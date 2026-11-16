"use client";

import Icon from "@mdi/react";
import { mdiArrowBottomRight, mdiArrowTopRight, mdiChartBar, mdiDatabaseOutline, mdiSafe, mdiTableLarge } from "@mdi/js";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useAvisos } from "@/components/avisos";
import { BarraEdicao } from "@/components/layout/barra-edicao";
import { BlocoKpis, type ItemDoBloco } from "@/components/layout/bloco-kpis";
import { GradePersonalizavel } from "@/components/layout/grade-personalizavel";
import { useLayout } from "@/components/layout/use-layout";
import { FiliaisSelect } from "@/components/filtros/filiais-select";
import { Delta, KpiCard } from "@/components/kpi/kpi-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { filiaisQuery } from "@/lib/api";
import { variacao } from "@/lib/calc";
import { lastDayOfMonth, mesesDoPeriodo } from "@/lib/date";
import { formatData, formatMesAno, formatMoeda } from "@/lib/format";
import { financeiroQueries } from "../queries";
import type { Categoria } from "../compute";
import type { DfcMes, DfcResponse, LinhaDfc, Movimentacao } from "../types";
import { FONTES, LAYOUT_PADRAO, LIMITES, ROTULOS } from "../layout-dfc";
import { EvolucaoMensalChart } from "./cards-inferiores";
import { CategoriasCard } from "./categorias-card";
import { SaldoContasCard } from "./saldo-contas-card";

/**
 * DFC (método direto): o que entrou e saiu do caixa no mês, na data em que aconteceu, por atividade
 * (operacional, investimento e financiamento), contra o mês anterior ou o mesmo mês do ano anterior.
 * No modo conceito (D47) os valores vêm da simulação do Mercado Teste.
 */

type Comparacao = "mes-anterior" | "ano-anterior";
const COMPARACOES: { value: Comparacao; label: string }[] = [
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "ano-anterior", label: "Mesmo mês do ano anterior" },
];

type Linha = { id: LinhaDfc; label: string };

// Classes completas (o Tailwind não gera classes montadas dinamicamente).
const ATIVIDADES: {
  id: string;
  label: string;
  cor: string;
  grupos: { label: string | null; linhas: Linha[] }[];
}[] = [
  {
    id: "operacional",
    label: "1. Fluxo de Caixa das Atividades Operacionais",
    cor: "bg-summary-green-bg",
    grupos: [
      {
        label: "Entradas operacionais",
        linhas: [
          { id: "vendas-a-vista", label: "Recebimentos de vendas (dinheiro e Pix)" },
          { id: "cartoes", label: "Recebimentos de cartões" },
          { id: "clientes", label: "Recebimentos de clientes (títulos)" },
        ],
      },
      {
        label: "Saídas operacionais",
        linhas: [
          { id: "fornecedores", label: "Pagamentos a fornecedores (mercadorias)" },
          { id: "pessoal", label: "Despesas com pessoal" },
          { id: "operacionais", label: "Despesas operacionais (energia, água, manutenção…)" },
          { id: "impostos", label: "Impostos e taxas" },
        ],
      },
    ],
  },
  {
    id: "investimento",
    label: "2. Fluxo de Caixa das Atividades de Investimento",
    cor: "bg-summary-blue-bg",
    grupos: [
      {
        label: null,
        linhas: [
          { id: "imobilizado", label: "Aquisição de imobilizado (equipamentos, reformas)" },
          { id: "veiculos", label: "Aquisição de veículos" },
        ],
      },
    ],
  },
  {
    id: "financiamento",
    label: "3. Fluxo de Caixa das Atividades de Financiamento",
    cor: "bg-summary-purple-bg",
    grupos: [
      {
        label: null,
        linhas: [
          { id: "captacao", label: "Captação de empréstimos" },
          { id: "amortizacao", label: "Amortização de empréstimos (principal)" },
          { id: "juros", label: "Pagamento de juros" },
        ],
      },
    ],
  },
];

/** Linha da tabela. `valor` lê a linha de um mês; `entrada` diz se aumentar é bom (nas saídas, aumentar é ruim). */
type LinhaTabela =
  | { tipo: "atividade"; chave: string; label: string; cor: string; valor: (d: DfcMes) => number }
  | { tipo: "grupo"; chave: string; label: string }
  | { tipo: "linha"; chave: string; label: string; valor: (d: DfcMes) => number; entrada: boolean }
  | { tipo: "total"; chave: string; label: string; valor: (d: DfcMes) => number };

const LINHAS_TABELA: LinhaTabela[] = ATIVIDADES.flatMap((a) => [
  {
    tipo: "atividade" as const,
    chave: a.id,
    label: a.label,
    cor: a.cor,
    valor: (d: DfcMes) => a.grupos.flatMap((g) => g.linhas).reduce((s, l) => s + d.linhas[l.id], 0),
  },
  ...a.grupos.flatMap((g) => [
    ...(g.label ? [{ tipo: "grupo" as const, chave: `${a.id}-${g.label}`, label: g.label }] : []),
    ...g.linhas.map((l) => ({
      tipo: "linha" as const,
      chave: l.id,
      label: l.label,
      valor: (d: DfcMes) => d.linhas[l.id],
      // Captação é a única linha de financiamento que entra; as demais saem.
      entrada: ["vendas-a-vista", "cartoes", "clientes", "captacao"].includes(l.id),
    })),
  ]),
]);

const LINHAS_TOTAIS: LinhaTabela[] = [
  { tipo: "total", chave: "geracao", label: "Geração Líquida de Caixa (1 + 2 + 3)", valor: (d) => d.geracao },
  { tipo: "total", chave: "saldo-inicial", label: "Saldo Inicial de Caixa e Equivalentes", valor: (d) => d.saldoInicial },
  { tipo: "total", chave: "saldo-final", label: "Saldo Final de Caixa e Equivalentes", valor: (d) => d.saldoFinal },
];

const vazio = <span className="text-muted-foreground">—</span>;

/** Valor de uma linha em um dos meses; a variação compara o tamanho do valor nas linhas e o valor com sinal nos subtotais. */
function celulaDfc(l: LinhaTabela, dfc: DfcResponse | undefined, coluna: "atual" | "comparacao" | "variacao"): ReactNode {
  if (l.tipo === "grupo") return null;
  if (!dfc) return vazio;
  if (coluna === "variacao") {
    const [a, b] = [l.valor(dfc.atual), l.valor(dfc.comparacao)];
    return l.tipo === "linha" ? (
      <Delta value={variacao(Math.abs(a), Math.abs(b))} unidade="%" maiorMelhor={l.entrada} />
    ) : (
      <Delta value={variacao(a, b)} unidade="%" maiorMelhor />
    );
  }
  const v = l.valor(dfc[coluna]);
  return <span className={l.tipo === "linha" && v < 0 ? "text-error" : ""}>{formatMoeda(v)}</span>;
}

function colunasDfc(dfc: DfcResponse | undefined, mes: string, mesComparacao: string): Coluna<LinhaTabela>[] {
  return [
    {
      id: "categoria",
      titulo: "Categoria",
      align: "left",
      className: "max-w-72 truncate",
      cell: (l) => (
        <span className={l.tipo === "linha" ? "pl-4" : ""} title={l.label}>
          {l.label}
        </span>
      ),
    },
    { id: "mes", titulo: formatMesAno(mes), cell: (l) => celulaDfc(l, dfc, "atual") },
    { id: "comparacao", titulo: formatMesAno(mesComparacao), cell: (l) => celulaDfc(l, dfc, "comparacao") },
    { id: "variacao", titulo: "Variação", cell: (l) => celulaDfc(l, dfc, "variacao") },
  ];
}

function DfcTabela({
  dfc,
  mes,
  mesComparacao,
  carregando,
}: {
  dfc: DfcResponse | undefined;
  mes: string;
  mesComparacao: string;
  carregando: boolean;
}) {
  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon path={mdiTableLarge} size={0.9} className="text-primary" aria-hidden />
          DFC Gerencial
        </CardTitle>
      </CardHeader>
      <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
          <DataTable
            colunas={colunasDfc(dfc, mes, mesComparacao)}
            linhas={LINHAS_TABELA}
            chave={(l) => l.chave}
            total={LINHAS_TOTAIS}
            classeLinha={(l) => (l.tipo === "atividade" ? `font-semibold ${l.cor}` : "")}
            linhaInteira={(l) =>
              l.tipo === "grupo" ? (
                <span className="block py-1 pl-4 pr-2.5 text-xs font-semibold text-muted-foreground">{l.label}</span>
              ) : null
            }
          />
        </div>
        <LoadingOverlay ativo={carregando} className="rounded-b-2xl" />
      </div>
    </Card>
  );
}

/** Soma `linhas` do mês nas categorias de um lado (entradas ou saídas), com a participação de cada uma. */
function categoriasDe(d: DfcMes | undefined, lado: "entrada" | "saida") {
  const itens = ATIVIDADES.flatMap((a) => a.grupos.flatMap((g) => g.linhas))
    .map((l) => ({ categoria: l.label, valor: lado === "entrada" ? d?.linhas[l.id] ?? 0 : -(d?.linhas[l.id] ?? 0) }))
    .filter((c) => c.valor > 0);
  const total = itens.reduce((s, c) => s + c.valor, 0);
  const categorias: Categoria[] = itens
    .map((c) => ({ ...c, participacao: total ? (c.valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
  return { total, categorias };
}

function MovimentacoesCard({ movimentacoes, carregando }: { movimentacoes: Movimentacao[]; carregando: boolean }) {
  const colunas: Coluna<Movimentacao>[] = [
    { id: "data", titulo: "Data", align: "left", cell: (m) => formatData(m.data), ordenar: (m) => m.data },
    { id: "descricao", titulo: "Descrição", align: "left", className: "max-w-60 truncate", cell: (m) => m.descricao, ordenar: (m) => m.descricao },
    { id: "conta", titulo: "Conta", align: "left", className: "max-w-44 truncate", cell: (m) => m.conta, ordenar: (m) => m.conta },
    {
      id: "valor",
      titulo: "Valor",
      cell: (m) => (
        <span className={m.tipo === "entrada" ? "text-success" : "text-error"}>
          {m.tipo === "entrada" ? "+" : "-"}
          {formatMoeda(m.valor)}
        </span>
      ),
      ordenar: (m) => (m.tipo === "entrada" ? m.valor : -m.valor),
    },
  ];
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Movimentações Relevantes do Período</CardTitle>
      </CardHeader>
      <div className="relative min-h-0 flex-1 overflow-auto px-3 pb-3 pt-1">
        <DataTable
          colunas={colunas}
          linhas={movimentacoes}
          chave={(m) => `${m.data}|${m.descricao}|${m.tipo}|${m.valor}`}
          densidade="compacto"
          vazio={carregando ? null : "Sem movimentações no mês."}
        />
        <LoadingOverlay ativo={carregando} className="rounded-b-2xl" />
      </div>
    </Card>
  );
}

export function Dfc() {
  const filiais = useQuery(filiaisQuery());
  const [mesEscolhido, setMes] = useState<string | null>(null);
  const [comparacao, setComparacao] = useState<Comparacao>("mes-anterior");
  const [filiaisEscolhidas, setFiliais] = useState<number[] | null>(null);

  const dados = filiais.data;
  const meses =
    dados?.dataMinima && dados.dataMaxima ? mesesDoPeriodo({ inicio: dados.dataMinima, fim: dados.dataMaxima }) : [];
  const mes = mesEscolhido ?? meses.at(-1) ?? "";
  const [a, m] = mes ? mes.split("-").map(Number) : [0, 0];
  const mesComparacao = mes
    ? new Date(Date.UTC(a, m - 1 - (comparacao === "mes-anterior" ? 1 : 12), 1)).toISOString().slice(0, 7)
    : "";
  const codigosFiliais = filiaisEscolhidas ?? dados?.filiais.map((f) => f.codigo) ?? [];

  const dfcQuery = useQuery(financeiroQueries.dfc({ filiais: codigosFiliais }, mes, mesComparacao));
  const dfc = dfcQuery.data;
  const carregando = dfcQuery.isPending || dfcQuery.isPlaceholderData;

  useAvisos(
    "dfc",
    dfcQuery.isError
      ? [
          {
            id: "erro-carregamento",
            nivel: "erro",
            titulo: "Não foi possível carregar a DFC",
            detalhes: [dfcQuery.error.message],
            acao: { label: "Tentar novamente", onClick: () => void dfcQuery.refetch() },
          },
        ]
      : [],
  );

  const grade = useLayout("dfc", LAYOUT_PADRAO, LIMITES);

  const vs = (valor: number | undefined) =>
    valor == null ? null : (
      <span className="whitespace-nowrap tabular-nums">
        vs {formatMoeda(valor)} ({formatMesAno(mesComparacao)})
      </span>
    );
  const comparar = (valor: (d: DfcMes) => number, maiorMelhor: boolean, magnitude = false) =>
    dfc && (
      <>
        <Delta
          value={
            magnitude
              ? variacao(Math.abs(valor(dfc.atual)), Math.abs(valor(dfc.comparacao)))
              : variacao(valor(dfc.atual), valor(dfc.comparacao))
          }
          unidade="%"
          maiorMelhor={maiorMelhor}
        />
        {vs(magnitude ? Math.abs(valor(dfc.comparacao)) : valor(dfc.comparacao))}
      </>
    );

  const kpis: ItemDoBloco[] = [
    {
      id: "saldo-inicial",
      titulo: "Saldo Inicial de Caixa",
      node: (
        <KpiCard
          titulo="Saldo Inicial de Caixa"
          ajuda="Saldo das contas bancárias, aplicações e do cofre no último dia do mês anterior."
          icone={mdiDatabaseOutline}
          tom="blue"
          carregando={carregando}
          valor={formatMoeda(dfc?.atual.saldoInicial ?? 0)}
          linhas={comparar((d) => d.saldoInicial, true)}
        />
      ),
    },
    {
      id: "entradas",
      titulo: "Entradas de Caixa",
      node: (
        <KpiCard
          titulo="Entradas de Caixa"
          ajuda="Recebimentos efetivos do mês: vendas à vista, cartões liquidados, títulos recebidos e empréstimos captados."
          icone={mdiArrowTopRight}
          tom="green"
          carregando={carregando}
          valor={formatMoeda(dfc?.atual.entradas ?? 0)}
          linhas={comparar((d) => d.entradas, true)}
        />
      ),
    },
    {
      id: "saidas",
      titulo: "Saídas de Caixa",
      node: (
        <KpiCard
          titulo="Saídas de Caixa"
          ajuda="Pagamentos efetivos do mês: fornecedores, pessoal, despesas, impostos, investimentos e empréstimos."
          icone={mdiArrowBottomRight}
          tom="coral"
          carregando={carregando}
          valor={formatMoeda(-(dfc?.atual.saidas ?? 0))}
          linhas={comparar((d) => d.saidas, false, true)}
        />
      ),
    },
    {
      id: "geracao",
      titulo: "Geração Líquida de Caixa",
      node: (
        <KpiCard
          titulo="Geração Líquida de Caixa"
          ajuda="Entradas menos saídas das três atividades."
          icone={mdiChartBar}
          tom="teal"
          carregando={carregando}
          valor={formatMoeda(dfc?.atual.geracao ?? 0)}
          linhas={comparar((d) => d.geracao, true)}
        />
      ),
    },
    {
      id: "saldo-final",
      titulo: "Saldo Final de Caixa",
      node: (
        <KpiCard
          titulo="Saldo Final de Caixa"
          ajuda="Saldo inicial + geração líquida."
          icone={mdiSafe}
          tom="purple"
          carregando={carregando}
          valor={formatMoeda(dfc?.atual.saldoFinal ?? 0)}
          linhas={comparar((d) => d.saldoFinal, true)}
        />
      ),
    },
  ];

  const cabecalho = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Financeiro <span className="text-base font-medium text-muted-foreground">· DFC</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {mes
              ? `Demonstração dos Fluxos de Caixa · ${formatMesAno(mes)} vs ${formatMesAno(mesComparacao)}${
                  dfc && dfc.atual.periodo.fim !== lastDayOfMonth(dfc.atual.periodo.inicio)
                    ? ` · dias 1 a ${Number(dfc.atual.periodo.fim.slice(8))} de cada mês`
                    : ""
                }`
              : "Demonstração dos Fluxos de Caixa"}
          </p>
        </div>
      </div>
      {dados && mes ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Período">
            <Select
              aria-label="Mês"
              className="w-36"
              value={mes}
              options={[...meses].reverse().map((x) => ({ value: x, label: formatMesAno(x) }))}
              onValueChange={setMes}
            />
          </Field>
          <Field label="Comparar com">
            <Select
              aria-label="Comparar com"
              className="w-52"
              value={comparacao}
              options={COMPARACOES}
              onValueChange={setComparacao}
            />
          </Field>
          <Field label="Filial">
            <FiliaisSelect filiais={dados.filiais} value={codigosFiliais} onChange={setFiliais} />
          </Field>
          <BarraEdicao
            grade={grade}
            rotulos={ROTULOS}
            rotulosBlocos={{
              kpis: { titulo: "Indicadores", itens: Object.fromEntries(kpis.map((k) => [k.id, k.titulo])) },
            }}
          />
        </div>
      ) : (
        <div className="flex h-14 items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-5 text-primary" />
          Carregando filtros…
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-2.5">
      {cabecalho}

      <GradePersonalizavel
        fontes={FONTES}
        grade={grade}
        rotulos={ROTULOS}
        blocos={["kpis"]}
        cards={{
          kpis: <BlocoKpis fontes={FONTES} grade={grade} bloco="kpis" itens={kpis} maxColunas={5} />,
          tabela: <DfcTabela dfc={dfc} mes={mes || "2000-01"} mesComparacao={mesComparacao || "2000-01"} carregando={carregando} />,
          evolucao: (
            <EvolucaoMensalChart
              titulo="Evolução da Geração de Caixa · 12 meses"
              descricao="Entradas, saídas e geração líquida de caixa de cada um dos 12 meses até o mês escolhido."
              pontos={dfc?.evolucao ?? []}
              carregando={carregando}
            />
          ),
          composicao: (
            <CategoriasCard
              titulo="Composição das Entradas e Saídas"
              entradas={categoriasDe(dfc?.atual, "entrada")}
              saidas={categoriasDe(dfc?.atual, "saida")}
              carregando={carregando}
            />
          ),
          "saldo-conta": (
            <SaldoContasCard
              titulo="Saldo por Conta Financeira"
              saldos={dfc && { contas: dfc.contas, total: dfc.atual.saldoFinal }}
              carregando={carregando}
            />
          ),
          movimentacoes: <MovimentacoesCard movimentacoes={dfc?.movimentacoes ?? []} carregando={carregando} />,
        }}
      />
    </div>
  );
}
