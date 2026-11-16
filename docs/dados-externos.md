# Dados do BI no modo conceito (D47)

O SGBI v2 não consulta mais o banco do cliente nem a API do VX. Todo dado que as telas mostram entra por **uma interface só**, a `FonteDeDados` (`src/dados/tipos.ts`). Hoje ela é implementada por uma simulação (o **Mercado Teste**), e é nela que se liga uma fonte externa.

```
Componente (useQuery) → /api/<tela>/... (route.ts) → features/<tela>/server/*.ts → dados (FonteDeDados)
                                                                                      └─ src/dados/mock/  (Mercado Teste)
```

Os arquivos `features/<tela>/server/*.ts` agrupam, somam e comparam as linhas que a fonte devolve (o que antes era SQL); as regras de negócio continuam em `compute.ts` e `config.ts` de cada tela.

## Como receber dados externos

1. Implemente a interface `FonteDeDados` (por exemplo, lendo de uma API, de arquivos ou de outro banco). Cada método devolve linhas já filtradas por **filiais** e **período**, no formato de `src/dados/tipos.ts`.
2. Troque o valor exportado em `src/dados/index.ts` (`export const dados: FonteDeDados = ...`).
3. Rode `npm test`: os testes de `src/dados/mock/` mostram as propriedades que as telas esperam (ex.: a venda do PDV dos cupons bate com a da análise; as metas por nível fecham com a meta diária; o saldo das contas fecha com a DFC).

Tudo é **somente leitura** e roda só no servidor (`import "server-only"`). Datas em ISO `YYYY-MM-DD`; valores em reais.

## O que cada método entrega

| Método | Linhas | Telas que usam |
|---|---|---|
| `empresa()` | Nome fantasia, CNPJ e código do cliente | Login, subtítulo do Painel, barra lateral |
| `filiais()` | Código e descrição das filiais com movimento | Filtro de filiais de todas as telas |
| `periodoCarregado()` | Primeiro dia carregado e último dia **com venda** (`dataMaxima`, D-1) | "Dados até", calendário, período padrão |
| `hierarquia()` | Departamentos, grupos e subgrupos (códigos únicos em toda a hierarquia) | Painel, Vendas, Metas |
| `analise(periodo, lojas)` | Venda, custo e compra por **produto, filial e dia** (PDV e faturamento separados) e a quantidade vendida | Painel, Vendas, Metas |
| `cuponsDiarios(periodo, lojas)` | Venda do PDV, cupons e itens por filial e dia | Ticket médio, cupons e itens por cupom |
| `cuponsPorNivel(nivel, periodo, lojas)` | Cupons que tiveram ao menos um item do nível e itens do nível | Vendas (desempenho por departamento) |
| `cancelamentos`, `despesas` | Valor por filial e dia | Painel (cancelamentos e despesas) |
| `metasDiarias(periodo, lojas)` | Meta de venda e de lucro por filial e dia | Painel, Metas |
| `metasMensais(nivel, anoInicio, anoFim, lojas)` | Meta mensal por filial e departamento, grupo ou subgrupo | Metas |
| `cartoesPorVenda`, `cartoesPorVencimento` | Parcelas de cartão por dia da venda, empresa e vencimento, com valor bruto e líquido | Fluxo de Caixa, DFC |
| `titulosReceber`, `titulosPagar` | Títulos com emissão, vencimento e baixa (`null` = em aberto); os a pagar trazem a classificação (mercadoria ou despesa) e o grupo da despesa | Fluxo de Caixa, DFC |
| `vendasAVista(periodo, lojas)` | Dinheiro e Pix por filial e dia | Fluxo de Caixa, DFC |
| `lancamentosCaixa(periodo, lojas)` | Investimentos e financiamentos (imobilizado, veículos, captação, amortização e juros) | DFC |
| `saldos(data, lojas)` | Saldo de cada conta no fim do dia | Fluxo de Caixa, DFC |

Regras que as telas assumem:

- Só há dados até `dataMaxima`; baixas depois dela não existem (o título fica em aberto).
- `analise` traz uma linha por produto, filial e dia; as telas agrupam por dia, departamento, grupo, subgrupo ou produto.
- `titulosReceber` e `titulosPagar` aceitam `emissao` (títulos emitidos no período) ou `vencimentoOuBaixa` (vencidos ou baixados no período).
- A DFC confere `saldo inicial + geração líquida = saldo final`: o saldo das contas precisa refletir os mesmos recebimentos e pagamentos que a fonte devolve.

## O Mercado Teste (a simulação)

`src/dados/mock/`:

| Arquivo | O que define |
|---|---|
| `catalogo.ts` | A empresa, as 3 lojas e o porte de cada uma, os 8 departamentos, grupos, subgrupos e os 72 produtos (preço, margem, volume) |
| `vendas.ts` | Venda, custo, compra, cupons, cancelamentos, despesas fixas e metas |
| `financeiro.ts` | Cartões, contas a receber e a pagar, investimentos, financiamentos e saldos |
| `tempo.ts` | O relógio: o último dia é **ontem** (fuso de Brasília) e a carga começa em 1º de janeiro do ano anterior |
| `aleatorio.ts` | O sorteio determinístico (hash): a simulação não guarda nada e dá os mesmos números a cada consulta |

Para ajustar a demonstração: mude `EMPRESA` e `LOJAS` (nome, filiais e porte) ou `ESCALA_DE_VOLUME` (venda diária de todas as lojas) em `catalogo.ts`; os produtos e preços ficam no `CATALOGO` do mesmo arquivo, e os percentuais das despesas fixas em `DESPESAS_FIXAS` (`vendas.ts`).

A simulação foi calibrada para uma matriz com cerca de R$ 90 mil de venda por dia, margem bruta em torno de 30%, ticket médio perto de R$ 76, despesas perto de 17% da venda e metas que o realizado ora supera, ora não alcança.
