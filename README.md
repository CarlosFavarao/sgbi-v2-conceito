# SGBI v2

Reescrita do **SGBI** (Business Intelligence do VX) em Next.js 16. Hoje roda em **modo conceito** (D47): os dados são simulados (o **Mercado Teste**, com 3 filiais) e o projeto **não acessa banco nem API externa**; qualquer usuário e senha entram. Os dados entram por uma interface única, pensada para receber dados externos (ver [`docs/dados-externos.md`](docs/dados-externos.md)). Telas prontas:

- **Painel Executivo** (`/`): indicadores de venda, margem, despesas, metas, compras e cancelamentos em uma única tela, sem rolagem. O layout é personalizável (lápis no cabeçalho: arrastar, redimensionar e ocultar cards, salvo no navegador).
- **Metas** (`/metas`): cumprimento das metas de venda e de margem por dia, semana, quinzena, mês e ano, com projeção de fechamento e acompanhamento por departamento, grupo e subgrupo.
- **Financeiro · Fluxo de Caixa** (`/financeiro`): entradas (cartões e contas a receber) e saídas (contas a pagar) realizadas e previstas, compromissos a vencer e prazos médios.
- **Financeiro · DFC** (`/financeiro/dfc`): demonstração dos fluxos de caixa pelo método direto (operacional, investimento e financiamento), com saldo inicial e final, evolução de 12 meses, composição, saldo por conta e maiores movimentações.
- **Vendas** (`/vendas`): desempenho comercial por departamento, grupo e subgrupo, cupons e ticket médio, Curva ABC e listas de produtos.

O acesso é pela tela de login (`/login`), que no modo conceito aceita **qualquer usuário e senha** (D47); as permissões por usuário ainda estão em aberto (P59). O BI também atende Cloud e Fivewin: o card cujo dado a plataforma não envia aparece desabilitado (D46; `PLATAFORMA` no `.env` simula uma delas).

> **Status:** conceito (dados simulados). As decisões tomadas e as perguntas ainda em aberto estão em [`docs/decisoes-e-pendencias.md`](docs/decisoes-e-pendencias.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `cacheComponents`), React 19, TypeScript |
| Estilo | Tailwind CSS v4 com os tokens do BI antigo, tema claro e escuro (`next-themes`), fonte Inter |
| Dados | Simulação do **Mercado Teste** (`src/dados/mock`), atrás da interface `FonteDeDados` (`src/dados`); sem banco |
| Dados no cliente | **TanStack React Query v5** |
| Gráficos | **Recharts v3** |
| Ícones | **Material Design Icons** (`@mdi/react` + `@mdi/js`) |
| Componentes | Radix UI (Select, Popover, Checkbox), `react-day-picker` (calendário) e `date-fns` |
| Sessão | Cookie com JWT assinado (`jose`), conferido no `src/proxy.ts` e nas rotas; qualquer usuário e senha entram |

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- Nada mais: sem banco, sem API externa e sem `.env` obrigatório

## Como rodar

```bash
nvm use
npm install
npm run dev
```

Abra http://localhost:3000. Pela rede interna, o `next dev` aceita os endereços `172.16.*.*` (configurado em `allowedDevOrigins`, no `next.config.ts`).

### Variáveis de ambiente (todas opcionais)

| Variável | Descrição |
|---|---|
| `JWT_SECRET` | Assina o cookie de sessão do login; mínimo 32 caracteres (`openssl rand -base64 32`). Sem ela, usa um segredo fixo de demonstração |
| `CLIENT_SLUG` | Opcional: dá um cookie próprio a cada SGBI quando há mais de um no mesmo endereço |
| `PLATAFORMA` | Opcional, para testes: força `vx`, `cloud` ou `fivewin` e mostra os cards indisponíveis nela |

O `.env.local` (não versionado) só é preciso para usar alguma delas. As variáveis são lidas só no servidor (`src/lib/env.ts`) e nunca podem usar o prefixo `NEXT_PUBLIC_`.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes de regressão (Vitest), inclusive os da simulação de dados |

## Estrutura

```
src/
├── app/
│   ├── api/<tela>/**/route.ts   # Route Handlers: validam os parâmetros e chamam server/
│   ├── api/filiais/route.ts     # Filiais e datas carregadas (comum às telas)
│   ├── layout.tsx, providers.tsx, globals.css (tokens do tema)
│   ├── page.tsx                 # Painel Executivo
│   ├── financeiro/page.tsx      # Financeiro · Fluxo de Caixa
│   ├── financeiro/dfc/page.tsx  # Financeiro · DFC
│   ├── metas/page.tsx           # Metas
│   └── vendas/page.tsx          # Vendas
├── components/
│   ├── app-shell.tsx            # Barra lateral recolhível e menu do celular
│   ├── avisos.tsx               # Botão de avisos da barra lateral (useAvisos)
│   ├── filtros/                 # Barra de filtros e seletor de filiais
│   ├── kpi/                     # Card de KPI, variação e minigráfico
│   ├── charts/                  # Gráfico de evolução (atual × comparação)
│   └── ui/                      # Card, Select, Popover, Dialog, DateRangePicker,
│                                # LoadingOverlay, DataTable...
├── dados/                       # Fonte de dados (D47): interface FonteDeDados e a simulação do Mercado Teste (mock/)
├── features/
│   ├── painel-executivo/
│   ├── financeiro/
│   ├── metas/
│   └── vendas/
│       ├── server/              # Agrupa e compara as linhas da fonte de dados (server-only)
│       ├── queries.ts           # queryOptions do React Query
│       ├── compute.ts           # Cálculos puros da tela
│       ├── config.ts            # Regras de negócio ajustáveis
│       └── components/
├── lib/                         # Datas, formatação, cálculos, tipos dos filtros, API, CSV
└── server/                      # Validação de parâmetros, sessão e acesso (server-only)
docs/                            # Análises, decisões e mapeamentos
```

### Fluxo dos dados

```
Componente (useQuery) → /api/<tela>/... (route.ts) → features/<tela>/server/*.ts → dados (FonteDeDados) → simulação (Mercado Teste)
```

- Os dados são **simulados e determinísticos**: de 1º de janeiro do ano passado até ontem (D-1, calculado pela data de hoje), com as mesmas cifras a cada consulta. Detalhes e como receber dados externos: [`docs/dados-externos.md`](docs/dados-externos.md).
- Cada fonte de dados é uma consulta separada (`/series/[fonte]`), então cada card carrega de forma independente e mostra o próprio indicador de carregamento.

## Convenções

- **Uma pasta por tela** em `src/features/<tela>/`, com a mesma divisão do Painel Executivo. O que for usado por mais de uma tela fica em `src/lib/`, `src/components/` ou `src/server/`.
- **Visual do BI antigo:** azul `#4B8CFF`, cards `rounded-2xl`, fonte Inter. Use sempre as classes dos tokens (`bg-card`, `text-muted-foreground`...), nunca cores fixas, para funcionar nos dois temas.
- **Layout compacto:** a tela deve caber sem rolar em 1536 × 864. Verifique também em 1280, 1366 e 1920 px de largura.
- **Valores com 2 casas decimais** (moeda, %, p.p.) via `format.ts`.
- **Sem controles nativos** nos filtros (`<select>`, `<input type="date">`, checkbox): use os componentes de `src/components/ui/`.
- **Avisos** (dados incompletos, erros de carregamento) vão para o botão de avisos da barra lateral, com `useAvisos()`, e não para faixas no topo da tela.

Os detalhes ficam em [`CLAUDE.md`](CLAUDE.md), que também orienta o Claude Code neste projeto.

## Padrão de commit

Mesmo padrão do SGBI antigo, com o número da Ordem de Serviço:

```
1649584 - feat: Descrição curta da alteração
----------------------
- Item alterado
- Outro item alterado
----------------------
Ordem-Servico: SGPS-1649584
```

Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/decisoes-e-pendencias.md`](docs/decisoes-e-pendencias.md) | Decisões tomadas e pontos de alinhamento em aberto |
| [`docs/dados-externos.md`](docs/dados-externos.md) | Modo conceito: a interface de dados, o que cada método entrega e como é a simulação do Mercado Teste |
| [`docs/painel-executivo-poc.md`](docs/painel-executivo-poc.md) | Análise do BI antigo, tabelas, fonte de cada dado, riscos e implementação da POC |
| [`docs/financeiro.md`](docs/financeiro.md) | Fluxo de Caixa: fontes, blocos sem fonte, regras e implementação |
| [`docs/metas.md`](docs/metas.md) | Tela de Metas: fonte das metas, regras de cálculo, dados de homologação e implementação |
| [`docs/vendas.md`](docs/vendas.md) | Tela de Vendas: fonte de cada dado, desempenho das consultas e implementação |
| [`docs/api-externa-mapeamento.md`](docs/api-externa-mapeamento.md) | Rotas da API do VX usadas pelo BI antigo e impacto no v2 (o modo conceito não as usa) |

## Problemas conhecidos

- **CSS desatualizado no `next dev`:** às vezes o Turbopack continua servindo uma versão antiga do `globals.css`. Pare o servidor, apague `.next/dev/cache/turbopack` e suba de novo.
- **Dados simulados:** nada vem de um banco; os limites e problemas de homologação descritos em `docs/painel-executivo-poc.md` (metas e despesas incompletas, cupons lentos no `logpdv`) só voltam a valer com dados reais.
