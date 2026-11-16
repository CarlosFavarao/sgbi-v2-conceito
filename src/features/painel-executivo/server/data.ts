import "server-only";

import { dados } from "@/dados";
import { daysInMonth, firstDayOfMonth, lastDayOfMonth } from "@/lib/date";
import { getCuponsDiarios } from "@/server/cupons";
import { agrupar, custoPorOrigem, somar, vendaPorOrigem } from "@/server/origem";
import type {
  DepartamentosResponse,
  Fonte,
  LinhaNivel,
  MetaResponse,
  Nivel,
  Origem,
  Periodo,
  PontoSerie,
} from "../types";

/**
 * Série diária de uma fonte (só os dias com carga). Cada fonte é consultada
 * separadamente para que cada card apareça assim que os seus dados chegam.
 * `origem` só afeta a fonte "vendas".
 */
export async function getSerie(
  fonte: Fonte,
  periodo: Periodo,
  lojas: number[],
  origem: Origem,
): Promise<PontoSerie[]> {
  switch (fonte) {
    case "vendas":
      return [...agrupar(dados.analise(periodo, lojas), (l) => l.data)].map(([data, linhas]) => ({
        data,
        venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
        custo: somar(linhas, (l) => custoPorOrigem(l, origem)),
        compra: somar(linhas, (l) => l.totalCompra),
      }));
    case "pdv":
      return (await getCuponsDiarios(periodo, lojas)).map((d) => ({
        data: d.data,
        vendaPdv: d.vendaPdv,
        tickets: d.cupons,
      }));
    case "cancelamentos":
      return [...agrupar(dados.cancelamentos(periodo, lojas), (l) => l.data)].map(([data, linhas]) => ({
        data,
        cancelamentos: somar(linhas, (l) => l.valor),
      }));
    case "despesas":
      return [...agrupar(dados.despesas(periodo, lojas), (l) => l.data)].map(([data, linhas]) => ({
        data,
        despesas: somar(linhas, (l) => l.valor),
      }));
  }
}

export async function getMeta(periodo: Periodo, lojas: number[], origem: Origem): Promise<MetaResponse> {
  const mes = periodo.fim.slice(0, 7);
  const metaDoMes = dados.metasDiarias({ inicio: `${mes}-01`, fim: lastDayOfMonth(`${mes}-01`) }, lojas);
  const realizado = dados.analise({ inicio: firstDayOfMonth(periodo.fim), fim: periodo.fim }, lojas);

  return {
    metaPeriodo: somar(
      metaDoMes.filter((m) => m.data >= periodo.inicio && m.data <= periodo.fim),
      (m) => m.previsaoVenda,
    ),
    mes,
    metaMes: somar(metaDoMes, (m) => m.previsaoVenda),
    realizadoMes: somar(realizado, (l) => vendaPorOrigem(l, origem)),
    diasRestantes: daysInMonth(periodo.fim) - Number(periodo.fim.slice(8, 10)),
  };
}

function compraVendaPorNivel(nivel: Nivel, periodo: Periodo, lojas: number[], origem: Origem) {
  return new Map(
    [...agrupar(dados.analise(periodo, lojas), (l) => l[nivel])].map(([codigo, linhas]) => [
      codigo,
      {
        compra: somar(linhas, (l) => l.totalCompra),
        venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
      },
    ]),
  );
}

export async function getDepartamentos(
  nivel: Nivel,
  periodo: Periodo,
  periodoAnterior: Periodo,
  lojas: number[],
  origem: Origem,
): Promise<DepartamentosResponse> {
  const atual = compraVendaPorNivel(nivel, periodo, lojas, origem);
  const anterior = compraVendaPorNivel(nivel, periodoAnterior, lojas, origem);
  const hierarquia = dados.hierarquia();
  const nomes = new Map(
    { departamento: hierarquia.departamentos, grupo: hierarquia.grupos, subgrupo: hierarquia.subgrupos }[nivel].map(
      (d) => [d.codigo, d.descricao],
    ),
  );

  const linhas: LinhaNivel[] = [...new Set([...atual.keys(), ...anterior.keys()])]
    .map((codigo) => ({
      codigo,
      descricao: nomes.get(codigo) ?? `Código ${codigo}`,
      compra: atual.get(codigo)?.compra ?? 0,
      venda: atual.get(codigo)?.venda ?? 0,
      compraAnterior: anterior.get(codigo)?.compra ?? 0,
      vendaAnterior: anterior.get(codigo)?.venda ?? 0,
    }))
    .filter((l) => l.compra || l.venda || l.compraAnterior || l.vendaAnterior)
    .sort((a, b) => b.venda - a.venda);

  return { linhas };
}
