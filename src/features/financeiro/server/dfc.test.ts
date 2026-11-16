import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays } from "@/lib/date";
import { dfcDoMes, getDfc } from "./dfc";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-16T15:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const lojas = [1, 2, 3];

describe("DFC do Mercado Teste", () => {
  it("saldo inicial + geração líquida = saldo final, em qualquer mês", async () => {
    for (const mes of ["2025-01", "2025-06", "2025-12", "2026-05", "2026-10", "2026-11"]) {
      const d = await dfcDoMes(mes, lojas);
      // Tolerância de centavos: cada conta do saldo é arredondada em 2 casas.
      expect(Math.abs(d.saldoInicial + d.geracao - d.saldoFinal)).toBeLessThan(0.1);
    }
  });

  it("o saldo inicial de um mês é o saldo final do anterior", async () => {
    const [outubro, novembro] = await Promise.all([dfcDoMes("2026-10", lojas), dfcDoMes("2026-11", lojas)]);
    expect(novembro.saldoInicial).toBeCloseTo(outubro.saldoFinal, 4);
    expect(novembro.saldoInicial).not.toBe(0);
  });

  it("entradas positivas, saídas negativas e geração = entradas + saídas", async () => {
    const d = await dfcDoMes("2026-10", lojas);
    expect(d.entradas).toBeGreaterThan(0);
    expect(d.saidas).toBeLessThan(0);
    expect(d.geracao).toBeCloseTo(d.entradas + d.saidas, 6);
    for (const id of ["vendas-a-vista", "cartoes", "clientes"] as const) expect(d.linhas[id]).toBeGreaterThan(0);
    for (const id of ["fornecedores", "pessoal", "operacionais", "impostos"] as const) expect(d.linhas[id]).toBeLessThan(0);
  });

  it("devolve 12 meses de evolução, as contas e as maiores movimentações", async () => {
    const r = await getDfc("2026-10", "2026-09", lojas);
    expect(r.evolucao).toHaveLength(12);
    expect(r.evolucao.at(-1)!.mes).toBe("2026-10");
    expect(r.contas.length).toBeGreaterThan(1);
    expect(r.contas.reduce((s, c) => s + c.saldo, 0)).toBeCloseTo(r.atual.saldoFinal, 1);
    expect(r.movimentacoes.length).toBeGreaterThan(0);
    expect(r.movimentacoes.every((m) => m.data >= "2026-10-01" && m.data <= "2026-10-31")).toBe(true);
  });

  it("no primeiro mês da carga a evolução começa nele (não há meses antes)", async () => {
    const r = await getDfc("2025-03", "2025-02", lojas);
    expect(r.evolucao.map((e) => e.mes)).toEqual(["2025-01", "2025-02", "2025-03"]);
  });

  it("o mês em andamento é comparado com os mesmos dias do outro mês", async () => {
    const r = await getDfc("2026-11", "2026-10", lojas);
    expect(r.atual.periodo).toEqual({ inicio: "2026-11-01", fim: "2026-11-15" });
    expect(r.comparacao.periodo).toEqual({ inicio: "2026-10-01", fim: "2026-10-15" });
    // Um mês fechado é comparado inteiro.
    const fechado = await getDfc("2026-10", "2026-09", lojas);
    expect(fechado.comparacao.periodo).toEqual({ inicio: "2026-09-01", fim: "2026-09-30" });
  });

  it("a comparação respeita o fim de fevereiro", async () => {
    const d = await dfcDoMes("2026-02", lojas, 31);
    expect(d.periodo.fim).toBe("2026-02-28");
  });

  it("o mês em andamento vai até ontem", async () => {
    const d = await dfcDoMes("2026-11", lojas);
    const ate = await dfcDoMes("2026-11", [1]);
    expect(d.mes).toBe("2026-11");
    expect(ate.saldoFinal).toBeLessThan(d.saldoFinal);
    expect(addDays("2026-11-15", 1)).toBe("2026-11-16");
  });
});
