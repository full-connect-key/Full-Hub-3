import type { Metadata } from "next";
import { Suspense } from "react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { disponibilidadeDe } from "@/lib/dados/disponibilidade";
import {
  acharEtapaPeloTitulo,
  cargaDaEquipeNaSemana,
} from "@/lib/dados/pauta-da-equipe";
import type { FocoDoDia } from "@/lib/dominio/tasks";

import { saudacaoDaAgencia } from "@/lib/dominio/datas";

import { AbasDeMinhasTasks } from "./abas";
import { montarLinhas } from "./linhas";
import { PainelPessoal } from "./painel-pessoal";
import { PautaDaEquipe } from "./pauta-da-equipe";
import { lerSecao, type Secao } from "./vocabulario";

export const metadata: Metadata = { title: "Minhas Tasks" };

const VISOES = ["board", "lista", "calendario"] as const;
const FOCOS = ["atrasadas", "hoje", "semana"] as const;

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
  diaPedido,
  termoPedido,
  barra,
}: {
  usuarioId: string;
  nome: string;
  souGestor: boolean;
  pessoaPedida: string;
  diaPedido: string;
  termoPedido: string;
  barra: React.ReactNode;
}) {
  const prazos = prazosDeHoje();

  // QUEM MEXE NUMA ETAPA DAQUI PASSA A SER O DONO DELA? A GUARDA 3 do gatilho
  // da 0144 não faz a passagem para a gestão nem para o Atendimento — eles
  // alteram SEM assumir, que é o pedido em quantas palavras. A frase da tela
  // sai desta pergunta, e não de uma segunda lista de perfis: quem responde é
  // `souDoAtendimento()`, que é a MESMA `is_atendimento()` que o gatilho lê.
  //
  // E ela é feita aqui e não na `Conteudo`: as duas seções chamam a função,
  // que é `cache`ada, então a ida ao banco é uma só por visita.
  const [carga, ehDoAtendimento] = await Promise.all([
    cargaDaEquipeNaSemana(),
    souDoAtendimento(),
  ]);

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

  // O DIA SE RESOLVE PELA GRADE, como a pessoa: só vira consulta se for uma
  // das cinco colunas desta semana. Um `?dia=2019-01-01` colado na URL não
  // existe como célula, então não existe como leitura — e `disponibilidade()`
  // tem teto de 62 dias, que é outra razão para o parâmetro nunca chegar cru.
  const dia =
    pessoa && carga?.dias.includes(diaPedido) ? diaPedido : null;

  const [linhas, diaEscolhido, busca] = await Promise.all([
    pessoa
      ? minhasTasks(pessoa.id, null, prazos).then(montarLinhas)
      : Promise.resolve([]),
    // `projetando: false` É O QUE FAZ O PAINEL CONCORDAR COM A CÉLULA.
    // `carga_da_equipe()` chama `carga_do_dia()`, que passa
    // `p_daqui_pra_frente = false` desde a 0081 — o retrato de uma semana não
    // projeta a etapa vencida para hoje. Lendo com o padrão (`true`), o
    // painel listaria etapas que o número ao lado não contou: duas respostas
    // para a mesma pergunta, a dois centímetros.
    pessoa && dia
      ? disponibilidadeDe(pessoa.id, dia, dia, false).then(
          (dias) => dias[0] ?? null,
        )
      : Promise.resolve(null),
    // A BUSCA NÃO DEPENDE DA PESSOA ESCOLHIDA, e é a decisão inteira dela: o
    // pedido é *"para achar a task caso não lembre quem fez"*, então uma busca
    // recortada por um nome não responde a quem não sabe o nome. Ela corre em
    // paralelo com a pauta porque as duas são perguntas independentes.
    //
    // E ela só acontece quando há termo: sem ele, nenhuma varredura sobre
    // `subtasks` — a tela mostra a linha que diz o que a busca alcança.
    termoPedido ? acharEtapaPeloTitulo(termoPedido) : Promise.resolve(null),
  ]);

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
        diaEscolhido={diaEscolhido}
        prazos={prazos}
        usuarioId={usuarioId}
        souGestor={souGestor}
        busca={busca}
        assumeAoMexer={!souGestor && !ehDoAtendimento}
      />
    </>
  );
}

export default async function PaginaDeMinhasTasks({
  searchParams,
}: PageProps<"/painel/minhas-tasks">) {
  const sessao = await exigirAcessoARota("/painel/minhas-tasks");
  const params = await searchParams;

  const aba: Secao = lerSecao(
    typeof params.aba === "string" ? params.aba : undefined,
  );

  const visaoPedida = typeof params.visao === "string" ? params.visao : "";
  const visao = (VISOES as readonly string[]).includes(visaoPedida)
    ? (visaoPedida as (typeof VISOES)[number])
    : "lista";

  const focoPedido = typeof params.foco === "string" ? params.foco : "";
  const foco = (FOCOS as readonly string[]).includes(focoPedido)
    ? (focoPedido as FocoDoDia)
    : null;

  const pessoaPedida = typeof params.pessoa === "string" ? params.pessoa : "";
  const diaPedido = typeof params.dia === "string" ? params.dia : "";
  const termoPedido = typeof params.busca === "string" ? params.busca : "";

  const nome = primeiroNome(sessao.profile.nome);

  const barra = <AbasDeMinhasTasks ativa={aba} />;

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
            diaPedido={diaPedido}
            termoPedido={termoPedido}
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
