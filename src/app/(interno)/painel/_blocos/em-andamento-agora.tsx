import Link from "next/link";

import { Cronometro } from "@/components/shared/cronometro";
import { Badge } from "@/components/ui/badge";
import type { EtapaEmAndamento } from "@/lib/dados/minhas-tasks";

/**
 * O RELÓGIO NA PRIMEIRA DOBRA.
 *
 * ---------------------------------------------------------------------------
 * **É a peça que a referência da interface "Leve" resolveu de graça.** O
 * cartão "reunião agora" dela é este: a coisa que está acontecendo neste
 * instante, no alto da tela, antes de qualquer lista. Aqui a coisa que está
 * acontecendo é o cronômetro de uma etapa — e ele é exatamente o número que
 * alguém esquece correndo a noite inteira.
 *
 * Até aqui o relógio vivia dentro do detalhe da etapa e nas linhas de Minhas
 * Tasks. Quem abre a Home de manhã e não passa por nenhuma das duas telas não
 * tinha como saber que deixou sexta-feira aberta — e descobria no diálogo de
 * conclusão, com um número grande que ela não sabe de onde veio. O comentário
 * de `cronometro.tsx` já dizia isso: *um cronômetro que a pessoa não vê é um
 * número que aparece pronto*. Este cartão é a outra metade da frase.
 * ---------------------------------------------------------------------------
 *
 * **Não aparece quando não há relógio andando**, como todo bloco de exceção
 * desta tela: uma caixa fixa dizendo "nada em andamento" ocuparia todo dia,
 * na primeira dobra de todo mundo, o lugar de uma informação que interessa em
 * alguns dias. E ele é opaco de propósito — a malha de cor do topo passa por
 * baixo desta faixa, e texto sobre ela só está medido para o que é grande.
 *
 * **Não há botão de parar, e a ausência é decisão.** O relógio não se para: ele
 * segue o status da etapa (0021), e para sozinho quando ela é enviada para
 * aprovação ou concluída. Um "Parar" aqui prometeria uma ação que o banco não
 * tem — e o caminho verdadeiro, que é mudar o andamento da etapa, é o link.
 *
 * **O tempo aqui é o MEDIDO, não o declarado.** Quem declara é a pessoa, no
 * diálogo de conclusão, e é por isso que este número nunca é gravado sozinho:
 * um relógio não sabe a diferença entre oito horas de trabalho e a noite em
 * que alguém esqueceu a etapa em andamento.
 *
 * **E NÃO HÁ BOTÃO DE AÇÃO, embora o produto tenha um componente pronto.**
 * `AcoesDaSubtarefa` decide o botão pela máquina de estados, e para isso ele
 * precisa da rodada, do aval e da dependência — que esta consulta pequena não
 * traz de propósito. Fabricar os campos para a etapa caber no molde faria o
 * cartão oferecer "Concluir" onde o banco recusa: **o molde errado mente com
 * mais convicção que a ausência.** O caminho é o link, para a tela onde os
 * botões são os de verdade.
 *
 * **O link vai para Minhas Tasks e não para a demanda**, e a razão é de
 * permissão: `/painel/gestao-tasks/{id}` é `GESTAO`, e quem mais esquece o
 * relógio aberto é justamente quem executa. Um link que devolve 403 para o
 * colaborador na primeira dobra da Home dele é pior que link nenhum.
 */
export function EmAndamentoAgora({
  etapa,
  agoraDoServidor,
}: {
  etapa: EtapaEmAndamento | null;
  agoraDoServidor: number;
}) {
  if (!etapa) return null;

  return (
    <section
      aria-labelledby="em-andamento-agora"
      className="bg-card rounded-card flex flex-wrap items-center gap-x-5 gap-y-3 border p-4"
    >
      <div className="min-w-48 flex-1">
        <h2
          id="em-andamento-agora"
          className="text-text-muted flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase"
        >
          {/*
            O ponto pulsa porque é a única coisa da tela que afirma "isto está
            acontecendo agora", e ele NÃO é o único sinal: o rótulo ao lado diz
            a mesma coisa por escrito, e o relógio anda. Com `prefers-reduced-
            motion` ele fica parado — quem pediu para nada se mexer continua
            lendo as outras duas.
          */}
          <span
            aria-hidden
            className="bg-accent-strong size-2 animate-pulse rounded-full motion-reduce:animate-none"
          />
          Em andamento agora
        </h2>

        <p className="text-text-primary mt-1.5 truncate text-base font-semibold">{etapa.titulo}</p>

        <p className="text-text-secondary mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="truncate">{etapa.tituloDaMae}</span>
          {etapa.cliente ? (
            <Badge variant="outline" className="max-w-40 truncate">
              {etapa.cliente}
            </Badge>
          ) : null}
        </p>
      </div>

      <div className="flex flex-col items-start gap-1 sm:items-end">
        <Cronometro
          destaque
          dados={{
            tempo_medido_segundos: etapa.tempoMedidoSegundos,
            andando_desde: etapa.andandoDesde,
          }}
          agoraDoServidor={agoraDoServidor}
        />

        {/* DUAS LINHAS, e não uma com um "·" no meio: o link ficaria dentro
            de uma frase, e ali a cor é a única coisa que o separa do texto em
            volta. É o achado `link-in-text-block` que o axe já cobrou uma vez
            neste produto, na tela do pedido concluído — e a resposta foi a
            mesma, linha própria. */}
        {etapa.outras > 0 ? (
          <p className="text-text-secondary text-xs">
            {etapa.outras === 1
              ? "Mais uma etapa sua está correndo"
              : `Mais ${etapa.outras} etapas suas estão correndo`}
          </p>
        ) : null}

        <Link
          href="/painel/minhas-tasks"
          className="text-accent-strong text-xs hover:underline"
        >
          Ver em Minhas Tasks
        </Link>
      </div>
    </section>
  );
}
