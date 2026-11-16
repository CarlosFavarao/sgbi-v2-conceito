import type {
  FiltroTitulos,
  LancamentoCaixa,
  LinhaCartao,
  LinhaDia,
  SaldoConta,
  TituloPagar,
  TituloReceber,
} from "../tipos";
import type { Periodo } from "@/lib/filtros";
import { entre, escolher, sorteio } from "./aleatorio";
import { porteDaLoja } from "./catalogo";
import { calendario, diaNum, diasCarregados, isoDoDia, primeiroDia, ultimoDia } from "./tempo";
import { custoEsperadoDoDepartamento, DESPESAS_FIXAS, RECEITA_MENSAL_MATRIZ, resumoDoDia, valorDaDespesaFixa } from "./vendas";

/**
 * Financeiro simulado: cartões (liquidação pelo prazo de cada operadora), contas a
 * receber (convênios), contas a pagar (fornecedores e despesas fixas), investimentos,
 * financiamentos e saldos das contas. Tudo sai das mesmas vendas de `vendas.ts`, então
 * os valores conversam entre as telas. Só existe até o último dia (D-1): baixas
 * depois dele ficam em aberto.
 */

const round2 = (x: number) => Math.round(x * 100) / 100;

// --- Cartões ----------------------------------------------------------------

const EMPRESAS_CARTAO = [
  { nome: "Visa Débito", peso: 0.17, prazo: 1, taxa: 0.0139 },
  { nome: "Mastercard Débito", peso: 0.15, prazo: 1, taxa: 0.0139 },
  { nome: "Elo Débito", peso: 0.06, prazo: 1, taxa: 0.0159 },
  { nome: "Visa Crédito", peso: 0.2, prazo: 30, taxa: 0.0299 },
  { nome: "Mastercard Crédito", peso: 0.19, prazo: 30, taxa: 0.0299 },
  { nome: "Elo Crédito", peso: 0.07, prazo: 30, taxa: 0.0329 },
  { nome: "Alelo Alimentação", peso: 0.1, prazo: 28, taxa: 0.042 },
  { nome: "Sodexo Refeição", peso: 0.06, prazo: 28, taxa: 0.045 },
] as const;

/** Cartão de uma empresa nas vendas de um dia (a venda do PDV paga em cartão, cerca de 58%). */
function cartaoDoDia(filial: number, nVenda: number, i: number): LinhaCartao {
  const e = EMPRESAS_CARTAO[i];
  const bruto = resumoDoDia(filial, nVenda).pdv * entre(0.54, 0.62, filial, nVenda, 51) * e.peso * entre(0.92, 1.08, filial, nVenda, 52 + i);
  return {
    filial,
    empresa: e.nome,
    dataVenda: isoDoDia(nVenda),
    dataVencimento: isoDoDia(nVenda + e.prazo),
    valorBruto: round2(bruto),
    valorLiquido: round2(bruto * (1 - e.taxa)),
  };
}

export function cartoesPorVenda(periodo: Periodo, lojas: number[]): LinhaCartao[] {
  return diasCarregados(periodo).flatMap((n) =>
    lojas.flatMap((filial) => EMPRESAS_CARTAO.map((_, i) => cartaoDoDia(filial, n, i))),
  );
}

export function cartoesPorVencimento(periodo: Periodo, lojas: number[]): LinhaCartao[] {
  const linhas: LinhaCartao[] = [];
  const [primeiro, ultimo] = limitarAoCarregado(0, Infinity);
  for (let v = diaNum(periodo.inicio); v <= diaNum(periodo.fim); v++) {
    EMPRESAS_CARTAO.forEach((e, i) => {
      const nVenda = v - e.prazo;
      if (nVenda < primeiro || nVenda > ultimo) return;
      for (const filial of lojas) linhas.push(cartaoDoDia(filial, nVenda, i));
    });
  }
  return linhas;
}

/** Vendas em dinheiro e Pix: o que o PDV vendeu e não foi para o cartão. */
export function vendasAVista(periodo: Periodo, lojas: number[]): LinhaDia[] {
  return diasCarregados(periodo).flatMap((n) =>
    lojas.map((filial) => {
      const noCartao = EMPRESAS_CARTAO.reduce((s, _, i) => s + cartaoDoDia(filial, n, i).valorBruto, 0);
      return { filial, data: isoDoDia(n), valor: round2(resumoDoDia(filial, n).pdv - noCartao) };
    }),
  );
}

// --- Contas a receber (convênios) -------------------------------------------

const CLIENTES = [
  "Prefeitura Municipal",
  "Escola Sol Nascente",
  "Restaurante Sabor",
  "Hotel Beira Rio",
  "Padaria Dois Irmãos",
  "Clínica Vida Plena",
  "Construtora Alicerce",
  "Lanchonete do Zé",
  "Transp. Rápido Sul",
  "Igreja Bom Pastor",
  "Asilo Santa Clara",
  "Buffet Festa Boa",
];

const PRAZOS_RECEBER = [15, 30, 30, 45];
const ATRASOS_RECEBIMENTO = [0, 0, 1, 2, 3, 5];
/** Maior distância entre a emissão e a baixa de um título a receber (45 + 18 dias). */
const FOLGA_RECEBER = 65;
const FOLGA_PAGAR = 45;

/** Dias de vendas e emissões simulados antes do primeiro dia da carga, para os títulos e cartões que vencem logo no começo dela. */
const AQUECIMENTO = 70;

/** Dias de emissão com dados: do aquecimento até o último dia. */
const limitarAoCarregado = (inicio: number, fim: number): [number, number] => [
  Math.max(inicio, diaNum(primeiroDia()) - AQUECIMENTO),
  Math.min(fim, diaNum(ultimoDia())),
];

function receberEmitidos(filial: number, inicio: number, fim: number): TituloReceber[] {
  const titulos: TituloReceber[] = [];
  const [de, ate] = limitarAoCarregado(inicio, fim);
  const ultimo = diaNum(ultimoDia());
  for (let n = de; n <= ate; n++) {
    if (sorteio(filial, n, 60) >= 0.55) continue;
    const valor = round2((1200 + 16800 * sorteio(filial, n, 61) ** 2) * (0.6 + 0.4 * porteDaLoja(filial)));
    const vencimento = n + escolher(PRAZOS_RECEBER, filial, n, 62);
    const sorte = sorteio(filial, n, 64);
    const atraso = sorte < 0.82 ? escolher(ATRASOS_RECEBIMENTO, filial, n, 65) : sorte < 0.92 ? 18 : null;
    const recebimento = atraso == null || vencimento + atraso > ultimo ? null : vencimento + atraso;
    titulos.push({
      filial,
      cliente: escolher(CLIENTES, filial, n, 63),
      emissao: isoDoDia(n),
      vencimento: isoDoDia(vencimento),
      recebimento: recebimento == null ? null : isoDoDia(recebimento),
      valorDocumento: valor,
      valorRecebido: recebimento == null ? null : round2(valor * (sorteio(filial, n, 66) < 0.1 ? 0.98 : 1)),
    });
  }
  return titulos;
}

const dentro = (data: string | null, p: Periodo) => !!data && data >= p.inicio && data <= p.fim;

export function titulosReceber(lojas: number[], filtro: FiltroTitulos): TituloReceber[] {
  const { emissao, vencimentoOuBaixa: janela } = filtro;
  const inicio = emissao ? diaNum(emissao.inicio) : janela ? diaNum(janela.inicio) - FOLGA_RECEBER : 0;
  const fim = emissao ? diaNum(emissao.fim) : janela ? diaNum(janela.fim) : -1;
  return lojas
    .flatMap((filial) => receberEmitidos(filial, inicio, fim))
    .filter(
      (t) =>
        (!emissao || dentro(t.emissao, emissao)) &&
        (!janela || dentro(t.vencimento, janela) || dentro(t.recebimento, janela)),
    );
}

// --- Contas a pagar ---------------------------------------------------------

const FORNECEDORES = [
  { id: 1, nome: "Distribuidora Alfa Alimentos", departamento: 1, cadencia: 7, prazo: 28 },
  { id: 2, nome: "Hortifruti Vale Verde", departamento: 2, cadencia: 3, prazo: 7 },
  { id: 3, nome: "Frigorífico Boa Carne", departamento: 3, cadencia: 5, prazo: 14 },
  { id: 4, nome: "Moinho São José", departamento: 4, cadencia: 10, prazo: 21 },
  { id: 5, nome: "Bebidas Real Distribuidora", departamento: 5, cadencia: 7, prazo: 30 },
  { id: 6, nome: "Laticínios Serra Azul", departamento: 6, cadencia: 7, prazo: 21 },
  { id: 7, nome: "Brilho Forte Limpeza", departamento: 7, cadencia: 14, prazo: 30 },
  { id: 8, nome: "Higiene Total Atacado", departamento: 8, cadencia: 14, prazo: 30 },
] as const;

const ATRASOS_PAGAMENTO = [0, 0, 0, 1, 2];

/** Faturas dos fornecedores (mercadoria): uma a cada `cadencia` dias, com o valor do que o departamento deve vender e repor. */
function mercadoriasEmitidas(filial: number, inicio: number, fim: number): TituloPagar[] {
  const titulos: TituloPagar[] = [];
  const [de, ate] = limitarAoCarregado(inicio, fim);
  const ultimo = diaNum(ultimoDia());
  for (let n = de; n <= ate; n++) {
    for (const f of FORNECEDORES) {
      if ((n + f.id * 3 + filial) % f.cadencia !== 0) continue;
      const valor = round2(custoEsperadoDoDepartamento(filial, n, f.departamento) * f.cadencia * entre(0.92, 1.08, filial, n, f.id, 71));
      const vencimento = n + f.prazo;
      const atraso = sorteio(filial, n, f.id, 70) < 0.03 ? 12 : escolher(ATRASOS_PAGAMENTO, filial, n, f.id, 72);
      const pagamento = vencimento + atraso > ultimo ? null : vencimento + atraso;
      titulos.push({
        filial,
        nome: f.nome,
        classificacao: "M",
        grupoDespesa: null,
        emissao: isoDoDia(n),
        vencimento: isoDoDia(vencimento),
        pagamento: pagamento == null ? null : isoDoDia(pagamento),
        valor,
        valorPago: pagamento == null ? null : valor,
      });
    }
  }
  return titulos;
}

/** Despesas fixas dos meses entre `inicio` e `fim` (dias): emitidas 7 dias antes do vencimento. */
function despesasEmitidas(filial: number, inicio: number, fim: number): TituloPagar[] {
  const titulos: TituloPagar[] = [];
  const ultimo = diaNum(ultimoDia());
  const primeiro = calendario(diaNum(primeiroDia()));
  const a = calendario(Math.max(inicio, diaNum(primeiroDia())));
  const b = calendario(fim);
  for (let indiceMes = a.ano * 12 + a.mes - 1; indiceMes <= b.ano * 12 + b.mes - 1; indiceMes++) {
    const ano = Math.floor(indiceMes / 12);
    const mes = (indiceMes % 12) + 1;
    if (ano * 12 + mes < primeiro.ano * 12 + primeiro.mes) continue;
    const ndias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    DESPESAS_FIXAS.forEach((d, i) => {
      const vencimento = diaNum(`${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d.dia, ndias)).padStart(2, "0")}`);
      const emissao = vencimento - 7;
      if (emissao < inicio || emissao > fim) return;
      const valor = round2(valorDaDespesaFixa(filial, ano, mes, i));
      const atraso = sorteio(filial, ano * 12 + mes, 80 + i) < 0.03 ? 9 : 0;
      const pagamento = vencimento + atraso > ultimo ? null : vencimento + atraso;
      titulos.push({
        filial,
        nome: d.descricao,
        classificacao: "D",
        grupoDespesa: d.grupo,
        emissao: isoDoDia(emissao),
        vencimento: isoDoDia(vencimento),
        pagamento: pagamento == null ? null : isoDoDia(pagamento),
        valor,
        valorPago: pagamento == null ? null : valor,
      });
    });
  }
  return titulos;
}

export function titulosPagar(lojas: number[], filtro: FiltroTitulos): TituloPagar[] {
  const { emissao, vencimentoOuBaixa: janela } = filtro;
  const inicio = emissao ? diaNum(emissao.inicio) : janela ? diaNum(janela.inicio) - FOLGA_PAGAR : 0;
  const fim = emissao ? diaNum(emissao.fim) : janela ? diaNum(janela.fim) : -1;
  return lojas
    .flatMap((filial) => [...mercadoriasEmitidas(filial, inicio, fim), ...despesasEmitidas(filial, inicio, fim)])
    .filter(
      (t) =>
        (!emissao || dentro(t.emissao, emissao)) &&
        (!janela || dentro(t.vencimento, janela) || dentro(t.pagamento, janela)),
    );
}

// --- Investimentos e financiamentos -----------------------------------------

const IMOBILIZADOS = [
  "Reforma da área de vendas",
  "Câmara fria nova",
  "Gôndolas e prateleiras",
  "Equipamentos de PDV e balanças",
];

/** Lançamentos de investimento e financiamento dos meses do período, só até o último dia. */
export function lancamentosCaixa(periodo: Periodo, lojas: number[]): LancamentoCaixa[] {
  const lancamentos: LancamentoCaixa[] = [];
  const [de, ate] = limitarAoCarregado(diaNum(periodo.inicio), diaNum(periodo.fim));
  if (de > ate) return lancamentos;
  const a = calendario(de);
  const b = calendario(ate);
  for (let indiceMes = a.ano * 12 + a.mes - 1; indiceMes <= b.ano * 12 + b.mes - 1; indiceMes++) {
    const ano = Math.floor(indiceMes / 12);
    const mes = (indiceMes % 12) + 1;
    for (const filial of lojas) {
      const receita = RECEITA_MENSAL_MATRIZ * porteDaLoja(filial);
      const novo = (dia: number, categoria: LancamentoCaixa["categoria"], descricao: string, valor: number) => {
        const data = isoDoDia(diaNum(`${ano}-${String(mes).padStart(2, "0")}-01`) + dia - 1);
        const n = diaNum(data);
        if (n >= de && n <= ate) lancamentos.push({ filial, data, categoria, descricao, valor: round2(valor) });
      };
      novo(15, "amortizacao", "Parcela do financiamento de capital de giro", receita * 0.035 * entre(0.99, 1.01, filial, indiceMes, 99));
      novo(15, "juros", "Juros do financiamento de capital de giro", receita * 0.01 * entre(0.99, 1.01, filial, indiceMes, 98));
      if (sorteio(filial, indiceMes, 90) < 0.4) {
        novo(
          3 + Math.floor(sorteio(filial, indiceMes, 91) * 22),
          "imobilizado",
          escolher(IMOBILIZADOS, filial, indiceMes, 92),
          receita * entre(0.006, 0.022, filial, indiceMes, 93),
        );
      }
      if (sorteio(filial, indiceMes, 94) < 0.06) {
        novo(10 + Math.floor(sorteio(filial, indiceMes, 95) * 10), "veiculos", "Veículo de entregas", receita * 0.045);
      }
      if (sorteio(filial, indiceMes, 96) < 0.05) {
        novo(8, "captacao", "Liberação de capital de giro", receita * 0.06);
      }
    }
  }
  return lancamentos;
}

// --- Saldos -----------------------------------------------------------------

const SALDO_INICIAL_MATRIZ = 1_000_000;

const CONTAS = [
  { nome: "Banco do Brasil · C/C", parte: 0.55 },
  { nome: "Caixa Econômica · C/C", parte: 0.33 },
  { nome: "Sicredi · Aplicação", parte: 0.1 },
  { nome: "Cofre da loja", parte: 0.02 },
] as const;

const acumulados = new Map<string, Float64Array>();

/** Saldo total da filial no fim de cada dia, do primeiro ao último: o saldo inicial mais o caixa líquido dos dias. */
function saldoPorDia(filial: number): Float64Array {
  const primeiro = diaNum(primeiroDia());
  const ultimo = diaNum(ultimoDia());
  const chave = `${filial}:${primeiro}:${ultimo}`;
  let saldo = acumulados.get(chave);
  if (saldo) return saldo;

  const liquido = new Float64Array(ultimo - primeiro + 1);
  const somar = (n: number, valor: number) => {
    if (n >= primeiro && n <= ultimo) liquido[n - primeiro] += valor;
  };
  const periodo = { inicio: primeiroDia(), fim: ultimoDia() };

  for (const v of vendasAVista(periodo, [filial])) somar(diaNum(v.data), v.valor);
  for (const c of cartoesPorVencimento(periodo, [filial])) somar(diaNum(c.dataVencimento), c.valorLiquido);
  const desde = primeiro - AQUECIMENTO;
  for (const t of receberEmitidos(filial, desde, ultimo)) if (t.recebimento) somar(diaNum(t.recebimento), t.valorRecebido!);
  for (const t of [...mercadoriasEmitidas(filial, desde, ultimo), ...despesasEmitidas(filial, desde, ultimo)]) {
    if (t.pagamento) somar(diaNum(t.pagamento), -t.valorPago!);
  }
  for (const l of lancamentosCaixa(periodo, [filial])) somar(diaNum(l.data), l.categoria === "captacao" ? l.valor : -l.valor);

  saldo = new Float64Array(liquido.length);
  let corrente = SALDO_INICIAL_MATRIZ * porteDaLoja(filial);
  for (let i = 0; i < liquido.length; i++) {
    corrente += liquido[i];
    saldo[i] = corrente;
  }
  acumulados.set(chave, saldo);
  return saldo;
}

export function saldos(data: string, lojas: number[]): SaldoConta[] {
  const primeiro = diaNum(primeiroDia());
  const n = Math.min(diaNum(data), diaNum(ultimoDia()));
  return lojas.flatMap((filial) => {
    const total = n < primeiro ? SALDO_INICIAL_MATRIZ * porteDaLoja(filial) : saldoPorDia(filial)[n - primeiro];
    return CONTAS.map((c) => ({ filial, conta: c.nome, saldo: round2(total * c.parte) }));
  });
}
