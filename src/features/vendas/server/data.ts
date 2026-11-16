import "server-only";

import { dados } from "@/dados";
import type { Origem } from "@/lib/filtros";
import { getCuponsDiarios } from "@/server/cupons";
import { agrupar, custoPorOrigem, somar, vendaPorOrigem } from "@/server/origem";
import { montarProdutos } from "../abc";
import type {
  CuponsNivelResponse,
  FonteVendas,
  LinhaVendaNivel,
  Nivel,
  NiveisResponse,
  Periodo,
  PontoVendas,
  ProdutosResponse,
} from "../types";

/**
 * Série diária de uma fonte (só os dias com carga). `origem` só afeta "vendas":
 * os cupons vêm do PDV.
 */
export async function getSerie(
  fonte: FonteVendas,
  periodo: Periodo,
  lojas: number[],
  origem: Origem,
): Promise<PontoVendas[]> {
  if (fonte === "vendas") {
    return [...agrupar(dados.analise(periodo, lojas), (l) => l.data)].map(([data, linhas]) => ({
      data,
      venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
      custo: somar(linhas, (l) => custoPorOrigem(l, origem)),
    }));
  }

  return getCuponsDiarios(periodo, lojas);
}

/** Nível acima de cada nível (grupo → departamento, subgrupo → grupo). */
const PAI = { departamento: null, grupo: "departamento", subgrupo: "grupo" } as const;

function descricoes(nivel: Nivel) {
  const h = dados.hierarquia();
  const lista = { departamento: h.departamentos, grupo: h.grupos, subgrupo: h.subgrupos }[nivel];
  return new Map(lista.map((d) => [d.codigo, d.descricao]));
}

function vendaPorNivel(nivel: Nivel, periodo: Periodo, lojas: number[], origem: Origem) {
  const pai = PAI[nivel];
  return [...agrupar(dados.analise(periodo, lojas), (l) => l[nivel])].map(([codigo, linhas]) => ({
    codigo,
    // Códigos são únicos em toda a hierarquia: o pai é o mesmo em todas as linhas.
    pai: pai ? linhas[0][pai] : null,
    venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
    custo: somar(linhas, (l) => custoPorOrigem(l, origem)),
  }));
}

/** Venda e custo por departamento, grupo ou subgrupo, nos dois períodos. */
export async function getNiveis(
  nivel: Nivel,
  periodo: Periodo,
  anterior: Periodo,
  lojas: number[],
  origem: Origem,
): Promise<NiveisResponse> {
  const nomes = descricoes(nivel);

  const linhas = new Map<number, LinhaVendaNivel>();
  const linha = (codigo: number, pai: number | null) => {
    let l = linhas.get(codigo);
    if (!l) {
      l = {
        codigo,
        descricao: nomes.get(codigo) ?? `Código ${codigo}`,
        pai,
        venda: 0,
        custo: 0,
        vendaAnterior: 0,
        custoAnterior: 0,
      };
      linhas.set(codigo, l);
    }
    return l;
  };
  for (const a of vendaPorNivel(nivel, periodo, lojas, origem)) {
    Object.assign(linha(a.codigo, a.pai), { venda: a.venda, custo: a.custo });
  }
  for (const b of vendaPorNivel(nivel, anterior, lojas, origem)) {
    Object.assign(linha(b.codigo, b.pai), { vendaAnterior: b.venda, custoAnterior: b.custo });
  }

  return {
    nivel,
    linhas: [...linhas.values()].filter((l) => l.venda || l.vendaAnterior).sort((a, b) => b.venda - a.venda),
  };
}

/** Cupons e itens por nível (PDV). Fica em rota separada da venda, como no banco (a consulta de cupons era lenta). */
export async function getCuponsNiveis(
  nivel: Nivel,
  periodo: Periodo,
  anterior: Periodo,
  lojas: number[],
): Promise<CuponsNivelResponse> {
  const atual = new Map(dados.cuponsPorNivel(nivel, periodo, lojas).map((c) => [c.codigo, c]));
  const comparacao = new Map(dados.cuponsPorNivel(nivel, anterior, lojas).map((c) => [c.codigo, c]));

  return {
    nivel,
    linhas: [...new Set([...atual.keys(), ...comparacao.keys()])].map((codigo) => ({
      codigo,
      cupons: atual.get(codigo)?.cupons ?? 0,
      itens: atual.get(codigo)?.itens ?? 0,
      cuponsAnterior: comparacao.get(codigo)?.cupons ?? 0,
      itensAnterior: comparacao.get(codigo)?.itens ?? 0,
    })),
  };
}

function vendaPorProduto(periodo: Periodo, lojas: number[], origem: Origem) {
  return [...agrupar(dados.analise(periodo, lojas), (l) => l.codigo)].map(([codigo, linhas]) => ({
    codigo,
    descricao: linhas[0].descricao,
    departamento: linhas[0].departamento,
    venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
    custo: somar(linhas, (l) => custoPorOrigem(l, origem)),
  }));
}

/** Curva ABC (por faturamento e por rentabilidade) e listas de produtos. */
export async function getProdutos(
  periodo: Periodo,
  anterior: Periodo,
  lojas: number[],
  origem: Origem,
): Promise<ProdutosResponse> {
  const nomes = descricoes("departamento");
  const comparacao = vendaPorProduto(anterior, lojas, origem);

  return montarProdutos(
    vendaPorProduto(periodo, lojas, origem).map((p) => ({
      ...p,
      departamento: nomes.get(p.departamento) ?? `Código ${p.departamento}`,
    })),
    new Map(comparacao.map((p) => [p.codigo, p.venda])),
  );
}
