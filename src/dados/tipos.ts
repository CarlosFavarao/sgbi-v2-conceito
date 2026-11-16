import type { Nivel, Periodo } from "@/lib/filtros";

/**
 * Contrato dos dados do BI (modo conceito, D47).
 *
 * O SGBI v2 deixou de consultar o banco do cliente: tudo o que as telas mostram
 * entra por uma `FonteDeDados`. Hoje a fonte é a simulação do "Mercado Teste"
 * (`./mock`); para receber dados externos, implemente esta interface e troque a
 * fonte em `./index.ts`. Cada método devolve as "tabelas" que o BI lia do banco,
 * já filtradas por filial e período; os cálculos continuam em `features/<tela>/server`.
 *
 * Datas sempre em ISO `YYYY-MM-DD`. Valores em reais.
 */

export type { Periodo };

export type Empresa = {
  nomeFantasia: string;
  cnpj: string;
  codigoCliente: string;
};

export type Loja = { codigo: number; descricao: string };

/** Intervalo carregado. `dataMaxima` é o último dia **com venda** (os dados são D-1). */
export type PeriodoCarregado = { dataMinima: string; dataMaxima: string };

export type Hierarquia = {
  departamentos: { codigo: number; descricao: string }[];
  grupos: { codigo: number; descricao: string; departamento: number }[];
  subgrupos: { codigo: number; descricao: string; grupo: number }[];
};

/** Venda, custo e compra de um produto, em um dia e filial (a antiga `view_analise_gerencial_produtos`). */
export type LinhaAnalise = {
  filial: number;
  data: string;
  codigo: number;
  descricao: string;
  departamento: number;
  grupo: number;
  subgrupo: number;
  /** `totalVenda = totalPDV + totalFaturamento` (idem para o custo). */
  totalVenda: number;
  totalPDV: number;
  totalFaturamento: number;
  totalCusto: number;
  totalCustoPDV: number;
  totalCustoFaturamento: number;
  totalCompra: number;
  /** Quantidade vendida (unidades e kg), PDV + faturamento. */
  quantidade: number;
  /** Parte da quantidade vendida no PDV (base dos itens por cupom). */
  quantidadePDV: number;
};

/** Venda, cupons e itens do PDV em um dia e filial (antes, agrupados do `logpdv`). */
export type LinhaCuponsDia = { filial: number; data: string; vendaPdv: number; cupons: number; itens: number };

/** Cupons que tiveram ao menos um item do nível e itens vendidos do nível no período. */
export type LinhaCuponsNivel = { codigo: number; cupons: number; itens: number };

export type LinhaDia = { filial: number; data: string; valor: number };

/** Meta de venda e de lucro da filial em um dia (a antiga `previsao_dia`). */
export type MetaDiaria = { filial: number; data: string; previsaoVenda: number; previsaoLucro: number };

/** Meta mensal de um departamento, grupo ou subgrupo (as antigas `previsao_*`). */
export type MetaMensalNivel = {
  filial: number;
  codigo: number;
  ano: number;
  mes: number;
  previsaoVenda: number;
  previsaoLucro: number;
};

/** Parcela de venda em cartão, agrupada por dia da venda e empresa (operadora ou bandeira). */
export type LinhaCartao = {
  filial: number;
  empresa: string;
  dataVenda: string;
  dataVencimento: string;
  valorBruto: number;
  valorLiquido: number;
};

export type TituloReceber = {
  filial: number;
  cliente: string;
  emissao: string;
  vencimento: string;
  /** `null` = em aberto. */
  recebimento: string | null;
  valorDocumento: number;
  valorRecebido: number | null;
};

/** Plano de contas gerencial das despesas (para a DFC). */
export type GrupoDespesa = "pessoal" | "operacional" | "impostos";

export type TituloPagar = {
  filial: number;
  /** Fornecedor ou descrição da despesa. */
  nome: string;
  /** "M" = mercadoria; "D" = despesa. */
  classificacao: "M" | "D";
  /** Só nas despesas. */
  grupoDespesa: GrupoDespesa | null;
  emissao: string;
  vencimento: string;
  /** `null` = em aberto. */
  pagamento: string | null;
  valor: number;
  valorPago: number | null;
};

/** Movimento de caixa fora das vendas e dos títulos: investimentos e financiamentos. */
export type LancamentoCaixa = {
  filial: number;
  data: string;
  categoria: "imobilizado" | "veiculos" | "captacao" | "amortizacao" | "juros";
  descricao: string;
  /** Sempre positivo; a categoria diz se entra (captação) ou sai. */
  valor: number;
};

export type SaldoConta = { filial: number; conta: string; saldo: number };

export type FiltroTitulos = {
  /** Títulos emitidos no período. */
  emissao?: Periodo;
  /** Títulos com vencimento ou baixa no período. */
  vencimentoOuBaixa?: Periodo;
};

export interface FonteDeDados {
  empresa(): Empresa;
  filiais(): Loja[];
  periodoCarregado(): PeriodoCarregado;
  hierarquia(): Hierarquia;

  analise(periodo: Periodo, lojas: number[]): LinhaAnalise[];
  cuponsDiarios(periodo: Periodo, lojas: number[]): LinhaCuponsDia[];
  cuponsPorNivel(nivel: Nivel, periodo: Periodo, lojas: number[]): LinhaCuponsNivel[];
  cancelamentos(periodo: Periodo, lojas: number[]): LinhaDia[];
  despesas(periodo: Periodo, lojas: number[]): LinhaDia[];

  metasDiarias(periodo: Periodo, lojas: number[]): MetaDiaria[];
  metasMensais(nivel: Nivel, anoInicio: number, anoFim: number, lojas: number[]): MetaMensalNivel[];

  cartoesPorVencimento(periodo: Periodo, lojas: number[]): LinhaCartao[];
  cartoesPorVenda(periodo: Periodo, lojas: number[]): LinhaCartao[];
  titulosReceber(lojas: number[], filtro: FiltroTitulos): TituloReceber[];
  titulosPagar(lojas: number[], filtro: FiltroTitulos): TituloPagar[];
  /** Vendas recebidas na hora (dinheiro e Pix), por dia. */
  vendasAVista(periodo: Periodo, lojas: number[]): LinhaDia[];
  lancamentosCaixa(periodo: Periodo, lojas: number[]): LancamentoCaixa[];
  /** Saldo de cada conta no fim do dia `data`. */
  saldos(data: string, lojas: number[]): SaldoConta[];
}
