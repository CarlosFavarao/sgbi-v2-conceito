import "server-only";

import type { LinhaAnalise } from "@/dados";
import type { Origem } from "@/lib/filtros";

/** Venda da linha pela origem escolhida: PDV, faturamento ou os dois. */
export function vendaPorOrigem(l: LinhaAnalise, origem: Origem) {
  if (origem === "pdv") return l.totalPDV;
  if (origem === "faturamento") return l.totalFaturamento;
  return l.totalVenda;
}

export function custoPorOrigem(l: LinhaAnalise, origem: Origem) {
  if (origem === "pdv") return l.totalCustoPDV;
  if (origem === "faturamento") return l.totalCustoFaturamento;
  return l.totalCusto;
}

/** Agrupa as linhas por `chave` (o equivalente ao `group by` do SQL). */
export function agrupar<T, K>(linhas: Iterable<T>, chave: (l: T) => K): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  for (const l of linhas) {
    const k = chave(l);
    const grupo = grupos.get(k);
    if (grupo) grupo.push(l);
    else grupos.set(k, [l]);
  }
  return grupos;
}

/** Soma `valor` das linhas. */
export const somar = <T>(linhas: Iterable<T>, valor: (l: T) => number) => {
  let total = 0;
  for (const l of linhas) total += valor(l);
  return total;
};
