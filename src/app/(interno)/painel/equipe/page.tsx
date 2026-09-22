import type { Metadata } from "next";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarEquipe } from "@/lib/dados/equipe";
import { listarCatalogoCompleto, panoramaDeSkills } from "@/lib/dados/skills";

import { FormularioDeColaborador } from "./formulario-de-colaborador";
import { ListaDaEquipe } from "./lista";
import { SkillsDaAgencia } from "./skills-da-agencia";

/**
 * A aba Skills carrega o panorama inteiro numa consulta só.
 *
 * Matriz, busca, lacunas e interesses são quatro arranjos dos mesmos dados.
 * Com quatro consultas, eles poderiam discordar entre si sobre quem é
 * avançado em quê.
 */
async function ConteudoDeSkills() {
  const [panorama, catalogo] = await Promise.all([panoramaDeSkills(), listarCatalogoCompleto()]);
  return <SkillsDaAgencia panorama={panorama} catalogo={catalogo} />;
}

export const metadata: Metadata = { title: "Equipe & Skills" };

export default async function PaginaDaEquipe() {
  const sessao = await exigirAcessoARota("/painel/equipe");
  // Traz também quem está desligado: a lista filtra por padrão para "ativos",
  // mas gestão precisa alcançar a ficha de quem saiu para reativar o acesso.
  const equipe = await listarEquipe(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe & Skills"
        description="Quem é da casa, o que cada um faz e o que alcança na plataforma."
        actions={
          <FormularioDeColaborador
            roleDeQuemCria={sessao.profile.role}
            trigger={
              <Button>
                <UserPlus aria-hidden />
                Adicionar colaborador
              </Button>
            }
          />
        }
      />
      <Tabs defaultValue="pessoas">
        <TabsList>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoas" className="pt-4">
          <ListaDaEquipe equipe={equipe} />
        </TabsContent>

        <TabsContent value="skills" className="pt-4">
          <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
            <ConteudoDeSkills />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
