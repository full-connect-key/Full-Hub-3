"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type {
  RespostaDoFeedback,
} from "@/lib/dominio/feedback";

import { responderAoFeedback } from "./acoes";

/**
 * RESPONDER AO FEEDBACK.
 *
 * ---------------------------------------------------------------------------
 * **ISTO NÃO É OPCIONAL: feedback sem direito de resposta é comunicado, não
 * feedback.** A pessoa pode discordar, contextualizar ou pedir conversa, e a
 * resposta notifica quem revisou e fica no histórico.
 * ---------------------------------------------------------------------------
 *
 * **E ELA NÃO SE EDITA NEM SE APAGA** — nem pelo sócio, e a tabela não tem
 * policy para nenhum dos dois. A resposta é o registro de que a pessoa
 * discordou; reescrevê-la depois apagaria a discordância, pela razão de a
 * rodada de aprovação fechada nunca ser reescrita.
 *
 * O componente é o MESMO nos dois lados — na Home da pessoa e na tela de quem
 * revisa —, e `comoPessoa` troca uma frase. Duas threads divergiriam, e a
 * divergência apareceria na conversa mais delicada do produto.
 */
export function ResponderAoFeedback({
  reportId,
  respostas,
  comoPessoa,
}: {
  reportId: string;
  respostas: RespostaDoFeedback[];
  comoPessoa?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    const resultado = await chamarEMostrar(() =>
      responderAoFeedback({ report_id: reportId, texto }),
    );
    setEnviando(false);
    if (resultado.ok) setTexto("");
  }

  return (
    <div className="space-y-3">
      <h3 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
        Conversa
      </h3>

      {respostas.length > 0 ? (
        <ul className="space-y-3">
          {respostas.map((r) => (
            <li key={r.id} className="flex gap-3">
              <UserAvatar
                name={r.autor?.nome ?? "—"}
                src={r.autor?.avatar_url ?? null}
                size="sm"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-xs font-medium">
                  {r.autor?.nome ?? "—"}{" "}
                  <span className="text-text-muted font-normal">
                    ·{" "}
                    {format(parseISO(r.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </p>
                <p className="text-text-secondary mt-0.5 text-sm whitespace-pre-wrap">
                  {r.texto}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={`resposta-${reportId}`} className="sr-only">
          Sua resposta
        </label>
        <Textarea
          id={`resposta-${reportId}`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder={
            comoPessoa
              ? "Discorde, acrescente contexto, ou peça uma conversa."
              : "Responda a esta pessoa."
          }
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-text-muted text-xs">
            {comoPessoa
              ? "Quem revisou o seu feedback é avisado. A resposta fica no histórico e não se apaga."
              : "A pessoa é avisada. A resposta fica no histórico e não se apaga."}
          </p>
          <Button
            size="sm"
            onClick={enviar}
            disabled={enviando || texto.trim().length < 2}
          >
            {enviando ? "Enviando…" : "Responder"}
          </Button>
        </div>
      </div>
    </div>
  );
}
