import type { Metadata } from "next";
import { Suspense } from "react";

import { EscolhaDePortal } from "@/components/portal/escolha-de-portal";
import { InicioDoPortal } from "@/components/portal/telas/inicio-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { primeiroNome } from "@/lib/auth/dal";
import { exigirAreaDoCliente } from "@/lib/auth/portal-administrativo";

export const metadata: Metadata = { title: "Início" };

/**
 * A tela inicial do Portal.
 *
 * **Uma pergunta domina a tela: o que está esperando por mim?** Tudo o mais é
 * contexto. O contador de pendências é o número maior da página porque é a
 * única coisa que pede ação do cliente — "em produção" e "aprovados" são
 * tranquilizadores, não tarefas.
 *
 * Para quem é da gestão, a pergunta é outra — "o portal de qual cliente?" —, e
 * a tela também: a escolha, com o portal de verdade em /portal/{slug}.
 */
export default async function PaginaInicialDoPortal({
  searchParams,
}: PageProps<"/portal">) {
  const { sessao, comoEquipe } = await exigirAreaDoCliente();

  if (comoEquipe) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Portais de clientes</h1>
          <p className="text-text-muted mt-1">
            Escolha uma empresa para ver o portal dela como o cliente vê. A
            visualização é só leitura e fica registrada.
          </p>
        </div>

        <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
          <EscolhaDePortal />
        </Suspense>
      </div>
    );
  }

  const nome = primeiroNome(sessao.profile.nome);
  const params = await searchParams;
  const empresa = typeof params.empresa === "string" ? params.empresa : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {nome}</h1>
        <p className="text-text-muted mt-1">
          Aqui está o que a Full preparou para você.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={5} />}>
        {/* `empresa` é o seletor do cabeçalho, e só aparece para quem responde
            por mais de uma. Sem ele, a tela soma as duas contas — que é o que
            quem tem duas quer ver ao entrar. */}
        <InicioDoPortal
          base="/portal"
          clienteId={empresa}
          comoEquipe={false}
          nome={nome}
        />
      </Suspense>
    </div>
  );
}
