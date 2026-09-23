"use client";

import { Check, Lock } from "lucide-react";

import { corDoPontoDeStatus } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROTULOS_DE_STATUS } from "@/lib/dominio/tasks";
import { EXPLICACAO_DO_STATUS, STATUS_MANUAIS_DA_TASK } from "@/lib/tasks/state-machine";
import type { TaskStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * O seletor de status da Task.
 *
 * MOSTRA OS SETE, e não só os dois que dá para marcar. A versão anterior
 * oferecia apenas `entregue` e `aguardando_informacoes`, atrás de um
 * "Marcar à mão…" — e o resultado era que quem abria a lista concluía que o
 * produto tinha dois status. Os outros cinco existiam no board e no filtro,
 * mas não aqui, que é onde alguém vai procurar.
 *
 * OS CALCULADOS APARECEM DESLIGADOS, com o cadeado e o motivo. Esconder é
 * pior de duas maneiras: some com a informação de que eles existem, e deixa
 * sem resposta a pergunta seguinte — "então como é que essa task chegou em
 * Aguardando aprovação?". Desligado com a explicação responde as duas.
 *
 * AGRUPADO por onde a demanda está, porque sete itens numa lista corrida são
 * sete itens que se leem um a um. O grupo dá a leitura de relance.
 *
 * **Sem campo de busca**, ao contrário da referência: ela vem de uma
 * ferramenta onde cada equipe inventa os próprios status e a lista passa de
 * vinte. Sete cabem na tela — uma busca aqui seria um campo que nunca
 * economiza um movimento.
 */

type Grupo = { rotulo: string; status: TaskStatus[] };

const GRUPOS: Grupo[] = [
  { rotulo: "Não iniciado", status: ["nao_iniciada"] },
  {
    rotulo: "Em andamento",
    status: ["em_andamento", "aguardando_informacoes", "em_aprovacao", "em_ajustes"],
  },
  { rotulo: "Encerrado", status: ["entregue", "concluido"] },
];

export function SeletorDeStatus({
  status,
  podeEditar,
  aoMudar,
}: {
  status: TaskStatus;
  podeEditar: boolean;
  aoMudar: (novo: TaskStatus) => void;
}) {
  return (
    <Select
      value={status}
      disabled={!podeEditar}
      onValueChange={(valor) => aoMudar(valor as TaskStatus)}
    >
      <SelectTrigger className="w-full" aria-label="Status da demanda">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {GRUPOS.map((grupo) => (
          <SelectGroup key={grupo.rotulo}>
            <SelectLabel className="text-text-muted text-[11px] font-medium tracking-wide uppercase">
              {grupo.rotulo}
            </SelectLabel>

            {grupo.status.map((valor) => {
              const manual = STATUS_MANUAIS_DA_TASK.includes(valor);
              return (
                <SelectItem
                  key={valor}
                  value={valor}
                  // O calculado não se escolhe: o recálculo desfaria a escolha
                  // no mesmo instante, e a pessoa veria o próprio clique sumir.
                  disabled={!manual}
                  className="gap-2"
                  title={EXPLICACAO_DO_STATUS[valor]}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn("size-2 shrink-0 rounded-full", corDoPontoDeStatus(valor))}
                    />
                    {ROTULOS_DE_STATUS[valor]}
                    {manual ? null : (
                      <Lock aria-label="calculado pelas subtarefas" className="size-3 opacity-50" />
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A linha que explica por que a maioria está desligada.
 *
 * Fica ao lado do seletor, e não dentro dele: dentro, só aparece para quem
 * abrir a lista — e quem não abre é justamente quem não entendeu que o status
 * anda sozinho.
 */
export function ComoOStatusAnda() {
  const manuais = STATUS_MANUAIS_DA_TASK.map((s) => ROTULOS_DE_STATUS[s]);
  return (
    <p className="text-text-muted text-xs">
      <Check aria-hidden className="mr-1 inline size-3" />
      Só{" "}
      {/* Os nomes entram como ELEMENTOS, um a um. Montar a frase com
          `join("</strong> e <strong>")` escreveria as tags na tela: o React
          escapa string, e o que apareceria era o texto "</strong> e
          <strong>" no meio do parágrafo. */}
      {manuais.map((nome, indice) => (
        <span key={nome}>
          {indice > 0 ? " e " : null}
          <strong className="font-medium">{nome}</strong>
        </span>
      ))}{" "}
      se marcam à mão. Os outros vêm das subtarefas — mova as etapas e a Task acompanha.
    </p>
  );
}
