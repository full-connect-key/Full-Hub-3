import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import {
  filaDaAgencia,
  mesesDeSocialDaAgencia,
  obterPostDaAgencia,
  postsDoMesDaAgencia,
  postsSemData,
  type SituacaoDoMes,
} from "@/lib/dados/social-media";
import { fluxosDeSocial } from "@/lib/dados/social-flows";
import { AbasDoSocial } from "./abas";
import { IndiceDoSocial } from "./indice-do-social";
import { FluxosDeSocial } from "./fluxos-de-social";

import { driveConfigurado } from "@/lib/drive/config";
import { SocialMedia } from "./social-media";

export const metadata: Metadata = { title: "Social Media" };

type Parametros = Record<string, string | string[] | undefined>;

function texto(p: Parametros, chave: string): string | undefined {
  const v = p[chave];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

async function Conteudo({ parametros }: { parametros: Parametros }) {
  const sessao = await exigirAcessoARota("/painel/social-media");
  const souGestor = ehGestor(sessao.profile.role);

  const visao = texto(parametros, "visao") === "calendario" ? "calendario" : "lista";
  const mes = texto(parametros, "mes") ?? new Date().toISOString().slice(0, 7);
  const clienteId = texto(parametros, "cliente");
  const foco = (texto(parametros, "foco") ?? "todos") as "todos" | "meus" | "sem_dono";
  const postId = texto(parametros, "post");

  const filtros = { clienteId, foco, usuarioId: sessao.usuarioId };

  const [posts, semData, clientes, equipe, aberto, fluxos] = await Promise.all([
    // CADA VISÃO CARREGA SÓ A PRÓPRIA CONSULTA. O calendário quer um mês; a
    // lista quer a fila dos próximos três, porque quem abre a lista está
    // procurando trabalho e o que tem para fazer hoje quase sempre publica no
    // mês que vem.
    visao === "calendario"
      ? postsDoMesDaAgencia(mes, filtros)
      : filaDaAgencia(filtros),
    // A FAIXA "SEM DATA AINDA" É SÓ DO CALENDÁRIO. Na lista eles já vêm
    // misturados na fila, em ordem — e a lista é ordenada por data justamente
    // para quem não tem data aparecer primeiro.
    visao === "calendario" ? postsSemData(clienteId) : Promise.resolve([]),
    listarClientes(),
    listarEquipeAtiva(),
    postId ? obterPostDaAgencia(postId) : Promise.resolve(null),
    // SÓ OS ATIVOS: o diálogo oferece o que dá para aplicar, e um fluxo
    // desativado é um que a agência tirou do ar sem apagar — oferecê-lo
    // abriria um mês com a corrente que ela aposentou.
    fluxosDeSocial({ apenasAtivos: true }),
  ]);

  return (
    <SocialMedia
      posts={posts}
      semData={semData}
      aberto={aberto?.post ?? null}
      versoes={aberto?.versoes ?? []}
      etapas={aberto?.etapas ?? []}
      caixinhas={aberto?.caixinhas ?? []}
      portaoDoMes={aberto?.portao ?? null}
      aprovacoesDoCliente={aberto?.aprovacoesDoCliente ?? 0}
      referencias={aberto?.referencias ?? []}
      clientes={clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
      // `driveConfigurado()` é `server-only` e desce como prop: valor
      // exportado de arquivo cliente não vale no servidor, e o contrário
      // também não atravessa — a checagem mora aqui e o booleano viaja.
      fluxos={fluxos}
      driveLigado={driveConfigurado()}
      quemLe={{ id: sessao.usuarioId, ehGestor: souGestor }}
      mes={mes}
    />
  );
}

/**
 * A ABA FLUXOS (migration 0087).
 *
 * **Ela carrega os fluxos INATIVOS também**, ao contrário do diálogo que abre o
 * mês: esta é a tela onde se reativa um, e um fluxo desativado que desaparece
 * da tela em que ele é editado é um fluxo que ninguém consegue trazer de volta.
 */
async function Fluxos() {
  const sessao = await exigirAcessoARota("/painel/social-media");
  const lista = await fluxosDeSocial();

  return <FluxosDeSocial fluxos={lista} podeEditar={ehGestor(sessao.profile.role)} />;
}

/**
 * O ÍNDICE DO SOCIAL: uma conta por cartão, com os meses dela dentro.
 *
 * **ELA É DE `EQUIPE` e não da gestão**, ao contrário de Fluxos: achar o mês
 * em que se trabalha é o trabalho do dia, e esconder isto de quem produz é
 * esconder o trabalho dele — o argumento que trouxe o módulo inteiro para
 * `EQUIPE` na 0042. Quem decide o que ele enxerga continua sendo `tasks_select`,
 * e não esta função: aqui não há nada que a RLS não resolva.
 *
 * **O RECORTE TORTO CAI EM "Em produção"**, nunca em erro: o valor vem da URL,
 * e `?situacao=outubro` não pode derrubar a tela — é a decisão de
 * `ehFaseDoMaterial` no portal e do `?aba=` torto logo abaixo.
 */
async function Indice({ parametros }: { parametros: Parametros }) {
  const sessao = await exigirAcessoARota("/painel/social-media");

  const pedida = texto(parametros, "situacao");
  const situacao: SituacaoDoMes =
    pedida === "concluidos" || pedida === "arquivados" || pedida === "todos"
      ? pedida
      : "producao";

  const conta = texto(parametros, "cliente") ?? null;

  const [meses, clientes, equipe, fluxos] = await Promise.all([
    mesesDeSocialDaAgencia(situacao, conta ?? undefined),
    listarClientes(),
    listarEquipeAtiva(),
    // SÓ OS ATIVOS: o diálogo oferece o que dá para aplicar, e um fluxo
    // desativado é um que a agência tirou do ar sem apagar — oferecê-lo
    // abriria um mês com a corrente que ela aposentou.
    fluxosDeSocial({ apenasAtivos: true }),
  ]);

  return (
    <IndiceDoSocial
      meses={meses}
      situacao={situacao}
      contaFixada={conta}
      clientes={clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
      fluxos={fluxos}
      driveLigado={driveConfigurado()}
      souGestor={ehGestor(sessao.profile.role)}
    />
  );
}

export default async function PaginaDeSocialMedia({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const sessao = await exigirAcessoARota("/painel/social-media");
  const parametros = await searchParams;
  const souGestor = ehGestor(sessao.profile.role);

  /**
   * A ABA FLUXOS É SÓ DA GESTÃO; MESES É DE TODA A EQUIPE.
   *
   * A separação é a da 0046 e da 0068: desenhar a corrente que toda conta
   * percorre é configuração do produto, e achar o mês em que se trabalha é o
   * trabalho do dia.
   *
   * E `?aba=fluxos` digitado por quem não é gestão cai em Posts, em vez de
   * levar 403: a rota é de `is_staff()` e o que a aba mostra é leitura que
   * `social_flow_steps_select` permite — o que ele não tem é o botão, e quem
   * recusa é a policy de escrita. Recusar a rota inteira seria esconder dele a
   * corrente que ele percorre.
   */
  const aba = souGestor && texto(parametros, "aba") === "fluxos" ? "fluxos" : "social";

  /**
   * DENTRO DE SOCIAL HÁ DOIS ESTADOS, e quem os separa é `?mes=`.
   *
   * Sem ele, o índice: as contas com os meses de cada uma. Com ele, o MÊS
   * ABERTO — o calendário, a lista, o feed e o editor do post, que até aqui
   * eram a aba Posts.
   *
   * **ELES SÃO O MESMO `?aba=`, e não duas seções**, porque são dois níveis da
   * mesma pergunta e não duas coisas: a barra de contexto navega entre assuntos,
   * e "o índice" e "um mês" são o mesmo assunto a uma profundidade de distância.
   * É a ficha do equipamento em Comodatos, que também não é uma aba.
   *
   * **E `?cliente=` SOZINHO NÃO ABRE MÊS NENHUM**: ele estreita o índice a uma
   * conta, que é para onde "Todos os meses →" leva.
   */
  const mesAberto = aba === "social" ? texto(parametros, "mes") : undefined;

  return (
    <div className="space-y-6">
      {/* A BARRA APARECE PARA TODO MUNDO DESDE QUE MESES EXISTE, e a regra não
          mudou: "menos de duas seções não vira barra" continua valendo, e o
          colaborador passou a alcançar DUAS — Posts e Meses. O `PageHeader`
          ficou para o caso que não existe mais, e saiu com ele.

          A BARRA MORA NUM ARQUIVO CLIENTE, e não aqui: a lista de seções
          carrega um componente de ícone, e componente não atravessa a fronteira
          dentro de um objeto. Montá-la aqui derruba a página com *"Functions
          cannot be passed directly to Client Components"* — e foi o gerador de
          protótipo que mostrou, porque nem o `tsc` nem o `build` pegam isso. */}
      <AbasDoSocial atual={aba} souGestor={souGestor} />

      {aba === "fluxos" ? (
        <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
          <Fluxos />
        </Suspense>
      ) : mesAberto ? (
        <Suspense
          key={JSON.stringify(parametros)}
          fallback={<LoadingSkeleton variant="table" rows={6} />}
        >
          <Conteudo parametros={parametros} />
        </Suspense>
      ) : (
        <Suspense
          key={JSON.stringify(parametros)}
          fallback={<LoadingSkeleton variant="table" rows={5} />}
        >
          <Indice parametros={parametros} />
        </Suspense>
      )}
    </div>
  );
}
