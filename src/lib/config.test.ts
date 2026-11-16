import { describe, expect, it } from "vitest";
import { periodoPadrao } from "./config";

describe("periodoPadrao", () => {
  it("é o mês da última carga, do dia 1 até o último dia com venda", () => {
    expect(periodoPadrao("2026-11-15")).toEqual({ inicio: "2026-11-01", fim: "2026-11-15" });
    expect(periodoPadrao("2026-10-31")).toEqual({ inicio: "2026-10-01", fim: "2026-10-31" });
  });

  it("devolve um período qualquer enquanto a data não chegou", () => {
    const p = periodoPadrao(null);
    expect(p.inicio <= p.fim).toBe(true);
  });
});
