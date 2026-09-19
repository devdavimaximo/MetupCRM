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
  `[id^="DndLiveRegion"]` do `@dnd-kit`.

## OneDrive: specs que "somem"

Com o repositório no OneDrive, arquivos só na nuvem viram *reparse points*. O Node os vê como
symlink, e o Playwright **não lista** esses specs, sem erro nenhum (`--list` mostra menos arquivos).
Se o total cair, marque a pasta como "Sempre manter neste dispositivo" ou regrave os arquivos.

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
| `pipeline-page` › arrastar com mouse, mesma coluna, teclado (2) | < 768px | No celular é uma coluna por vez: não há coluna vizinha na tela, e o arrasto por toque (pressionar 250 ms) não é dublável com fidelidade. O menu `⋮ > Mover para…` é testado em todas as larguras. |
| `pipeline-page` › soltar em Fechados (4) | < 768px | As zonas Ganho/Perdido aparecem durante o arrasto com mouse. |
| `pipeline-page` › + Adicionar da coluna | < 768px | No celular o CTA é o FAB (testado em "Novo negócio"). |

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
