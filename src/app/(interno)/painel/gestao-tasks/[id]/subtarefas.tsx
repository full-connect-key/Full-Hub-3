"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CornerDownRight,
  GripVertical,
  Layers,
  Link2,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { Cronometro } from "@/components/shared/cronometro";
import { DateBadge } from "@/components/shared/date-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { emArvore, folhas } from "@/lib/dominio/tasks";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { Pessoa, SubtarefaDetalhada } from "@/lib/dados/tasks";
import { cn } from "@/lib/utils";

import { criarSubtarefa, removerSubtarefa } from "../acoes-de-itens";
import { PainelDaSubtarefa } from "./painel-da-subtarefa";

/**
 * A lista de etapas — o centro do detalhe da Task.
 *
 * Cada linha responde, de relance: quem faz, para quando, em que pé está, se
 * precisa passar por aprovação (o cadeado) e se está esperando outra etapa (o
 * elo). Clicar abre o painel lateral com o resto, sem trocar de página.
 *
 * SÃO TRÊS NÍVEIS: a demanda, a etapa e a sub-etapa (migration 0022). E o que
 * governa o desenho é uma regra só — **quem tem sub-etapa vira agrupadora**,
 * e agrupadora não é unidade de trabalho. A linha dela perde o responsável, o
 * prazo, o relógio e os botões de ação, e no lugar mostra a soma das filhas.
 * Não é omissão: esses campos passaram a ser das filhas, e desenhá-los na mãe
 * mostraria um dono e uma data que já não valem para nada.
 *
 * Criar e apagar etapa é do Atendimento e da gestão. Trabalhar nela é de quem
 * é responsável — e é por isso que o botão de ação de cada linha é o mesmo
 * componente compartilhado: ele pergunta à máquina de estados, não ao layout.
 */
export function Subtarefas({
  taskId,
  subtarefas,
  equipe,
  podeGerenciar,
  souGestor,
  usuarioId,
  agoraDoServidor,
}: {
  taskId: string;
  subtarefas: SubtarefaDetalhada[];
  equipe: Pessoa[];
  /** Atendimento ou gestão: quem pode acrescentar e remover etapas. */
  podeGerenciar: boolean;
  souGestor: boolean;
  usuarioId: string;
  /** O instante medido no servidor, para o cronômetro começar de lá. */
  agoraDoServidor: number;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [novo, setNovo] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  /** Em qual etapa o campo de nova sub-etapa está aberto. */
  const [aninhandoEm, setAninhandoEm] = useState<string | null>(null);
  const [novaFilha, setNovaFilha] = useState("");

  const arvore = emArvore(subtarefas);
  // O CONTADOR É DE FOLHAS. Contar a agrupadora faria "3 de 4" ficar parado
  // para sempre: ela só conclui depois das filhas, então a conta nunca fecha.
  const asFolhas = folhas(subtarefas);
  const concluidas = asFolhas.filter((s) => s.status === "concluida").length;
  const emAberto = subtarefas.find((s) => s.id === aberta) ?? null;

  function adicionar(titulo: string, parentId: string | null) {
    const limpo = titulo.trim();
    if (limpo.length === 0) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        criarSubtarefa(taskId, { titulo: limpo, parent_id: parentId }),
      );
      // A recusa vem do banco por extenso — "a etapa exige aprovação e por
      // isso não pode virar agrupadora", "já é uma sub-etapa". É ela que
      // ensina a regra, e por isso vai inteira para a tela.
      if (!resultado.ok) toast.error(resultado.error);
      else {
        setNovo("");
        setNovaFilha("");
        setAninhandoEm(null);
        router.refresh();
      }
    });
  }

  function remover(sub: SubtarefaDetalhada, quantasFilhas: number) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => removerSubtarefa(sub.id, taskId));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        if (quantasFilhas > 0) {
          toast.success(
            `"${sub.titulo}" saiu, e as ${quantasFilhas} sub-etapas dentro dela foram junto.`,
          );
        }
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">Subtarefas</h2>

        {/* A BARRA, e não só o número. "8 de 24" é uma conta que a pessoa
            faz; a barra é uma resposta que ela lê. As duas juntas porque a
            barra sozinha não diz quantas faltam. */}
        {asFolhas.length > 0 ? (
          <>
            <span className="text-text-secondary text-xs tabular-nums">
              {concluidas} de {asFolhas.length} concluída
              {asFolhas.length === 1 ? "" : "s"}
            </span>
            <span aria-hidden className="bg-neutral-soft h-1.5 w-24 overflow-hidden rounded-full">
              <span
                className="bg-success block h-full rounded-full"
                style={{ width: `${Math.round((concluidas / asFolhas.length) * 100)}%` }}
              />
            </span>
          </>
        ) : (
          <span className="text-text-muted text-xs">nenhuma etapa</span>
        )}
      </div>

      {subtarefas.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Esta demanda ainda não tem etapas. A subtarefa é a unidade de trabalho: é nela que entra
          o responsável, o prazo e a regra de aprovação.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {arvore.map(({ etapa, filhas }) => (
            <li key={etapa.id}>
              <Linha
                sub={etapa}
                filhas={filhas.length}
                somaDasFilhas={
                  filhas.length > 0
                    ? {
                        real: somar(filhas, "tempo_real_minutos"),
                        estimado: somar(filhas, "estimativa_minutos"),
                        concluidas: filhas.filter((f) => f.status === "concluida").length,
                      }
                    : null
                }
                podeGerenciar={podeGerenciar}
                souGestor={souGestor}
                usuarioId={usuarioId}
                agoraDoServidor={agoraDoServidor}
                aoAbrir={() => setAberta(etapa.id)}
                aoAninhar={() => {
                  setAninhandoEm(aninhandoEm === etapa.id ? null : etapa.id);
                  setNovaFilha("");
                }}
                aoRemover={() => remover(etapa, filhas.length)}
              />

              {filhas.length > 0 ? (
                <ul className="border-t">
                  {filhas.map((filha) => (
                    <li key={filha.id} className="border-b last:border-b-0">
                      <Linha
                        sub={filha}
                        aninhada
                        filhas={0}
                        somaDasFilhas={null}
                        podeGerenciar={podeGerenciar}
                        souGestor={souGestor}
                        usuarioId={usuarioId}
                        agoraDoServidor={agoraDoServidor}
                        aoAbrir={() => setAberta(filha.id)}
                        aoAninhar={null}
                        aoRemover={() => remover(filha, 0)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {aninhandoEm === etapa.id ? (
                <form
                  className="bg-muted flex gap-2 border-t p-3 pl-10"
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    adicionar(novaFilha, etapa.id);
                  }}
                >
                  <Input
                    autoFocus
                    value={novaFilha}
                    onChange={(evento) => setNovaFilha(evento.target.value)}
                    placeholder={`Sub-etapa dentro de "${etapa.titulo}"`}
                    aria-label={`Título da nova sub-etapa de ${etapa.titulo}`}
                  />
                  <Button type="submit" variant="outline" disabled={salvando || novaFilha.trim() === ""}>
                    {salvando ? <Loader2 className="animate-spin" /> : <Plus aria-hidden />}
                    Adicionar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setAninhandoEm(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {asFolhas.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Tempo somado: {formatarMinutos(somar(asFolhas, "tempo_real_minutos"))} realizado de{" "}
          {formatarMinutos(somar(asFolhas, "estimativa_minutos"))} estimado.
        </p>
      ) : null}

      {podeGerenciar ? (
        <form
          className="flex gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            adicionar(novo, null);
          }}
        >
          <Input
            value={novo}
            onChange={(evento) => setNovo(evento.target.value)}
            placeholder="Nova subtarefa"
            aria-label="Título da nova subtarefa"
          />
          <Button type="submit" variant="outline" disabled={salvando || novo.trim() === ""}>
            {salvando ? <Loader2 className="animate-spin" /> : <Plus aria-hidden />}
            Adicionar
          </Button>
        </form>
      ) : null}

      {emAberto ? (
        <PainelDaSubtarefa
          subtarefa={emAberto}
          taskId={taskId}
          equipe={equipe}
          irmas={subtarefas}
          podeGerenciar={podeGerenciar}
          souGestor={souGestor}
          usuarioId={usuarioId}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * Uma linha da lista, nos dois papéis que ela tem.
 *
 * **Agrupadora** (`somaDasFilhas` preenchido): sem responsável, sem prazo, sem
 * relógio e sem botão de ação — esses quatro passaram a ser das filhas no
 * instante em que a primeira nasceu. No lugar vai a soma delas, que é a única
 * coisa verdadeira que a mãe ainda tem a dizer sobre tempo.
 *
 * **Folha**: como sempre foi.
 */
function Linha({
  sub,
  aninhada = false,
  filhas,
  somaDasFilhas,
  podeGerenciar,
  souGestor,
  usuarioId,
  agoraDoServidor,
  aoAbrir,
  aoAninhar,
  aoRemover,
}: {
  sub: SubtarefaDetalhada;
  aninhada?: boolean;
  filhas: number;
  somaDasFilhas: { real: number | null; estimado: number | null; concluidas: number } | null;
  podeGerenciar: boolean;
  souGestor: boolean;
  usuarioId: string;
  agoraDoServidor: number;
  aoAbrir: () => void;
  /** Null na sub-etapa: o terceiro nível é o último. */
  aoAninhar: (() => void) | null;
  aoRemover: () => void;
}) {
  const agrupadora = somaDasFilhas !== null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 p-3", aninhada && "pl-10")}>
      {aninhada ? (
        <CornerDownRight className="text-muted-foreground/50 size-4 shrink-0" aria-hidden />
      ) : podeGerenciar ? (
        <GripVertical className="text-muted-foreground/50 size-4 shrink-0" aria-hidden />
      ) : null}

      <button
        type="button"
        className="hover:text-accent-strong min-w-0 flex-1 text-left text-sm font-medium"
        onClick={aoAbrir}
      >
        <span className="truncate">{sub.titulo}</span>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {agrupadora ? (
          <>
            {/* O que a agrupadora tem a dizer: quantas etapas ela junta, e a
                soma do tempo delas. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-text-secondary inline-flex cursor-help items-center gap-1 text-xs">
                  <Layers className="size-3.5" aria-hidden />
                  <span className="tabular-nums">
                    {somaDasFilhas.concluidas}/{filhas}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Esta etapa agrupa {filhas} sub-etapa{filhas === 1 ? "" : "s"} — o responsável, o
                prazo e o tempo são de cada uma delas. O status daqui é calculado pelo andamento
                das filhas.
              </TooltipContent>
            </Tooltip>

            <span className="text-muted-foreground text-xs tabular-nums">
              {formatarMinutos(somaDasFilhas.real)} de {formatarMinutos(somaDasFilhas.estimado)}
            </span>

            <StatusBadge status={sub.status} />
          </>
        ) : (
          <>
            {sub.requer_aprovacao ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground inline-flex">
                    <Lock className="size-3.5" aria-label="Exige aprovação" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Exige aprovação {ROTULO_DA_APROVACAO[sub.tipo_aprovacao ?? "interna"]}
                </TooltipContent>
              </Tooltip>
            ) : null}

            {sub.dependenciasAbertas.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-warning inline-flex">
                    <Link2 className="size-3.5" aria-label="Aguardando outra etapa" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Aguardando: {sub.dependenciasAbertas.join(", ")}</TooltipContent>
              </Tooltip>
            ) : null}

            {sub.responsavel ? (
              <UserAvatar name={sub.responsavel.nome} src={sub.responsavel.avatar_url} size="sm" />
            ) : (
              <span className="text-muted-foreground text-xs">sem responsável</span>
            )}

            <PriorityBadge priority={sub.prioridade} />

            {/* DateBadge é para prazo a vencer. Etapa concluída mostra a data
                crua, senão o passado apareceria em vermelho como se fosse
                atraso. */}
            {sub.prazo ? (
              sub.status === "concluida" ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {format(parseISO(sub.prazo), "dd/MM/yy", { locale: ptBR })}
                </span>
              ) : (
                <DateBadge date={sub.prazo} />
              )
            ) : null}

            <StatusBadge status={sub.status} />

            {/* O relógio à vista. Um cronômetro que ninguém vê é um número que
                aparece pronto no diálogo de conclusão, sem a pessoa ter como
                saber de onde veio — e sem reparar que esqueceu a etapa em
                andamento de um dia para o outro. */}
            <Cronometro dados={sub} agoraDoServidor={agoraDoServidor} />

            <AcoesDaSubtarefa
              subtarefa={sub}
              usuarioId={usuarioId}
              souGestor={souGestor}
              rodadaPendenteId={sub.rodadas.find((r) => r.status === "pendente")?.id ?? null}
            />
          </>
        )}

        {podeGerenciar && aoAninhar ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Adicionar sub-etapa em ${sub.titulo}`}
                onClick={aoAninhar}
              >
                <CornerDownRight aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Desdobrar em sub-etapas</TooltipContent>
          </Tooltip>
        ) : null}

        {podeGerenciar ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Remover ${sub.titulo}`}
            onClick={aoRemover}
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function somar(
  subtarefas: SubtarefaDetalhada[],
  campo: "tempo_real_minutos" | "estimativa_minutos",
): number | null {
  const valores = subtarefas.map((s) => s[campo]).filter((v): v is number => v !== null);
  return valores.length === 0 ? null : valores.reduce((total, v) => total + v, 0);
}
