import type { Nivel, Periodo } from "@/lib/filtros";
import type {
  LinhaAnalise,
  LinhaCuponsDia,
  LinhaCuponsNivel,
  LinhaDia,
  MetaDiaria,
  MetaMensalNivel,
} from "../tipos";
import { entre, sorteio } from "./aleatorio";
import { NOS_POR_NIVEL, porteDaLoja, PRODUTOS, type Produto } from "./catalogo";
import { calendario, diaNum, diasCarregados, fimDoAnoDeMetas, isoDoDia, primeiroDia } from "./tempo";

/**
 * Venda, custo e compra simulados do Mercado Teste: cada produto, em cada filial
 * e dia, é uma conta determinística (ver `aleatorio.ts`) sobre uma base
 * (popularidade, porte da loja, dia da semana, dia de pagamento, estação e
 * crescimento) com ruído e promoções. A meta é a mesma base, sem o ruído, vezes
 * um fator por subgrupo e mês: por isso o realizado fica em torno da meta, ora
 * acima, ora abaixo.
 */

const DIA_ZERO = diaNum("2025-01-01");
/** Domingo a sábado. */
const FATOR_SEMANA = [1.14, 0.86, 0.84, 0.88, 0.92, 1.08, 1.28];
/** Janeiro a dezembro. */
const FATOR_ESTACAO = [0.97, 0.93, 0.97, 0.98, 1, 0.98, 1, 1, 1, 1.03, 1.06, 1.16];

function fatorDoDia(n: number): number {
  const c = calendario(n);
  const pagamento = c.dia >= 5 && c.dia <= 8 ? 1.07 : c.dia >= 20 && c.dia <= 22 ? 1.04 : 1;
  // Crescimento de cerca de 4,5% ao ano.
  return FATOR_SEMANA[c.dow] * FATOR_ESTACAO[c.mes - 1] * pagamento * (1 + 0.00012 * (n - DIA_ZERO));
}

const precoNoDia = (p: Produto, n: number) => p.preco * (1 + 0.00007 * (n - DIA_ZERO));

/** O que se espera vender (sem ruído nem promoção): a base da meta. */
function esperado(filial: number, n: number, p: Produto) {
  const quantidade = p.unidades * porteDaLoja(filial) * fatorDoDia(n);
  const venda = quantidade * precoNoDia(p, n);
  return { quantidade, venda, lucro: venda * p.margem };
}

type Totais = {
  venda: number;
  pdv: number;
  faturamento: number;
  custo: number;
  custoPdv: number;
  custoFaturamento: number;
  compra: number;
  quantidade: number;
  quantidadePdv: number;
};

/** Venda realizada de um produto em um dia e filial. */
function realizado(filial: number, n: number, p: Produto): Totais {
  const base = esperado(filial, n, p);
  const promocao = sorteio(filial, Math.floor(n / 7), p.codigo, 5) < 0.07 ? 1.55 : 1;
  const ruido = (0.95 + 0.1 * sorteio(filial, n, 1)) * (0.82 + 0.36 * sorteio(filial, n, p.codigo));
  const quantidade = base.quantidade * ruido * promocao;
  const venda = quantidade * precoNoDia(p, n);
  const fracaoFaturamento = p.faturamento * (0.7 + 0.6 * sorteio(filial, n, p.codigo, 2));
  const faturamento = venda * fracaoFaturamento;
  const pdv = venda - faturamento;
  // A margem do dia varia na loja toda (mix e promoções) e um pouco em cada produto.
  const margem = p.margem + 0.035 * (sorteio(filial, n, 6) - 0.5) + 0.02 * (sorteio(filial, n, p.codigo, 3) - 0.5);
  const custoPdv = pdv * (1 - margem);
  // O faturamento (atacado) tem margem menor.
  const custoFaturamento = faturamento * (1 - margem * 0.6);
  const custo = custoPdv + custoFaturamento;
  // Cada produto é reposto a cada 4 dias, em lote.
  const reposicao = (n + p.codigo + filial) % 4 === 0;
  return {
    venda,
    pdv,
    faturamento,
    custo,
    custoPdv,
    custoFaturamento,
    compra: reposicao ? custo * 4 * (0.9 + 0.25 * sorteio(filial, n, p.codigo, 4)) : 0,
    quantidade,
    quantidadePdv: quantidade * (1 - fracaoFaturamento),
  };
}

const resumos = new Map<number, Totais>();

/** Totais da filial no dia (soma dos produtos), guardados porque muitas consultas os reaproveitam. */
export function resumoDoDia(filial: number, n: number): Totais {
  const chave = filial * 1_000_000 + n;
  let r = resumos.get(chave);
  if (!r) {
    r = {
      venda: 0,
      pdv: 0,
      faturamento: 0,
      custo: 0,
      custoPdv: 0,
      custoFaturamento: 0,
      compra: 0,
      quantidade: 0,
      quantidadePdv: 0,
    };
    for (const p of PRODUTOS) {
      const x = realizado(filial, n, p);
      for (const k of Object.keys(r) as (keyof Totais)[]) r[k] += x[k];
    }
    resumos.set(chave, r);
  }
  return r;
}

export function analise(periodo: Periodo, lojas: number[]): LinhaAnalise[] {
  const linhas: LinhaAnalise[] = [];
  for (const n of diasCarregados(periodo)) {
    const data = isoDoDia(n);
    for (const filial of lojas) {
      for (const p of PRODUTOS) {
        const x = realizado(filial, n, p);
        linhas.push({
          filial,
          data,
          codigo: p.codigo,
          descricao: p.descricao,
          departamento: p.departamento,
          grupo: p.grupo,
          subgrupo: p.subgrupo,
          totalVenda: x.venda,
          totalPDV: x.pdv,
          totalFaturamento: x.faturamento,
          totalCusto: x.custo,
          totalCustoPDV: x.custoPdv,
          totalCustoFaturamento: x.custoFaturamento,
          totalCompra: x.compra,
          quantidade: x.quantidade,
          quantidadePDV: x.quantidadePdv,
        });
      }
    }
  }
  return linhas;
}

/** Cupons do dia: venda do PDV dividida pelo ticket do dia (cerca de R$ 75). */
function cuponsDoDia(filial: number, n: number) {
  const r = resumoDoDia(filial, n);
  const ticket = entre(66, 86, filial, n, 20);
  return { vendaPdv: r.pdv, cupons: Math.max(1, Math.round(r.pdv / ticket)), itens: r.quantidadePdv };
}

export function cuponsDiarios(periodo: Periodo, lojas: number[]): LinhaCuponsDia[] {
  return diasCarregados(periodo).flatMap((n) =>
    lojas.map((filial) => ({ filial, data: isoDoDia(n), ...cuponsDoDia(filial, n) })),
  );
}

export function cuponsPorNivel(nivel: Nivel, periodo: Periodo, lojas: number[]): LinhaCuponsNivel[] {
  const dias = diasCarregados(periodo);
  const totalCupons = dias.reduce(
    (soma, n) => soma + lojas.reduce((s, filial) => s + cuponsDoDia(filial, n).cupons, 0),
    0,
  );
  return NOS_POR_NIVEL[nivel].map((no) => {
    let itens = 0;
    for (const p of PRODUTOS) {
      if (p[nivel] !== no.codigo) continue;
      for (const n of dias) for (const filial of lojas) itens += realizado(filial, n, p).quantidadePdv;
    }
    return { codigo: no.codigo, cupons: Math.round(totalCupons * no.penetracao), itens };
  });
}

export function cancelamentos(periodo: Periodo, lojas: number[]): LinhaDia[] {
  return diasCarregados(periodo).flatMap((n) =>
    lojas.map((filial) => ({
      filial,
      data: isoDoDia(n),
      // Cerca de 0,35% da venda do PDV, com picos esporádicos.
      valor: resumoDoDia(filial, n).pdv * 0.0035 * (0.5 + sorteio(filial, n, 40)) * (sorteio(filial, n, 41) < 0.04 ? 3 : 1),
    })),
  );
}

// --- Despesas ---------------------------------------------------------------

export type GrupoDespesaMock = "pessoal" | "operacional" | "impostos";

/** Despesa mensal fixa: dia do vencimento e % da receita mensal de referência da matriz. */
export const DESPESAS_FIXAS: { descricao: string; dia: number; grupo: GrupoDespesaMock; pct: number }[] = [
  { descricao: "Folha de pagamento", dia: 5, grupo: "pessoal", pct: 0.058 },
  { descricao: "Encargos sociais (FGTS e INSS)", dia: 20, grupo: "pessoal", pct: 0.022 },
  { descricao: "Vale-alimentação e benefícios", dia: 5, grupo: "pessoal", pct: 0.006 },
  { descricao: "Aluguel do imóvel", dia: 10, grupo: "operacional", pct: 0.018 },
  { descricao: "Energia elétrica", dia: 14, grupo: "operacional", pct: 0.015 },
  { descricao: "Água e esgoto", dia: 15, grupo: "operacional", pct: 0.002 },
  { descricao: "Internet e telefonia", dia: 10, grupo: "operacional", pct: 0.0012 },
  { descricao: "Manutenção e conservação", dia: 18, grupo: "operacional", pct: 0.004 },
  { descricao: "Marketing e encartes", dia: 25, grupo: "operacional", pct: 0.004 },
  { descricao: "Embalagens e sacolas", dia: 12, grupo: "operacional", pct: 0.0035 },
  { descricao: "Contabilidade e serviços", dia: 8, grupo: "operacional", pct: 0.0025 },
  { descricao: "Impostos (Simples Nacional)", dia: 20, grupo: "impostos", pct: 0.026 },
  { descricao: "Taxas e alvarás", dia: 28, grupo: "impostos", pct: 0.0008 },
];

/** Receita mensal de referência da matriz: base dos valores das despesas fixas. */
export const RECEITA_MENSAL_MATRIZ = 2_750_000;

/** Valor de uma despesa fixa em um mês (varia um pouco de mês a mês). */
export function valorDaDespesaFixa(filial: number, ano: number, mes: number, indice: number): number {
  const d = DESPESAS_FIXAS[indice];
  return RECEITA_MENSAL_MATRIZ * porteDaLoja(filial) * d.pct * entre(0.95, 1.05, filial, ano * 12 + mes, 50 + indice);
}

/** Despesa do dia: cada despesa fixa do mês rateada pelos dias do mês (competência). */
export function despesas(periodo: Periodo, lojas: number[]): LinhaDia[] {
  return diasCarregados(periodo).flatMap((n) => {
    const c = calendario(n);
    return lojas.map((filial) => ({
      filial,
      data: isoDoDia(n),
      valor: DESPESAS_FIXAS.reduce((s, _, i) => s + valorDaDespesaFixa(filial, c.ano, c.mes, i), 0) / c.ndias,
    }));
  });
}

// --- Metas ------------------------------------------------------------------

/** Meta = esperado × um fator de 0,99 a 1,11 por subgrupo e mês. */
const fatorDaMeta = (subgrupo: number, ano: number, mes: number) => 1.05 + 0.12 * (sorteio(subgrupo, ano * 12 + mes, 9) - 0.5);

function metaDoProduto(filial: number, n: number, p: Produto) {
  const c = calendario(n);
  const e = esperado(filial, n, p);
  const fator = fatorDaMeta(p.subgrupo, c.ano, c.mes);
  return { venda: e.venda * fator, lucro: e.lucro * fator };
}

const metasDoDia = new Map<number, { venda: number; lucro: number }>();

function metaDaLojaNoDia(filial: number, n: number) {
  const chave = filial * 1_000_000 + n;
  let m = metasDoDia.get(chave);
  if (!m) {
    m = { venda: 0, lucro: 0 };
    for (const p of PRODUTOS) {
      const x = metaDoProduto(filial, n, p);
      m.venda += x.venda;
      m.lucro += x.lucro;
    }
    metasDoDia.set(chave, m);
  }
  return m;
}

/** Dias com meta cadastrada: do primeiro dia da carga até o fim do ano do último dia. */
function diasComMeta(periodo: Periodo): number[] {
  const inicio = periodo.inicio < primeiroDia() ? primeiroDia() : periodo.inicio;
  const fim = periodo.fim > fimDoAnoDeMetas() ? fimDoAnoDeMetas() : periodo.fim;
  const dias: number[] = [];
  for (let n = diaNum(inicio); n <= diaNum(fim); n++) dias.push(n);
  return dias;
}

export function metasDiarias(periodo: Periodo, lojas: number[]): MetaDiaria[] {
  return diasComMeta(periodo).flatMap((n) =>
    lojas.map((filial) => {
      const m = metaDaLojaNoDia(filial, n);
      return { filial, data: isoDoDia(n), previsaoVenda: m.venda, previsaoLucro: m.lucro };
    }),
  );
}

const metasDoMes = new Map<string, Map<number, { venda: number; lucro: number }>>();

/** Meta do mês de cada produto da filial (soma dos dias do mês). */
function metaDoMesPorProduto(filial: number, ano: number, mes: number) {
  const chave = `${filial}-${ano}-${mes}`;
  let porProduto = metasDoMes.get(chave);
  if (!porProduto) {
    porProduto = new Map();
    const inicio = diaNum(`${ano}-${String(mes).padStart(2, "0")}-01`);
    const dias = calendario(inicio).ndias;
    for (const p of PRODUTOS) {
      let venda = 0;
      let lucro = 0;
      for (let n = inicio; n < inicio + dias; n++) {
        const x = metaDoProduto(filial, n, p);
        venda += x.venda;
        lucro += x.lucro;
      }
      porProduto.set(p.codigo, { venda, lucro });
    }
    metasDoMes.set(chave, porProduto);
  }
  return porProduto;
}

export function metasMensais(nivel: Nivel, anoInicio: number, anoFim: number, lojas: number[]): MetaMensalNivel[] {
  const linhas: MetaMensalNivel[] = [];
  const primeiro = calendario(diaNum(primeiroDia()));
  const ultimoAno = calendario(diaNum(fimDoAnoDeMetas())).ano;
  for (let ano = Math.max(anoInicio, primeiro.ano); ano <= Math.min(anoFim, ultimoAno); ano++) {
    for (let mes = ano === primeiro.ano ? primeiro.mes : 1; mes <= 12; mes++) {
      for (const filial of lojas) {
        const porProduto = metaDoMesPorProduto(filial, ano, mes);
        const porCodigo = new Map<number, { venda: number; lucro: number }>();
        for (const p of PRODUTOS) {
          const m = porProduto.get(p.codigo)!;
          const acumulado = porCodigo.get(p[nivel]) ?? { venda: 0, lucro: 0 };
          acumulado.venda += m.venda;
          acumulado.lucro += m.lucro;
          porCodigo.set(p[nivel], acumulado);
        }
        for (const [codigo, m] of porCodigo) {
          linhas.push({ filial, codigo, ano, mes, previsaoVenda: m.venda, previsaoLucro: m.lucro });
        }
      }
    }
  }
  return linhas;
}

/** Esperado de um departamento em um dia: base dos títulos de compra (ver `financeiro.ts`). */
export function custoEsperadoDoDepartamento(filial: number, n: number, departamento: number): number {
  let custo = 0;
  for (const p of PRODUTOS) {
    if (p.departamento === departamento) custo += esperado(filial, n, p).venda * (1 - p.margem);
  }
  return custo;
}
