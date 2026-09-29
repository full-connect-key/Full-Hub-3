import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import {
  alertasDeCarga,
  configDoFeedback,
  filaDoPeriodo,
  relatorioComConversa,
} from "@/lib/dados/feedback";
import { hojeNaAgencia } from "@/lib/dominio/datas";
import { periodoFechadoAnterior } from "@/lib/dominio/feedback";
import { temChaveDaAnthropic } from "@/lib/feedback/gerar";

import { AlertasDeCarga } from "./alertas-de-carga";
import { FilaDoFeedback } from "./fila";
import { RevisaoDoFeedback } from "./revisao";
import { lerPeriodicidade, lerPeriodo } from "./vocabulario";

export const metadata: Metadata = { title: "Feedback" };

/**
 * A TELA DE QUEM GERA, REVISA E ENVIA (Sprint 3H).
 *
 * ---------------------------------------------------------------------------
 * **ISTO NÃO É AVALIAÇÃO DE DESEMPENHO**, e a frase aparece na tela e não só no
 * cabeçalho da migration: quem abre esta página está escrevendo sobre o
 * trabalho de outra pessoa, e é aqui que a regra precisa ser lida.
 *
 * Não é nota, não é ranking, não é insumo para decisão sobre promoção, aumento
 * ou desligamento. Se um dia for usado para isso, a regra muda inteira e passa
 * pelo jurídico antes — a LGPD dá à pessoa o direito de pedir revisão de
 * decisão automatizada que a afete (Art. 20).
 * ---------------------------------------------------------------------------
 *
 * **O PERÍODO PADRÃO É O ANTERIOR FECHADO, e nunca o corrente.** No dia 2,
 * "este mês" mede duas etapas e mostra um número que parece medição e é ruído —
 * a mesma decisão do padrão de 30 dias nas Métricas.
 *
 * **A periodicidade padrão vem da CONFIGURAÇÃO**, não de uma constante aqui: a
 * agência que combinou trimestral abre a tela no trimestre, sem precisar trocar
 * o seletor toda vez.
 *
 * `exigirAcessoARota` é a guarda de tela; a que vale é a RLS, e ela devolveria
 * lista vazia de qualquer forma. As duas existem porque uma lista vazia lida
 * por quem não pode ver diz "ninguém tem feedback" — uma afirmação falsa com
 * toda a confiança.
 */
export default async function Pagina({
  searchParams,
}: PageProps<"/painel/feedback">) {
  const sessao = await exigirAcessoARota("/painel/feedback");
  const parametros = await searchParams;

  const config = await configDoFeedback();

  const periodicidade = lerPeriodicidade(
    typeof parametros.periodicidade === "string"
      ? parametros.periodicidade
      : (config?.periodicidade ?? undefined),
  );

  // O "hoje" é o DA AGÊNCIA e não o do processo: num servidor em UTC, das 21h à
  // meia-noite o dia já virou e o período padrão sairia um mês adiante.
  const padrao = periodoFechadoAnterior(hojeNaAgencia(), periodicidade);
  const periodo = lerPeriodo(
    typeof parametros.periodo === "string" ? parametros.periodo : undefined,
    padrao,
    periodicidade,
  );

  const selecionado =
    typeof parametros.relatorio === "string" ? parametros.relatorio : null;

  const [{ fila, relatorios }, alertas, aberto] = await Promise.all([
    filaDoPeriodo(periodo.inicio, periodo.fim, periodicidade),
    alertasDeCarga(periodo.inicio),
    selecionado ? relatorioComConversa(selecionado) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Feedback de desenvolvimento"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/painel/feedback/sobre">Como funciona</Link>
            </Button>
            {ehSocio(sessao.profile.role) ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/painel/feedback/configuracoes">Configurações</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* A FRASE FICA NA TELA, e em `--neutral` e não em `--warning`: ela não é
          um alerta, é o enquadramento do módulo. Âmbar aqui competiria com os
          alertas de verdade, que são os da verificação do texto. */}
      <p className="bg-neutral-soft text-text-secondary rounded-lg p-3 text-sm">
        Isto não é avaliação de desempenho, nota nem ranking, e não entra em
        decisão sobre remuneração ou continuidade. É uma ferramenta para a pessoa
        enxergar padrões no próprio trabalho. A comparação é sempre com o período
        anterior dela — nunca com colegas.
      </p>

      <AlertasDeCarga alertas={alertas} />

      <div className="border-border bg-card rounded-lg border p-4 lg:p-6">
        <FilaDoFeedback
          fila={fila}
          relatorios={relatorios}
          periodo={periodo}
          periodicidade={periodicidade}
          minimo={config?.minimo_subtarefas ?? 5}
          temChave={temChaveDaAnthropic()}
          selecionado={selecionado}
        />
      </div>

      {aberto ? (
        <div className="border-border bg-card rounded-lg border p-4 lg:p-6">
          {/* `key` E NÃO EFEITO: trocar de relatório remonta o editor, senão o
              texto de um apareceria no lugar do outro até a próxima
              renderização. É a lição do editor de post no Sprint 14. */}
          <RevisaoDoFeedback
            key={aberto.relatorio.id}
            relatorio={aberto.relatorio}
            respostas={aberto.respostas}
            exigeRevisao={config?.exige_revisao ?? true}
          />
        </div>
      ) : null}
    </div>
  );
}
