import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight } from "lucide-react";

import { StatusBadge, type Status } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { TaskCompleta } from "@/lib/dados/tasks";
import { hojeNaAgencia, horaNaAgencia } from "@/lib/dominio/datas";

/**
 * O histórico da demanda, agrupado por DIA e do mais recente para o mais
 * antigo.
 *
 * ---------------------------------------------------------------------------
 * **A FORMA É A DO FEED DE ATIVIDADE, por decisão do usuário** — *"deixe essa
 * parte de histórico mais parecido com o [feed de atividade da referência]"*,
 * com duas imagens ao lado. O que mudou é o que aquela referência faz e esta
 * tela não fazia:
 *
 *   - **o dia virou CABEÇALHO.** A coluna de data tinha 28 caracteres e
 *     repetia `12/11/26` em cada linha do mesmo dia; com o dia escrito uma
 *     vez, a linha fica com a HORA, que é o que distingue uma da outra;
 *   - **a pessoa vem primeiro, com o rosto.** A pergunta de quem abre o
 *     histórico é *quem mexeu nisto*, e o nome vinha por último, depois de um
 *     ponto do meio;
 *   - **o rótulo virou FRASE.** "Status da subtarefa" é um substantivo que não
 *     diz o que aconteceu; depois do nome, *"mudou o status da etapa"* é uma
 *     frase que se lê de uma vez;
 *   - **o valor virou PÍLULA**, com a cor do status.
 *
 * **NADA AQUI É APAGADO PARA "LIMPAR" O ESTADO ATUAL:** o valor do histórico é
 * justamente responder, meses depois, por que uma peça foi refeita três vezes.
 * ---------------------------------------------------------------------------
 */

/**
 * O que cada ação gravada no banco quer dizer, **em frase verbal**.
 *
 * ---------------------------------------------------------------------------
 * **DUAS DAS TREZE NÃO ESTAVAM AQUI, e são as que um GATILHO escreve.** O mapa
 * antigo tinha onze rótulos — exatamente as onze ações que as Server Actions
 * de `gestao-tasks/` gravam —, e o banco escreve mais duas por conta própria:
 * `status_da_etapa` (`registrar_status_da_subtarefa`, 0035) e
 * `gerada_por_recorrencia` (0040). As duas caíam no `?? evento.acao` e
 * apareciam com o NOME DA COLUNA na tela.
 *
 * E a primeira é **o evento mais comum do histórico inteiro**: toda vez que
 * alguém move uma etapa, o gatilho grava uma linha. Quem abria a aba
 * Histórico de uma demanda com dez etapas lia `status_da_etapa` dez vezes.
 *
 * **Ação sem rótulo continua aparecendo CRUA**, e é de propósito: é assim que
 * um evento novo é notado em vez de passar batido — foi exatamente assim que
 * estas duas foram encontradas.
 * ---------------------------------------------------------------------------
 */
const FRASES: Record<string, string> = {
  task_criada: "criou a demanda",
  subtarefa_criada: "criou uma etapa",
  responsavel_alterado: "trocou o responsável",
  status_da_task: "mudou o status da demanda",
  status_da_subtarefa: "mudou o status da etapa",
  // ESCRITA PELO GATILHO `subtasks_registra_status` (0035), e não por action
  // nenhuma: é por isso que ela faltava no mapa antigo.
  status_da_etapa: "mudou o status da etapa",
  enviada_para_aprovacao: "pediu o aval interno",
  aprovacao_interna: "aprovou internamente",
  ajustes_solicitados: "pediu ajustes",
  enviada_ao_cliente: "enviou ao cliente",
  cliente_aprovou: "aprovou",
  cliente_pediu_ajustes: "pediu ajustes",
  entrega_anexada: "anexou uma entrega",
  entrega_removida: "removeu uma entrega",
  // TAMBÉM DO BANCO (0040/0041/0113): a rotina da madrugada grava isto na
  // demanda que ela acabou de criar.
  gerada_por_recorrencia: "foi gerada por uma recorrência",
};

/**
 * As ações em que o VALOR é um status, e só elas.
 *
 * **Nas outras o `para_valor` é o valor de enum da rodada** — `aprovada`,
 * `ajustes_solicitados` —, e a própria frase já o diz: *"Joana aprovou —
 * aprovada"* escreve duas vezes a mesma coisa, uma delas na camada em inglês,
 * que é a que não vai para a tela.
 */
const MOSTRAM_O_VALOR = new Set([
  "status_da_task",
  "status_da_subtarefa",
  "status_da_etapa",
]);

/**
 * O dia escrito por extenso, com "Hoje" e "Ontem" quando valem.
 *
 * **`hojeNaAgencia()` e nunca `new Date()` aqui dentro**, que é a regra desta
 * casa: o container roda em UTC, e às 22h de São Paulo um `toISOString()`
 * poria "Ontem" em cima do que acabou de acontecer.
 */
function tituloDoDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";

  const [a, m, d] = hoje.split("-").map(Number);
  const ontem = new Date(Date.UTC(a ?? 0, (m ?? 1) - 1, (d ?? 1) - 1))
    .toISOString()
    .slice(0, 10);
  if (dia === ontem) return "Ontem";

  return format(parseISO(dia), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function HistoricoDaTask({
  eventos,
}: {
  eventos: TaskCompleta["historico"];
}) {
  if (eventos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nada registrado ainda. Cada movimento da demanda aparece aqui.
      </p>
    );
  }

  const hoje = hojeNaAgencia();

  // O AGRUPAMENTO É NA TELA e não numa segunda consulta: a lista já veio
  // ordenada do banco, e agrupar aqui é percorrê-la uma vez. Uma consulta por
  // dia seria uma ida ao banco para repartir o que já está em mãos.
  //
  // **E A CHAVE DO DIA É O CALENDÁRIO DA AGÊNCIA, nunca `created_at.slice(0,
  // 10)`**, que é a data em UTC: um evento das 22h de São Paulo já é o dia
  // seguinte lá, então ele cairia num grupo à FRENTE de "Hoje" — um cabeçalho
  // com a data de amanhã em cima do que acabou de acontecer.
  const dias: { dia: string; eventos: TaskCompleta["historico"] }[] = [];
  for (const evento of eventos) {
    const dia = hojeNaAgencia(parseISO(evento.created_at));
    const ultimo = dias.at(-1);
    if (ultimo?.dia === dia) ultimo.eventos.push(evento);
    else dias.push({ dia, eventos: [evento] });
  }

  return (
    <div className="space-y-5">
      {dias.map(({ dia, eventos: doDia }) => (
        <section key={dia} className="space-y-2">
          <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
            {tituloDoDia(dia, hoje)}
          </h3>

          <ol className="space-y-2.5">
            {doDia.map((evento) => {
              const quem = evento.autor?.nome ?? "O Full Hub";
              const mostraValor = MOSTRAM_O_VALOR.has(evento.acao);

              return (
                <li key={evento.id} className="flex items-start gap-2.5 text-sm">
                  {/* O ROSTO SÓ EXISTE QUANDO HÁ PESSOA: um círculo genérico
                      para o que um gatilho escreveu afirmaria que existe
                      alguém — a regra da pilha de avatares. O vão fica, para a
                      coluna do texto não andar de linha para linha. */}
                  {evento.autor ? (
                    <UserAvatar
                      name={evento.autor.nome}
                      src={evento.autor.avatar_url}
                      size="xs"
                      tooltip={false}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <span aria-hidden className="mt-0.5 size-5 shrink-0" />
                  )}

                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="font-medium">{quem}</span>
                    <span className="text-text-secondary">
                      {FRASES[evento.acao] ?? evento.acao}
                    </span>

                    {mostraValor && evento.de_valor ? (
                      <>
                        <StatusBadge status={evento.de_valor as Status} />
                        <ArrowRight
                          aria-hidden
                          className="text-text-muted size-3.5 shrink-0"
                        />
                      </>
                    ) : null}
                    {mostraValor && evento.para_valor ? (
                      <StatusBadge status={evento.para_valor as Status} />
                    ) : null}
                  </span>

                  {/* A HORA À DIREITA, porque o dia já está no cabeçalho —
                      e no relógio da AGÊNCIA, pela razão de `hojeNaAgencia()`:
                      `format(..., "HH:mm")` responde pelo fuso do processo, e
                      num container em UTC ele adianta três horas. */}
                  <span className="text-text-muted ms-auto shrink-0 tabular-nums">
                    {horaNaAgencia(parseISO(evento.created_at))}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
