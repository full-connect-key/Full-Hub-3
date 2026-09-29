import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquareHeart } from "lucide-react";

import type { RelatorioDeFeedback, RespostaDoFeedback } from "@/lib/dados/feedback";
import { PainelDeMetricas } from "../feedback/painel-de-metricas";
import { ResponderAoFeedback } from "../feedback/responder";

/**
 * O MEU FEEDBACK DE DESENVOLVIMENTO — na tela Início.
 *
 * ---------------------------------------------------------------------------
 * **AQUI, E NÃO NUMA ABA DO MÓDULO QUE O SPRINT CITA** — decisão do usuário.
 * O sprint punha a tela da pessoa dentro de um módulo que SAIU DO PRODUTO na
 * migration 0043, por decisão dele também. Então o feedback chega onde ela já
 * abre todo dia. (O nome daquele módulo não aparece aqui de propósito: ele está
 * na lista de nomes mortos que o `check:cores` varre, e a explicação mora em
 * CLAUDE.md e no cabeçalho da 0043 — fora de `src/`.)
 *
 * O ganho não é só de rota: um retrato do próprio trabalho num módulo que
 * ninguém abre por hábito é um retrato que ninguém lê. Aqui ele está na mesma
 * tela em que ela vê o que entrega hoje.
 * ---------------------------------------------------------------------------
 *
 * **A ORDEM É TEXTO → ASSINATURA → NÚMEROS**, e não o contrário. O texto é o
 * que ela veio ler; os números existem para ela poder conferir se a IA leu
 * certo, e conferir vem depois de ler. É a decisão do detalhe do material no
 * Portal, onde a arte vem antes dos botões.
 *
 * **E OS NÚMEROS NÃO FICAM ATRÁS DE UM BOTÃO.** Escondidos, eles passam a ser
 * uma nota de rodapé que ninguém abre, e o texto volta a ser opinião de
 * máquina.
 *
 * **O BLOCO SOME QUANDO NÃO HÁ FEEDBACK ENVIADO**, como todo bloco de exceção
 * da Home. E ele só recebe relatório `enviado`: quem garante é
 * `feedback_reports_select`, não este componente — a tela não repete o filtro,
 * porque dois lugares decidindo a mesma coisa é como nascem duas verdades.
 */
export function MeuFeedback({
  relatorio,
  respostas,
  quantosAnteriores,
}: {
  relatorio: RelatorioDeFeedback | null;
  respostas: RespostaDoFeedback[];
  quantosAnteriores: number;
}) {
  if (!relatorio) return null;

  const texto = relatorio.texto_final ?? relatorio.texto_gerado;
  if (!texto) return null;

  const quando = relatorio.enviado_em ?? relatorio.created_at;

  return (
    <section className="space-y-3" aria-labelledby="meu-feedback-titulo">
      <h2
        id="meu-feedback-titulo"
        className="text-text-primary flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"
      >
        <MessageSquareHeart className="size-4" aria-hidden />
        Seu feedback de desenvolvimento
      </h2>

      <div className="border-border bg-card space-y-5 rounded-lg border p-4 lg:p-6">
        {/* ESPAÇO PARA RESPIRAR: o texto é curto de propósito (150 a 250
            palavras) e é a única coisa desta tela que se lê inteira. */}
        <div className="text-text-primary space-y-3 text-[0.95rem] leading-relaxed">
          {texto.split(/\n{2,}/).map((paragrafo, i) => (
            <p key={i}>{paragrafo}</p>
          ))}
        </div>

        {/* A LINHA HONESTA. Ela não é aviso legal nem letra miúda: sem ela, a
            pessoa leria um texto sobre si mesma sem saber que uma máquina o
            escreveu — e descobriria depois, que é o pior jeito de descobrir. */}
        <p className="text-text-muted border-border border-t pt-3 text-xs">
          Gerado automaticamente a partir dos seus dados no sistema
          {relatorio.revisor?.nome ? (
            <> e revisado por {relatorio.revisor.nome}</>
          ) : null}
          , em {format(parseISO(quando), "dd/MM/yyyy", { locale: ptBR })}.{" "}
          <Link
            href="/painel/feedback/sobre"
            className="text-accent-strong hover:underline"
          >
            Como isto funciona
          </Link>
        </p>

        <div className="border-border border-t pt-4">
          <h3 className="text-text-secondary mb-3 text-xs font-semibold tracking-wide uppercase">
            Os números que geraram este texto
          </h3>
          <PainelDeMetricas
            metricasBrutas={relatorio.metricas_json}
            contextoBrutos={relatorio.contexto_json}
          />
        </div>

        <div className="border-border border-t pt-4">
          <ResponderAoFeedback
            reportId={relatorio.id}
            respostas={respostas}
            comoPessoa
          />
        </div>

        {quantosAnteriores > 0 ? (
          <p className="text-text-muted text-xs">
            Você tem {quantosAnteriores} feedback(s) de períodos anteriores.{" "}
            <Link
              href="/painel/feedback/sobre#historico"
              className="text-accent-strong hover:underline"
            >
              Ver o histórico
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
