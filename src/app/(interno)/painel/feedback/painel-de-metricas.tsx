import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  lerContexto,
  lerMetricas,
  variacao,
  type ContextoDoFeedback,
  type MetricasDoFeedback,
} from "@/lib/dominio/feedback";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { cn } from "@/lib/utils";

/**
 * OS NÚMEROS CRUS, sempre visíveis — nunca atrás de um botão.
 *
 * ---------------------------------------------------------------------------
 * É a segunda das três regras do módulo: **texto sem número é opinião de
 * máquina.** A pessoa precisa poder conferir se a IA leu certo, e quem revisa
 * precisa conferir se o texto bate com os números. As duas fazem a mesma coisa
 * com a mesma tela, e é por isso que este é UM componente e não dois — duas
 * telas parecidas divergiriam, e a divergência apareceria no lugar mais caro:
 * o que a gestão olha antes de enviar contra o que a pessoa vê depois.
 * ---------------------------------------------------------------------------
 *
 * **BARRAS E VARIAÇÕES SIMPLES, nada de gráfico elaborado.** O objetivo é
 * conferência, não painel: um gráfico de linhas aqui convidaria a comparar
 * períodos que não estão na tela, e o módulo compara com exatamente um.
 *
 * **NADA DE NOTA, CONCEITO, ESTRELA OU POSIÇÃO.** Não existe nenhum dos quatro
 * em lugar nenhum do módulo, e esta tela é onde a tentação seria maior — um
 * "83% no prazo" pede uma cor de semáforo ao lado. Ele não tem: a cor aqui
 * separa "este período" de "o anterior", e mais nada.
 */

function Linha({
  rotulo,
  valor,
  antes,
  sufixo,
  dica,
}: {
  rotulo: string;
  valor: number | null;
  antes?: number | null;
  sufixo?: string;
  dica?: string;
}) {
  const delta = antes === undefined ? null : variacao(valor, antes ?? null);

  return (
    <div className="border-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-text-primary text-sm">{rotulo}</p>
        {dica ? <p className="text-text-muted text-xs">{dica}</p> : null}
      </div>
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-text-primary text-base font-semibold tabular-nums">
          {/* NULO NÃO É ZERO, e a frase diz qual dos dois. Zero é uma afirmação
              sobre a conta; "não houve o que medir" é a verdade quando o
              denominador não existe. É a regra de `receita_por_hora` na 0035. */}
          {valor === null ? (
            <span className="text-text-muted text-sm font-normal">
              sem o que medir
            </span>
          ) : (
            <>
              {valor}
              {sufixo ?? ""}
            </>
          )}
        </span>
        {delta !== null && delta !== 0 ? (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              delta > 0 ? "text-success" : "text-warning",
            )}
          >
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta)}
            {sufixo ?? ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Barra({ proporcao }: { proporcao: number | null }) {
  if (proporcao === null) return null;
  const largura = Math.max(0, Math.min(100, proporcao));
  return (
    <div className="bg-neutral-soft h-1.5 w-full overflow-hidden rounded-full">
      <div
        className="bg-brand-blue h-full rounded-full"
        style={{ width: `${largura}%` }}
      />
    </div>
  );
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <h3 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
        {titulo}
      </h3>
      <div>{children}</div>
    </section>
  );
}

export function PainelDeMetricas({
  metricasBrutas,
  contextoBrutos,
}: {
  metricasBrutas: unknown;
  contextoBrutos: unknown;
}) {
  const m: MetricasDoFeedback | null = lerMetricas(metricasBrutas);
  const c: ContextoDoFeedback | null = lerContexto(contextoBrutos);

  if (!m) {
    return (
      <p className="text-text-muted text-sm">
        Os números deste período não ficaram gravados.
      </p>
    );
  }

  const entrega = m.entrega;
  const anterior = m.periodo_anterior;
  const cal = m.calibracao;
  const qual = m.qualidade;

  return (
    <div className="space-y-5">
      {m.periodo ? (
        <p className="text-text-secondary text-sm">
          De{" "}
          {format(parseISO(m.periodo.inicio), "dd 'de' MMMM", { locale: ptBR })} a{" "}
          {format(parseISO(m.periodo.fim), "dd 'de' MMMM 'de' yyyy", {
            locale: ptBR,
          })}
          {anterior?.inicio ? (
            <>
              {" "}
              · comparado com{" "}
              {format(parseISO(anterior.inicio), "dd/MM", { locale: ptBR })} a{" "}
              {format(parseISO(anterior.fim), "dd/MM", { locale: ptBR })}
            </>
          ) : null}
        </p>
      ) : null}

      <Bloco titulo="Entrega">
        <Linha
          rotulo="Etapas concluídas"
          valor={entrega?.concluidas ?? 0}
          antes={anterior?.concluidas ?? null}
        />
        <Linha
          rotulo="Dentro do prazo"
          valor={entrega?.taxa_no_prazo ?? null}
          antes={anterior?.taxa_no_prazo ?? null}
          sufixo="%"
          dica={
            /* O DENOMINADOR APARECE, e é o que impede a leitura errada: 100%
               sobre duas etapas e 100% sobre trinta são o mesmo número e não
               são o mesmo fato. */
            entrega?.com_prazo
              ? `${entrega.no_prazo} de ${entrega.com_prazo} etapas com prazo combinado`
              : "nenhuma etapa do período tinha prazo combinado"
          }
        />
        {entrega?.sem_prazo ? (
          <Linha
            rotulo="Concluídas sem prazo combinado"
            valor={entrega.sem_prazo}
            dica="ficam fora da taxa acima: não estavam no prazo nem fora dele"
          />
        ) : null}
        {entrega?.dias_de_atraso_media !== null &&
        entrega?.dias_de_atraso_media !== undefined ? (
          <Linha
            rotulo="Atraso médio de quem saiu fora"
            valor={entrega.dias_de_atraso_media}
            sufixo=" dias"
          />
        ) : null}
      </Bloco>

      <Bloco titulo="Calibração da estimativa">
        <Linha
          rotulo="Desvio sobre o que foi estimado"
          valor={cal?.desvio_percentual ?? null}
          sufixo="%"
          dica={
            cal?.etapas_medidas
              ? `${cal.etapas_medidas} etapa(s) com estimativa e tempo medido · estimado ${formatarMinutos(
                  cal.minutos_estimados,
                )}, real ${formatarMinutos(cal.minutos_reais)}`
              : "nenhuma etapa do período tinha os dois números"
          }
        />
        {cal?.tendencia ? (
          <p className="text-text-secondary pt-1 text-sm">
            A tendência do período é{" "}
            <strong className="text-text-primary font-semibold">
              {cal.tendencia === "subestima"
                ? "estimar para baixo"
                : cal.tendencia === "superestima"
                  ? "estimar para cima"
                  : "equilibrada"}
            </strong>
            .
          </p>
        ) : null}
      </Bloco>

      <Bloco titulo="Retorno do cliente">
        <Linha
          rotulo="Aprovado na primeira rodada"
          valor={qual?.taxa_de_prima ?? null}
          sufixo="%"
          dica={
            qual?.conteudos_decididos
              ? `${qual.aprovados_de_prima} de ${qual.conteudos_decididos} peça(s) decidida(s) no período`
              : "nenhuma peça sua foi decidida no período"
          }
        />
        <Linha
          rotulo="Rodadas até o aceite, em média"
          valor={qual?.rodadas_media ?? null}
        />
      </Bloco>

      {c ? (
        <Bloco titulo="O que explica o volume">
          <Linha
            rotulo="Dias fora no período"
            valor={c.ausencia?.dias_fora ?? 0}
            dica={
              c.ausencia?.dias_uteis_no_periodo
                ? `de ${c.ausencia.dias_uteis_no_periodo} dias úteis`
                : undefined
            }
          />
          <div className="border-border space-y-2 border-b py-2">
            <Linha
              rotulo="Carga atribuída, contra a capacidade"
              valor={c.carga?.proporcao_da_capacidade ?? null}
              sufixo="%"
              dica={
                /* A CONTA SE DECLARA INCERTA em vez de devolver um número
                   baixo: num período em que ninguém estimou, a proporção cai
                   sozinha e diria que a pessoa recebeu pouco trabalho. */
                c.carga?.proporcao_da_capacidade === null
                  ? `${c.carga?.etapas_sem_estimativa ?? 0} de ${c.carga?.etapas_datadas ?? 0} etapas datadas estavam sem estimativa — não dá para afirmar a carga`
                  : `${formatarMinutos(c.carga?.minutos_comprometidos ?? 0)} em ${c.carga?.dias_uteis ?? 0} dias úteis`
              }
            />
            <Barra proporcao={c.carga?.proporcao_da_capacidade ?? null} />
          </div>
          <Linha
            rotulo="Horas esperando o aval interno"
            valor={c.espera_por_aprovacao?.horas_interna ?? 0}
            dica="este tempo não é atraso de quem produziu"
          />
          <Linha
            rotulo="Horas esperando o cliente"
            valor={c.espera_por_aprovacao?.horas_cliente ?? 0}
            dica="este tempo também não"
          />
        </Bloco>
      ) : null}

      {m.por_cliente?.length ? (
        <Bloco titulo="Por cliente">
          <ul className="flex flex-wrap gap-2 pt-1">
            {m.por_cliente.map((x) => (
              <li
                key={x.nome}
                className="bg-neutral-soft text-text-secondary rounded-full px-2.5 py-1 text-xs"
              >
                {x.nome} · <span className="tabular-nums">{x.concluidas}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      ) : null}

      {m.por_workflow?.length ? (
        <Bloco titulo="Por workflow">
          <ul className="flex flex-wrap gap-2 pt-1">
            {m.por_workflow.map((x) => (
              <li
                key={x.nome}
                className="bg-neutral-soft text-text-secondary rounded-full px-2.5 py-1 text-xs"
              >
                {x.nome} · <span className="tabular-nums">{x.concluidas}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      ) : null}

      {m.palavras_nos_pedidos_de_ajuste?.length ? (
        <Bloco titulo="O que mais apareceu nos pedidos de ajuste">
          <ul className="flex flex-wrap gap-2 pt-1">
            {m.palavras_nos_pedidos_de_ajuste.map((x) => (
              <li
                key={x.palavra}
                className="bg-warning-soft text-warning rounded-full px-2.5 py-1 text-xs"
              >
                {x.palavra} · <span className="tabular-nums">{x.vezes}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      ) : null}

      {m.desenvolvimento?.trilhas?.length ||
      m.desenvolvimento?.workflows_novos?.length ? (
        <Bloco titulo="O que você estudou e o que pegou de novo">
          <ul className="text-text-secondary space-y-1 pt-1 text-sm">
            {m.desenvolvimento.trilhas?.map((t) => (
              <li key={t.titulo}>
                {t.titulo} ·{" "}
                <span className="tabular-nums">{t.materiais_concluidos}</span>{" "}
                material(is) concluído(s)
              </li>
            ))}
            {m.desenvolvimento.workflows_novos?.length ? (
              <li>
                Primeira vez em: {m.desenvolvimento.workflows_novos.join(", ")}
              </li>
            ) : null}
          </ul>
        </Bloco>
      ) : null}
    </div>
  );
}
