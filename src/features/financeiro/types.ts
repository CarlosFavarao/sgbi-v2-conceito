import type { Periodo } from "@/lib/filtros";

export type { Periodo } from "@/lib/filtros";

export type FiltrosFinanceiro = {
  /** Mês de referência (YYYY-MM). */
  mes: string;
  filiais: number[];
};

export type TipoMovimento = "entrada" | "saida";

/**
 * - realizado: recebido/pago (data do recebimento/pagamento) ou cartão já liquidado (vencimento até a referência);
 * - previsto: título em aberto com vencimento depois da referência;
 * - vencido: título em aberto com vencimento até a referência.
 */
export type SituacaoMovimento = "realizado" | "previsto" | "vencido";

/** Fonte do movimento (para os compromissos e a documentação). */
export type FonteMovimento = "cartao" | "receber" | "pagar" | "avista";

/** Movimento agregado por dia, categoria e situação. */
export type Movimento = {
  data: string;
  tipo: TipoMovimento;
  fonte: FonteMovimento;
  categoria: string;
  situacao: SituacaoMovimento;
  valor: number;
};

export type MovimentosResponse = { movimentos: Movimento[] };

/** Título (ou cartões de um dia agrupados por empresa) a vencer. */
export type Compromisso = {
  data: string;
  tipo: TipoMovimento;
  fonte: FonteMovimento;
  descricao: string;
  valor: number;
  situacao: "previsto" | "vencido";
};

export type CompromissosResponse = { compromissos: Compromisso[] };

/** Prazos médios ponderados pelo valor (dias). */
export type PrazosResponse = {
  recebimentoCartoes: number | null;
  recebimentoClientes: number | null;
  pagamento: number | null;
};

/** Saldo de cada conta financeira (bancos, aplicações e cofre) no fim de um dia. */
export type SaldosResponse = { contas: { conta: string; saldo: number }[]; total: number };

/** Linhas da DFC (método direto). */
export type LinhaDfc =
  | "vendas-a-vista"
  | "cartoes"
  | "clientes"
  | "fornecedores"
  | "pessoal"
  | "operacionais"
  | "impostos"
  | "imobilizado"
  | "veiculos"
  | "captacao"
  | "amortizacao"
  | "juros";

/** DFC de um mês: entradas com sinal positivo e saídas com sinal negativo. */
export type DfcMes = {
  mes: string;
  /** Dias do mês considerados (o mês em andamento vai até o último dia com dados). */
  periodo: Periodo;
  linhas: Record<LinhaDfc, number>;
  entradas: number;
  saidas: number;
  /** Geração líquida de caixa (entradas + saídas). */
  geracao: number;
  saldoInicial: number;
  saldoFinal: number;
};

export type Movimentacao = {
  data: string;
  descricao: string;
  conta: string;
  tipo: TipoMovimento;
  valor: number;
};

export type DfcResponse = {
  atual: DfcMes;
  comparacao: DfcMes;
  /** Entradas, saídas e geração dos 12 meses até o mês escolhido. */
  evolucao: { mes: string; entradas: number; saidas: number; resultado: number }[];
  /** Saldo das contas no fim do mês (ou no último dia com dados). */
  contas: SaldosResponse["contas"];
  /** Maiores entradas e saídas do mês. */
  movimentacoes: Movimentacao[];
};
