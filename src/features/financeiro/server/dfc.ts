import "server-only";

import { dados } from "@/dados";
import { addDays, lastDayOfMonth, mesesDoPeriodo } from "@/lib/date";
import { agrupar, somar } from "@/server/origem";
import type { DfcMes, DfcResponse, LinhaDfc, Movimentacao, Periodo } from "../types";
import { getSaldos } from "./data";

/**
 * DFC pelo método direto (D41, D47): o que entrou e saiu do caixa no mês, na data
 * em que aconteceu. Entradas: vendas à vista (dinheiro e Pix), cartões liquidados e
 * títulos recebidos. Saídas: títulos pagos (fornecedores e despesas por grupo),
 * investimentos e financiamentos. O saldo inicial é o das contas no dia anterior ao
 * mês e o final, o do último dia, então saldo inicial + geração = saldo final.
 */

const dentro = (data: string | null, p: Periodo) => !!data && data >= p.inicio && data <= p.fim;

/**
 * Do primeiro dia do mês até o último dia do mês ou o último dia com dados. Com `ateODia`, só até esse dia do mês
 * (a comparação de um mês em andamento usa os mesmos dias do outro mês).
 */
function periodoDoMes(mes: string, ateODia?: number): Periodo {
  const { dataMaxima } = dados.periodoCarregado();
  const ultimo = lastDayOfMonth(`${mes}-01`);
  const limite = ateODia ? `${mes}-${String(Math.min(ateODia, Number(ultimo.slice(8)))).padStart(2, "0")}` : ultimo;
  const fim = [limite, ultimo, dataMaxima].reduce((a, b) => (a < b ? a : b));
  return { inicio: `${mes}-01`, fim };
}

const cache = new Map<string, DfcMes>();

export async function dfcDoMes(mes: string, lojas: number[], ateODia?: number): Promise<DfcMes> {
  const periodo = periodoDoMes(mes, ateODia);
  const chave = `${mes}|${lojas.join(",")}|${periodo.fim}`;
  const guardado = cache.get(chave);
  if (guardado) return guardado;

  const pagos = dados.titulosPagar(lojas, { vencimentoOuBaixa: periodo }).filter((t) => dentro(t.pagamento, periodo));
  const lancamentos = dados.lancamentosCaixa(periodo, lojas);
  const porGrupo = (grupo: string) => somar(pagos.filter((t) => t.grupoDespesa === grupo), (t) => t.valorPago ?? 0);
  const lancado = (categoria: string) => somar(lancamentos.filter((l) => l.categoria === categoria), (l) => l.valor);

  const linhas: Record<LinhaDfc, number> = {
    "vendas-a-vista": somar(dados.vendasAVista(periodo, lojas), (v) => v.valor),
    cartoes: somar(dados.cartoesPorVencimento(periodo, lojas), (c) => c.valorLiquido),
    clientes: somar(
      dados.titulosReceber(lojas, { vencimentoOuBaixa: periodo }).filter((t) => dentro(t.recebimento, periodo)),
      (t) => t.valorRecebido ?? 0,
    ),
    fornecedores: -somar(pagos.filter((t) => t.classificacao === "M"), (t) => t.valorPago ?? 0),
    pessoal: -porGrupo("pessoal"),
    operacionais: -porGrupo("operacional"),
    impostos: -porGrupo("impostos"),
    imobilizado: -lancado("imobilizado"),
    veiculos: -lancado("veiculos"),
    captacao: lancado("captacao"),
    amortizacao: -lancado("amortizacao"),
    juros: -lancado("juros"),
  };

  const valores = Object.values(linhas);
  const entradas = somar(valores.filter((v) => v > 0), (v) => v);
  const saidas = somar(valores.filter((v) => v < 0), (v) => v);
  const [inicial, final] = await Promise.all([
    getSaldos(addDays(periodo.inicio, -1), lojas),
    getSaldos(periodo.fim, lojas),
  ]);

  const resultado: DfcMes = {
    mes,
    periodo,
    linhas,
    entradas,
    saidas,
    geracao: entradas + saidas,
    saldoInicial: inicial.total,
    saldoFinal: final.total,
  };
  cache.set(chave, resultado);
  return resultado;
}

const mesesAntes = (mes: string, n: number) => {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m - 1 - n, 1)).toISOString().slice(0, 7);
};

const CONTA_BANCO = "Banco do Brasil · C/C";
const CONTA_CAIXA = "Caixa Econômica · C/C";

/** As maiores entradas e saídas do mês, com a conta por onde passaram. */
function maioresMovimentacoes(periodo: Periodo, lojas: number[]): Movimentacao[] {
  const entradas: Movimentacao[] = [];
  const saidas: Movimentacao[] = [];

  for (const v of dados.vendasAVista(periodo, lojas)) {
    entradas.push({ data: v.data, descricao: "Vendas em dinheiro e Pix", conta: CONTA_BANCO, tipo: "entrada", valor: v.valor });
  }
  const cartoes = new Map<string, Movimentacao>();
  for (const c of dados.cartoesPorVencimento(periodo, lojas)) {
    const chave = `${c.dataVencimento}|${c.empresa}`;
    const m = cartoes.get(chave) ?? { data: c.dataVencimento, descricao: `Liquidação · ${c.empresa}`, conta: CONTA_BANCO, tipo: "entrada" as const, valor: 0 };
    m.valor += c.valorLiquido;
    cartoes.set(chave, m);
  }
  entradas.push(...cartoes.values());
  for (const t of dados.titulosReceber(lojas, { vencimentoOuBaixa: periodo })) {
    if (dentro(t.recebimento, periodo)) {
      entradas.push({ data: t.recebimento!, descricao: `Recebimento · ${t.cliente}`, conta: CONTA_BANCO, tipo: "entrada", valor: t.valorRecebido ?? 0 });
    }
  }

  for (const t of dados.titulosPagar(lojas, { vencimentoOuBaixa: periodo })) {
    if (dentro(t.pagamento, periodo)) {
      saidas.push({
        data: t.pagamento!,
        descricao: `Pagamento · ${t.nome}`,
        conta: t.classificacao === "M" || t.grupoDespesa !== "operacional" ? CONTA_BANCO : CONTA_CAIXA,
        tipo: "saida",
        valor: t.valorPago ?? 0,
      });
    }
  }
  for (const l of dados.lancamentosCaixa(periodo, lojas)) {
    (l.categoria === "captacao" ? entradas : saidas).push({
      data: l.data,
      descricao: l.descricao,
      conta: CONTA_CAIXA,
      tipo: l.categoria === "captacao" ? "entrada" : "saida",
      valor: l.valor,
    });
  }

  // As duas maiores de cada tipo (vendas, cartões, títulos, fornecedores...), para a lista não ser só de um tipo.
  const maiores = (lista: Movimentacao[]) =>
    [...agrupar(lista, (m) => m.descricao.split(" · ")[0]).values()]
      .flatMap((grupo) => grupo.sort((a, b) => b.valor - a.valor).slice(0, 2))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  return [...maiores(entradas), ...maiores(saidas)];
}

export async function getDfc(mes: string, mesComparacao: string, lojas: number[]): Promise<DfcResponse> {
  const { dataMinima } = dados.periodoCarregado();
  const meses = mesesDoPeriodo({ inicio: `${mesesAntes(mes, 11)}-01`, fim: `${mes}-01` }).filter((m) => m >= dataMinima.slice(0, 7));
  const periodo = periodoDoMes(mes);

  const [atual, comparacao, evolucao, saldos] = await Promise.all([
    dfcDoMes(mes, lojas),
    // Mês em andamento: o outro mês vai até o mesmo dia, para a comparação ser justa.
    dfcDoMes(mesComparacao, lojas, Number(periodo.fim.slice(8))),
    Promise.all(meses.map((m) => dfcDoMes(m, lojas))),
    getSaldos(periodo.fim, lojas),
  ]);

  return {
    atual,
    comparacao,
    evolucao: evolucao.map((d) => ({ mes: d.mes, entradas: d.entradas, saidas: -d.saidas, resultado: d.geracao })),
    contas: saldos.contas,
    movimentacoes: maioresMovimentacoes(periodo, lojas),
  };
}
