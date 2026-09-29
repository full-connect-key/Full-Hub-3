import Link from "next/link";
import { Gauge } from "lucide-react";

import type { AlertaDeCarga } from "@/lib/dados/feedback";
import {
  EXPLICACAO_DO_ALERTA,
  ROTULOS_DE_ALERTA_DE_CARGA,
} from "@/lib/dominio/feedback";
import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import type { ResumoDaHome } from "@/lib/dados/home";

/**
 * O panorama da agência, só para a gestão.
 *
 * ---------------------------------------------------------------------------
 * CINCO NÚMEROS, E TODOS CONTAM SÓ AS FOLHAS
 *
 * A agrupadora fica de fora de "etapas abertas" e de "atrasadas" pela mesma
 * razão de sempre: quem tem filha para de ser unidade de trabalho, e contá-la
 * faria a agência parecer ter mais trabalho aberto do que tem. Quem aplica o
 * filtro é `home_summary()`, num lugar só — este bloco desenha o que recebe.
 *
 * **E rascunho não entra em nenhum deles.** Um rascunho é um pensamento pela
 * metade, e se ele contasse aqui o número mudaria quando alguém desistisse de
 * uma demanda que nunca existiu para a equipe.
 * ---------------------------------------------------------------------------
 *
 * **"Concluídas na semana" sai do histórico de status, e não de `updated_at`.**
 * Aquele carimbo muda com qualquer save, então corrigir o título de uma etapa
 * concluída em janeiro a traria para a conta de hoje. O histórico grava a
 * transição, que é o fato que a pergunta quer.
 *
 * **O bloco não some quando os números são zero**, ao contrário de "Precisa de
 * mim". Aqui zero é informação: zero atrasada é a resposta boa, e um bloco que
 * desaparece nos dias bons ensina que ele só aparece quando há problema — e aí
 * ninguém mais o lê nos outros dias.
 */
export function PulsoDaAgencia({
  dados,
  alertasDeCarga = [],
}: {
  dados: ResumoDaHome["pulso"];
  /**
   * OS SINAIS DE DISTRIBUIÇÃO DE TRABALHO (Sprint 3H), e eles vêm ANTES dos
   * cinco cartões — não como um sexto.
   *
   * Um cartão diria "3 alertas" e mandaria clicar; aqui cada linha nomeia a
   * pessoa e diz o que aconteceu, porque a resposta útil é essa. E é o único
   * bloco do Pulso que fala de GENTE em vez de trabalho: somado aos números de
   * etapa, ele viraria mais um contador da agência.
   *
   * A pessoa não vê nenhum destes sobre si mesma — `workload_alerts` é
   * `is_gestor()` no SELECT, e o que é dela chega pelo feedback, relativizado.
   */
  alertasDeCarga?: AlertaDeCarga[];
}) {
  if (!dados) return null;

  const atrasadas = dados.atrasadas ?? 0;

  return (
    <section className="space-y-3">
      <h2 className="text-text-primary flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
        <Gauge aria-hidden className="size-4" />
        Pulso da agência
        <Link
          href="/painel/gestao-tasks"
          className="text-accent-strong ml-auto text-xs font-normal normal-case tracking-normal hover:underline"
        >
          ver as demandas
        </Link>
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CartaoDeNumero
          rotulo="Etapas abertas"
          valor={dados.etapas_abertas ?? 0}
          apoio="em demandas publicadas"
          href="/painel/gestao-tasks"
        />
        {/* O CARTAO LEVA O FILTRO, e nao o board inteiro (decisao do
            usuario: "quero que ao clicar no botao de atrasadas, ele me mostre
            quais tasks estao atrasadas"). Um numero que abre a lista completa
            obriga a pessoa a procurar, na agencia inteira, as tres linhas que
            ele contou.

            E VALE DIZER O QUE MUDA DE UNIDADE NO CAMINHO: este numero conta
            ETAPAS vencidas (`home_summary`, 0049, so as folhas), e o board
            lista as DEMANDAS que as contem — uma demanda com duas etapas
            vencidas e uma linha la. Entao cinco aqui pode virar tres linhas
            adiante, e nenhuma das duas contas esta errada: o apoio deste
            cartao diz "etapa" justamente para a diferenca nao ser lida como
            defeito. Mandar para uma lista de etapas da agencia seria a outra
            saida, e ela existe — e o "ficou para tras" do Resumo da Agencia. */}
        <CartaoDeNumero
          rotulo="Atrasadas"
          valor={atrasadas}
          apoio={atrasadas === 0 ? "nenhuma passou do prazo" : "passaram do prazo da etapa"}
          tom={atrasadas > 0 ? "alerta" : "bom"}
          href={atrasadas > 0 ? "/painel/gestao-tasks?atrasadas=1" : "/painel/gestao-tasks"}
        />
        <CartaoDeNumero
          rotulo="Concluídas na semana"
          valor={dados.concluidas_semana ?? 0}
          apoio="nos últimos 7 dias"
        />
        <CartaoDeNumero
          rotulo="Posts com o cliente"
          valor={dados.posts_com_cliente ?? 0}
          apoio="enviados, esperando decisão"
          href="/painel/social-media"
        />
        <CartaoDeNumero
          rotulo="Campanhas ativas"
          valor={dados.campanhas_ativas ?? 0}
          apoio="em produção agora"
          href="/painel/aprovacoes"
        />
      </div>

      {alertasDeCarga.length > 0 ? (
        <ul className="space-y-2">
          {alertasDeCarga.slice(0, 4).map((a) => (
            <li
              key={a.id}
              className="bg-warning-soft border-warning rounded-lg border p-3"
            >
              <p className="text-warning text-sm font-semibold">
                {ROTULOS_DE_ALERTA_DE_CARGA[a.tipo] ?? a.tipo} ·{" "}
                {a.pessoa?.nome ?? "—"}
              </p>
              <p className="text-text-secondary mt-0.5 text-xs">
                {EXPLICACAO_DO_ALERTA[a.tipo] ?? ""}{" "}
                <Link
                  href="/painel/feedback"
                  className="text-accent-strong hover:underline"
                >
                  Ver em Feedback
                </Link>
              </p>
            </li>
          ))}
          {alertasDeCarga.length > 4 ? (
            <li className="text-text-muted text-xs">
              e mais {alertasDeCarga.length - 4} sinal(is) em{" "}
              <Link
                href="/painel/feedback"
                className="text-accent-strong hover:underline"
              >
                Feedback
              </Link>
              .
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
