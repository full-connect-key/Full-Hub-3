"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { RelatorioDeFeedback, RespostaDoFeedback } from "@/lib/dados/feedback";
import { lerAlertas, ROTULOS_DE_STATUS } from "@/lib/dominio/feedback";

import {
  apagarFeedback,
  descartarFeedback,
  enviarFeedback,
  salvarTextoDoFeedback,
} from "./acoes";
import { PainelDeMetricas } from "./painel-de-metricas";
import { ResponderAoFeedback } from "./responder";

/**
 * A REVISÃO: o texto de um lado, os números do outro.
 *
 * ---------------------------------------------------------------------------
 * **LADO A LADO, e não um abaixo do outro.** Quem revisa faz uma coisa só:
 * conferir se o texto bate com os números. Empilhados, essa conferência vira
 * rolar a tela para cima e para baixo comparando de memória — e o erro que ela
 * existe para pegar (um número que a IA calculou em vez de ler) é exatamente o
 * que não sobrevive a isso.
 *
 * Em 375px eles empilham, e aí o TEXTO vem primeiro: no celular a revisão é
 * leitura, e a conferência número por número é trabalho de tela grande.
 * ---------------------------------------------------------------------------
 *
 * **O TEXTO É EDITÁVEL, E A EDIÇÃO É O NORMAL — não a exceção.** Nenhum aviso,
 * nenhuma confirmação: quem revisa escreve por cima. `texto_gerado` continua
 * guardando o que a IA escreveu, e é por isso que as duas colunas existem.
 *
 * **OS ALERTAS DA VERIFICAÇÃO APARECEM EM DESTAQUE**, e eles nunca
 * descartaram nada: um descarte silencioso gastaria a chamada e não deixaria
 * nada para investigar. `--warning` e não `--danger` — um número fora dos dados
 * pede leitura, não pânico.
 *
 * **O TEXTO NÃO SALVA SOZINHO**, ao contrário da tela de task. Lá o rascunho é
 * de quem o criou e não existe para mais ninguém; aqui cada salvamento parcial
 * é uma frase a meio caminho sobre uma pessoa, e o botão "Enviar" está a um
 * clique de distância — a decisão do editor de recorrência, que também não
 * salva sozinho.
 */
export function RevisaoDoFeedback({
  relatorio,
  respostas,
  exigeRevisao,
}: {
  relatorio: RelatorioDeFeedback;
  respostas: RespostaDoFeedback[];
  exigeRevisao: boolean;
}) {
  const router = useRouter();
  const alertas = lerAlertas(relatorio.alertas_json);
  const [texto, setTexto] = useState(
    relatorio.texto_final ?? relatorio.texto_gerado ?? "",
  );
  const [salvando, setSalvando] = useState(false);

  // NÃO HÁ EFEITO DE SINCRONIZAÇÃO AQUI, e a ausência é a regra: quem troca de
  // relatório recebe um componente novo, porque o `page.tsx` passa `key` com o
  // id. Ressincronizar dentro de um `useEffect` dispara renderização em cascata
  // — o `lint` do projeto reprova — e, pior, sobrescreveria o que quem revisa
  // acabou de digitar no instante em que o servidor revalidasse a página. É a
  // lição do editor de post no Sprint 14, e a mesma de `atualizacao-ao-vivo`.

  const enviado = relatorio.status === "enviado";
  const semTexto = !relatorio.texto_gerado;
  const mudou = texto !== (relatorio.texto_final ?? relatorio.texto_gerado ?? "");

  async function salvar() {
    setSalvando(true);
    await chamarEMostrar(() =>
      salvarTextoDoFeedback({ id: relatorio.id, texto_final: texto }),
    );
    setSalvando(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-text-primary text-base font-semibold">
          {relatorio.pessoa?.nome ?? "—"}
        </h2>
        <p className="text-text-muted text-xs">
          {ROTULOS_DE_STATUS[relatorio.status]}
          {relatorio.modelo_usado ? ` · ${relatorio.modelo_usado}` : ""}
          {relatorio.prompt_versao ? ` · prompt ${relatorio.prompt_versao}` : ""}
        </p>
      </div>

      {alertas.length > 0 ? (
        <div className="bg-warning-soft border-warning space-y-2 rounded-lg border p-3">
          <p className="text-warning flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4" aria-hidden />
            A verificação automática achou {alertas.length} coisa(s) neste texto
          </p>
          <ul className="text-text-secondary list-disc space-y-1 pl-5 text-xs">
            {alertas.map((a, i) => (
              <li key={i}>{a.frase}</li>
            ))}
          </ul>
          <p className="text-text-muted text-xs">
            Nada foi descartado: corrija o texto, ou envie assim mesmo se a
            verificação estiver errada.
          </p>
        </div>
      ) : null}

      {semTexto ? (
        <p className="text-text-muted text-sm">
          {relatorio.status === "dados_insuficientes"
            ? "O período não tinha etapas concluídas suficientes, então nenhum texto foi escrito. Os números estão do lado."
            : "Este relatório ficou sem texto. Apague-o e gere de novo."}
        </p>
      ) : null}

      {/* LADO A LADO a partir de `xl`, e o texto PRIMEIRO na ordem do DOM: em
          375px a coluna de números desce, que é onde ela deve ficar. */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <label
            htmlFor={`texto-${relatorio.id}`}
            className="text-text-secondary text-xs font-semibold tracking-wide uppercase"
          >
            O texto que a pessoa vai ler
          </label>
          <Textarea
            id={`texto-${relatorio.id}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={16}
            disabled={enviado}
            className="text-[0.95rem] leading-relaxed"
          />
          {enviado ? (
            <p className="text-text-muted text-xs">
              Este feedback já foi enviado e não se reescreve. Se algo estiver
              errado, converse com a pessoa aqui embaixo.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={salvar}
                disabled={salvando || !mudou}
              >
                {salvando ? "Salvando…" : "Salvar texto"}
              </Button>

              <ConfirmDialog
                title="Enviar este feedback?"
                description={`${relatorio.pessoa?.nome ?? "A pessoa"} passa a ler este texto e os números dele, e recebe um aviso. Um feedback enviado não volta atrás.`}
                confirmLabel="Aprovar e enviar"
                onConfirm={async () => {
                  await chamarEMostrar(() => enviarFeedback({ ids: [relatorio.id] }));
                  router.refresh();
                }}
                trigger={
                  <Button size="sm" disabled={semTexto || mudou}>
                    Aprovar e enviar
                  </Button>
                }
              />

              <ConfirmDialog
                title="Descartar este feedback?"
                description="Ele não chega à pessoa. Os números do período ficam gravados, e dá para gerar outro depois de apagar este."
                confirmLabel="Descartar"
                onConfirm={async () => {
                  await chamarEMostrar(() => descartarFeedback({ id: relatorio.id }));
                  router.refresh();
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    Descartar
                  </Button>
                }
              />

              <ConfirmDialog
                title="Apagar este relatório?"
                description="Apaga a linha inteira, com os números e o texto. É o caminho para o relatório gerado sobre o período errado — para o que foi lido e recusado, use Descartar."
                confirmLabel="Apagar"
                destructive
                onConfirm={async () => {
                  await chamarEMostrar(() => apagarFeedback({ id: relatorio.id }));
                  router.push("/painel/feedback");
                  router.refresh();
                }}
                trigger={
                  <Button size="sm" variant="ghost" className="text-danger">
                    Apagar
                  </Button>
                }
              />
            </div>
          )}

          {mudou && !enviado ? (
            <p className="text-warning text-xs">
              Salve o texto antes de enviar — o que está na tela ainda não foi
              gravado.
            </p>
          ) : null}

          {!exigeRevisao ? (
            <p className="text-warning text-xs">
              A revisão humana está desligada na configuração. Isto significa
              que a geração em massa envia direto, sem ninguém ler.
            </p>
          ) : null}
        </div>

        <div className="border-border xl:border-l xl:pl-6">
          <h3 className="text-text-secondary mb-3 text-xs font-semibold tracking-wide uppercase">
            Os números que a IA recebeu
          </h3>
          <PainelDeMetricas
            metricasBrutas={relatorio.metricas_json}
            contextoBrutos={relatorio.contexto_json}
          />
        </div>
      </div>

      <div className="border-border border-t pt-4">
        <ResponderAoFeedback reportId={relatorio.id} respostas={respostas} />
      </div>
    </div>
  );
}
