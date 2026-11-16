import "server-only";

import { dados } from "@/dados";
import { addDays, daysBetween } from "@/lib/date";
import { agrupar, somar } from "@/server/origem";
import type { Compromisso, Movimento, Periodo, PrazosResponse, SaldosResponse, SituacaoMovimento } from "../types";

const CATEGORIA_RECEBER = "Clientes (contas a receber)";
const CATEGORIA_A_VISTA = "Vendas à vista (dinheiro e Pix)";

/** Categoria de saída: "D" = despesa (P45); o resto, compra de mercadoria. */
const categoriaPagar = (classificacao: "M" | "D") => (classificacao === "D" ? "Despesas" : "Fornecedores (mercadoria)");

function situacaoEmAberto(vencimento: string, referencia: string): SituacaoMovimento {
  return vencimento <= referencia ? "vencido" : "previsto";
}

const dentro = (data: string | null, p: Periodo) => !!data && data >= p.inicio && data <= p.fim;

/** Cartões de um dia agrupados por empresa (as parcelas vêm aos milhares). */
function cartoesPorDiaEEmpresa(periodo: Periodo, lojas: number[]) {
  return [...agrupar(dados.cartoesPorVencimento(periodo, lojas), (c) => `${c.dataVencimento}|${c.empresa}`)].map(
    ([, linhas]) => ({
      data: linhas[0].dataVencimento,
      empresa: linhas[0].empresa,
      valor: somar(linhas, (c) => c.valorLiquido),
    }),
  );
}

/**
 * Movimentos de caixa por dia e categoria no intervalo:
 * - vendas à vista (dinheiro e Pix): realizadas no dia da venda;
 * - cartões: valor líquido no vencimento (liquidação); até a referência conta como realizado (P43);
 * - contas a receber e a pagar: realizadas na data do recebimento/pagamento (se até a referência),
 *   em aberto no vencimento.
 */
export async function getMovimentos(periodo: Periodo, referencia: string, lojas: number[]): Promise<Movimento[]> {
  const movimentos: Movimento[] = [];

  // Dinheiro e Pix entram no dia da venda: só o que já aconteceu até a referência.
  for (const v of dados.vendasAVista({ inicio: periodo.inicio, fim: periodo.fim < referencia ? periodo.fim : referencia }, lojas)) {
    movimentos.push({
      data: v.data,
      tipo: "entrada",
      fonte: "avista",
      categoria: CATEGORIA_A_VISTA,
      situacao: "realizado",
      valor: v.valor,
    });
  }

  for (const c of cartoesPorDiaEEmpresa(periodo, lojas)) {
    movimentos.push({
      data: c.data,
      tipo: "entrada",
      fonte: "cartao",
      categoria: c.empresa,
      situacao: c.data <= referencia ? "realizado" : "previsto",
      valor: c.valor,
    });
  }

  for (const r of dados.titulosReceber(lojas, { vencimentoOuBaixa: periodo })) {
    // Recebido até a referência: realizado no dia do recebimento; senão, em aberto no vencimento.
    if (dentro(r.recebimento, periodo) && r.recebimento! <= referencia) {
      movimentos.push({
        data: r.recebimento!,
        tipo: "entrada",
        fonte: "receber",
        categoria: CATEGORIA_RECEBER,
        situacao: "realizado",
        valor: r.valorRecebido ?? 0,
      });
    } else if (dentro(r.vencimento, periodo)) {
      movimentos.push({
        data: r.vencimento,
        tipo: "entrada",
        fonte: "receber",
        categoria: CATEGORIA_RECEBER,
        situacao: situacaoEmAberto(r.vencimento, referencia),
        valor: r.valorDocumento,
      });
    }
  }

  for (const p of dados.titulosPagar(lojas, { vencimentoOuBaixa: periodo })) {
    if (dentro(p.pagamento, periodo) && p.pagamento! <= referencia) {
      movimentos.push({
        data: p.pagamento!,
        tipo: "saida",
        fonte: "pagar",
        categoria: categoriaPagar(p.classificacao),
        situacao: "realizado",
        valor: p.valorPago ?? p.valor,
      });
    } else if (dentro(p.vencimento, periodo)) {
      movimentos.push({
        data: p.vencimento,
        tipo: "saida",
        fonte: "pagar",
        categoria: categoriaPagar(p.classificacao),
        situacao: situacaoEmAberto(p.vencimento, referencia),
        valor: p.valor,
      });
    }
  }

  return movimentos;
}

/**
 * Compromissos dos próximos dias e títulos vencidos em aberto (até 60 dias antes da referência).
 * Os cartões de um dia são agrupados por empresa (são milhares de parcelas).
 */
export async function getCompromissos(referencia: string, dias: number, lojas: number[]): Promise<Compromisso[]> {
  const ate = addDays(referencia, dias);
  const janela = { inicio: addDays(referencia, -60), fim: ate };

  // Em aberto na referência: sem baixa, ou baixado depois dela.
  const emAberto = (baixa: string | null) => !baixa || baixa > referencia;

  const lista: Compromisso[] = [
    ...cartoesPorDiaEEmpresa({ inicio: addDays(referencia, 1), fim: ate }, lojas).map((c) => ({
      data: c.data,
      tipo: "entrada" as const,
      fonte: "cartao" as const,
      descricao: `Cartão · ${c.empresa}`,
      valor: c.valor,
      situacao: "previsto" as const,
    })),
    ...dados
      .titulosReceber(lojas, { vencimentoOuBaixa: janela })
      .filter((r) => dentro(r.vencimento, janela) && emAberto(r.recebimento))
      .map((r) => ({
        data: r.vencimento,
        tipo: "entrada" as const,
        fonte: "receber" as const,
        descricao: r.cliente,
        valor: r.valorDocumento,
        situacao: situacaoEmAberto(r.vencimento, referencia) as "previsto" | "vencido",
      })),
    ...dados
      .titulosPagar(lojas, { vencimentoOuBaixa: janela })
      .filter((p) => dentro(p.vencimento, janela) && emAberto(p.pagamento))
      .map((p) => ({
        data: p.vencimento,
        tipo: "saida" as const,
        fonte: "pagar" as const,
        descricao: p.nome,
        valor: p.valor,
        situacao: situacaoEmAberto(p.vencimento, referencia) as "previsto" | "vencido",
      })),
  ];
  return lista.filter((c) => c.valor).sort((a, b) => a.data.localeCompare(b.data) || b.valor - a.valor);
}

/** Média de `dias` ponderada pelo valor; null sem títulos. */
function mediaPonderada<T>(linhas: T[], dias: (l: T) => number, valor: (l: T) => number): number | null {
  const total = somar(linhas, valor);
  return total ? somar(linhas, (l) => dias(l) * valor(l)) / total : null;
}

/** Prazos médios (dias, ponderados pelo valor) dos títulos emitidos/vendidos no período. */
export async function getPrazos(periodo: Periodo, lojas: number[]): Promise<PrazosResponse> {
  return {
    recebimentoCartoes: mediaPonderada(
      dados.cartoesPorVenda(periodo, lojas),
      (c) => daysBetween(c.dataVenda, c.dataVencimento),
      (c) => c.valorLiquido,
    ),
    recebimentoClientes: mediaPonderada(
      dados.titulosReceber(lojas, { emissao: periodo }),
      (t) => daysBetween(t.emissao, t.vencimento),
      (t) => t.valorDocumento,
    ),
    pagamento: mediaPonderada(
      dados.titulosPagar(lojas, { emissao: periodo }),
      (t) => daysBetween(t.emissao, t.vencimento),
      (t) => t.valor,
    ),
  };
}

/** Saldo de cada conta no fim do dia `data`, somando as filiais. */
export async function getSaldos(data: string, lojas: number[]): Promise<SaldosResponse> {
  const contas = [...agrupar(dados.saldos(data, lojas), (s) => s.conta)].map(([conta, linhas]) => ({
    conta,
    saldo: somar(linhas, (s) => s.saldo),
  }));
  return { contas, total: somar(contas, (c) => c.saldo) };
}
