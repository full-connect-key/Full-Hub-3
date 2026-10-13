import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MesDoPortal } from "@/lib/dados/posts";

/**
 * O MÊS DE SOCIAL QUE CHEGOU, na primeira dobra do portal.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário, a outra metade do pedido das notificações: *"no caso dos
 * clientes, se eles receberam um mês de social, preciso que isso apareça na
 * página inicial do portal do cliente, com um botão para direcionar para a aba
 * de social, para ele realizar a aprovação."*
 *
 * **O SINO NÃO BASTA, e é a razão de este bloco existir.** A 0098 faz o sino
 * tocar no instante em que a peça sai — e o sino se apaga no primeiro clique,
 * e depois disso o que ele avisou não existe em tela nenhuma. É a mesma razão
 * pela qual o pedido de nota fiscal ganhou faixa em `/painel/notas-fiscais`
 * (0066) em vez de só um aviso: a tela que a pessoa abre é que tem de dizer o
 * que está esperando por ela.
 *
 * **E ELE NÃO É O MESMO FATO QUE "Para a sua aprovação" logo abaixo.** Aquela
 * lista é PEÇA por peça, cortada em cinco; esta faixa é o MÊS como unidade,
 * que é o que a empresa contratou — dezoito peças de outubro são uma entrega,
 * e o cliente decide sobre elas numa sessão. Sem ela, um mês inteiro chega e a
 * tela mostra cinco linhas soltas sem dizer de onde elas vêm.
 * ---------------------------------------------------------------------------
 *
 * **NADA ESPERANDO NÃO DESENHA NADA**, e a ausência é a decisão: é o bloco de
 * exceção da Home visto de outro ângulo — uma faixa dizendo "nenhum mês
 * esperando você" todos os dias gasta a primeira dobra para informar em
 * alguns. É a mesma linha do `CabecalhoDoLote`.
 *
 * **E ELA É `--warning`, nunca `--danger`.** Material esperando decisão é o
 * estado normal de um mês de social, não um erro — a mesma regra do alerta de
 * 7 dias das campanhas. Vermelho num portal que a pessoa abre uma vez por
 * semana treina o hábito de ignorar vermelho.
 */
export function SocialQueChegou({
  base,
  comoEquipe,
  meses,
}: {
  base: string;
  /** Troca a frase: do lado de cá quem espera é o cliente, não quem lê. */
  comoEquipe: boolean;
  meses: MesDoPortal[];
}) {
  // SÓ OS QUE TÊM PEÇA ESPERANDO. A consulta devolve todos os meses com
  // material enviado — doze, num ano de contrato —, e o mês já decidido não
  // está esperando ninguém: ele mora na aba de Social, onde a pessoa vai
  // quando quer rever o que já aprovou.
  const esperando = meses.filter((m) => m.esperando > 0);
  if (esperando.length === 0) return null;

  return (
    <section aria-labelledby="social-que-chegou" className="space-y-[9px]">
      <h2 id="social-que-chegou" className="sr-only">
        {comoEquipe
          ? "Meses de social esperando o cliente"
          : "Meses de social esperando você"}
      </h2>

      {/* UM CARTÃO POR MÊS, e não um cartão com a lista dentro. É a decisão da
          lista de Minhas Tasks e da de materiais logo abaixo: cada mês é uma
          decisão separada, com um botão próprio — num contêiner único o que se
          lê primeiro é a CAIXA, e o botão passaria a ser um só para dois meses
          diferentes.

          E QUASE SEMPRE É UM, que é o que torna a escolha barata: dois meses
          esperando ao mesmo tempo é o mês que virou e o anterior que ficou
          para trás, e aí ver os dois separados é exatamente a informação. */}
      {esperando.map((mes) => (
        <div
          key={mes.mes}
          className="border-warning-soft bg-warning-soft rounded-card shadow-cartao flex flex-wrap items-center gap-x-4 gap-y-3 border p-4"
        >
          <CalendarCheck
            aria-hidden
            className="text-warning size-5 shrink-0 self-start"
          />

          <div className="min-w-[12rem] flex-1">
            <p className="text-text-primary font-semibold">
              {/* O MÊS POR EXTENSO E COM INICIAL MAIÚSCULA: `MMMM` do date-fns
                  devolve "outubro" em minúscula, porque é assim que o mês se
                  escreve no meio de uma frase em português. Aqui ele abre a
                  linha, e é a mesma função que a prévia da recorrência e o
                  cartão do índice de Social já usam pelo mesmo motivo. */}
              {comInicialMaiuscula(
                format(parseISO(`${mes.mes}-01`), "MMMM 'de' yyyy", {
                  locale: ptBR,
                }),
              )}{" "}
              chegou
            </p>
            {/* OS DOIS NÚMEROS NA MESMA LINHA, e o primeiro é o que cobra: "4
                de 18" diz se a sessão de aprovação é longa ou se falta pouco.
                O total vem do mês inteiro e não do que sobrou — é o contador
                das abas de Pedidos pela quarta vez. */}
            <p className="text-text-secondary text-sm tabular-nums">
              <span className="text-text-primary font-semibold">
                {mes.esperando}
              </span>{" "}
              {mes.esperando === 1 ? "peça" : "peças"}{" "}
              {comoEquipe ? "esperando o cliente" : "esperando você"} ·{" "}
              {mes.pecas} {mes.pecas === 1 ? "peça" : "peças"} no mês
            </p>
          </div>

          {/* O BOTÃO LEVA AO MÊS, e não à aba sem recorte: `?mes=` é o
              parâmetro que a aba de Social sempre leu, e sem ele a
              pessoa cairia no mês corrente — que em novembro não é o mês de
              social que ela acabou de receber. É a regra de o filtro morar na
              URL, aplicada ao destino de um botão. */}
          {/* O `Button` DO PRODUTO, e não uma classe escrita aqui: a pílula
              preta com o hover indo para o royal é o par nomeado medido pelo
              `check:cores` (19,43:1), e ele inverte sozinho no tema escuro
              porque `--acao-fundo` aponta para `--text-primary`. Um botão
              montado à mão aqui seria a cor que ninguém mediu. */}
          <Button asChild className="shrink-0">
            <Link href={`${base}/social-media?mes=${mes.mes}`}>
              {comoEquipe ? "Ver o social do mês" : "Aprovar o social do mês"}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
      ))}
    </section>
  );
}

/** `MMMM` devolve o mês em minúscula; aqui ele abre a frase. */
function comInicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
