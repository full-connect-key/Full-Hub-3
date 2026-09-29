import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import {
  configDoFeedback,
  meusFeedbacks,
  minhaEscolhaDeFeedback,
} from "@/lib/dados/feedback";
import {
  ROTULOS_DE_PERIODICIDADE,
  ROTULOS_DE_STATUS,
} from "@/lib/dominio/feedback";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { EscolhaDeFeedback } from "./escolha";

export const metadata: Metadata = { title: "Sobre o feedback" };

/**
 * A TRANSPARÊNCIA, E ELA VEM ANTES.
 *
 * ---------------------------------------------------------------------------
 * **Um módulo assim só funciona se as pessoas confiarem nele, e confiança se
 * ganha explicando antes, não depois.** Esta página diz quais dados são usados,
 * quem lê antes, para que serve, e que não vale como avaliação — e carrega o
 * interruptor de optar por não receber, alterável a qualquer momento.
 *
 * Ela é de TODA A EQUIPE e não da gestão, e é por isso que tem entrada própria
 * em `permissions.ts`: sem ela, `findMenuItem` casaria esta rota com
 * `/painel/feedback`, que é `GESTAO`, e `exigirAcessoARota` devolveria 403 a
 * quem o módulo existe para servir.
 * ---------------------------------------------------------------------------
 *
 * **E O HISTÓRICO MORA AQUI**, não numa terceira rota. A tela Início mostra o
 * feedback mais recente, que é o que a pessoa vai ler; os anteriores são
 * consulta, e consulta não ocupa a primeira tela de todo dia. O `#historico`
 * é o que o link da Home aponta.
 */
export default async function Pagina() {
  await exigirAcessoARota("/painel/feedback/sobre");

  const [config, escolha, meus] = await Promise.all([
    configDoFeedback(),
    minhaEscolhaDeFeedback(),
    meusFeedbacks(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Sobre o feedback de desenvolvimento" />

      {/* A PRIMEIRA COISA É O QUE ELE NÃO É, e não o que ele é. Quem abre esta
          página está com essa dúvida — "isto conta para o meu aumento?" —, e
          deixar a resposta para o quarto parágrafo é deixar a pessoa ler os três
          primeiros desconfiando. */}
      <section className="bg-blue-soft space-y-2 rounded-lg p-4">
        <h2 className="text-text-primary text-sm font-semibold">
          Isto não é avaliação de desempenho
        </h2>
        <p className="text-text-secondary text-sm">
          Não é nota, não é conceito, não é ranking, e não existe comparação com
          ninguém — nem com colegas, nem com média da equipe. Nada disto entra em
          decisão sobre remuneração, promoção ou continuidade.
        </p>
        <p className="text-text-secondary text-sm">
          A única comparação que o texto faz é com o seu próprio período
          anterior.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Para que serve
        </h2>
        <p className="text-text-secondary text-sm">
          Para você enxergar padrões no próprio trabalho que não enxergaria
          sozinha — como a diferença entre o que você estima e o que o trabalho
          leva, ou em que tipo de demanda a entrega sai mais redonda. É uma
          ferramenta de autoconhecimento, e o que você faz com ela é seu.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Quais dados são usados
        </h2>
        <ul className="text-text-secondary list-disc space-y-1 pl-5 text-sm">
          <li>as etapas que você concluiu no período, com prazo e cliente;</li>
          <li>
            a estimativa e o tempo real que você registrou nelas — o que você
            digitou ao concluir, não o que o cronômetro mediu;
          </li>
          <li>
            quantas rodadas de aprovação o material passou até o cliente aceitar;
          </li>
          <li>
            as trilhas do Full Academy que você tocou e os materiais que
            concluiu;
          </li>
          <li>
            os seus dias fora no período, a carga que foi atribuída a você contra
            a sua capacidade, e o tempo que as suas entregas ficaram esperando
            aprovação — estes quatro existem para o texto{" "}
            <strong className="text-text-primary">não</strong> cobrar de você o
            que não foi sua decisão.
          </li>
        </ul>
        {/* A LISTA DO QUE NÃO É USADO É TÃO IMPORTANTE QUANTO A DE CIMA. Sem
            ela, "dados do sistema" é uma frase que a pessoa preenche com o pior
            que ela imagina. */}
        <p className="text-text-secondary text-sm">
          <strong className="text-text-primary">O que não é usado:</strong>{" "}
          horário de login, tempo de tela, atividade minuto a minuto, o que você
          escreve em anotação da Academy, e nada do seu Full Days além de quantos
          dias você esteve fora. O Full Hub não mede nenhuma dessas coisas.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Quem escreve, e quem lê antes
        </h2>
        <p className="text-text-secondary text-sm">
          Os números são calculados pelo sistema. O texto é escrito por uma
          inteligência artificial, que recebe os números prontos e não faz conta
          nenhuma — e o Full Hub confere depois se todo número citado no texto
          existe mesmo nos dados.
        </p>
        <p className="text-text-secondary text-sm">
          {config?.exige_revisao
            ? `Antes de chegar a você, ${config.revisor?.nome ? `${config.revisor.nome} lê` : "alguém da gestão lê"} o texto e pode corrigi-lo. Você vê quem revisou, junto da data, embaixo do texto.`
            : "Neste momento a revisão humana está desligada na configuração, então o texto vai direto para você. Se isso não parecer certo, fale com um sócio."}
        </p>
        <p className="text-text-secondary text-sm">
          A periodicidade combinada é{" "}
          {ROTULOS_DE_PERIODICIDADE[config?.periodicidade ?? "mensal"].toLowerCase()}
          , e você só recebe quando o período tem pelo menos{" "}
          {config?.minimo_subtarefas ?? 5} etapas concluídas — feedback em cima de
          três tarefas seria invenção.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Você pode responder, e pode não receber
        </h2>
        <p className="text-text-secondary text-sm">
          Embaixo de cada feedback tem um campo aberto: discorde, acrescente
          contexto, peça uma conversa. Quem revisou é avisado, e a sua resposta
          fica no histórico — ela não se apaga nem se reescreve, nem por um
          sócio.
        </p>
        <EscolhaDeFeedback recebe={escolha.recebe} />
      </section>

      <section className="space-y-3" id="historico">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Os seus feedbacks
        </h2>
        {meus.length === 0 ? (
          <p className="text-text-muted text-sm">
            Você ainda não recebeu nenhum. O primeiro aparece na tela Início
            quando chegar.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {meus.map((r) => (
              <li key={r.id} className="py-2">
                <p className="text-text-primary text-sm">
                  {format(parseISO(r.periodo_inicio), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}{" "}
                  a{" "}
                  {format(parseISO(r.periodo_fim), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                  <span className="text-text-muted">
                    {" "}
                    · {ROTULOS_DE_STATUS[r.status]}
                    {r.revisor?.nome ? ` · revisado por ${r.revisor.nome}` : ""}
                  </span>
                </p>
                <p className="text-text-secondary mt-1 text-sm">
                  {r.texto_final ?? r.texto_gerado}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
