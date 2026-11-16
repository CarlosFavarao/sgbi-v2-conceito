import type { NextRequest } from "next/server";
import { getDfc } from "@/features/financeiro/server/dfc";
import { parseMes } from "@/features/financeiro/server/params";
import { handle, parseFiliais } from "@/server/params";
import { exigirAcesso } from "@/server/acesso";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await exigirAcesso("dfc", []);
    const params = request.nextUrl.searchParams;
    return getDfc(parseMes(params, "mes"), parseMes(params, "comparacao"), parseFiliais(params));
  }, "financeiro");
}
