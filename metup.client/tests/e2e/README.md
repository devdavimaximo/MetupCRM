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

## Pulos declarados

Nada aqui é silenciado: todo `test.skip` diz por que existe.

| Onde | Tamanho | Por quê |
|---|---|---|
| `dashboard-layout` › sem rolagem vertical | < 1600px | A regra vale para 1600×900 e 1920×1080; abaixo disso a tela pode rolar. |
| `dashboard-layout` › tabela de destaques | ≠ 1366px | A folga de rolagem que sobrou é específica dessa faixa (pendência da P1, teto de 60px para não piorar). |
| `dashboard-mobile` › o arquivo inteiro | ≥ 768px | Abaixo de `md` o dashboard monta **outra árvore** (item 26); as asserções de ordem não valem no desktop. |

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
