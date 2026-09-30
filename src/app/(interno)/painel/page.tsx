import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { PageHeader } from "@/components/shared/page-header";
import { BotaoDeNovaTask } from "@/components/shared/botao-de-nova-task";
import { exigirAcessoARota, primeiroNome } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { saudacaoDaAgencia } from "@/lib/dominio/datas";
import { resumoDaHome } from "@/lib/dados/home";
import {
  etapaEmAndamento,
  meuDia,
  prazosDeHoje,
  souDoAtendimento,
} from "@/lib/dados/minhas-tasks";
import {
  meusPedidosDeNota,
  minhasNotasRecusadas,
  notasEsperandoOSocio,
} from "@/lib/dados/notas-fiscais";
import { meusComodatos } from "@/lib/dados/comodatos";
import {
  alertasAbertos,
  feedbackNovoParaMim,
  meusFeedbacks,
  relatorioComConversa,
} from "@/lib/dados/feedback";
import { listarPortaisDeClientes } from "@/lib/dados/portais-de-clientes";

import { MeuDia } from "./minhas-tasks/meu-dia";
import { AcessoRapido } from "./_blocos/acesso-rapido";
import { ClientesEmAtencao } from "./_blocos/clientes-em-atencao";
import { EmAndamentoAgora } from "./_blocos/em-andamento-agora";
import { MeuFeedback } from "./_blocos/meu-feedback";
import { MeusEquipamentos } from "./_blocos/meus-equipamentos";
import { PortaisDeClientes } from "./_blocos/portais-de-clientes";
import { PrecisaDeMim, linhasDoPrecisaDeMim } from "./_blocos/precisa-de-mim";
import { PulsoDaAgencia } from "./_blocos/pulso-da-agencia";
import { QuemEstaForaHoje } from "./_blocos/quem-esta-fora-hoje";
import { RascunhosAExpirar } from "./_blocos/rascunhos-a-expirar";

export const metadata: Metadata = { title: "Início" };

/**
 * A tela inicial do Painel Interno.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM É A DO DIA DA PESSOA, e ela não muda por perfil — o que muda é
 * quantos blocos existem.
 *
 * Quem sou eu → o que eu entrego hoje → o que está parado me esperando → quem
 * não está aqui → para onde eu vou. E só então, para a gestão, o panorama da
 * agência: quem abre esta tela abre para trabalhar, não para conferir número.
 * Pôr o painel de indicadores no topo faria a gestão rolar todo dia por cima
 * dele para achar as próprias entregas.
 *
 * **Os blocos de exceção somem quando não têm nada a dizer** — rascunho a
 * expirar, o que precisa de mim, quem está fora, cliente parado. Uma caixa
 * fixa dizendo "nada aqui" ocupa todo dia, na primeira tela de todo mundo, o
 * lugar de uma informação que interessa em alguns dias. O Pulso é a exceção da
 * exceção, e está explicado lá: zero atrasada é a resposta boa.
 * ---------------------------------------------------------------------------
 *
 * **SÃO DUAS IDAS AO BANCO PARA OS NÚMEROS, e não uma.** `home_summary()`
 * (0049) traz os sete blocos de contagem numa chamada só; `meuDia()` traz a
 * lista de etapas com o que cada botão pode fazer — máquina de estados,
 * cronômetro, dependência em aberto. Aquilo não cabe num contador, e a
 * alternativa era desenhar aqui uma segunda lista parecida com a de Minhas
 * Tasks. Duas listas parecidas divergem no pior lugar: o botão que muda o
 * status de uma etapa. É o MESMO componente, alimentado pela MESMA função.
 *
 * **E as duas vão em paralelo.** Em série seriam duas viagens de rede somadas
 * na primeira tela que todo mundo abre, todo dia.
 */
export default async function PaginaInicialDoPainel() {
  const { profile, usuarioId } = await exigirAcessoARota("/painel");
  const gestao = ehGestor(profile.role);

  const [
    resumo,
    itensDoDia,
    portais,
    recusadas,
    esperandoOSocio,
    pedidosDeNotaAbertos,
    meusEquipamentos,
    meusFeedbacks_lista,
    alertasDeCargaAbertos,
    correndoAgora,
    podeAbrirDemanda,
  ] = await Promise.all([
    resumoDaHome(),
    meuDia(usuarioId, prazosDeHoje()),
    // Só a gestão enxerga a seção. A rota /portal/{slug} recusa colaborador no
    // servidor de qualquer forma — não buscar aqui é economia, não é a trava.
    gestao ? listarPortaisDeClientes() : Promise.resolve([]),
    // AS NOTAS FISCAIS ENTRAM AQUI (0065), e as duas consultas são baratas: a
    // primeira é do próprio usuário, a segunda é uma contagem que volta zero
    // pelo RLS para quem não é sócio. Não vale um `if` de perfil antes —
    // seria repetir na tela a regra que a policy já aplica.
    minhasNotasRecusadas(),
    notasEsperandoOSocio(),
    // O PEDIDO EM ABERTO (0066): os meses em que o Financeiro cobrou a minha
    // nota e eu não mandei. Sem ele o pedido viveria só no sino, que vira lido
    // no primeiro clique — e o prazo é o mesmo dia.
    meusPedidosDeNota(),
    // O EQUIPAMENTO QUE ESTÁ COMIGO (0069). Ela passa por `meus_comodatos()`,
    // que é definer e devolve vazio para quem não é da equipe — nenhum `if` de
    // perfil aqui, pela mesma razão das notas acima.
    meusComodatos(),
    // O FEEDBACK QUE CHEGOU PARA MIM (Sprint 3H). A consulta não filtra por
    // status: `feedback_reports_select` devolve só os `enviado` desta pessoa, e
    // repetir o filtro aqui criaria o segundo lugar onde a regra pode divergir
    // — o que mostraria a alguém um rascunho sobre ela mesma.
    meusFeedbacks(),
    // OS SINAIS DE CARGA, para o Pulso. Volta lista vazia pelo RLS para quem
    // não é gestão, e não cai por conta própria: derrubar a tela inicial por
    // causa de um bloco entre nove seria caro por nada.
    gestao ? alertasAbertos() : Promise.resolve([]),
    // O RELÓGIO QUE ESTÁ CORRENDO (interface "Leve"). Ela NÃO sai de
    // `meuDia()`, e o porquê está em `etapaEmAndamento()`: o relógio esquecido
    // aberto quase nunca está numa etapa que vence hoje. E vai aqui dentro,
    // no mesmo `Promise.all`, em vez de num bloco que busca por conta
    // própria — um `await` dentro do componente serializaria três consultas
    // no caminho crítico da primeira dobra, que é justamente onde ele mora.
    etapaEmAndamento(usuarioId),
    // QUEM ABRE DEMANDA — a mesma pergunta que `tasks_insert` faz desde a
    // 0006, por RPC. A pílula de "Nova task" é a ação principal da coluna da
    // direita, e oferecê-la a quem o banco recusa seria um botão que existe
    // para dar erro.
    souDoAtendimento(),
  ]);

  // A CONVERSA DO FEEDBACK MAIS RECENTE, e só dele: os anteriores viram
  // histórico em `/painel/feedback/sobre#historico`. Uma segunda ida ao banco
  // por aqui é barata, e a alternativa era `meusFeedbacks()` trazer as respostas
  // de todos — que numa pessoa com um ano de feedbacks é uma leitura inteira
  // para desenhar uma thread.
  const meuMaisRecente = meusFeedbacks_lista[0] ?? null;
  const conversaDoMeuFeedback = meuMaisRecente
    ? await relatorioComConversa(meuMaisRecente.id)
    : null;

  // O NÚMERO DO SUBTÍTULO SAI DA MESMA LISTA QUE O BLOCO DESENHA, e não de uma
  // soma feita aqui: "5 coisas esperando você" leva até `#precisa-de-mim`, e
  // duas contas para o mesmo fato são o cartão de "11 entregues" com sete na
  // lista logo abaixo, que o Resumo da Agência já pagou uma vez.
  const esperandoPorMim = linhasDoPrecisaDeMim({
    dados: resumo.precisa_de_mim,
    notasRecusadas: recusadas.length,
    notasEsperandoOSocio: esperandoOSocio,
    notasPedidas: pedidosDeNotaAbertos.length,
  }).reduce((total, linha) => total + linha.quantos, 0);

  const prazos = prazosDeHoje();

  return (
    <div className="space-y-5">
      {/* A SAUDAÇÃO PERDEU O EMOJI E OS SELOS DE PERFIL, e a ausência é
          escolha: o cartão da pessoa no pé da barra lateral já diz o perfil de
          acesso e o cargo, na tela inteira e não só nesta. Repetir na primeira
          dobra gastaria a linha que o subtítulo usa para dizer o que mudou
          desde ontem.

          E o que está esperando vira LINK no subtítulo, nunca ladrilho de
          número: em Minhas Tasks os ladrilhos respondem "para hoje" e
          "atrasadas", que são duas perguntas que a lista ao lado não responde.
          Aqui o número seria "5 esperando você" — e a lista logo abaixo É esse
          cinco, item por item. */}
      <PageHeader
        title={`${saudacaoDaAgencia()},`}
        titleSecundario={primeiroNome(profile.nome)}
        subtitulo={
          <>
            <span className="inline-block first-letter:uppercase">
              {format(prazos.agora, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
            {esperandoPorMim > 0 ? (
              <>
                {" · "}
                <Link href="#precisa-de-mim" className="text-accent-strong hover:underline">
                  {esperandoPorMim === 1
                    ? "1 coisa esperando você"
                    : `${esperandoPorMim} coisas esperando você`}
                </Link>
              </>
            ) : null}
          </>
        }
      />

      {/* AS DUAS COLUNAS SÃO AS MESMAS DE MINHAS TASKS, e a largura fixa de
          306px tem o mesmo motivo: a direita carrega cartões cujo conteúdo
          define a altura, e em `1fr` eles encolheriam junto com a lista.
          Abaixo de 1150px vira uma coluna só, com a direita DEPOIS — no
          celular o que a pessoa veio ver é o que está parado esperando ela. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_306px]">
        <div className="min-w-0 space-y-6">
          {/* A FAIXA DE EXCEÇÃO FICA ACIMA DE TUDO, porque ela tem prazo — e
              some sozinha quando não há nada a dizer, como todo bloco de
              exceção desta tela. */}
          <RascunhosAExpirar />

          <PrecisaDeMim
            dados={resumo.precisa_de_mim}
            notasRecusadas={recusadas.length}
            notasEsperandoOSocio={esperandoOSocio}
            notasPedidas={pedidosDeNotaAbertos.length}
          />

          <MeuDia
            itens={itensDoDia}
            primeiroNome={primeiroNome(profile.nome)}
            usuarioId={usuarioId}
            souGestor={gestao}
            estaSemana={resumo.meu_dia?.semana ?? 0}
          />

          {/* O FEEDBACK VEM DEPOIS DO QUE PRECISA DE MIM E DO QUE EU ENTREGO
              HOJE: ele não é uma pendência — ninguém tem que fazer nada com
              ele hoje —, mas é sobre a pessoa, e o que é sobre a pessoa fica
              acima do que é sobre a agência. */}
          <MeuFeedback
            relatorio={conversaDoMeuFeedback?.relatorio ?? null}
            respostas={conversaDoMeuFeedback?.respostas ?? []}
            quantosAnteriores={Math.max(0, meusFeedbacks_lista.length - 1)}
          />

          {gestao ? (
            <>
              <PulsoDaAgencia
                dados={resumo.pulso}
                alertasDeCarga={alertasDeCargaAbertos}
              />
              <ClientesEmAtencao clientes={resumo.clientes_em_atencao} />
              <PortaisDeClientes clientes={portais} />
            </>
          ) : null}
        </div>

        <aside className="flex flex-col gap-2.5 lg:sticky lg:top-20">
          {podeAbrirDemanda ? (
            <BotaoDeNovaTask destaque className="w-full" />
          ) : null}

          {/* O CRONÔMETRO É O PRIMEIRO CARTÃO DA COLUNA, e é o mesmo
              componente e a mesma consulta de Minhas Tasks. Repetir o
              componente não é repetir a verdade: quem abre o Início de manhã
              sem passar pela outra tela vê o relógio esquecido aberto do mesmo
              jeito. Some quando não há nenhum andando. */}
          <EmAndamentoAgora etapa={correndoAgora} agoraDoServidor={prazos.agora} />

          <QuemEstaForaHoje pessoas={resumo.fora_hoje} />

          <MeusEquipamentos comodatos={meusEquipamentos} />

          <AcessoRapido />
        </aside>
      </div>
    </div>
  );
}
