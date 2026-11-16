import "server-only";

import { dados } from "@/dados";
import type { FiliaisResponse } from "@/lib/filtros";

/** Filiais com movimento e o intervalo carregado; `dataMaxima` é o último dia com venda. */
export async function getFiliais(): Promise<FiliaisResponse> {
  return { filiais: dados.filiais(), ...dados.periodoCarregado() };
}
