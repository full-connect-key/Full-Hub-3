"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ArrowRight, CalendarDays, Clock, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BotaoDeNovaTask } from "@/components/shared/botao-de-nova-task";
import { PageHeader } from "@/components/shared/page-header";
import { EmAndamentoAgora } from "../_blocos/em-andamento-agora";
import { QuemEstaForaHoje } from "../_blocos/quem-esta-fora-hoje";
import type { ResumoDaHome } from "@/lib/dados/home";
import type { EtapaEmAndamento } from "@/lib/dados/minhas-tasks";
import { ROTULOS_DE_FOCO, type FocoDoDia } from "@/lib/dominio/tasks";
import type { ItemDeCalendario } from "@/lib/dados/tasks";
import type { Prazos } from "@/lib/dados/minhas-tasks";
import type { ItemDoDia } from "@/lib/dados/minhas-tasks";
import type { NovidadeDeArea } from "@/lib/dados/novidades";
import type { TeamFuncao } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { CalendarioDeTasks } from "../gestao-tasks/calendario";
import { BoardDeEtapas } from "./board-de-etapas";
import {
  ICONE_DA_AREA,
  ROTA_DA_AREA,
  ROTULOS_DE_AREA,
  areaDaLinha,
  type LinhaPessoal,
} from "./linhas";
import { Novidades } from "./novidades";
import { MeuDia } from "./meu-dia";
import { MinhaLista } from "./minha-lista";
import { PainelLateralDaTask } from "./painel-lateral";
import {
  SeletorDeVisao,
  type Visao,
} from "@/components/shared/seletor-de-visao";

/**
 * Minhas Tasks.
 *
 * AS TRÊS VISÕES MOSTRAM ETAPAS, e é isto que faz elas concordarem. A Lista
 * já listava uma linha por etapa; o board listava um card por DEMANDA, com um
 * selo dizendo "5 subtarefas suas" — cinco trabalhos, cinco prazos e cinco
 * andamentos espremidos num card só, numa coluna decidida pelo status da
 * demanda. Agora ele é `BoardDeEtapas`, com um card por etapa e as colunas dos
 * status da etapa.
 *
 * O calendário e o formulário de nova task continuam sendo os mesmos da Gestão
 * de Tasks, recebendo parâmetros diferentes: aqui o clique abre o painel
 * lateral em vez de trocar de página. O board não dá para reaproveitar porque
 * o que ele desenha é outra entidade, com outro enum de status.
 *
 * Visualização e foco moram na URL. Além de o link ficar compartilhável, é o
 * que faz o contador clicável funcionar sem estado duplicado: clicar em
 * "Atrasadas" navega, e o servidor devolve a lista já filtrada pela mesma
 * função que produziu o número.
 */
/**
 * OS DOIS LADRILHOS DA COLUNA DA DIREITA, na ordem do desenho: o que vence
 * hoje e o que já passou. O terceiro foco — "esta semana" — não está aqui de
 * propósito: ele virou a linha do subtítulo, onde o artifact o pôs.
 *
 * O tom é o PAR NOMEADO e nunca opacidade, que é a regra da casa para cor de
 * estado: `bg-warning/10` sobre um fundo qualquer dá uma cor que ninguém
 * mediu, e no tema escuro dá outra.
 */
const LADRILHOS = [
  { id: "hoje", Icone: CalendarDays, tom: "bg-action-soft text-action-text" },
  { id: "atrasadas", Icone: Clock, tom: "bg-danger-soft text-danger" },
] as const satisfies readonly {
  id: FocoDoDia;
  Icone: LucideIcon;
  tom: string;
}[];

export function PainelPessoal({
  linhas,
  novidades,
  itensDeCalendario,
  itensDoDia,
  contadores,
  equipe,
  prazos,
  usuarioId,
  souGestor,
  primeiroNome,
  podeCriarTask,
  visao,
  foco,
  correndoAgora,
  foraHoje,
  saudacao,
  dataPorExtenso,
  agoraDoServidor,
}: {
  linhas: LinhaPessoal[];
  itensDeCalendario: ItemDeCalendario[];
  itensDoDia: ItemDoDia[];
  novidades: NovidadeDeArea[];
  contadores: Record<FocoDoDia, number>;
  equipe: {
    id: string;
    nome: string;
    avatar_url: string | null;
    funcao: TeamFuncao | null;
  }[];
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  primeiroNome: string;
  podeCriarTask: boolean;
  visao: Visao;
  foco: FocoDoDia | null;
  /** A etapa que está com o relógio correndo — a que está andando há mais tempo. */
  correndoAgora: EtapaEmAndamento | null;
  foraHoje: ResumoDaHome["fora_hoje"];
  /** "Bom dia" / "Boa tarde" / "Boa noite", decidido NO SERVIDOR. */
  saudacao: string;
  /** "Terça, 29 de setembro", já no locale pt-BR e no fuso da agência. */
  dataPorExtenso: string;
  agoraDoServidor: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const [taskAberta, setTaskAberta] = useState<string | null>(null);

  function navegar(mudancas: Record<string, string | null>) {
    const proximos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) proximos.delete(chave);
      else proximos.set(chave, valor);
    }
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      {/*
        O CABEÇALHO DA TELA, na composição aprovada: saudação grande em duas
        cores, e embaixo a data com a contagem da semana.

        **A contagem da semana é a SUBTÍTULO e não um terceiro ladrilho**, e
        essa é a única diferença entre esta tela e o artifact — ele mostra dois
        ladrilhos (Para hoje, Atrasada) e escreve "7 etapas suas nesta semana"
        na linha de baixo. O produto tinha os três como contador clicável, e
        perder o terceiro seria perder um filtro que existe na URL. Ele virou
        BOTÃO dentro do subtítulo: continua filtrando, e não ocupa um ladrilho
        numa coluna de 306px onde três não cabem sem apertar.

        A saudação e a data descem do SERVIDOR. Se a tela lesse o relógio, o
        navegador em outro fuso diria "Boa noite" num começo de tarde — é a
        regra de `hojeNaAgencia()` vista do lado do texto.
      */}
      <PageHeader
        title={`${saudacao},`}
        titleSecundario={primeiroNome}
        subtitulo={
          <>
            {/* `capitalize` do CSS sobe a primeira letra de CADA palavra, e o
                que sai é "Quarta-Feira, 30 De Setembro". O date-fns em pt-BR
                devolve tudo minúsculo de propósito; o que falta é a primeira
                letra da FRASE, que é `first-letter`. */}
            <span className="inline-block first-letter:uppercase">
              {dataPorExtenso}
            </span>
            {contadores.semana > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  data-foco="semana"
                  aria-pressed={foco === "semana"}
                  onClick={() =>
                    navegar({ foco: foco === "semana" ? null : "semana" })
                  }
                  className="text-accent-strong hover:underline"
                >
                  {contadores.semana} etapas suas nesta semana
                </button>
              </>
            ) : null}
          </>
        }
      />

      {/* AS TRÊS ÁREAS, COM CONTAGEM, MESMO QUANDO UMA DELAS ESTÁ EM ZERO.
          ---------------------------------------------------------------
          Decisão do usuário: *"Social Media e Campanhas ainda não está dentro
          de Minhas Tasks"*. Elas estavam — a peça de campanha é uma subtarefa
          desde a 0051 e a etapa de social desde a 0088 —, mas as duas só
          apareciam QUANDO havia trabalho nelas. Quem abre a tela procurando a
          área pelo nome, e não tem nada lá naquele dia, conclui que ela não
          existe aqui.

          **AS TRÊS CONTAGENS SAEM DE `areaDaLinha()` AGORA**, e isso é a 0088
          aparecendo na tela: até ela o Social contava de `etapasDeSocial`,
          uma consulta própria, porque a corrente era de `post_etapas` e não
          cabia na lista. Com a etapa sendo do mês ela é uma subtarefa comum e
          entra na mesma lista — então o número é a mesma soma dos outros dois,
          sobre as mesmas linhas, e não há segundo lugar onde ele possa
          divergir.

          Por isso esta faixa mostra o ZERO, ao contrário do selo de contagem
          da fila de aprovações, onde a ausência é a resposta. As duas regras
          não brigam: lá o selo COBRA uma ação, e um zero cobraria nada; aqui
          a linha RESPONDE onde o meu trabalho está, e "nenhum" é resposta.

          Cada chip é um link para a área inteira — não um filtro: a Lista já
          separa por área logo abaixo, e um filtro seria um segundo jeito de
          fazer a mesma coisa, com a URL para manter em dia. */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            [
              "demandas",
              linhas.filter((l) => areaDaLinha(l) === "demandas").length,
            ],
            [
              "campanhas",
              linhas.filter((l) => areaDaLinha(l) === "campanhas").length,
            ],
            [
              "social",
              linhas.filter((l) => areaDaLinha(l) === "social").length,
            ],
          ] as const
        ).map(([area, quantas]) => {
          const Icone = ICONE_DA_AREA[area];
          return (
            <Link
              key={area}
              href={ROTA_DA_AREA[area]}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                "hover:bg-accent",
                quantas === 0 && "text-muted-foreground",
              )}
            >
              <Icone aria-hidden className="size-3.5" />
              {ROTULOS_DE_AREA[area]}
              <span className="tabular-nums font-medium">{quantas}</span>
            </Link>
          );
        })}
      </div>

      {/* A FAIXA FICA ACIMA DE "MEU DIA", e é o único lugar em que ela cabe:
          ela diz que chegou trabalho que ainda NÃO está em nenhuma das listas
          abaixo — o post que a gestão acabou de liberar não tem prazo próprio,
          e a peça de campanha só vira linha depois de alguém abrir a demanda.
          Embaixo, ela seria a resposta depois da pergunta. */}
      <Novidades novidades={novidades} />

      {/*
        AS DUAS COLUNAS DO DESENHO APROVADO.

        A coluna da direita não é decoração, e o artifact diz o que ela carrega
        e por quê: o cronômetro, os contadores e quem está fora — "as três
        coisas que hoje moram na Home e que ninguém vê estando em Minhas
        Tasks". Quem passa o dia nesta tela não abre a Home, e o relógio
        esquecido aberto é justamente o número que ninguém vê.

        306px é a largura do desenho, e ela é fixa de propósito: a coluna
        carrega dois ladrilhos lado a lado, e em `1fr` eles encolheriam junto
        com a lista ao lado — o número de 26px é o conteúdo do ladrilho, não um
        enfeite que pode espremer.

        Abaixo de 1150px vira uma coluna só, como no artifact. E a direita vem
        DEPOIS no empilhamento, porque no celular o que a pessoa veio fazer é a
        lista; o resumo é contexto.
      */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_306px]">
        <div className="min-w-0 space-y-5">
          <MeuDia
            itens={itensDoDia}
            primeiroNome={primeiroNome}
            usuarioId={usuarioId}
            souGestor={souGestor}
          />

          <div className="flex flex-wrap items-center gap-3">
            <SeletorDeVisao
              atual={visao}
              aoTrocar={(v) => navegar({ visao: v })}
            />

            {foco ? (
              <Badge variant="secondary">
                Filtrando por {ROTULOS_DE_FOCO[foco].toLowerCase()}
              </Badge>
            ) : null}
          </div>

          {visao === "board" ? (
            <BoardDeEtapas
              linhas={linhas}
              prazos={prazos}
              usuarioId={usuarioId}
              souGestor={souGestor}
              aoAbrir={setTaskAberta}
            />
          ) : null}

          {visao === "lista" ? (
            <MinhaLista
              linhas={linhas}
              prazos={prazos}
              usuarioId={usuarioId}
              souGestor={souGestor}
              aoAbrir={setTaskAberta}
            />
          ) : null}

          {visao === "calendario" ? (
            <CalendarioDeTasks
              itens={itensDeCalendario}
              equipe={equipe}
              prazos={prazos}
              aoAbrir={setTaskAberta}
            />
          ) : null}

          {/* ---------------------------------------------------------------
              O BLOCO DO SOCIAL SAIU DAQUI (0088), e a ausência é a entrega.

              Ele ficava embaixo das três visões, fora do seletor, porque o
              board desenha colunas de `subtask_status` e o calendário desenha
              prazos — e uma etapa de `post_etapas` não tinha nem rodada, nem
              cronômetro, nem dependência para caber no molde. Posto dentro da
              Lista, o Social sumiria em duas das três visões.

              Com a etapa sendo do MÊS ela é uma subtarefa como qualquer outra:
              tem responsável, período, estimativa, cronômetro e as travas da
              0007. Então ela aparece nas TRÊS visões pelo caminho de sempre —
              linha na Lista, card no board, barra no calendário —, e o bloco
              próprio deixou de ter o que mostrar que a lista não mostre.

              **E o chip continua, com a contagem**, que é a razão de ele ter
              nascido: ele leva ao MÓDULO, onde a pessoa vê o mês inteiro e as
              caixinhas de cada peça. Era ele o pedido do usuário — ter nome e
              contagem nesta tela —, não o bloco.
              --------------------------------------------------------------- */}
        </div>

        <aside className="flex flex-col gap-2.5 lg:sticky lg:top-20">
          {/* A PÍLULA DE AÇÃO ABRE A COLUNA, como no desenho. Ela só aparece
              para quem faz Atendimento — `tasks_insert` é quem recusa de
              verdade, e isto evita oferecer um caminho sem saída. */}
          {podeCriarTask ? (
            <BotaoDeNovaTask className="w-full" destaque />
          ) : null}

          {/* O MESMO componente da Home, com os mesmos dados. Ele já sabe
              sumir quando não há etapa correndo — e sumir é o certo: um cartão
              dizendo "nenhuma etapa em andamento" ocupa a primeira dobra todo
              dia para informar em alguns. */}
          <EmAndamentoAgora
            etapa={correndoAgora}
            agoraDoServidor={agoraDoServidor}
          />

          <div className="grid grid-cols-2 gap-2.5">
            {LADRILHOS.map(({ id, Icone, tom }) => {
              const ativo = foco === id;
              const valor = contadores[id];
              return (
                <button
                  key={id}
                  type="button"
                  // Identifica o contador para o teste automatizado conferir
                  // que o número bate com o que a lista e o calendário mostram.
                  data-foco={id}
                  aria-pressed={ativo}
                  onClick={() => navegar({ foco: ativo ? null : id })}
                  className={cn(
                    "bg-card rounded-card border p-3 text-left transition-colors",
                    ativo
                      ? "border-accent-strong"
                      : "border-border hover:border-accent-strong/40",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-lg",
                        tom,
                      )}
                    >
                      <Icone aria-hidden className="size-4" />
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="text-text-muted size-3.5"
                    />
                  </span>
                  <span
                    className={cn(
                      "mt-2.5 block text-[26px] leading-none font-bold tracking-[-0.04em] tabular-nums",
                      id === "atrasadas" && valor > 0 && "text-destructive",
                    )}
                  >
                    {valor}
                  </span>
                  <span className="text-text-secondary mt-1 block text-xs font-semibold">
                    {ROTULOS_DE_FOCO[id]}
                  </span>
                </button>
              );
            })}
          </div>

          {foco ? (
            <button
              type="button"
              onClick={() => navegar({ foco: null })}
              className="text-text-muted hover:text-foreground self-start text-xs underline underline-offset-4"
            >
              Limpar filtro
            </button>
          ) : null}

          <QuemEstaForaHoje pessoas={foraHoje} />
        </aside>
      </div>

      <PainelLateralDaTask
        taskId={taskAberta}
        aoFechar={() => setTaskAberta(null)}
      />
    </div>
  );
}
