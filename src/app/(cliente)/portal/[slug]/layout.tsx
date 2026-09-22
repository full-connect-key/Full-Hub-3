import { AvisoDeVisualizacao } from "@/components/portal/aviso-de-visualizacao";
import { CascaDoPortal } from "@/components/portal/casca-do-portal";
import { exigirVisualizacaoDoPortal } from "@/lib/auth/portal-administrativo";

/**
 * A visualização administrativa do portal de um cliente.
 *
 * Mesma casca do portal dele — é esse o ponto —, com duas diferenças que
 * importam: a faixa de aviso presa no topo, e o fato de que nenhuma ação do
 * cliente aparece. A recusa de verdade, porém, não é a ausência do botão: a
 * função `decidir_rodada_do_cliente` no Postgres recusa quem não é o cliente
 * daquela rodada, e por isso montar a chamada à mão não adianta.
 *
 * A identidade de quem entrou não muda. É a sessão da pessoa da agência, com o
 * auth.uid() dela, e é por isso que o menu do canto continua mostrando o nome
 * dela e não o do cliente.
 */
export default async function LayoutDaVisualizacao({
  children,
  params,
}: LayoutProps<"/portal/[slug]">) {
  const { slug } = await params;
  const { cliente, profile, email } = await exigirVisualizacaoDoPortal(slug);

  return (
    <CascaDoPortal
      nome={profile.nome}
      email={email}
      nomeDaEmpresa={cliente.nome_empresa}
      base={`/portal/${slug}`}
      // Quem está logado é da equipe: "Meus dados" é o perfil dela no painel,
      // não as configurações do cliente.
      hrefDosDados="/painel/perfil"
      aviso={<AvisoDeVisualizacao nomeDaEmpresa={cliente.nome_empresa} />}
    >
      {children}
    </CascaDoPortal>
  );
}
