/**
 * Sorteio determinístico: o mesmo conjunto de números dá sempre o mesmo valor em
 * [0, 1). A simulação não guarda nada, recalcula cada dia quando é pedido, e a
 * tela mostra os mesmos números a cada visita.
 */
export function sorteio(...valores: number[]): number {
  let h = 0x811c9dc5;
  for (const v of valores) {
    h = Math.imul(h ^ (v | 0), 0x01000193);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Sorteio entre `min` e `max`. */
export const entre = (min: number, max: number, ...valores: number[]) => min + (max - min) * sorteio(...valores);

/** Escolhe um item da lista pelo sorteio. */
export const escolher = <T>(lista: readonly T[], ...valores: number[]): T =>
  lista[Math.floor(sorteio(...valores) * lista.length)];
