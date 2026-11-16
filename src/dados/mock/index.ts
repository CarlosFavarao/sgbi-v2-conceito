import type { Nivel } from "@/lib/filtros";
import type { FonteDeDados } from "../tipos";
import { EMPRESA, HIERARQUIA, LOJAS } from "./catalogo";
import * as financeiro from "./financeiro";
import { primeiroDia, ultimoDia } from "./tempo";
import * as vendas from "./vendas";

/**
 * Fonte de dados simulada do **Mercado Teste** (D47): três lojas, 72 produtos em 8
 * departamentos, de 1º de janeiro do ano passado até ontem. É determinística (não
 * guarda nada e dá os mesmos números a cada consulta) e não acessa banco nem rede.
 */
export const fonteMock: FonteDeDados = {
  empresa: () => EMPRESA,
  filiais: () => LOJAS.map(({ codigo, descricao }) => ({ codigo, descricao })),
  periodoCarregado: () => ({ dataMinima: primeiroDia(), dataMaxima: ultimoDia() }),
  hierarquia: () => HIERARQUIA,

  analise: vendas.analise,
  cuponsDiarios: vendas.cuponsDiarios,
  cuponsPorNivel: (nivel: Nivel, periodo, lojas) => vendas.cuponsPorNivel(nivel, periodo, lojas),
  cancelamentos: vendas.cancelamentos,
  despesas: vendas.despesas,

  metasDiarias: vendas.metasDiarias,
  metasMensais: vendas.metasMensais,

  cartoesPorVencimento: financeiro.cartoesPorVencimento,
  cartoesPorVenda: financeiro.cartoesPorVenda,
  titulosReceber: financeiro.titulosReceber,
  titulosPagar: financeiro.titulosPagar,
  vendasAVista: financeiro.vendasAVista,
  lancamentosCaixa: financeiro.lancamentosCaixa,
  saldos: financeiro.saldos,
};
