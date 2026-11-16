"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { formatMoeda, formatPercentual } from "@/lib/format";
import type { SaldosResponse } from "../types";

/** Saldo de cada conta financeira (bancos, aplicação e cofre), com a parte de cada uma no total. */
export function SaldoContasCard({
  titulo = "Saldo de Caixa por Conta",
  saldos,
  carregando,
}: {
  titulo?: string;
  saldos: SaldosResponse | undefined;
  carregando: boolean;
}) {
  const contas = [...(saldos?.contas ?? [])].sort((a, b) => b.saldo - a.saldo);
  const maior = Math.max(...contas.map((c) => c.saldo), 1);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">{titulo}</CardTitle>
      </CardHeader>
      <div className="relative min-h-0 flex-1 overflow-auto px-3 pb-3 pt-1.5" aria-busy={carregando}>
        <p className="mb-2 text-xs text-muted-foreground">
          Total <span className="ml-1 text-base font-semibold tabular-nums text-foreground">{formatMoeda(saldos?.total ?? 0)}</span>
        </p>
        <ul className="flex flex-col gap-2">
          {contas.map((c) => (
            <li key={c.conta} className="text-xs" title={`${c.conta}: ${formatMoeda(c.saldo)}`}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate">{c.conta}</span>
                <span className="whitespace-nowrap font-semibold tabular-nums">{formatMoeda(c.saldo)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 flex-1 rounded-sm bg-secondary">
                  <span
                    className="block h-full rounded-sm bg-chart-1"
                    style={{ width: `${(c.saldo / maior) * 100}%` }}
                  />
                </span>
                <span className="w-14 text-right tabular-nums text-muted-foreground">
                  {formatPercentual(saldos?.total ? (c.saldo / saldos.total) * 100 : 0)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <LoadingOverlay ativo={carregando} className="rounded-b-2xl" />
      </div>
    </Card>
  );
}
