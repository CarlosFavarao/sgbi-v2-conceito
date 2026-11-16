import { addDays, toIso } from "@/lib/date";
import type { Periodo } from "@/lib/filtros";

/**
 * Relógio e funções de dia da simulação. Os dados vão de 1º de janeiro do ano
 * passado até ontem (D-1, no fuso de Brasília), então a demonstração está sempre
 * "em dia", sem depender de uma carga fixa.
 */

const DIA_MS = 86_400_000;

/** Último dia com dados: ontem. */
export function ultimoDia(): string {
  return addDays(toIso(new Date(Date.now() - 3 * 3_600_000)), -1);
}

/** Primeiro dia com dados: 1º de janeiro do ano anterior ao do último dia. */
export function primeiroDia(): string {
  return `${Number(ultimoDia().slice(0, 4)) - 1}-01-01`;
}

/** Fim do ano do último dia: as metas já estão cadastradas até lá. */
export function fimDoAnoDeMetas(): string {
  return `${ultimoDia().slice(0, 4)}-12-31`;
}

/** Número do dia (dias desde 1970-01-01), para contas e sorteios. */
export function diaNum(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DIA_MS;
}

export function isoDoDia(n: number): string {
  return new Date(n * DIA_MS).toISOString().slice(0, 10);
}

export type Calendario = { dow: number; dia: number; mes: number; ano: number; ndias: number };

const calendarios = new Map<number, Calendario>();

/** Dia da semana (0 = domingo), dia, mês, ano e dias do mês de um número de dia. */
export function calendario(n: number): Calendario {
  let c = calendarios.get(n);
  if (!c) {
    const d = new Date(n * DIA_MS);
    c = {
      dow: d.getUTCDay(),
      dia: d.getUTCDate(),
      mes: d.getUTCMonth() + 1,
      ano: d.getUTCFullYear(),
      ndias: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(),
    };
    calendarios.set(n, c);
  }
  return c;
}

/** Números dos dias de `periodo` que têm dados (cortado entre o primeiro e o último dia). */
export function diasCarregados(periodo: Periodo): number[] {
  const inicio = diaNum(periodo.inicio < primeiroDia() ? primeiroDia() : periodo.inicio);
  const fim = diaNum(periodo.fim > ultimoDia() ? ultimoDia() : periodo.fim);
  const dias: number[] = [];
  for (let n = inicio; n <= fim; n++) dias.push(n);
  return dias;
}
