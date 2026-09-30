import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CascaDoPortal } from "@/components/portal/casca-do-portal";
import { Logo } from "@/components/shared/logo";
import { exigirAreaDoCliente } from "@/lib/auth/portal-administrativo";
import { identidadeDoPortal, obterMinhasEmpresas } from "@/lib/dados/clientes";

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
      /* A CASCA SIMPLES DA GESTÃO ganhou a mesma pele da do cliente, e por um
         motivo bobo e real: sem ela esta tela seria o terceiro desenho da
         mesma plataforma — o painel de onde a pessoa veio, o portal para onde
         ela vai, e uma bifurcação com cara de nenhum dos dois. O que ela
         continua não tendo é a navegação do cliente, que é a decisão de
         sempre: a equipe não tem empresa, e todas as seções voltariam vazias. */
      <div className="bg-surface-page relative flex min-h-dvh flex-col">
        <div
          aria-hidden
          className="malha-do-painel pointer-events-none absolute inset-x-0 top-0 z-0 h-[170px]"
        />

        <header className="relative z-10 flex h-16 items-center px-4 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
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

        <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>

        <footer className="text-text-muted relative z-10 px-4 py-6 text-center text-xs lg:px-8">
          Full Hub — Full Connect Key
        </footer>
      </div>
    );
  }

  const empresas = await obterMinhasEmpresas();
  // SÓ COM UMA EMPRESA. Com duas, o cabeçalho troca o nome pelo seletor, e uma
  // foto ao lado de um controle que lista N empresas diria que ela é de todas.
  const identidade =
    empresas.length === 1 ? await identidadeDoPortal(empresas[0].id) : null;
  const nomeDaEmpresa = empresas
    .map((empresa) => empresa.nome_empresa)
    .join(", ");

  return (
    <CascaDoPortal
      nome={sessao.profile.nome}
      email={sessao.email}
      nomeDaEmpresa={nomeDaEmpresa || null}
      fotoDaEmpresa={identidade?.fotoAssinada ?? null}
      empresas={empresas}
    >
      {children}
    </CascaDoPortal>
  );
}
