import type { Metadata } from "next";

import { PiggyBank } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
 * Meu perfil, em duas abas.
 *
 * Financeiro Pessoal virou aba daqui no Sprint 3C. Como item solto no menu ele
 * disputava atenção com os módulos de trabalho, e o uso real pela equipe ainda
 * é incerto — mas ele é, literalmente, assunto de quem já está olhando o
 * próprio cadastro. A rota /painel/financeiro-pessoal continua existindo e
 * continua validando o perfil no servidor: o que mudou foi só por onde se
 * chega a ela.
 */
export default async function PaginaDoMeuPerfil() {
  const sessao = await exigirAcessoARota("/painel/perfil");
  const pessoa = await obterColaborador(sessao.usuarioId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Meu perfil"
        description="Seus dados de acesso. Cargo, área e função são definidos pela gestão."
        actions={<Badge variant="secondary">{ROTULOS_DE_ROLE[sessao.profile.role]}</Badge>}
      />

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Meus dados</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro Pessoal</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-6 pt-4">
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
        </TabsContent>

        <TabsContent value="financeiro" className="pt-4">
          <EmptyState
            icon={PiggyBank}
            title="Controle das suas finanças pessoais"
            description="Opcional, e só seu: ninguém da agência enxerga. O módulo entra em um dos próximos sprints."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
