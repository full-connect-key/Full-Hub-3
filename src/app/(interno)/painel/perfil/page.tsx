import type { Metadata } from "next";


import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import { obterColaborador } from "@/lib/dados/equipe";
import { rotuloDaFuncao } from "@/lib/dominio/equipe";

import { FormularioDoPerfil, TrocaDeSenha } from "./formulario";

export const metadata: Metadata = { title: "Meu perfil" };

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="mt-0.5 text-sm">{valor}</dd>
    </div>
  );
}

/**
 * Meu perfil.
 *
 * Só os dados da pessoa: foto, contato e senha. Já houve um módulo opcional
 * pendurado aqui como aba, e a lição que ficou é a razão de não haver
 * nenhuma: duas portas para a mesma tela confundem quem procura, e quem tem
 * tela própria merece entrada própria no menu.
 */
export default async function PaginaDoMeuPerfil() {
  const sessao = await exigirAcessoARota("/painel/perfil");
  const pessoa = await obterColaborador(sessao.usuarioId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Meu perfil"
        actions={<Badge variant="secondary">{ROTULOS_DE_ROLE[sessao.profile.role]}</Badge>}
      />

      <div className="space-y-6">
          <FormularioDoPerfil profile={sessao.profile} />

          <section className="rounded-card border p-5">
            <h2 className="mb-4 text-sm font-semibold">Sua ficha na agência</h2>
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Campo rotulo="Cargo" valor={pessoa?.membro?.cargo ?? "—"} />
              <Campo rotulo="Área" valor={pessoa?.membro?.area ?? "—"} />
              <Campo rotulo="Função" valor={rotuloDaFuncao(pessoa?.membro?.funcao ?? null)} />
              <Campo rotulo="Perfil de acesso" valor={ROTULOS_DE_ROLE[sessao.profile.role]} />
            </dl>
            <p className="text-muted-foreground mt-4 text-xs">
              Precisa alterar algum desses? Fale com a gestão.
            </p>
          </section>

          <TrocaDeSenha />
      </div>
    </div>
  );
}
