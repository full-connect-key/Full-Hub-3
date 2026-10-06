import { MailOpen } from "lucide-react";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import type { LoteDoPortal } from "@/lib/dados/posts";

/**
 * O QUE A AGÊNCIA MANDOU, e quanto falta decidir.
 *
 * ---------------------------------------------------------------------------
 * **A UNIDADE DE ENVIO PASSOU A SER O MÊS** (migration 0090, decisão do
 * usuário), e esta faixa é o que diz isso ao cliente. Antes dela a gestão
 * clicava "Enviar ao cliente" peça por peça, e do lado de lá não havia nada
 * dizendo que as doze peças que apareceram são UM conjunto — nem quantas dele
 * ainda esperam resposta.
 *
 * **OS DOIS NÚMEROS SÃO DERIVADOS**, e o lote não guarda nenhum: "18 peças ·
 * 12 decididas" sai das `approval_rounds` que apontam para ele. É a regra que
 * o lote existe para respeitar — duas fontes de verdade para o mesmo fato é
 * exatamente o que a 0090 desfez.
 * ---------------------------------------------------------------------------
 *
 * **LOTE FECHADO NÃO DESENHA NADA**, e a ausência é a decisão: é o bloco de
 * exceção da Home visto de outro ângulo — uma faixa dizendo "nada esperando
 * você" todos os dias gasta a primeira dobra para informar em alguns.
 *
 * **E ELA É `--warning`, nunca `--danger`.** Material esperando decisão é o
 * estado normal de um mês de social, não um erro — a mesma regra do alerta de
 * 7 dias das campanhas e dos quatro sinais de carga do Feedback. Vermelho num
 * portal que a pessoa abre uma vez por semana treina o hábito de ignorar
 * vermelho.
 */
export function CabecalhoDoLote({ lote }: { lote: LoteDoPortal | null }) {
  if (!lote) return null;

  const pendentes = lote.pecas - lote.decididas;

  return (
    <section
      aria-labelledby="lote-aberto"
      className="border-warning-soft bg-warning-soft space-y-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <MailOpen
          className="text-warning size-4 shrink-0 self-center"
          aria-hidden
        />
        <h2 id="lote-aberto" className="text-text-primary font-semibold">
          {lote.portao} — aguardando a sua aprovação
        </h2>
        {/* A CONTAGEM NA MESMA LINHA DO TÍTULO, em `tabular-nums`: ela é a
            resposta de "quanto falta", e numa linha própria obrigaria o olho a
            descer para saber se o conjunto está quase fechado. */}
        <p className="text-text-secondary text-sm tabular-nums">
          {lote.pecas} {lote.pecas === 1 ? "peça" : "peças"} ·{" "}
          {lote.decididas} decidida{lote.decididas === 1 ? "" : "s"} ·{" "}
          {pendentes} pendente{pendentes === 1 ? "" : "s"}
        </p>
      </div>

      {/* O RECADO DA AGÊNCIA, quando houve um. É a única coisa do lote que o
          cliente lê que não é número — e é ela que faz o envio parecer uma
          pessoa mandando material em vez de um sistema despejando peças. */}
      {lote.recado ? (
        <p className="text-text-primary text-sm">{lote.recado}</p>
      ) : null}

      {/* A BARRA DO PRODUTO, e não uma nova: `BarraDeProgresso` é a mesma do
          cartão da campanha e do Início do portal. Duas barras com dois
          desenhos para a mesma pergunta — quanto deste conjunto já foi
          decidido — seriam descobertas pela pessoa na primeira tela em que as
          duas aparecessem juntas. O rótulo fica OCULTO porque a contagem já
          está na linha de cima: repeti-la ao lado da barra seriam dois números
          para o mesmo fato a um centímetro de distância. */}
      <BarraDeProgresso
        valor={lote.decididas}
        total={lote.pecas}
        rotulo={`${lote.decididas} de ${lote.pecas} decididas`}
        rotuloOculto
        nome={`Decisões em ${lote.portao}`}
      />
    </section>
  );
}
