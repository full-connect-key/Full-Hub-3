import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CascaDoPortal } from "@/components/portal/casca-do-portal";
import { Logo } from "@/components/shared/logo";
import { exigirAreaDoCliente } from "@/lib/auth/portal-administrativo";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";

/**
 * O portal da pessoa cliente — e, para a gestão, a escolha de qual portal abrir.
 *
 * `exigirAreaDoCliente()` deixa passar o cliente e a gestão, e devolve 403 para
 * o colaborador. A diferença entre os dois que passam é grande, e por isso a
 * casca não é a mesma: o cliente recebe o portal inteiro, com a navegação das
 * seções; quem é da equipe recebe uma casca simples, porque /portal para ela é
 * uma bifurcação e não um destino — a tela do cliente mora em /portal/{slug},
 * onde há faixa de aviso e registro de visita.
 *
 * Montar a navegação do portal para a equipe aqui seria prometer seções que
 * não têm empresa nenhuma por trás: `my_client_ids()` é vazio para quem é da
 * agência, e todas voltariam em branco.
 */
export default async function LayoutDoMeuPortal({
  children,
}: LayoutProps<"/portal">) {
  const { sessao, comoEquipe } = await exigirAreaDoCliente();

  if (comoEquipe) {
    return (
      <div className="bg-surface-page flex min-h-dvh flex-col">
        <header className="bg-surface-card border-b">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 lg:px-8">
            <Logo tamanho="sm" />
            <Link
              href="/painel"
              className="text-text-muted hover:text-foreground ml-auto inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Voltar ao painel
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8 lg:py-12">
          {children}
        </main>

        <footer className="text-text-muted px-4 py-6 text-center text-xs lg:px-8">
          Full Hub — Full Connect Key
        </footer>
      </div>
    );
  }

  const empresas = await obterMinhasEmpresas();
  const nomeDaEmpresa = empresas
    .map((empresa) => empresa.nome_empresa)
    .join(", ");

  return (
    <CascaDoPortal
      nome={sessao.profile.nome}
      email={sessao.email}
      nomeDaEmpresa={nomeDaEmpresa || null}
      empresas={empresas}
    >
      {children}
    </CascaDoPortal>
  );
}
