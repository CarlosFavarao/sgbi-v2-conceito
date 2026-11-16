import "server-only";

import { dados } from "@/dados";
import type { Periodo } from "@/lib/filtros";

export type CuponsDia = {
  data: string;
  /** Venda do PDV (bate com a venda PDV da analise gerencial). */
  vendaPdv: number;
  cupons: number;
  /** Quantidade vendida (unidades e kg, como a "cesta média" do BI antigo). */
  itens: number;
};

/** Venda, cupons e itens do PDV por dia (base do Ticket Médio do Painel Executivo e da tela de Vendas), somando as filiais. */
export async function getCuponsDiarios(periodo: Periodo, lojas: number[]): Promise<CuponsDia[]> {
  const porDia = new Map<string, CuponsDia>();
  for (const l of dados.cuponsDiarios(periodo, lojas)) {
    const dia = porDia.get(l.data) ?? { data: l.data, vendaPdv: 0, cupons: 0, itens: 0 };
    dia.vendaPdv += l.vendaPdv;
    dia.cupons += l.cupons;
    dia.itens += l.itens;
    porDia.set(l.data, dia);
  }
  return [...porDia.values()];
}
