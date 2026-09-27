"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, List } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BotaoDeNovaTask } from "@/components/shared/botao-de-nova-task";
import { ROTULOS_DE_FOCO, type FocoDoDia } from "@/lib/dominio/tasks";
import type { ItemDeCalendario } from "@/lib/dados/tasks";
import type { Prazos } from "@/lib/dados/minhas-tasks";
import type { ItemDoDia } from "@/lib/dados/minhas-tasks";
import type { EtapaDeSocialMinha } from "@/lib/dados/social-media";
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
import { EtapasDeSocial } from "./etapas-de-social";
import { Novidades } from "./novidades";
import { MeuDia } from "./meu-dia";
import { MinhaLista } from "./minha-lista";
import { PainelLateralDaTask } from "./painel-lateral";

type Visao = "board" | "lista" | "calendario";

const VISOES: { id: Visao; rotulo: string; Icone: typeof List }[] = [
  { id: "board", rotulo: "Board", Icone: Columns3 },
  { id: "lista", rotulo: "Lista", Icone: List },
  { id: "calendario", rotulo: "Calendário", Icone: CalendarDays },
];

const FOCOS: FocoDoDia[] = ["atrasadas", "hoje", "semana"];

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
export function PainelPessoal({
  linhas,
  etapasDeSocial,
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
}: {
  linhas: LinhaPessoal[];
  itensDeCalendario: ItemDeCalendario[];
  itensDoDia: ItemDoDia[];
  etapasDeSocial: EtapaDeSocialMinha[];
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
      <div className="flex flex-wrap gap-2">
        {FOCOS.map((id) => {
          const ativo = foco === id;
          const valor = contadores[id];
          return (
            <button
              key={id}
              type="button"
              // Identifica o contador para o teste automatizado conferir que o
              // número bate com o que a lista e o calendário mostram.
              data-foco={id}
              aria-pressed={ativo}
              onClick={() => navegar({ foco: ativo ? null : id })}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-left transition-colors",
                ativo ? "border-accent-strong bg-accent" : "hover:bg-accent",
              )}
            >
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  id === "atrasadas" && valor > 0 && "text-destructive",
                )}
              >
                {valor}
              </p>
              <p className="text-muted-foreground text-xs">
                {ROTULOS_DE_FOCO[id]}
              </p>
            </button>
          );
        })}

        {foco ? (
          <button
            type="button"
            onClick={() => navegar({ foco: null })}
            className="text-muted-foreground hover:text-foreground self-center text-xs underline underline-offset-4"
          >
            Limpar filtro
          </button>
        ) : null}
      </div>

      {/* AS TRÊS ÁREAS, COM CONTAGEM, MESMO QUANDO UMA DELAS ESTÁ EM ZERO.
          ---------------------------------------------------------------
          Decisão do usuário: *"Social Media e Campanhas ainda não está dentro
          de Minhas Tasks"*. Elas estavam — a peça de campanha é uma subtarefa
          desde a 0051 e a etapa de social tem bloco desde o Sprint 14 —, mas
          as duas só apareciam QUANDO havia trabalho nelas. Quem abre a tela
          procurando a área pelo nome, e não tem nada lá naquele dia, conclui
          que ela não existe aqui.

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
            ["demandas", linhas.filter((l) => areaDaLinha(l) === "demandas").length],
            ["campanhas", linhas.filter((l) => areaDaLinha(l) === "campanhas").length],
            ["social", etapasDeSocial.length],
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

      <MeuDia
        itens={itensDoDia}
        primeiroNome={primeiroNome}
        usuarioId={usuarioId}
        souGestor={souGestor}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-muted/60 inline-flex rounded-lg border p-0.5">
          {VISOES.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => navegar({ visao: id })}
              aria-pressed={visao === id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                visao === id
                  ? "bg-background text-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone aria-hidden className="size-4" />
              {rotulo}
            </button>
          ))}
        </div>

        {foco ? (
          <Badge variant="secondary">
            Filtrando por {ROTULOS_DE_FOCO[foco].toLowerCase()}
          </Badge>
        ) : null}

        {/* Só aparece para quem faz Atendimento. A policy tasks_insert é quem
            recusa de verdade — isto evita oferecer um caminho sem saída. */}
        {podeCriarTask ? (
          <BotaoDeNovaTask className="ml-auto" />
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

      {/* O SOCIAL É A TERCEIRA ÁREA, e vem DEPOIS do conteúdo da visão — na
          mesma ordem dos chips lá em cima: Demandas, Campanhas, Social Media.

          **Ele fica FORA do seletor de visão, e isso é mecânico.** O board
          desenha colunas dos status da etapa de demanda e o calendário desenha
          prazos de demanda; nenhum dos dois sabe desenhar uma etapa de post, e
          uma etapa de post não tem rodada, cronômetro nem dependência para
          caber no molde. Posto dentro da Lista, o Social sumiria em duas das
          três visões — e quem trabalha no board perderia a área inteira sem
          nada dizendo por quê.

          Na Lista ele fecha a sequência das três seções; no board e no
          calendário ele aparece embaixo, que é onde uma lista cabe. */}
      <EtapasDeSocial etapas={etapasDeSocial} />

      <PainelLateralDaTask taskId={taskAberta} aoFechar={() => setTaskAberta(null)} />

    </div>
  );
}
