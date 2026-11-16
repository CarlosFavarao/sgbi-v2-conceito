import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays } from "@/lib/date";
import { DEPARTAMENTOS, GRUPOS, HIERARQUIA, LOJAS, PRODUTOS, SUBGRUPOS } from "./catalogo";
import { fonteMock as dados } from "./index";
import { primeiroDia, ultimoDia } from "./tempo";

// Dia fixo: a simulação é relativa a "ontem".
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-16T15:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const lojas = LOJAS.map((l) => l.codigo);
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const novembro = { inicio: "2026-11-01", fim: "2026-11-15" };

describe("período carregado", () => {
  it("vai de 1º de janeiro do ano anterior até ontem", () => {
    expect(primeiroDia()).toBe("2025-01-01");
    expect(ultimoDia()).toBe("2026-11-15");
    expect(dados.periodoCarregado()).toEqual({ dataMinima: "2025-01-01", dataMaxima: "2026-11-15" });
  });

  it("não devolve dias fora do período carregado", () => {
    const linhas = dados.cuponsDiarios({ inicio: "2024-12-30", fim: "2026-11-20" }, [1]);
    expect(linhas[0].data).toBe("2025-01-01");
    expect(linhas.at(-1)!.data).toBe("2026-11-15");
    expect(dados.analise({ inicio: "2026-11-16", fim: "2026-11-30" }, lojas)).toEqual([]);
  });
});

describe("Mercado Teste", () => {
  it("é um cliente com três filiais", () => {
    expect(dados.empresa().nomeFantasia).toBe("Mercado Teste");
    expect(dados.filiais().map((f) => f.codigo)).toEqual([1, 2, 3]);
  });

  it("tem hierarquia coerente e códigos únicos", () => {
    const codigos = [...DEPARTAMENTOS, ...GRUPOS, ...SUBGRUPOS].map((n) => n.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    const grupoPorCodigo = new Map(HIERARQUIA.grupos.map((g) => [g.codigo, g]));
    const subgrupoPorCodigo = new Map(HIERARQUIA.subgrupos.map((s) => [s.codigo, s]));
    for (const p of PRODUTOS) {
      expect(subgrupoPorCodigo.get(p.subgrupo)?.grupo).toBe(p.grupo);
      expect(grupoPorCodigo.get(p.grupo)?.departamento).toBe(p.departamento);
    }
  });
});

describe("venda", () => {
  it("é determinística: a mesma consulta dá os mesmos números", () => {
    expect(dados.analise(novembro, [1])).toEqual(dados.analise(novembro, [1]));
  });

  it("fecha: venda = PDV + faturamento, e o custo fica abaixo da venda", () => {
    for (const l of dados.analise(novembro, lojas)) {
      expect(l.totalVenda).toBeCloseTo(l.totalPDV + l.totalFaturamento, 6);
      expect(l.totalCusto).toBeCloseTo(l.totalCustoPDV + l.totalCustoFaturamento, 6);
      expect(l.totalCusto).toBeLessThan(l.totalVenda);
      expect(l.quantidadePDV).toBeLessThanOrEqual(l.quantidade);
    }
  });

  it("a matriz vende mais que as outras lojas e a margem fica em torno de 30%", () => {
    const venda = (f: number) => soma(dados.analise(novembro, [f]).map((l) => l.totalVenda));
    expect(venda(1)).toBeGreaterThan(venda(2));
    expect(venda(2)).toBeGreaterThan(venda(3));
    const todas = dados.analise(novembro, lojas);
    const margem = 1 - soma(todas.map((l) => l.totalCusto)) / soma(todas.map((l) => l.totalVenda));
    expect(margem).toBeGreaterThan(0.25);
    expect(margem).toBeLessThan(0.35);
  });

  it("os cupons têm ticket médio plausível e itens por cupom", () => {
    const dias = dados.cuponsDiarios(novembro, lojas);
    const ticket = soma(dias.map((d) => d.vendaPdv)) / soma(dias.map((d) => d.cupons));
    expect(ticket).toBeGreaterThan(55);
    expect(ticket).toBeLessThan(100);
    // A venda do PDV dos cupons bate com a da análise gerencial.
    expect(soma(dias.map((d) => d.vendaPdv))).toBeCloseTo(soma(dados.analise(novembro, lojas).map((l) => l.totalPDV)), 4);
  });

  it("os cupons por nível nunca passam do total de cupons", () => {
    const total = soma(dados.cuponsDiarios(novembro, lojas).map((d) => d.cupons));
    for (const nivel of ["departamento", "grupo", "subgrupo"] as const) {
      for (const l of dados.cuponsPorNivel(nivel, novembro, lojas)) expect(l.cupons).toBeLessThanOrEqual(total);
    }
  });
});

describe("metas", () => {
  it("as metas mensais por nível fecham com as metas diárias da loja", () => {
    const mes = { inicio: "2026-10-01", fim: "2026-10-31" };
    const diaria = soma(dados.metasDiarias(mes, lojas).map((m) => m.previsaoVenda));
    for (const nivel of ["departamento", "grupo", "subgrupo"] as const) {
      const mensal = soma(
        dados
          .metasMensais(nivel, 2026, 2026, lojas)
          .filter((m) => m.mes === 10)
          .map((m) => m.previsaoVenda),
      );
      expect(mensal).toBeCloseTo(diaria, 4);
    }
  });

  it("a meta cobre o ano inteiro do último dia, e o realizado fica em torno dela", () => {
    expect(dados.metasDiarias({ inicio: "2026-12-31", fim: "2026-12-31" }, [1])).toHaveLength(1);
    const meta = soma(dados.metasDiarias(novembro, lojas).map((m) => m.previsaoVenda));
    const venda = soma(dados.analise(novembro, lojas).map((l) => l.totalVenda));
    expect(venda / meta).toBeGreaterThan(0.85);
    expect(venda / meta).toBeLessThan(1.15);
  });
});

describe("financeiro", () => {
  it("o cartão liquida depois da venda e o líquido é menor que o bruto", () => {
    for (const c of dados.cartoesPorVenda(novembro, [1])) {
      expect(c.dataVencimento >= c.dataVenda).toBe(true);
      expect(c.valorLiquido).toBeLessThan(c.valorBruto);
    }
  });

  it("os cartões por vencimento só trazem vendas já feitas (nada depois de ontem)", () => {
    const futuro = dados.cartoesPorVencimento({ inicio: "2026-11-16", fim: "2026-12-31" }, lojas);
    expect(futuro.length).toBeGreaterThan(0);
    for (const c of futuro) expect(c.dataVenda <= ultimoDia()).toBe(true);
  });

  it("não há baixa depois do último dia", () => {
    const janela = { inicio: "2026-09-01", fim: "2026-12-31" };
    for (const t of dados.titulosReceber(lojas, { vencimentoOuBaixa: janela })) {
      if (t.recebimento) expect(t.recebimento <= ultimoDia()).toBe(true);
    }
    for (const t of dados.titulosPagar(lojas, { vencimentoOuBaixa: janela })) {
      if (t.pagamento) expect(t.pagamento <= ultimoDia()).toBe(true);
      expect(t.valorPago == null).toBe(t.pagamento == null);
    }
  });

  it("filtra por emissão e por vencimento ou baixa", () => {
    const mes = { inicio: "2026-10-01", fim: "2026-10-31" };
    for (const t of dados.titulosPagar(lojas, { emissao: mes })) expect(t.emissao >= mes.inicio && t.emissao <= mes.fim).toBe(true);
    for (const t of dados.titulosReceber(lojas, { vencimentoOuBaixa: mes })) {
      const noMes = (d: string | null) => !!d && d >= mes.inicio && d <= mes.fim;
      expect(noMes(t.vencimento) || noMes(t.recebimento)).toBe(true);
    }
  });

  it("o saldo do dia seguinte é o do dia mais o caixa líquido do dia (sem buracos)", () => {
    const total = (d: string) => soma(dados.saldos(d, lojas).map((s) => s.saldo));
    expect(total(addDays(primeiroDia(), -1))).toBeGreaterThan(0);
    // Depois do último dia, o saldo não muda.
    expect(total("2026-12-31")).toBeCloseTo(total(ultimoDia()), 6);
  });

  it("o saldo das contas se mantém positivo ao longo de toda a carga", () => {
    for (const d of ["2025-01-31", "2025-06-30", "2025-12-31", "2026-06-30", "2026-11-15"]) {
      for (const s of dados.saldos(d, lojas)) expect(s.saldo).toBeGreaterThan(0);
    }
  });
});
