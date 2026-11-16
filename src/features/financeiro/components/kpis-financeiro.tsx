"use client";

import type { ItemDoBloco } from "@/components/layout/bloco-kpis";
import {
  mdiAlertOutline,
  mdiArrowBottomRight,
  mdiArrowTopRight,
  mdiCalendarClock,
  mdiCashMultiple,
  mdiWalletOutline,
} from "@mdi/js";
import { corDoTom, Delta, KpiCard, SemDados } from "@/components/kpi/kpi-card";
import { Sparkline } from "@/components/kpi/sparkline";
import { variacao } from "@/lib/calc";
import { formatData, formatDecimal, formatMoeda } from "@/lib/format";

type Serie = { data: string; valor: number | null }[];
type Totais = { entradas: number; saidas: number; resultado: number };

function Vs({ valor }: { valor: number }) {
  return <span className="whitespace-nowrap tabular-nums">vs {formatMoeda(valor)} (mês ant.)</span>;
}

/** KPIs do Fluxo de Caixa (o `BlocoKpis` da grade personalizável monta a grade deles). */
export function kpisDoFinanceiro({
  atual,
  anterior,
  menorSaldo,
  saldo,
  referencia,
  saidasPrevistas,
  diasPrevistos,
  series,
  carregando,
  carregandoSaldo,
}: {
  atual: Totais;
  anterior: Totais | null;
  /** Menor acumulado previsto nos próximos dias (a partir de zero) e a data. */
  menorSaldo: { valor: number; data: string } | null;
  /** Saldo das contas na referência; null enquanto não chega. */
  saldo: number | null;
  referencia: string;
  /** Saídas previstas nos próximos `diasPrevistos` dias. */
  saidasPrevistas: number;
  diasPrevistos: number;
  series: { entradas: Serie; saidas: Serie; resultado: Serie };
  carregando: boolean;
  carregandoSaldo: boolean;
}): ItemDoBloco[] {
  const comparar = (chave: keyof Totais, maiorMelhor: boolean) =>
    anterior && (
      <>
        <Delta value={variacao(atual[chave], anterior[chave])} unidade="%" maiorMelhor={maiorMelhor} />
        <Vs valor={anterior[chave]} />
      </>
    );

  return [
    {
      id: "saldo",
      titulo: "Saldo em Caixa Hoje",
      node: (
        <KpiCard
          titulo="Saldo em Caixa Hoje"
          ajuda="Saldo das contas bancárias, aplicações e do cofre no fim da data de referência."
          icone={mdiWalletOutline}
          tom="blue"
          carregando={carregandoSaldo}
          valor={saldo == null ? <SemDados>Sem saldo</SemDados> : formatMoeda(saldo)}
          linhas={saldo != null && <span>em {formatData(referencia)}</span>}
        />
      ),
    },
    {
      id: "entradas",
      titulo: "Entradas do Período",
      node: (
        <KpiCard
          titulo="Entradas do Período"
          ajuda="Vendas à vista (dinheiro e Pix), cartões liquidados (valor líquido no vencimento) e contas a receber recebidas, do início do mês até a referência."
          icone={mdiArrowTopRight}
          tom="green"
          carregando={carregando}
          valor={formatMoeda(atual.entradas)}
          linhas={comparar("entradas", true)}
          grafico={
            <Sparkline
              label="Entradas"
              kind="bar"
              color={corDoTom("green")}
              format={formatMoeda}
              data={series.entradas}
            />
          }
        />
      ),
    },
    {
      id: "saidas",
      titulo: "Saídas do Período",
      node: (
        <KpiCard
          titulo="Saídas do Período"
          ajuda="Contas a pagar pagas do início do mês até a referência."
          icone={mdiArrowBottomRight}
          tom="coral"
          carregando={carregando}
          valor={formatMoeda(atual.saidas)}
          linhas={comparar("saidas", false)}
          grafico={
            <Sparkline label="Saídas" kind="bar" color={corDoTom("coral")} format={formatMoeda} data={series.saidas} />
          }
        />
      ),
    },
    {
      id: "resultado",
      titulo: "Resultado de Caixa",
      node: (
        <KpiCard
          titulo="Resultado de Caixa"
          ajuda="Entradas menos saídas realizadas no período."
          icone={mdiCashMultiple}
          tom="teal"
          carregando={carregando}
          valor={formatMoeda(atual.resultado)}
          linhas={comparar("resultado", true)}
          grafico={
            <Sparkline
              label="Resultado"
              kind="bar"
              color={corDoTom("teal")}
              format={formatMoeda}
              data={series.resultado}
            />
          }
        />
      ),
    },
    {
      id: "menor-saldo",
      titulo: "Menor Saldo Projetado",
      node: (
        <KpiCard
          titulo="Menor Saldo Projetado"
          ajuda="Saldo de hoje mais o menor valor do fluxo previsto acumulado nos próximos 30 dias."
          icone={mdiAlertOutline}
          tom="orange"
          carregando={carregando || carregandoSaldo}
          valor={
            menorSaldo && saldo != null ? formatMoeda(saldo + menorSaldo.valor) : <SemDados>Sem previsão</SemDados>
          }
          linhas={menorSaldo && saldo != null && <span>em {formatData(menorSaldo.data)}</span>}
        />
      ),
    },
    {
      id: "cobertura",
      titulo: "Dias de Cobertura",
      node: (
        <KpiCard
          titulo="Dias de Cobertura"
          ajuda="Quantos dias o saldo de hoje cobre as saídas previstas, pela média diária dos próximos 30 dias."
          icone={mdiCalendarClock}
          tom="purple"
          carregando={carregando || carregandoSaldo}
          valor={
            saldo != null && saidasPrevistas > 0 ? (
              `${formatDecimal((saldo * diasPrevistos) / saidasPrevistas)} dias`
            ) : (
              <SemDados>Sem saídas previstas</SemDados>
            )
          }
          linhas={saldo != null && saidasPrevistas > 0 && <span>{formatMoeda(saidasPrevistas / diasPrevistos)} de saídas por dia</span>}
        />
      ),
    },
  ];
}
