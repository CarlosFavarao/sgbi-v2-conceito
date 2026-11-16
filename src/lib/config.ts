import { firstDayOfMonth } from "./date";
import type { Periodo } from "./filtros";

/**
 * Período inicial das telas: o mês da última carga (do dia 1 até o último dia com
 * venda). Os dados são D-1, então o período acompanha a data dos dados em vez de
 * ficar fixo. Sem a data ainda (as filiais não chegaram), um período qualquer: as
 * consultas esperam as filiais e não o usam.
 */
export function periodoPadrao(dataMaxima: string | null | undefined): Periodo {
  return dataMaxima
    ? { inicio: firstDayOfMonth(dataMaxima), fim: dataMaxima }
    : { inicio: "1970-01-01", fim: "1970-01-01" };
}
