import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes, logosDasContas } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import {
  demandaDoMes,
  filaDaAgencia,
  mesesDeSocialDaAgencia,
  obterPostDaAgencia,
  ondeMoraOPost,
  postsDoMesDaAgencia,
  postsSemData,
  type SituacaoDoMes,
} from "@/lib/dados/social-media";
import { fluxosDeSocial } from "@/lib/dados/social-flows";
import {
  estadoDosRelatorios,
  redesDoMes,
  relatorioDoMes,
} from "@/lib/dados/relatorio-do-social";
import {
  mesesParaRelatar,
  publicado,
} from "@/lib/dominio/relatorio-do-social";
import { AbasDoSocial, type AbaDoSocial } from "./abas";
import { IndiceDoSocial } from "./indice-do-social";
import { FluxosDeSocial } from "./fluxos-de-social";
import { RelatorioDoSocialNaTela } from "./relatorio-do-social";

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

  const visao =
    texto(parametros, "visao") === "calendario" ? "calendario" : "lista";
  const mes = texto(parametros, "mes") ?? new Date().toISOString().slice(0, 7);
  const clienteId = texto(parametros, "cliente");
  const foco = (texto(parametros, "foco") ?? "todos") as
    | "todos"
    | "meus"
    | "sem_dono";
  const postId = texto(parametros, "post");

  const filtros = { clienteId, foco, usuarioId: sessao.usuarioId };

  const [posts, semData, clientes, equipe, aberto, fluxos, demanda] =
    await Promise.all([
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
      // A DEMANDA DESTE MÊS, e ela só existe com uma empresa escolhida: o mês é
      // identificado pelo par `(?mes=, ?cliente=)`, que é o índice único da
      // 0061. Em "Todos os clientes" há tantos meses quantas contas têm social
      // naquela competência, e apagar o primeiro que a consulta achasse seria
      // apagar o mês de uma conta que ninguém escolheu.
      //
      // **É A PONTE QUE FALTAVA PARA AS QUATRO AÇÕES DA 0086.** Elas recebem
      // `task_id` e esta tela só conhecia a competência, então o botão de
      // apagar o mês não tinha o que apagar — ver `acoes-do-mes.tsx`.
      clienteId ? demandaDoMes(mes, clienteId) : Promise.resolve(null),
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
      comentarios={aberto?.comentarios ?? []}
      historico={aberto?.historico ?? []}
      // O "AGORA" DESCE DO SERVIDOR, que é a regra escrita da thread: com
      // `new Date()` dentro do componente de cliente, o SSR renderiza "há 2
      // horas" e o navegador, noutro fuso ou um segundo depois, recalcula
      // outra coisa na hidratação.
      agora={new Date().toISOString()}
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
      demanda={demanda}
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

  return (
    <FluxosDeSocial fluxos={lista} podeEditar={ehGestor(sessao.profile.role)} />
  );
}

/**
 * A ABA RELATÓRIOS (migration 0150), que é o item 18 do pedido.
 *
 * ---------------------------------------------------------------------------
 * **ELA É DE `EQUIPE` E NÃO DA GESTÃO**, ao contrário de Fluxos, e a frase do
 * usuário é que decide: *"para permitir que os dados sejam editados pela
 * social"* — a social media é `colaborador`, e `exigirAcessoARota` é a MESMA
 * guarda das outras duas seções. Quem recusa a escrita é
 * `social_reports_write`, que é `is_staff()`: aqui não há nada que a RLS não
 * resolva, e uma segunda pergunta de perfil seria a 0060.
 *
 * ---------------------------------------------------------------------------
 * **A CONTA SE RESOLVE PELA LISTA, e nunca direto do `?cliente=`** — a
 * doutrina do `?pessoa=` da pauta da equipe, palavra por palavra: é de lá que
 * sai o nome do cabeçalho, e é ela que VALIDA o uuid, então um id colado na
 * URL só vira consulta se for de uma conta ATIVA. Sem isso, `relatorioDoMes()`
 * seria chamada com um uuid que a RLS devolve vazio, e a tela desenharia um
 * formulário em branco com o nome da conta ausente.
 *
 * **E O MÊS SE RESOLVE PELO SELETOR, pela mesma razão.** `mesesParaRelatar()`
 * oferece doze; um `?mes=` fora deles — digitado, ou herdado de um mês de
 * social mais antigo que um ano — cai no corrente, em vez de abrir um
 * formulário que o seletor ao lado afirma não existir. *O custo está dito:*
 * quem vier de um mês de 2024 clicando em "Relatórios" chega em novembro, e o
 * seletor diz qual mês está aberto.
 * ---------------------------------------------------------------------------
 */
async function Relatorios({ parametros }: { parametros: Parametros }) {
  await exigirAcessoARota("/painel/social-media");

  const contas = (await listarClientes())
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }));

  const conta = contas.find((c) => c.id === texto(parametros, "cliente")) ?? null;

  const meses = mesesParaRelatar();
  const pedido = texto(parametros, "mes");
  const mes = pedido && meses.includes(pedido) ? pedido : meses[0];

  // SEM CONTA ESCOLHIDA NÃO HÁ CONSULTA NENHUMA, e não é só economia: as duas
  // leituras recortam por `client_id`, então chamá-las com nulo seria pedir ao
  // banco o relatório de ninguém. A tela desenha os dois seletores e a frase.
  if (!conta) {
    return (
      <RelatorioDoSocialNaTela
        contas={contas}
        clienteId={null}
        nomeDaConta={null}
        mes={mes}
        relatorio={null}
        numeros={[]}
        anteriores={[]}
        redes={[]}
      />
    );
  }

  const [{ relatorio, numeros, anteriores }, redes] = await Promise.all([
    relatorioDoMes(conta.id, mes),
    redesDoMes(conta.id, mes),
  ]);

  return (
    <RelatorioDoSocialNaTela
      contas={contas}
      clienteId={conta.id}
      nomeDaConta={conta.nome_empresa}
      mes={mes}
      relatorio={relatorio}
      numeros={numeros}
      anteriores={anteriores}
      redes={redes}
    />
  );
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
  await exigirAcessoARota("/painel/social-media");

  const pedida = texto(parametros, "situacao");
  const situacao: SituacaoDoMes =
    pedida === "concluidos" || pedida === "arquivados" || pedida === "todos"
      ? pedida
      : "producao";

  const conta = texto(parametros, "cliente") ?? null;

  // TRÊS CONSULTAS SAÍRAM DAQUI, e é consequência de a abertura do mês ter
  // virado tela: clientes, equipe e fluxos alimentavam o diálogo, e o índice
  // as carregava em toda visita para um diálogo que quase ninguém abria. Agora
  // elas são de `/painel/social-media/abrir`, que é quem as usa.
  const [meses, podeAbrirMes, logos] = await Promise.all([
    mesesDeSocialDaAgencia(situacao, conta ?? undefined),
    // QUEM ABRE O MÊS É `is_atendimento()` desde a 0046, e a pergunta vai ao
    // BANCO pela mesma função que a policy usa — perfil de acesso e função na
    // agência são coisas diferentes, e o colaborador do Atendimento abre o mês.
    souDoAtendimento(),
    // O LOGO DE CADA CONTA, assinado — o ladrilho do cartão desenhava as
    // INICIAIS, por uma função própria que era a mesma conta de `iniciaisDe()`
    // escrita duas vezes. A assinatura é uma ida ao Storage a mais nesta aba,
    // e é por isso que ela não mora dentro de `listarClientes()`.
    logosDasContas(),
  ]);

  // O ESTADO DO RELATÓRIO DE CADA MÊS (0150), e ela vem DEPOIS e não dentro do
  // `Promise.all`: os ids das contas saem da PRIMEIRA consulta, que é a mesma
  // razão pela qual a leitura do escopo e a do relatório do portal também ficam
  // de fora do bloco paralelo delas.
  //
  // **É UMA IDA E NÃO UMA POR MÊS**, que é o argumento escrito na função: a
  // faixa desenha até quatro meses por conta, e uma consulta por cartão seriam
  // dezenas de idas ao banco para desenhar dezenas de selos.
  const estados = await estadoDosRelatorios(
    meses.map((m) => m.clienteId),
  );

  return (
    <IndiceDoSocial
      meses={meses}
      situacao={situacao}
      contaFixada={conta}
      podeAbrirMes={podeAbrirMes}
      logos={Object.fromEntries(logos)}
      // O QUE ATRAVESSA É UM BOOLEANO POR MÊS, e não a linha: `publicado()` é
      // a mesma pergunta que a policy do cliente faz, e respondê-la aqui é o
      // que impede a tela de ter uma segunda definição de "publicado".
      relatorios={Object.fromEntries(
        [...estados].map(([chave, linha]) => [chave, publicado(linha)]),
      )}
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
  const pedida = texto(parametros, "aba");
  // O RELATÓRIO VIROU MÓDULO PRÓPRIO (0159): o endereço antigo leva ao novo.
  if (pedida === "relatorios") redirect("/painel/relatorios");
  const aba: AbaDoSocial =
    pedida === "fluxos" && souGestor
      ? "fluxos"
      : pedida === "relatorios"
        ? "relatorios"
        : "social";

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

  /**
   * `?post=` SOZINHO ABRE O POST, e este bloco é o que devolve isso.
   *
   * -------------------------------------------------------------------------
   * Relato do usuário: *"quando clico em um post que está em aval interno, a
   * plataforma me direciona para o social geral daquela conta e não direto
   * para o post"*. Ele estava certo, e o alcance é maior que a fila: **todo
   * link `?post=` do produto caía no índice** — os avisos do sino (0042, 0088,
   * 0090), a busca global (0073, 0088, 0097), o resumo da semana e a própria
   * fila de aprovações internas.
   *
   * A causa é a linha de cima: quem separa o índice do mês aberto é `?mes=`, e
   * nenhum daqueles links o carrega — eles foram escritos quando o módulo era
   * uma lista corrida de posts. O `?post=` chegava, era lido, e a tela
   * desenhava os cartões das contas.
   *
   * **O CONSERTO É AQUI E NÃO EM CADA LINK, porque a maioria deles já está
   * GRAVADA no banco de produção**: `notificar()` é chamada de dentro de
   * trigger com o endereço escrito no corpo da função. É o argumento dos 308
   * das duas rotas que entraram em Gestão de Tasks, e o dos comentários
   * datados da 0028 e da 0031 — a razão está inteira em `ondeMoraOPost()`.
   *
   * **É `redirect` e não montar o mês aqui**, e a diferença aparece na tela:
   * o endereço canônico passa a estar na barra, então a trilha diz a conta e o
   * mês, a lista em volta é a daquele mês, e a seção de apagar o mês encontra
   * a demanda. Abrindo o editor sem o par, o post apareceria dentro de uma
   * tela que não sabe de onde ele é — e o link não sobreviveria a um
   * compartilhamento, que é a razão de todo filtro deste produto morar na URL.
   *
   * **Ele é 307 e não 308**, que é o default do `redirect` do Next: o destino
   * depende de onde o post mora, e ele muda quando a data dele muda. Um
   * permanente ficaria no cache do navegador de quem clicou, apontando para o
   * mês antigo.
   *
   * **Post avulso sem data nenhuma não redireciona**, e a razão está no leitor:
   * ele não mora em mês nenhum, e mandá-lo para o mês corrente abriria uma
   * tela com a trilha dizendo uma competência inventada. Ele cai no índice,
   * como hoje.
   * -------------------------------------------------------------------------
   */
  const postPedido = aba === "social" ? texto(parametros, "post") : undefined;
  if (postPedido && !mesAberto) {
    const onde = await ondeMoraOPost(postPedido);
    if (onde) {
      const destino = new URLSearchParams({
        cliente: onde.clienteId,
        mes: onde.mes,
        post: postPedido,
      });
      // A VISÃO VIAJA quando ela veio no link, e não é zelo: o link do
      // calendário do Calendário Full manda `?visao=calendario`, e perdê-la
      // aqui abriria a lista para quem clicou numa grade de dias.
      const visao = texto(parametros, "visao");
      if (visao) destino.set("visao", visao);
      redirect(`/painel/social-media?${destino.toString()}`);
    }
  }

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
      ) : aba === "relatorios" ? (
        <Suspense
          key={JSON.stringify(parametros)}
          fallback={<LoadingSkeleton variant="table" rows={5} />}
        >
          <Relatorios parametros={parametros} />
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
