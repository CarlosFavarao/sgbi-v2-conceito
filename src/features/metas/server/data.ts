import "server-only";

import { dados } from "@/dados";
import { mesesDoPeriodo } from "@/lib/date";
import type { Origem } from "@/lib/filtros";
import { agrupar, custoPorOrigem, somar, vendaPorOrigem } from "@/server/origem";
import { metaDiariaDoNivel, metaNivelNoPeriodo, type MetaMensal } from "../metas";
import type {
  LinhaMetaNivel,
  MetaDia,
  Nivel,
  NiveisMetasResponse,
  OpcoesMetasResponse,
  Periodo,
  RealizadoDia,
  TotalResponse,
} from "../types";

const pad = (n: number) => String(n).padStart(2, "0");
const anos = (p: Periodo) => [Number(p.inicio.slice(0, 4)), Number(p.fim.slice(0, 4))] as const;

/** Meta diária da loja (soma das filiais). */
function curvaDaLoja(periodo: Periodo, lojas: number[]): MetaDia[] {
  return [...agrupar(dados.metasDiarias(periodo, lojas), (m) => m.data)].map(([data, linhas]) => ({
    data,
    meta: somar(linhas, (m) => m.previsaoVenda),
    metaLucro: somar(linhas, (m) => m.previsaoLucro),
  }));
}

/** Metas mensais de um nível (soma das filiais) nos meses do período. */
function metasMensais(nivel: Nivel, periodo: Periodo, lojas: number[]): MetaMensal[] {
  const [anoInicio, anoFim] = anos(periodo);
  const meses = new Set(mesesDoPeriodo(periodo));
  const porCodigoEMes = agrupar(
    dados.metasMensais(nivel, anoInicio, anoFim, lojas),
    (m) => `${m.codigo}|${m.ano}-${pad(m.mes)}`,
  );
  return [...porCodigoEMes.values()]
    .map((linhas) => ({
      codigo: linhas[0].codigo,
      mes: `${linhas[0].ano}-${pad(linhas[0].mes)}`,
      meta: somar(linhas, (m) => m.previsaoVenda),
      metaLucro: somar(linhas, (m) => m.previsaoLucro),
    }))
    .filter((m) => meses.has(m.mes));
}

/** Meses com meta cadastrada e lista de departamentos para o filtro. */
export async function getOpcoes(lojas: number[]): Promise<OpcoesMetasResponse> {
  const { dataMinima, dataMaxima } = dados.periodoCarregado();
  const metas = dados.metasMensais("departamento", Number(dataMinima.slice(0, 4)), Number(dataMaxima.slice(0, 4)), lojas);
  return {
    mesesComMeta: [...new Set(metas.filter((m) => m.previsaoVenda > 0).map((m) => `${m.ano}-${pad(m.mes)}`))].sort(),
    departamentos: [...dados.hierarquia().departamentos].sort((a, b) => a.descricao.localeCompare(b.descricao)),
  };
}

/**
 * Meta diária do período: da loja ou, com o filtro Departamento, a meta mensal
 * do departamento dividida igualmente pelos dias (P33).
 */
export async function getMetasDiarias(
  periodo: Periodo,
  lojas: number[],
  departamento: number | null,
): Promise<MetaDia[]> {
  if (departamento == null) return curvaDaLoja(periodo, lojas);
  // Departamento: só há meta mensal, dividida igualmente pelos dias (P33).
  const mensais = metasMensais("departamento", periodo, lojas).filter((m) => m.codigo === departamento);
  return metaDiariaDoNivel(mensais).filter((d) => d.data >= periodo.inicio && d.data <= periodo.fim);
}

/** Linhas de venda do período, só do departamento filtrado (ou todas). */
function vendaDoPeriodo(periodo: Periodo, lojas: number[], departamento: number | null) {
  const linhas = dados.analise(periodo, lojas);
  return departamento == null ? linhas : linhas.filter((l) => l.departamento === departamento);
}

/** Venda e custo por dia (só os dias com carga). */
export async function getRealizadoDiario(
  periodo: Periodo,
  lojas: number[],
  origem: Origem,
  departamento: number | null,
): Promise<RealizadoDia[]> {
  return [...agrupar(vendaDoPeriodo(periodo, lojas, departamento), (l) => l.data)].map(([data, linhas]) => ({
    data,
    venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
    custo: somar(linhas, (l) => custoPorOrigem(l, origem)),
  }));
}

/** Venda e custo somados no período (aba Ano: o ano até a referência, sem trazer cada dia). */
export async function getTotal(
  periodo: Periodo,
  lojas: number[],
  origem: Origem,
  departamento: number | null,
): Promise<TotalResponse> {
  const linhas = vendaDoPeriodo(periodo, lojas, departamento);
  return {
    venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
    custo: somar(linhas, (l) => custoPorOrigem(l, origem)),
  };
}

/** Nível acima de cada nível (grupo → departamento, subgrupo → grupo). */
const PAI = { departamento: null, grupo: "departamento", subgrupo: "grupo" } as const;

function realizadoPorNivel(
  nivel: Nivel,
  periodo: Periodo | null,
  lojas: number[],
  origem: Origem,
  departamento: number | null,
) {
  if (!periodo) return [];
  const pai = PAI[nivel];
  return [...agrupar(vendaDoPeriodo(periodo, lojas, departamento), (l) => l[nivel])].map(([codigo, linhas]) => ({
    codigo,
    // Códigos são únicos em toda a hierarquia: o pai é o mesmo em todas as linhas.
    pai: pai ? linhas[0][pai] : null,
    venda: somar(linhas, (l) => vendaPorOrigem(l, origem)),
    custo: somar(linhas, (l) => custoPorOrigem(l, origem)),
  }));
}

/** Código, descrição, pai e departamento de cada item do nível (para metas sem venda e para o filtro). */
function hierarquia(nivel: Nivel) {
  const h = dados.hierarquia();
  if (nivel === "departamento") {
    return h.departamentos.map((d) => ({ ...d, pai: null as number | null, departamento: d.codigo }));
  }
  if (nivel === "grupo") {
    return h.grupos.map((g) => ({ codigo: g.codigo, descricao: g.descricao, pai: g.departamento, departamento: g.departamento }));
  }
  const departamentoDoGrupo = new Map(h.grupos.map((g) => [g.codigo, g.departamento]));
  return h.subgrupos.map((s) => ({
    codigo: s.codigo,
    descricao: s.descricao,
    pai: s.grupo,
    departamento: departamentoDoGrupo.get(s.grupo) ?? -1,
  }));
}

/**
 * Meta (do período inteiro e esperada até a referência), realizado e venda da
 * comparação por departamento, grupo ou subgrupo.
 */
export async function getNiveisMetas(
  nivel: Nivel,
  periodo: Periodo,
  decorrido: Periodo | null,
  comparacao: Periodo | null,
  lojas: number[],
  origem: Origem,
  departamento: number | null,
): Promise<NiveisMetasResponse> {
  const atual = realizadoPorNivel(nivel, decorrido, lojas, origem, departamento);
  const anterior = realizadoPorNivel(nivel, comparacao, lojas, origem, departamento);
  const mensais = metasMensais(nivel, periodo, lojas);
  const itens = hierarquia(nivel);

  const porCodigo = new Map(itens.map((i) => [i.codigo, i]));
  const noFiltro = (codigo: number) => departamento == null || porCodigo.get(codigo)?.departamento === departamento;
  const mensaisPorCodigo = Map.groupBy(mensais, (m) => m.codigo);
  const atualPorCodigo = new Map(atual.map((a) => [a.codigo, a]));
  const anteriorPorCodigo = new Map(anterior.map((a) => [a.codigo, a.venda]));
  const codigos = new Set([...atual.map((a) => a.codigo), ...mensaisPorCodigo.keys()].filter(noFiltro));

  const linhas: LinhaMetaNivel[] = [...codigos].map((codigo) => {
    const metasDoCodigo = mensaisPorCodigo.get(codigo) ?? [];
    const total = metaNivelNoPeriodo(metasDoCodigo, periodo);
    const esperada = metaNivelNoPeriodo(metasDoCodigo, decorrido);
    const real = atualPorCodigo.get(codigo);
    return {
      codigo,
      descricao: porCodigo.get(codigo)?.descricao ?? `Código ${codigo} (sem cadastro)`,
      pai: real?.pai ?? porCodigo.get(codigo)?.pai ?? null,
      meta: total?.meta ?? null,
      // Período ainda não começou: nada era esperado até a referência.
      metaEsperada: decorrido ? (esperada?.meta ?? null) : total ? 0 : null,
      metaLucro: total?.metaLucro ?? null,
      venda: real?.venda ?? 0,
      custo: real?.custo ?? 0,
      vendaAnterior: anteriorPorCodigo.get(codigo) ?? 0,
    };
  });

  return {
    nivel,
    linhas: linhas
      .filter((l) => l.venda || l.vendaAnterior || l.meta)
      .sort((a, b) => (b.meta ?? 0) - (a.meta ?? 0) || b.venda - a.venda),
  };
}
