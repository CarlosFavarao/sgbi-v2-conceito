import "server-only";

import type { FonteDeDados } from "./tipos";
import { fonteMock } from "./mock";

/**
 * Fonte de dados do BI (D47). Todas as telas leem por aqui: para alimentar o
 * SGBI com dados externos, implemente `FonteDeDados` (ver `docs/dados-externos.md`)
 * e troque o valor abaixo.
 */
export const dados: FonteDeDados = fonteMock;

export type * from "./tipos";
