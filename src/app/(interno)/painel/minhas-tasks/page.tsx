import type { Metadata } from "next";
import { Suspense } from "react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ListChecks, Users } from "lucide-react";

import { BarraDeContexto } from "@/components/shared/barra-de-contexto";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota, primeiroNome } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import {
  contadoresPessoais,
  etapaEmAndamento,
  itensPessoaisDoCalendario,
  meuDia,
  minhasTasks,
  prazosDeHoje,
  souDoAtendimento,
} from "@/lib/dados/minhas-tasks";
import { resumoDaHome } from "@/lib/dados/home";
import { minhasNovidades } from "@/lib/dados/novidades";
import { cargaDaEquipeNaSemana } from "@/lib/dados/pauta-da-equipe";
import type { FocoDoDia } from "@/lib/dominio/tasks";

import { saudacaoDaAgencia } from "@/lib/dominio/datas";

import { montarLinhas } from "./linhas";
import { PainelPessoal } from "./painel-pessoal";
import { PautaDaEquipe } from "./pauta-da-equipe";

export const metadata: Metadata = { title: "Minhas Tasks" };

const VISOES = ["board", "lista", "calendario"] as const;
const FOCOS = ["atrasadas", "hoje", "semana"] as const;

/**
 * AS DUAS SEÇÕES DA TELA (migration 0144, item 22).
 *
 * Decisão do usuário: *"todos os colaboradores devem poder visualizar as
 * pautas de todos"*.
 *
 * **É UMA SEÇÃO E NÃO UMA QUARTA VISÃO, e a distinção é a que a
 * `BarraDeContexto` existe para fazer:** o seletor de visão troca o DESENHO
 * do mesmo conteúdo — as mesmas etapas em coluna, em linha ou em dia —, e a
 * barra navega entre ASSUNTOS, cada um com outra consulta e outro conteúdo.
 * *O meu dia* e *a semana da equipe* são dois assuntos, então "Da equipe" ao
 * lado de Board/Lista/Calendário leria como um quarto jeito de desenhar as
 * minhas etapas.
 *
 * **E NÃO É UMA ROTA PRÓPRIA**, que era a outra saída: a barra é o mecanismo
 * da casa para as seções de um módulo, e um `/painel/pauta-da-equipe` seria um
 * item a mais na barra lateral — a direção oposta à do sprint que tirou dois
 * de lá. Aqui ela cumpre a frase do pedido com o módulo que já existe.
 *
 * **O SELETOR DE VISÃO FICA DENTRO DE "O meu dia"**, menor que a barra e no
 * tamanho que ele já tinha: com o mesmo peso, a pessoa leria "O meu dia / Da
 * equipe" e "Board / Lista" como duas metades da mesma escolha — é a decisão
 * escrita da Gestão de Tasks, onde os dois também aparecem juntos.
 */
const SECOES = ["minhas", "equipe"] as const;
type Secao = (typeof SECOES)[number];

async function Conteudo({
  usuarioId,
  nome,
  souGestor,
  visao,
  foco,
  barra,
}: {
  usuarioId: string;
  nome: string;
  souGestor: boolean;
  visao: (typeof VISOES)[number];
  foco: FocoDoDia | null;
  barra: React.ReactNode;
}) {
  // Uma régua de datas só para tudo nesta tela: contador, lista e calendário
  // classificam o mesmo prazo do mesmo jeito.
  const prazos = prazosDeHoje();

  const [
    tasks,
    itensDeCalendario,
    itensDoDia,
    contadores,
    podeCriarTask,
    novidades,
    correndoAgora,
    resumo,
  ] = await Promise.all([
    minhasTasks(usuarioId, foco, prazos),
    itensPessoaisDoCalendario(usuarioId, foco, prazos),
    meuDia(usuarioId, prazos),
    contadoresPessoais(usuarioId, prazos),
    // A EQUIPE NÃO É MAIS CONSULTADA AQUI, e a ausência é consequência de uma
    // remoção e não economia: o único leitor dela nesta tela era o seletor de
    // responsável do calendário, que saiu — e nele ela só sabia esvaziar a
    // grade, porque os itens desta tela já são todos de quem está olhando. Uma
    // ida ao banco por visita para alimentar uma lista que nenhuma tela
    // desenha é a ponte construída e nunca atravessada pelo outro lado.
    //
    // (A seção "Da equipe" lê a equipe, e ela é OUTRO ramo: a consulta dela só
    // acontece quando aquela seção é a escolhida.)
    souDoAtendimento(),
    // O SINAL DE "CHEGOU COISA NOVA" (decisão do usuário). Ele lê as
    // notificações por ler desta pessoa e as separa por área pelo endereço —
    // é o sino visto de outro ângulo, e não um estado novo ao lado dele.
    minhasNovidades(),
    // AS DUAS PEÇAS DA COLUNA DA DIREITA, e elas já existiam: o cronômetro da
    // etapa esquecida aberta e quem não está hoje moram na Home desde o
    // Sprint 15, e o artifact aprovado as traz para cá com a frase que explica
    // por quê — "as três coisas que hoje moram na Home e que ninguém vê
    // estando em Minhas Tasks".
    //
    // São as MESMAS consultas e os MESMOS componentes, nunca cópias: duas
    // versões do cronômetro divergiriam no número que a pessoa usa para
    // declarar quanto tempo a etapa levou.
    etapaEmAndamento(usuarioId),
    resumoDaHome(),
  ]);

  return (
    <PainelPessoal
      linhas={montarLinhas(tasks)}
      itensDeCalendario={itensDeCalendario}
      itensDoDia={itensDoDia}
      novidades={novidades}
      contadores={contadores}
      prazos={prazos}
      usuarioId={usuarioId}
      souGestor={souGestor}
      primeiroNome={nome}
      podeCriarTask={podeCriarTask}
      visao={visao}
      foco={foco}
      correndoAgora={correndoAgora}
      foraHoje={resumo.fora_hoje}
      saudacao={saudacaoDaAgencia()}
      dataPorExtenso={format(prazos.agora, "EEEE, d 'de' MMMM", {
        locale: ptBR,
      })}
      agoraDoServidor={prazos.agora}
      barra={barra}
    />
  );
}

async function ConteudoDaEquipe({
  usuarioId,
  nome,
  souGestor,
  pessoaPedida,
  barra,
}: {
  usuarioId: string;
  nome: string;
  souGestor: boolean;
  pessoaPedida: string;
  barra: React.ReactNode;
}) {
  const prazos = prazosDeHoje();
  const carga = await cargaDaEquipeNaSemana();

  // A PESSOA ESCOLHIDA SE RESOLVE PELA LISTA DA GRADE, e nunca direto do
  // `?pessoa=`. São duas coisas de uma vez: é de lá que sai o NOME do
  // cabeçalho da pauta, e é ela que valida o uuid — um id colado na URL só
  // vira consulta se for de alguém com ficha ATIVA na equipe. Lendo o
  // parâmetro cru, `minhasTasks()` seria chamada com o que estivesse ali.
  //
  // E com a grade em nulo não há ninguém a resolver: a tela diz que não
  // conseguiu ler a carga, e a pauta diz para escolher um nome. É mais honesto
  // que um segundo `select` em `profiles` só para dar nome a um uuid — e a
  // leitura que falhou é justamente a que diria se aquela pessoa existe.
  const pessoa =
    carga?.pessoas.find((p) => p.id === pessoaPedida) ?? null;

  const linhas = pessoa
    ? montarLinhas(await minhasTasks(pessoa.id, null, prazos))
    : [];

  return (
    <>
      <PageHeader
        title={`${saudacaoDaAgencia()},`}
        titleSecundario={nome}
        subtitulo={
          <span className="inline-block first-letter:uppercase">
            {format(prazos.agora, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </span>
        }
      />
      {barra}
      <PautaDaEquipe
        carga={carga}
        pessoa={pessoa ? { id: pessoa.id, nome: pessoa.nome } : null}
        linhas={linhas}
        prazos={prazos}
        usuarioId={usuarioId}
        souGestor={souGestor}
      />
    </>
  );
}

export default async function PaginaDeMinhasTasks({
  searchParams,
}: PageProps<"/painel/minhas-tasks">) {
  const sessao = await exigirAcessoARota("/painel/minhas-tasks");
  const params = await searchParams;

  const abaPedida = typeof params.aba === "string" ? params.aba : "";
  const aba: Secao = (SECOES as readonly string[]).includes(abaPedida)
    ? (abaPedida as Secao)
    : "minhas";

  const visaoPedida = typeof params.visao === "string" ? params.visao : "";
  const visao = (VISOES as readonly string[]).includes(visaoPedida)
    ? (visaoPedida as (typeof VISOES)[number])
    : "lista";

  const focoPedido = typeof params.foco === "string" ? params.foco : "";
  const foco = (FOCOS as readonly string[]).includes(focoPedido)
    ? (focoPedido as FocoDoDia)
    : null;

  const pessoaPedida = typeof params.pessoa === "string" ? params.pessoa : "";

  const nome = primeiroNome(sessao.profile.nome);

  const barra = (
    <BarraDeContexto<Secao>
      rotuloAcessivel="Seções de Minhas Tasks"
      atual={aba}
      secoes={[
        { chave: "minhas", rotulo: "O meu dia", Icone: ListChecks },
        { chave: "equipe", rotulo: "Da equipe", Icone: Users },
      ]}
      /* O QUE NÃO FAZ SENTIDO DO OUTRO LADO SAI DA URL. `visao` e `foco`
         recortam a MINHA lista, e `pessoa` escolhe alguém da equipe —
         atravessando, eles ficariam na barra de endereço afirmando um recorte
         que a seção de destino não aplica, e voltariam a valer no clique de
         volta sem ninguém ter pedido. */
      limparAoSair={(destino) =>
        destino === "equipe" ? ["visao", "foco"] : ["pessoa"]
      }
    />
  );

  return (
    <div className="space-y-6">
      <Suspense
        key={aba}
        fallback={<LoadingSkeleton variant="table" rows={6} />}
      >
        {aba === "equipe" ? (
          <ConteudoDaEquipe
            usuarioId={sessao.usuarioId}
            nome={nome}
            souGestor={ehGestor(sessao.profile.role)}
            pessoaPedida={pessoaPedida}
            barra={barra}
          />
        ) : (
          <Conteudo
            usuarioId={sessao.usuarioId}
            nome={nome}
            souGestor={ehGestor(sessao.profile.role)}
            visao={visao}
            foco={foco}
            barra={barra}
          />
        )}
      </Suspense>
    </div>
  );
}
