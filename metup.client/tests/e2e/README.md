# Suíte de ponta a ponta do dashboard

Cobre o que o teste unitário não alcança: layout em quatro tamanhos de tela, foco e teclado, e o
comportamento das quatro fontes de dado do dashboard (panorama, fila de tarefas, feed e
notificações) quando elas demoram, falham ou chegam fora de ordem.

## Como rodar

```bash
cd metup.client
npx playwright install chromium   # só na primeira vez
npm run test:e2e                  # os quatro tamanhos
npm run test:e2e -- --project=1600x900          # um tamanho só
npm run test:e2e -- dashboard-period            # um arquivo
npm run test:e2e:ui                             # modo interativo
```

O `playwright.config.ts` sobe o `npm run dev` sozinho (e reaproveita um que já esteja rodando).
**O back-end não precisa estar de pé:** toda a API é dublada por `page.route`.

## Como o cenário é montado

Nenhum mock vive dentro do app. Quem decide o que a API responde é o teste:

```ts
import { data, expect, gotoDashboard, installApi, problem, test } from "./fixtures/app"

test("...", async ({ page }) => {
  await installApi(page, {
    overview: data.overview({ revenue: { current: 0, previous: 0 } }),
    summary: problem("Suas tarefas não responderam.", 503),
  })
  await gotoDashboard(page)
})
```

- `fixtures/data.ts` — os corpos JSON, um por entidade, montados por função com `patch`. O "hoje" de
  todo cenário é fixo (`data.TODAY`), para rótulo de data e janela de previsão não mudarem com o dia.
- `fixtures/app.ts` — `installApi` (sessão + rotas), `gotoDashboard`, `problem` (resposta de erro no
  formato que o `apiFetch` traduz) e a lista de caminhos dublados (`ApiPath`).

Cada rota aceita **um corpo** (JSON devolvido sempre) ou **uma função de rota**, para variar por
chamada — falhar até o teste liberar, atrasar a resposta, conferir o que foi pedido. Uma chamada de
API que o cenário não previu responde **501**, para o teste falhar alto em vez de vazar para a API
real.

### Adicionar um cenário

1. Precisa de um dado novo? Acrescente o campo em `fixtures/data.ts` (junto do DTO a que ele
   pertence), nunca inline no teste.
2. Precisa de uma rota nova? Some o caminho em `ApiPath`/`ROUTES` e o padrão em `defaults()`.
3. O teste descreve **comportamento**, não implementação: prefira papel e nome acessível
   (`getByRole("button", { name: ... })`) a classe CSS.
4. Espere por **estado**, nunca por tempo: `expect(...).toBeVisible()`, `expect.poll(...)`. Não use
   `waitForTimeout`.

## Coisas que mordem

- **O React monta duas vezes em desenvolvimento.** Um dublê do tipo "falha só na primeira chamada"
  nunca chega à tela. Faça a resposta depender do que foi **pedido** (a janela em `days`/`from`, o
  `cursor`) ou de uma variável que o próprio teste vira quando quiser.
- **O hub SignalR não sobe aqui** (`/hubs/dashboard` é abortado). O dashboard fica em
  "Reconectando…" e revalida ao voltar o foco da aba — o mesmo caminho de código de um evento do
  hub (debounce, recarga em segundo plano, realce). `dashboard-realtime.spec.ts` dispara esse
  caminho com `document.dispatchEvent(new Event("visibilitychange"))`. Um teste de conexão real do
  hub é item de back-end, na onda 3B.
- **O feed carrega sozinho ao rolar.** Clicar em "Carregar mais" disputa com o carregamento do
  sentinela e solta o botão do DOM; o teste rola até o fim, que é o mesmo caminho.
- **Ambiguidade de nome acessível:** "Mês anterior" é atalho de período *e* navegação do calendário;
  "Buscar no CRM" é o diálogo *e* o campo. Sempre dê escopo (`getByRole("list", { name: "Atalhos" })`).

## Tela de Tarefas (`tasks-page.spec.ts`)

A API de tarefas é dublada **com estado** por `TaskStore` (`fixtures/tasks.ts`): concluir, cancelar,
reagendar e criar mudam a loja, e a listagem e o resumo seguintes refletem isso, com recortes de
prazo iguais aos do servidor. `gotoTasks(page, "&aba=hoje")` congela o relógio do navegador em
`NOW` (terça, 15/09/2026, 15:00) com `page.clock.setFixedTime`.

```ts
const store = new TaskStore()
await installApi(page, { ...store.routes(), createTask: problem("Negócio fechado.", 409) })
await gotoTasks(page)
expect(store.listRequests.at(-1)?.get("scope")).toBe("All") // o que a tela pediu
```

## Pipeline (`pipeline-page.spec.ts`)

O quadro é dublado **com estado** por `BoardStore` (`fixtures/pipeline.ts`): mover, fechar e o 409
mudam a loja, e o quadro e as colunas seguintes refletem isso (contagem e soma da coluna inteira,
20 por página, Fechados só no período). `gotoPipeline(page, "&etapa=Proposta")` congela o relógio em
`NOW`. Para simular concorrência: `store.movedByOther.set("q-2", "Proposta")` (o próximo pedido dá
409) e `store.failNextStage = true` (500).

- **Arrasto com mouse:** `page.mouse` (apertar, passar dos 6px, mover, soltar). As zonas de Fechados
  só existem **durante** o arrasto, então o alvo é resolvido depois de começar (`dragWithMouse`).
- **Teclado:** foco no cartão, `Space`, `ArrowRight`, `Space`. Os anúncios saem no
  `[id^="DndLiveRegion"]` do `@dnd-kit`. Entre o `Space` e a primeira seta vai um `nextTick(page)`:
  o sensor assina as setas num `setTimeout(0)` (de propósito, para o mesmo Espaço não soltar o
  cartão), e um `setTimeout(0)` agendado depois sai só com ele pronto. Nada de folga em ms.
- **Toque:** `dragWithTouch` e `swipe` falam CDP (`Input.dispatchTouchEvent`), porque o
  `page.touchscreen` só sabe `tap`. Pressionar dura 350 ms: é o contrato do sensor (250 ms), não
  folga. O ponto de toque precisa estar **dentro da janela** (role o alvo antes).
- **Tempo real:** `installHub(page)` (`fixtures/hub.ts`), instalado **depois** do `installApi`,
  responde o `negotiate` e fala o protocolo JSON do SignalR por `page.routeWebSocket`: o cliente
  de verdade conecta, e `hub.send({ type, dealId, ownerUserId })` empurra um evento. Mude a
  `BoardStore` antes de mandar o evento: a tela relê o cartão por `GET /card`. `hub.drop()`
  derruba a conexão (o indicador vai a "Reconectando…" e volta sozinho).

## OneDrive: specs que "somem"

Com o repositório no OneDrive, os arquivos viram *reparse points* — **inclusive com a pasta fixada
como "Sempre manter neste dispositivo"** (testado na PL4: o atributo `P` fica, a etiqueta de nuvem
também). O `readdir` do Node vê o arquivo como link simbólico, e o Playwright **não lista** esses
specs, sem erro nenhum ("0 tests in 0 files"). O `lstat` não acusa nada, por isso a detecção é pela
entrada do diretório.

**Resolvido no `npm run test:e2e`:** o `pretest:e2e` (`scripts/e2e-onedrive.mjs`) regrava como
arquivo comum tudo de `tests/e2e` que virou reparse point e confere que todo `*.spec.ts` do disco
ficou legível; se não ficou, **falha** com a lista dos arquivos. Para só regravar:
`npm run test:e2e:fix`. Rodando `npx playwright test` direto, a guarda não roda — use o script.

## Pulos declarados

Nada aqui é silenciado: todo `test.skip` diz por que existe.

| Onde | Tamanho | Por quê |
|---|---|---|
| `dashboard-layout` › sem rolagem vertical | < 1600px | A regra vale para 1600×900 e 1920×1080; abaixo disso a tela pode rolar. |
| `dashboard-layout` › tabela de destaques | ≠ 1366px | 1366px é a faixa mais estreita em que a tabela existe (no celular ela vira cards). Desde a onda 4A o teto é 0: nenhuma rolagem horizontal. |
| `tasks-page` › cabeçalho Prazo | < 768px | Cabeçalhos de coluna só existem na tabela. |
| `tasks-page` › 1366×768 sem rolagem | ≠ 1366px | Faixa mais estreita com tabela. |
| `tasks-page` › 390×844 cards | ≥ 768px | Cards só abaixo de `md`. |
| `dashboard-mobile` › o arquivo inteiro | ≥ 768px | Abaixo de `md` o dashboard monta **outra árvore** (item 26); as asserções de ordem não valem no desktop. |
| `pipeline-page` › teclado: pega/solta e Esc (2) | < 768px | Limite da tela: uma coluna por vez, e o arrasto por teclado não tem vizinha (as abas não são alvo de teclado). No celular o teclado usa ⋮ / `M`. |
| `pipeline-page` › soltar em Fechados (4) | < 768px | Limite da tela: Fechados é uma aba à parte, então as zonas Ganho/Perdido nunca estão na tela junto com um cartão aberto. O fechamento no celular é pelo ⋮. |
| `pipeline-page` › tempo real: mover, filtro, arrasto (3) | < 768px | Uma coluna por vez; as mesmas regras estão no Vitest (`board-realtime.test.ts`). O eco da própria ação e a reconexão rodam no celular. |
| `pipeline-page` › atalhos e teclado (6) | < 768px | Teclado físico; a folha de atalhos some no celular. |
| `pipeline-page` › celular (5) | ≥ 768px | Acabamento só abaixo de `md`. |

> PL4: o arrasto por toque (pressionar e soltar na aba), soltar na mesma coluna, "+ Adicionar", o
> `×` dos KPIs, o funil e o "Ver detalhes" deixaram de pular no celular.

> O pulo do tooltip do nó Ganhos saiu na onda 3B: o item 26 deu ao `Hint` a abertura por toque
> (`openOnTap`), e o cenário passou a valer em todas as larguras.

## O celular tem uma árvore própria

Abaixo de 768px o `DashboardPage` renderiza `MobileGrid` em vez de `MainGrid` + `SideColumn`, via
`useMediaQuery`. Isso é escolha de **árvore**, não de estilo: a ordem de leitura muda, e `order` do
CSS deixaria o teclado e o leitor de tela na ordem antiga.

Consequência para quem escreve teste: **um seletor que existe no desktop pode não existir em
390×844, e vice-versa.** Casos concretos já vividos:

- Não há `<table>` no celular — os destaques são cards.
- A frase do erro do panorama muda ("disponíveis **ao lado**" no desktop, "**acima**" no celular);
  `dashboard-errors` casa as duas com regex.
- Um cenário que dependa da ordem dos painéis pertence a `dashboard-mobile.spec.ts`, não aos outros.
