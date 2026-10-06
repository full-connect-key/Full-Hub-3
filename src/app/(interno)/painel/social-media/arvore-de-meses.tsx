"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, CalendarRange, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { GrupoDobravel } from "@/components/shared/grupo-dobravel";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { porContaEAno } from "@/lib/dominio/posts";
import type { MesDeSocial, SituacaoDoMes } from "@/lib/dados/social-media";
import { cn } from "@/lib/utils";

/**
 * CONTA → ANO → MÊS: quais meses de social existem, e em que pé estão.
 *
 * ---------------------------------------------------------------------------
 * **O MÓDULO TINHA UMA PORTA SÓ, e ela era um recorte de UM mês.** `?mes=` e
 * `?cliente=` existem desde o Sprint 14, e nada na tela dizia quais meses
 * existem: quem queria o social de outubro da Mundo Verde trocava os dois à
 * mão, e as cento e vinte combinações de dez contas por doze meses eram
 * alcançáveis só digitando a URL.
 *
 * **ELA É UMA SEÇÃO E NÃO A COLUNA ÍNDICE DA LISTA**, e a escolha é de espaço
 * antes de ser de desenho: aquela coluna de 320px já agrupa por CONTA desde o
 * Sprint 3J, e dois agrupamentos por conta na mesma tela — um de posts e um de
 * meses — seriam dois cabeçalhos "Mundo Verde" a quarenta pixels de distância.
 * E a coluna não existe na visão de calendário, então metade do módulo ficaria
 * sem navegação.
 *
 * **E ELA É DE `EQUIPE`, não da gestão**, ao contrário de Fluxos: desenhar a
 * corrente que toda conta percorre é configuração do produto, e achar o mês em
 * que se trabalha é o trabalho do dia. Esconder isto de quem produz é esconder
 * o trabalho dele, que é o argumento que trouxe o módulo inteiro para `EQUIPE`
 * na 0042.
 * ---------------------------------------------------------------------------
 */

/**
 * AS QUATRO SITUAÇÕES, e "Todos" é a última e não a primeira.
 *
 * É o contrário das abas de Pedidos do portal, onde "Todos" abre a lista: lá a
 * pergunta é "o que eu mandei?", e uma conta cujos três pedidos estão em
 * produção cairia numa tela vazia. Aqui a pergunta é "onde eu trabalho hoje", e
 * a resposta é o mês em produção — abrir em "Todos" poria dois anos de meses
 * arquivados no caminho do mês da semana que vem.
 */
const SITUACOES: { chave: SituacaoDoMes; rotulo: string }[] = [
  { chave: "producao", rotulo: "Em produção" },
  { chave: "concluidos", rotulo: "Concluídos" },
  { chave: "arquivados", rotulo: "Arquivados" },
  { chave: "todos", rotulo: "Todos" },
];

export function ArvoreDeMeses({
  meses,
  situacao,
}: {
  meses: MesDeSocial[];
  situacao: SituacaoDoMes;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const contas = porContaEAno(meses);

  function trocarSituacao(nova: SituacaoDoMes) {
    const proximos = new URLSearchParams(parametros.toString());
    if (nova === "producao") proximos.delete("situacao");
    else proximos.set("situacao", nova);
    // AS DOBRAS CAEM JUNTO, e é de propósito: as contas que aparecem em
    // "Arquivados" não são as mesmas de "Em produção", e uma lista de chaves
    // fechadas do recorte anterior esconderia uma conta que a pessoa acabou de
    // pedir para ver — sem nada na tela dizendo por quê.
    proximos.delete("contas");
    proximos.delete("anos");
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  return (
    /* A ÁRVORE TEM LARGURA MÁXIMA, e foi a imagem que mostrou por quê: em
       1440px o cartão de um mês ia de ponta a ponta para carregar três
       palavras, e o olho atravessava um deserto entre "Novembro" e o selo. Uma
       navegação não precisa da largura de uma tabela — ela precisa de linhas
       que se leiam de relance, e é a mesma razão pela qual a coluna da
       legenda do post é fixa em 340px e não `1fr`. */
    <div className="max-w-3xl space-y-4">
      {/* O FILTRO É BOTÃO E NÃO LINK, como o seletor de visão: com `<Link>`
          cada troca viraria uma entrada no histórico, e quem voltasse de um mês
          percorreria os quatro recortes antes de sair da tela. */}
      <nav aria-label="Situação dos meses">
        <ul className="bg-muted inline-flex flex-wrap gap-1 rounded-xl p-1">
          {SITUACOES.map((s) => (
            <li key={s.chave}>
              <Button
                variant={situacao === s.chave ? "default" : "ghost"}
                size="sm"
                aria-pressed={situacao === s.chave}
                onClick={() => trocarSituacao(s.chave)}
              >
                {s.rotulo}
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      {contas.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhum mês neste recorte"
          description={
            situacao === "producao"
              ? "Todo mês de social desta agência já foi concluído ou arquivado. Abra o próximo em Posts."
              : "Troque o recorte acima, ou abra o mês em Posts."
          }
        />
      ) : (
        contas.map((conta) => (
          <GrupoDobravel
            key={conta.clienteId}
            chave={conta.clienteId}
            titulo={conta.cliente}
            contagem={conta.meses}
            parametro="contas"
            extra={
              /* "N ESPERANDO" É O SEGUNDO FATO DO CABEÇALHO, e é ele que faz a
                 dobra ser segura: a conta fechada continua dizendo que tem peça
                 com o cliente, que é a única coisa desta tela que cobra uma
                 ação. **No zero ele não aparece** — "0 esperando" em nove das
                 dez contas é a mesma linha com um número a mais, e a ausência é
                 a resposta, como no selo da fila de aprovações. */
              conta.esperandoCliente > 0 ? (
                <span className="text-warning">
                  {" · "}
                  {conta.esperandoCliente} esperando
                </span>
              ) : null
            }
          >
            <div className="space-y-3 pl-6">
              {conta.anos.map((ano) => (
                <GrupoDobravel
                  key={`${conta.clienteId}-${ano.ano}`}
                  chave={`${conta.clienteId}-${ano.ano}`}
                  titulo={ano.ano}
                  contagem={ano.meses.length}
                  parametro="anos"
                >
                  <ul className="space-y-1.5 pl-6">
                    {ano.meses.map((m) => (
                      <li key={m.taskId}>
                        {/* O MÊS É LINK e leva ao CALENDÁRIO, não à lista: quem
                            escolheu uma conta e um mês está perguntando "o que
                            vai ao ar quando", e a lista é a fila de três meses
                            de quem está procurando trabalho. E ele leva os dois
                            parâmetros juntos, porque um sem o outro é metade do
                            recorte que a pessoa acabou de pedir. */}
                        <Link
                          href={`/painel/social-media?visao=calendario&mes=${m.mes.slice(0, 7)}&cliente=${conta.clienteId}`}
                          className="bg-surface-card shadow-cartao hover:bg-muted flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border px-3 py-2 transition-colors"
                        >
                          <span className="text-text-primary text-sm font-medium">
                            {comInicialMaiuscula(
                              format(parseISO(m.mes), "MMMM", { locale: ptBR }),
                            )}
                          </span>

                          {/* O ANDAMENTO É "x de y", e não uma barra: a barra
                              precisa de largura e aqui cada linha tem a de uma
                              palavra — e "11 de 18" diz o número, que é o que
                              alguém repete numa conversa. */}
                          <span className="text-text-secondary text-xs tabular-nums">
                            {m.pecas === 0
                              ? "sem peça ainda"
                              : `${m.aprovadas} de ${m.pecas} aprovadas`}
                          </span>

                          {m.esperandoCliente > 0 ? (
                            <span className="bg-warning-soft text-warning rounded px-1.5 py-0.5 text-[11px] font-semibold">
                              {m.esperandoCliente} com o cliente
                            </span>
                          ) : null}

                          {/* OS DOIS SELOS DE ESTADO SÃO EXCLUDENTES na tela,
                              e o arquivado ganha: um mês arquivado está
                              concluído por definição (a rotina só alcança
                              `concluido`), e dois selos dizendo a mesma coisa
                              em palavras diferentes é a linha se desmentindo.
                              Em "Todos" eles são a única coisa que distingue
                              um mês do outro, e por isso não somem ali. */}
                          {m.arquivadaEm ? (
                            <span className="text-text-muted inline-flex items-center gap-1 text-[11px]">
                              <Archive aria-hidden className="size-3" />
                              Arquivado
                            </span>
                          ) : m.concluido ? (
                            <span className="text-success inline-flex items-center gap-1 text-[11px]">
                              <CheckCircle2 aria-hidden className="size-3" />
                              Concluído
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </GrupoDobravel>
              ))}
            </div>
          </GrupoDobravel>
        ))
      )}

      {/* A REGRA DO ARQUIVAMENTO FICA ESCRITA, e não só acontece. Um mês que
          sai da lista noventa dias depois de concluído, sem nada ter dito que
          ele sairia, lê como mês perdido — e a pessoa vai procurá-lo no board
          da agência. A frase não cita rotina nem agendamento: o vocabulário de
          desenvolvimento não vai para a tela. */}
      {situacao !== "arquivados" ? (
        <p className={cn("text-text-muted text-xs")}>
          Um mês concluído sai desta lista depois de 90 dias e passa a aparecer
          em Arquivados. Nada dele é apagado.
        </p>
      ) : null}
    </div>
  );
}

/**
 * `MMMM` do date-fns devolve "outubro" em minúscula, porque é assim que o mês
 * se escreve no meio de uma frase em português. Aqui ele é um TÍTULO de linha,
 * e título começa com maiúscula — é a mesma função que a prévia da recorrência
 * já usava pelo mesmo motivo.
 */
function comInicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
