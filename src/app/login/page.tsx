import Icon from "@mdi/react";
import { mdiBadgeAccountOutline, mdiCardAccountDetailsOutline, mdiDatabaseOutline, mdiDomain } from "@mdi/js";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { dados } from "@/dados";
import { formatCnpj } from "@/lib/format";
import pacote from "../../../package.json";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar · SGBI" };

function Linha({ icone, rotulo, children }: { icone: string; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="flex shrink-0 items-center gap-2 opacity-85">
        <Icon path={icone} size={0.75} aria-hidden />
        {rotulo}
      </span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

/** Dados do cliente de demonstração (D47), no lugar do status da API do VX. */
function InfoSistema() {
  const empresa = dados.empresa();
  return (
    <>
      <Linha icone={mdiDatabaseOutline} rotulo="Fonte de dados">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-2 py-0.5 text-xs">
          <span aria-hidden className="size-2 rounded-full bg-success" />
          Simulada (conceito)
        </span>
      </Linha>
      <Linha icone={mdiDomain} rotulo="Nome fantasia">
        {empresa.nomeFantasia}
      </Linha>
      <Linha icone={mdiCardAccountDetailsOutline} rotulo="CNPJ">
        {formatCnpj(empresa.cnpj)}
      </Linha>
      <Linha icone={mdiBadgeAccountOutline} rotulo="Código do cliente">
        {empresa.codigoCliente}
      </Linha>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>
      <section className="grid w-full max-w-3xl overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-md md:grid-cols-2">
        {/* O formulário lê `?de=` (destino depois de entrar). */}
        <Suspense>
          <FormLogin />
        </Suspense>
        <div className="hidden flex-col gap-4 bg-header p-6 text-header-foreground md:flex md:p-8">
          <h2 className="text-base font-semibold">Informações do sistema</h2>
          <InfoSistema />
          <p className="mt-auto text-xs opacity-85">
            Os dados são simulados: nenhum banco ou sistema externo é consultado.
          </p>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">Versão {pacote.version}</p>
    </main>
  );
}
