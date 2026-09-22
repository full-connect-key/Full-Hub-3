import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { TaskCompleta } from "@/lib/dados/tasks";

/**
 * O histórico da demanda, do mais recente para o mais antigo.
 *
 * Nada aqui é apagado para "limpar" o estado atual: o valor do histórico é
 * justamente responder, meses depois, por que uma peça foi refeita três vezes.
 *
 * Os rótulos traduzem o nome técnico da ação gravada no banco. Ação que ainda
 * não tem tradução aparece crua, em vez de sumir — é assim que um evento novo
 * é notado em vez de passar batido.
 */
const ROTULOS: Record<string, string> = {
  task_criada: "Task criada",
  subtarefa_criada: "Subtarefa criada",
  responsavel_alterado: "Responsável alterado",
  status_da_task: "Status da Task",
  status_da_subtarefa: "Status da subtarefa",
  enviada_para_aprovacao: "Enviada para aprovação",
  aprovacao_interna: "Aprovada internamente",
  ajustes_solicitados: "Ajustes solicitados",
  enviada_ao_cliente: "Enviada ao cliente",
  cliente_aprovou: "Cliente aprovou",
  cliente_pediu_ajustes: "Cliente pediu ajustes",
  entrega_anexada: "Entrega anexada",
};

export function HistoricoDaTask({ eventos }: { eventos: TaskCompleta["historico"] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nada registrado ainda. Cada movimento da demanda aparece aqui.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {eventos.map((evento) => (
        <li key={evento.id} className="flex gap-3 text-sm">
          <span className="text-muted-foreground w-28 shrink-0 tabular-nums">
            {format(parseISO(evento.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
          </span>
          <span className="min-w-0">
            <span className="font-medium">{ROTULOS[evento.acao] ?? evento.acao}</span>
            {evento.de_valor || evento.para_valor ? (
              <span className="text-muted-foreground">
                {evento.de_valor ? ` — de ${evento.de_valor}` : ""}
                {evento.para_valor ? ` ${evento.de_valor ? "para" : "—"} ${evento.para_valor}` : ""}
              </span>
            ) : null}
            {evento.autor ? (
              <span className="text-muted-foreground"> · {evento.autor.nome}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
