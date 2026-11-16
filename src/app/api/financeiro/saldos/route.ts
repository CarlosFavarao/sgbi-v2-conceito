import type { NextRequest } from "next/server";
import { getSaldos } from "@/features/financeiro/server/data";
import { parseReferencia } from "@/features/financeiro/server/params";
import { handle, parseFiliais } from "@/server/params";
import { exigirAcesso } from "@/server/acesso";

/** Saldo das contas financeiras no fim da data de referência. */
export async function GET(request: NextRequest) {
  return handle(async () => {
    await exigirAcesso("financeiro", []);
    const params = request.nextUrl.searchParams;
    return getSaldos(parseReferencia(params), parseFiliais(params));
  }, "financeiro");
}
