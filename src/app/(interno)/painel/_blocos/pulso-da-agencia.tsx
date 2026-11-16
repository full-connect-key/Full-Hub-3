import Link from "next/link";
import { Gauge } from "lucide-react";

import type {
  AlertaDeCarga,
} from "@/lib/dominio/feedback";
import {
  EXPLICACAO_DO_ALERTA,
  ROTULOS_DE_ALERTA_DE_CARGA,
} from "@/lib/dominio/feedback";
import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import type { ResumoDaHome } from "@/lib/dados/home";

/**
 * O panorama da agência, só para a gestão — e o primeiro cartão é de quem olha.
 *
 * ---------------------------------------------------------------------------
 * CINCO NÚMEROS, E QUATRO SÃO DA AGÊNCIA
 *
 * O primeiro deixou de ser (0141), por decisão do usuário: *"somente etapas
 * do usuário logado, somente as previstas para o dia atual"*. Ele contava as
 * etapas abertas da agência inteira em qualquer data, e 38 etapas de todo
 * mundo em todas as datas não pedem ação de ninguém.
 *
 * ***E ISSO DEIXA A FILEIRA MISTA, o que é dito em vez de escondido:*** um
 * cartão pessoal ao lado de quatro da agência. A alternativa era um sexto
 * cartão, e aí a fileira teria o número da agência que ninguém usava mais; ou
 * pôr o pessoal noutro lugar da tela, e aí ele não estaria onde ele foi
 * pedido. O que mantém a leitura honesta é o RÓTULO de cada um: "Minhas
 * etapas de hoje" não se confunde com "Atrasadas".
 *
 * ---------------------------------------------------------------------------
 * E TODOS CONTAM SÓ AS FOLHAS
 *
 * A agrupadora fica de fora pela razão de sempre: quem tem filha para de ser
 * unidade de trabalho, e contá-la faria a agência parecer ter mais trabalho
 * aberto do que tem. Quem aplica o filtro é `home_summary()`, num lugar só —
 * este bloco desenha o que recebe.
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
  minhasDeHoje,
  alertasDeCarga = [],
}: {
  dados: ResumoDaHome["pulso"];
  /**
   * AS ETAPAS DE HOJE DE QUEM ESTÁ OLHANDO — decisão do usuário: *"somente
   * etapas do usuário logado, somente as previstas para o dia atual, sem
   * etapas de outras pessoas nem de datas futuras. O clique abre a relação
   * dessas etapas."*
   *
   * **O número já era calculado e ninguém o desenhava.** `home_summary()`
   * devolve `meu_dia.hoje` desde a 0049, com exatamente este recorte — só as
   * minhas, só `prazo = hoje`, só folha, rascunho fora. A tela lia dali
   * apenas `semana`, para a frase do "e mais N"; `hoje` e `atrasadas`
   * atravessavam a consulta e morriam. É a ponte construída e nunca
   * atravessada, e é por isso que esta entrega não tem migration.
   *
   * ***E ISTO CUSTA O NÚMERO DA AGÊNCIA, que é dito em vez de escondido:***
   * o cartão contava as etapas abertas da agência inteira, em qualquer data.
   * Aquele número deixa de aparecer aqui — ele continua respondido pelo board
   * de Gestão de Tasks e pelo "o que ficou para trás" do Resumo da Agência.
   * O que se ganha é um cartão que decide alguma coisa para quem o lê: 38
   * etapas de todo mundo em todas as datas não pedem ação de ninguém.
   */
  minhasDeHoje: number;
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
        {/* "FULL PULSE", e não mais "Pulso da agência" — decisão do usuário,
            entre sete nomes que ele mesmo listou: *"minha sugestão principal
            é Full Pulse, pela consistência com os nomes do ecossistema
            Full"*.

            **O ARQUIVO E O COMPONENTE CONTINUAM `pulso-da-agencia`**, e é a
            decisão de `dias_uteis` e de `saldo_de_ferias()` depois da 0016,
            e de `pedirAnaliseDoEntregavel` depois da 0092: renomear o que
            está em uso é mexer em muito lugar sem nada em troca, e ninguém
            que usa o sistema vê esses nomes.

            **E "Pulso" NÃO entra na lista de nomes mortos do `check:cores`**,
            pela razão que "Descanso" já escreveu: ela não foi aposentada —
            continua sendo o nome do arquivo, do componente e de meia dúzia de
            comentários que EXPLICAM decisões. Pô-la lá reprovaria o
            vocabulário do próprio projeto, que é a armadilha que aquela lista
            já pagou sete vezes. Quem protege a troca é o `check:sprint9`, que
            lê o texto renderizado e mede as duas metades. */}
        Full Pulse
        <Link
          href="/painel/gestao-tasks"
          className="text-accent-strong ml-auto text-xs font-normal normal-case tracking-normal hover:underline"
        >
          ver as demandas
        </Link>
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {/* O RÓTULO TROCOU JUNTO COM A CONTA, e não podia não trocar:
            "Etapas abertas" contando só as de hoje seria o cartão mentindo
            sobre o próprio número — quem lesse 2 ali concluiria que a agência
            tem duas etapas em aberto.

            E O CLIQUE VAI PARA A LISTA, não para o board. "O clique abre a
            relação dessas etapas" é a segunda metade do pedido, e o board de
            Gestão de Tasks lista DEMANDAS: era a mesma troca de unidade que o
            cartão de "Atrasadas" já documenta logo abaixo. `?foco=hoje` é o
            filtro que Minhas Tasks já tem na URL, então o número e a lista
            saem da mesma pergunta — nenhuma conta nova. */}
        <CartaoDeNumero
          rotulo="Minhas etapas de hoje"
          valor={minhasDeHoje}
          apoio="previstas para hoje"
          href="/painel/minhas-tasks?foco=hoje"
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
              {/* O LINK EM LINHA PRÓPRIA, pela razão do `link-in-text-block`:
                  dentro do parágrafo a cor seria a única coisa a distingui-lo.
                  Este não foi acusado porque a imagem do Pulso é da gestão e a
                  do feedback é do colaborador — e "não foi acusado" não é
                  argumento para repetir o erro ao lado. */}
              <p className="text-text-secondary mt-0.5 text-xs">
                {EXPLICACAO_DO_ALERTA[a.tipo] ?? ""}
              </p>
              <Link
                href="/painel/feedback"
                className="text-accent-strong mt-1 inline-block text-xs hover:underline"
              >
                Ver em Feedback
              </Link>
            </li>
          ))}
          {alertasDeCarga.length > 4 ? (
            <li className="text-text-muted text-xs">
              <Link
                href="/painel/feedback"
                className="text-accent-strong hover:underline"
              >
                e mais {alertasDeCarga.length - 4} sinal(is) em Feedback
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
