import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus, UserPlus } from "lucide-react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipe, listarEquipeAtiva } from "@/lib/dados/equipe";

import { AbasDePessoas } from "./abas";
import { ehAba, type Aba } from "./vocabulario";
import { FormularioDeCliente } from "./clientes/formulario-de-cliente";
import { ListaDeClientes } from "./clientes/lista";
import { FormularioDeColaborador } from "./equipe/formulario-de-colaborador";
import { ListaDaEquipe } from "./equipe/lista";

/**
 * Gestão de Pessoas: quem é da casa, e quem é cliente.
 *
 * **Eram dois itens de menu e viraram um**, por decisão do usuário, escolhida
 * entre três propostas de layout. As duas listas são as mesmas de antes — o
 * que mudou é que elas dividem uma rota e uma barra de abas, e o menu perdeu
 * uma linha.
 *
 * **Não foram fundidas numa tabela só, e isso era a proposta B.** "Mundo
 * Verde" é uma empresa e "Joana Prado" é gente: na mesma tabela, a linha passa
 * a significar duas coisas e as colunas Cargo e Área ficam vazias em metade
 * delas. Elas continuam separadas no banco porque são coisas separadas, e a
 * tela passou a refletir isso com duas abas em vez de dois módulos.
 *
 * **A aba mora na URL**, como toda listagem do produto.
 */
export const metadata: Metadata = { title: "Gestão de Pessoas" };

async function Conteudo({ aba }: { aba: Aba }) {
  if (aba === "equipe") {
    // Traz também quem está desligado: a lista filtra por padrão para
    // "ativos", mas a gestão precisa alcançar a ficha de quem saiu para
    // reativar o acesso.
    const equipe = await listarEquipe(true);
    return <ListaDaEquipe equipe={equipe} />;
  }

  const [clientes, equipe] = await Promise.all([listarClientes(), listarEquipeAtiva()]);
  return <ListaDeClientes clientes={clientes} equipe={equipe} />;
}

export default async function PaginaDePessoas({
  searchParams,
}: PageProps<"/painel/pessoas">) {
  const sessao = await exigirAcessoARota("/painel/pessoas");
  const parametros = await searchParams;
  const aba: Aba = ehAba(parametros.aba) ? parametros.aba : "clientes";

  // A equipe ativa é do FORMULÁRIO de cliente (o select de "quem atende"), e
  // por isso só é buscada na aba dele. Na aba Equipe o botão é outro e esta
  // consulta seria uma ida ao banco para preencher um campo que não aparece.
  const paraOSelectDeAtendimento = aba === "clientes" ? await listarEquipeAtiva() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Pessoas"
        actions={
          // O BOTÃO É DA ABA, e não da página: "Novo cliente" na aba Equipe
          // abriria o formulário errado para quem está olhando uma lista de
          // pessoas. Um só botão que muda de destino conforme a aba seria
          // pior ainda — é o tipo de controle que a pessoa clica sem ler.
          aba === "clientes" ? (
            <FormularioDeCliente
              equipe={paraOSelectDeAtendimento}
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Novo cliente
                </Button>
              }
            />
          ) : (
            <FormularioDeColaborador
              roleDeQuemCria={sessao.profile.role}
              trigger={
                <Button>
                  <UserPlus aria-hidden />
                  Adicionar colaborador
                </Button>
              }
            />
          )
        }
      />

      <AbasDePessoas atual={aba} />

      <Suspense key={aba} fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo aba={aba} />
      </Suspense>
    </div>
  );
}
