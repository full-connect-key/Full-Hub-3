"use client";

import { useState } from "react";
import { Check, ChevronDown, Search, Wand2 } from "lucide-react";

import { corDoPontoDeStatus } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROTULOS_DE_STATUS, STATUS_DE_TASK } from "@/lib/dominio/tasks";
import {
  EXPLICACAO_DO_STATUS,
  ROTULOS_DE_SUBTAREFA,
  STATUS_DE_SUBTAREFA,
} from "@/lib/tasks/state-machine";
import type { SubtaskStatus, TaskStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * O seletor de status, nos dois níveis.
 *
 * **TODOS OS STATUS SÃO ESCOLHÍVEIS, e nenhum aparece desligado.** A versão
 * anterior mostrava os sete e desabilitava cinco, com o motivo: o status da
 * Task era calculado pelas subtarefas e a escolha seria desfeita no mesmo
 * instante. Decisão do usuário: os sete se marcam à mão. A migration 0025 é o
 * que torna isso verdade — `status_manual` passou a travar o recálculo
 * inteiro, e não só dois casos. Sem ela, isto aqui seria pior que a recusa:
 * o clique passaria e a escolha sumiria na próxima mexida numa etapa.
 *
 * **AGRUPADO E COM BUSCA**, como a referência que o usuário mandou. O grupo dá
 * a leitura de relance — onde a demanda está, não qual das sete palavras é —,
 * e a busca é o que faz a lista continuar utilizável de teclado quando ela
 * cresce. Digitar filtra e Enter escolhe o primeiro.
 *
 * **NA SUBTAREFA NADA É DESLIGADO TAMBÉM, e o que o banco recusa vira a
 * mensagem.** As travas da etapa continuam todas de pé: concluir sem
 * aprovação, ir para "Enviada para aprovação" sem rodada, estacionar em "Em
 * ajustes" sem ninguém ter pedido ajuste. A diferença é onde a pessoa
 * descobre — antes num item cinza que ela não podia clicar, agora numa frase
 * que diz o caminho ("A rodada é criada pela ação Enviar para aprovação").
 * Cinza não ensina nada; a recusa do banco ensina.
 */

type Grupo<T extends TaskStatus | SubtaskStatus> = { rotulo: string; status: T[] };

const GRUPOS_DA_TASK: Grupo<TaskStatus>[] = [
  { rotulo: "Não iniciado", status: ["nao_iniciada"] },
  {
    rotulo: "Em andamento",
    status: ["em_andamento", "aguardando_informacoes", "em_aprovacao", "em_ajustes"],
  },
  { rotulo: "Encerrado", status: ["entregue", "concluido"] },
];

const GRUPOS_DA_SUBTAREFA: Grupo<SubtaskStatus>[] = [
  { rotulo: "Não iniciada", status: ["nao_iniciada"] },
  {
    rotulo: "Em andamento",
    status: ["em_andamento", "aguardando_informacoes", "enviada_aprovacao", "em_ajustes"],
  },
  { rotulo: "Encerrada", status: ["concluida"] },
];

// Os grupos precisam cobrir a lista inteira. Se um status novo entrar no enum
// e ninguém o colocar num grupo, ele some do seletor — sem erro, sem aviso, e
// só aparece no dia em que alguém procurar por ele.
const FALTA_NA_TASK = STATUS_DE_TASK.filter(
  (s) => !GRUPOS_DA_TASK.some((g) => (g.status as string[]).includes(s)),
);
const FALTA_NA_SUBTAREFA = STATUS_DE_SUBTAREFA.filter(
  (s) => !GRUPOS_DA_SUBTAREFA.some((g) => (g.status as string[]).includes(s)),
);
if (FALTA_NA_TASK.length > 0 || FALTA_NA_SUBTAREFA.length > 0) {
  throw new Error(
    `Status fora de todo grupo do seletor: ${[...FALTA_NA_TASK, ...FALTA_NA_SUBTAREFA].join(", ")}`,
  );
}

export function SeletorDeStatus({
  status,
  podeEditar,
  aoMudar,
  aoCalcular,
  calculado,
}: {
  status: TaskStatus;
  podeEditar: boolean;
  aoMudar: (novo: TaskStatus) => void;
  /** Devolver o volante ao cálculo. Ausente onde isso não faz sentido. */
  aoCalcular?: () => void;
  /** Se o status atual veio do cálculo (e não da mão de alguém). */
  calculado?: boolean;
}) {
  return (
    <Picker
      valor={status}
      grupos={GRUPOS_DA_TASK}
      rotulos={ROTULOS_DE_STATUS}
      explicacoes={EXPLICACAO_DO_STATUS}
      podeEditar={podeEditar}
      aoMudar={aoMudar}
      rotuloAcessivel="Status da demanda"
      rodape={
        aoCalcular && !calculado
          ? {
              rotulo: "Deixar o Full Hub calcular",
              descricao: "O status volta a sair do andamento das etapas.",
              ao: aoCalcular,
            }
          : null
      }
    />
  );
}

export function SeletorDeStatusDaSubtarefa({
  status,
  podeEditar,
  aoMudar,
  compacto = false,
}: {
  status: SubtaskStatus;
  podeEditar: boolean;
  aoMudar: (novo: SubtaskStatus) => void;
  compacto?: boolean;
}) {
  return (
    <Picker
      valor={status}
      grupos={GRUPOS_DA_SUBTAREFA}
      rotulos={ROTULOS_DE_SUBTAREFA}
      explicacoes={null}
      podeEditar={podeEditar}
      aoMudar={aoMudar}
      rotuloAcessivel="Status da etapa"
      rodape={null}
      compacto={compacto}
    />
  );
}

function Picker<T extends TaskStatus | SubtaskStatus>({
  valor,
  grupos,
  rotulos,
  explicacoes,
  podeEditar,
  aoMudar,
  rotuloAcessivel,
  rodape,
  compacto = false,
}: {
  valor: T;
  grupos: Grupo<T>[];
  rotulos: Record<T, string>;
  explicacoes: Record<T, string> | null;
  podeEditar: boolean;
  aoMudar: (novo: T) => void;
  rotuloAcessivel: string;
  rodape: { rotulo: string; descricao: string; ao: () => void } | null;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const visiveis = grupos
    .map((grupo) => ({
      ...grupo,
      status: grupo.status.filter((s) => rotulos[s].toLowerCase().includes(termo)),
    }))
    .filter((grupo) => grupo.status.length > 0);

  const primeiro = visiveis[0]?.status[0] ?? null;

  function escolher(novo: T) {
    setAberto(false);
    setBusca("");
    if (novo !== valor) aoMudar(novo);
  }

  const gatilho = (
    <button
      type="button"
      disabled={!podeEditar}
      aria-label={rotuloAcessivel}
      className={cn(
        "flex items-center gap-2 rounded-md border text-sm transition-colors",
        "disabled:cursor-default disabled:opacity-100",
        compacto ? "px-2 py-1 text-xs" : "w-full px-3 py-2",
        podeEditar && "hover:bg-accent",
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", corDoPontoDeStatus(valor))} />
      <span className="min-w-0 flex-1 truncate text-left">{rotulos[valor]}</span>
      {podeEditar ? (
        <ChevronDown aria-hidden className="text-text-muted size-3.5 shrink-0" />
      ) : null}
    </button>
  );

  if (!podeEditar) return gatilho;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-0">
        <div className="relative border-b p-2">
          <Search
            aria-hidden
            className="text-text-muted pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2"
          />
          <Input
            autoFocus
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar status…"
            aria-label="Buscar status"
            className="h-8 pl-7 text-sm"
            onKeyDown={(evento) => {
              // Enter escolhe o primeiro da lista filtrada: digitar "apro" e
              // apertar Enter é o caminho de quem já sabe o que quer, e é o
              // que faz a busca economizar um movimento em vez de custar um.
              if (evento.key === "Enter" && primeiro) {
                evento.preventDefault();
                escolher(primeiro);
              }
            }}
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {visiveis.length === 0 ? (
            <p className="text-text-muted px-2 py-4 text-center text-xs">
              Nenhum status com esse nome.
            </p>
          ) : (
            visiveis.map((grupo) => (
              <div key={grupo.rotulo} className="py-1">
                <p className="text-text-muted px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                  {grupo.rotulo}
                </p>

                {grupo.status.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => escolher(s)}
                    title={explicacoes?.[s]}
                    className={cn(
                      "hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      s === valor && "bg-accent",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("size-2.5 shrink-0 rounded-full", corDoPontoDeStatus(s))}
                    />
                    <span className="min-w-0 flex-1 truncate">{rotulos[s]}</span>
                    {s === valor ? (
                      <Check aria-hidden className="text-accent-strong size-3.5 shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {rodape ? (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                rodape.ao();
              }}
              className="hover:bg-accent flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left"
            >
              <Wand2 aria-hidden className="text-text-muted mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm">{rodape.rotulo}</span>
                <span className="text-text-muted block text-xs">{rodape.descricao}</span>
              </span>
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
