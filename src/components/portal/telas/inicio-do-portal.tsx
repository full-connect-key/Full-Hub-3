import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, PartyPopper } from "lucide-react";

import { CartaoDeItem } from "@/components/portal/cartao-de-item";
import { cn } from "@/lib/utils";
import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { StatusBadge } from "@/components/shared/status-badge";
import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { CapaDoCartao } from "@/components/shared/capa-do-cartao";
import { identidadeDoPortal } from "@/lib/dados/clientes";
import { IdentidadeDoCliente } from "@/components/portal/identidade-do-cliente";
import { SocialQueChegou } from "@/components/portal/social-que-chegou";
import {
  campanhasDoCliente,
  entregaveisDaCampanha,
} from "@/lib/dados/campanhas";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import { mesesDeSocialDoCliente } from "@/lib/dados/posts";
import { meusPedidos } from "@/lib/dados/solicitacoes";
import {
  atividadeRecente,
  itensDoPortal,
  prazosDoPortal,
  registrarAcesso,
} from "@/lib/dados/portal";
import {
  emArvore,
  esperandoOCliente,
  folhas,
  periodoCurto,
  progresso,
} from "@/lib/dominio/campanhas";
import { ordenarPorUrgencia, progressoDoMaterial } from "@/lib/dominio/portal";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";

/**
 * A tela inicial do Portal, num bloco só.
 *
 * **Um bloco, duas entradas.** O portal da pessoa cliente (/portal) e a
 * visualização da equipe (/portal/{slug}) renderizam ESTE componente. Duas
 * cópias divergiriam na primeira mudança, e a visualização existe justamente
 * para mostrar o que o cliente vê — uma aproximação não serve.
 *
 * O que muda entre as duas é o parâmetro, não o desenho:
 *
 *   `clienteId`  — null para o cliente (a RLS já fecha nas empresas dele),
 *                  obrigatório para a equipe, que enxerga todas.
 *   `comoEquipe` — desliga o registro de acesso e troca a frase do vazio.
 *   `base`       — o prefixo dos links, para "Ver tudo" não sair do portal
 *                  que está sendo visto.
 */
export async function InicioDoPortal({
  base,
  clienteId,
  comoEquipe,
  nome,
}: {
  base: string;
  clienteId: string | null;
  comoEquipe: boolean;
  /** Primeiro nome de quem está lendo. Vazio na visualização da equipe. */
  nome: string;
}) {
  const { hoje } = prazosDoPortal();
  const [itens, atividade, campanhas, identidade, mesesDeSocial, pedidos] =
    await Promise.all([
      itensDoPortal(clienteId ?? undefined),
      atividadeRecente(clienteId ?? undefined, comoEquipe),
      campanhasDoCliente(clienteId ?? undefined),
      identidadeDoPortal(clienteId ?? undefined),
      // UMA IDA A MAIS, no mesmo `Promise.all`: a contagem do que espera sai
      // do SQL (0100), então o bloco não custa uma consulta por mês nem uma
      // soma em TypeScript que divergiria da que a aba de Social mostra.
      mesesDeSocialDoCliente(clienteId ?? undefined),
      // OS PEDIDOS ENTRAM NO MESMO `Promise.all` porque um dos quatro números
      // do topo é sobre eles — e é o único que a lista desta tela não
      // responde de jeito nenhum: ela é sobre o que a Full ENVIOU, e o pedido
      // é o que o cliente PEDIU.
      meusPedidos(clienteId ?? undefined),
    ]);

  // TODAS AS ATIVAS, e não as três primeiras — decisão do usuário: "as
  // campanhas devem aparecer na página inicial do Portal do Cliente, para ele
  // ver todas as campanhas ativas, assim que entrar".
  //
  // O corte em três fazia sentido quando o bloco era um atalho para a
  // listagem. Mas "ativa" aqui quer dizer EM PRODUÇÃO — o trabalho que a Full
  // está fazendo para ele agora —, e esse conjunto é pequeno por natureza:
  // uma campanha sai dele sozinha no instante em que a última peça é
  // aprovada. Um corte num conjunto que já se limita sozinho só esconde.
  //
  // A ordem é o FIM e não o começo, como na listagem: a pergunta de quem abre
  // é "o que preciso decidir antes que acabe".
  // ATIVA **E EM PLANEJAMENTO**, e o `planejamento` estava faltando.
  //
  // A regra do produto é explícita, e está escrita no CLAUDE.md: a campanha o
  // cliente vê desde o planejamento — ela tem nome, período e progresso, e é
  // isso que responde "o que a Full está fazendo para mim este mês". É por
  // isso que `campaigns_select_cliente` não exige carimbo de envio nenhum, ao
  // contrário de `deliverables_select_cliente`.
  //
  // Este filtro dizia outra coisa. O default da coluna é `planejamento`
  // (0033), então uma campanha aberta por qualquer caminho que não passe pelo
  // formulário — o seed, um `insert` colado no SQL Editor, uma campanha
  // anterior ao conserto do formulário — existia, o cliente podia abri-la pela
  // listagem, e **o bloco da tela inicial a escondia**. Foi o que o usuário
  // encontrou: "não está aparecendo a área de campanhas na tela inicial".
  //
  // `finalizada` e `cancelada` continuam fora, e é o que o bloco quer dizer:
  // o trabalho que a Full está fazendo agora.
  const ativas = campanhas
    .filter((c) => c.status === "ativa" || c.status === "planejamento")
    .sort((a, b) => a.dataFim.localeCompare(b.dataFim));

  const comProgresso = await Promise.all(
    ativas.map(async (campanha) => {
      const itensDela = folhas(
        emArvore(await entregaveisDaCampanha(campanha.id)),
      );
      return {
        campanha,
        conta: progresso(itensDela),
        esperando: esperandoOCliente(itensDela),
      };
    }),
  );

  // O acesso fica registrado por empresa: quem responde por duas contas entrou
  // nas duas. A equipe NÃO registra aqui — a visita dela vira linha em
  // `client_portal_views`, no layout de /portal/{slug}, e a policy de
  // `client_access_log` recusaria a escrita de quem não é do cliente.
  if (!comoEquipe) {
    const empresas = await obterMinhasEmpresas();
    await Promise.all(
      empresas.map((empresa) => registrarAcesso(empresa.id, "login")),
    );
  }

  const pendentes = itens
    .filter((i) => i.status === "em_aprovacao")
    .sort(ordenarPorUrgencia);

  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  const aprovadosNoMes = itens.filter(
    (i) => i.status === "aprovado" && (i.enviadoEm ?? "") >= inicioDoMes,
  ).length;

  // ---------------------------------------------------------------------
  // OS QUATRO NÚMEROS DO TOPO.
  //
  // **Eles substituem a linha de texto que estava embaixo do título "Para a
  // sua aprovação", e não se somam a ela.** A regra que esta tela já aplicava
  // continua inteira: *quando a lista ao lado É o número, o número não vira
  // cartão* — o que ela proíbe é o mesmo número aparecer duas vezes, e não o
  // ladrilho existir. Três destes quatro a lista não responde (pedidos
  // abertos, o que está em produção, o que já saiu no mês), e o quarto —
  // "esperando você" — é o único que ela responde, e por isso ele é LINK para
  // ela em vez de um número solto.
  // ---------------------------------------------------------------------
  const mesPassado = (() => {
    const [ano, mes] = inicioDoMes.split("-").map(Number);
    const anterior = mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
    return { inicio: `${anterior}-01`, fim: inicioDoMes };
  })();
  const aprovadosNoMesPassado = itens.filter(
    (i) =>
      i.status === "aprovado" &&
      (i.enviadoEm ?? "") >= mesPassado.inicio &&
      (i.enviadoEm ?? "") < mesPassado.fim,
  ).length;

  // EM ANDAMENTO é tudo o que está com a Full — inclusive o que voltou para
  // ajuste e o que parou esperando informação. Do lado de cá da porta, os três
  // dizem a mesma coisa: a agência está trabalhando nisso.
  const emAndamento = itens.filter((i) =>
    ["em_producao", "aguardando_informacoes", "stand_by", "ajustes"].includes(
      i.status,
    ),
  );
  const atrasadas = emAndamento.filter(
    (i) => i.prazo !== null && i.prazo < hoje,
  ).length;

  // UM PEDIDO ABERTO É O QUE AINDA NÃO ACABOU, e "recusado" conta como
  // encerrado: ele não espera mais nada de ninguém.
  const pedidosAbertos = pedidos.filter(
    (p) => p.status !== "concluida" && p.status !== "recusada",
  ).length;
  const seteDiasAtras = format(
    new Date(parseISO(hoje).getTime() - 7 * 86400000),
    "yyyy-MM-dd",
  );
  const pedidosNovos = pedidos.filter(
    (p) => (p.created_at ?? "").slice(0, 10) >= seteDiasAtras,
  ).length;

  // ---------------------------------------------------------------------
  // PRÓXIMAS ENTREGAS é a lente do QUANDO, e ela olha tudo o que está aberto
  // — inclusive o que já está esperando a decisão do cliente, que também tem
  // data e também "vem aí".
  //
  // **E ELA SOME QUANDO NÃO ACRESCENTA NADA.** Numa conta com poucas peças, as
  // quatro primeiras por prazo são as mesmas que o cartão ao lado já lista uma
  // a uma — e aí a coluna é o mesmo cartão duas vezes, a dois centímetros de
  // distância. Foi a imagem do protótipo que mostrou: com um material só, os
  // dois blocos diziam exatamente a mesma linha.
  // ---------------------------------------------------------------------
  const emAndamentoNaTela = emAndamento.slice(0, 5);
  const chaveDo = (i: (typeof itens)[number]) => `${i.tipo}-${i.conteudoId}`;
  const jaNaTela = new Set(emAndamentoNaTela.map(chaveDo));

  const proximas = itens
    .filter(
      (i) =>
        i.prazo !== null && i.status !== "aprovado" && i.status !== "rejeitado",
    )
    .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""))
    .slice(0, 4);
  const proximasAcrescentam = proximas.some((i) => !jaNaTela.has(chaveDo(i)));

  return (
    <div className="space-y-10">
      {/* A IDENTIDADE ABRE A TELA, e só esta (0063): a capa tem altura para
          ser uma imagem de verdade aqui, e nas outras telas a empresa aparece
          na foto pequena do cabeçalho. Sem empresa — que é o caso da equipe
          antes de escolher um portal — não se desenha nada. */}
      {identidade ? (
        <IdentidadeDoCliente
          nome={identidade.nome}
          capaAssinada={identidade.capaAssinada}
          fotoAssinada={identidade.fotoAssinada}
          saudacao={
            comoEquipe
              ? undefined
              : `Olá, ${nome} — aqui está o que a Full preparou para você.`
          }
        />
      ) : null}

      {/* --------------------------------------- o mês de social que chegou --
          ELE ABRE A TELA, depois da identidade: decisão do usuário — *"se eles
          receberam um mês de social, preciso que isso apareça na página
          inicial do portal do cliente, com um botão para direcionar para a aba
          de social, para ele realizar a aprovação"*.

          ACIMA DE "Para a sua aprovação" e não abaixo, e a razão é o que cada
          um responde: a lista de baixo é peça por peça, cortada em cinco, e
          sozinha ela mostra cinco linhas soltas sem dizer de onde vêm; a faixa
          diz que um MÊS chegou, que é a unidade que a empresa contratou. Lida
          depois da lista ela explicaria o que a pessoa já tentou entender.

          E ELA SOME quando não há mês esperando — o bloco de exceção da Home
          visto de outro ângulo. */}
      <SocialQueChegou
        base={base}
        comoEquipe={comoEquipe}
        meses={mesesDeSocial}
      />

      {/* ------------------------------------------------- os quatro números --

          A razão de eles existirem — e de não repetirem a lista — está na
          conta logo acima, onde eles são calculados.

          **O de "Esperando você" é LINK e os outros três não**: ele é o único
          cujo detalhe está nesta mesma tela, logo abaixo. Os outros respondem
          sobre coisas que moram noutra seção, e um número que leva a lugar
          nenhum é melhor que um que promete uma tela e abre outra. */}
      <section
        aria-label="Os números da sua conta"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <CartaoDeNumero
          rotulo="Solicitações abertas"
          valor={pedidosAbertos}
          apoio={
            pedidosNovos > 0
              ? `${pedidosNovos} ${pedidosNovos === 1 ? "nova" : "novas"} esta semana`
              : "nenhuma nova esta semana"
          }
          href={`${base}/solicitacoes`}
        />
        <CartaoDeNumero
          rotulo="Em andamento"
          valor={emAndamento.length}
          // O TOM SEGUE O ATRASO, e só ele. Um ladrilho âmbar permanente num
          // mês sem atraso é o alerta que ensina a ignorar alerta.
          // O TOM NÃO MUDA COM O ATRASO, e isso é a regra do portal: o
          // âmbar é de "Esperando você", que é o único que PEDE uma ação de
          // quem está olhando. Dois ladrilhos âmbar na mesma fileira tiram do
          // primeiro o que ele tem de dizer, e vermelho num portal que se
          // abre uma vez por semana treina o hábito de ignorar vermelho. O
          // atraso é dito na linha de apoio, por extenso.
          apoio={
            atrasadas > 0
              ? `${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"}`
              : "no prazo"
          }
        />
        <CartaoDeNumero
          rotulo={comoEquipe ? "Esperando o cliente" : "Esperando você"}
          valor={pendentes.length}
          tom={pendentes.length > 0 ? "atencao" : "neutro"}
          apoio={
            pendentes.length > 0 ? "aguardando decisão" : "nada pendente"
          }
          href="#precisa-decidir"
        />
        <CartaoDeNumero
          rotulo="Aprovados no mês"
          valor={aprovadosNoMes}
          apoio={
            // A VARIAÇÃO SÓ APARECE COM COM QUE COMPARAR. No primeiro mês de
            // portal de uma conta, "+3 em relação ao mês anterior" seria uma
            // comparação com um mês que não existe.
            aprovadosNoMesPassado === 0
              ? undefined
              : `${aprovadosNoMes - aprovadosNoMesPassado >= 0 ? "+" : ""}${
                  aprovadosNoMes - aprovadosNoMesPassado
                } em relação ao mês passado`
          }
        />
      </section>

      {/* ------------------------------- em andamento, e o que vem logo aí --

          **SEM O AVATAR DE QUEM ESTÁ FAZENDO, e isso não é esquecimento.** A
          proposta pede o rosto do responsável em cada linha, e o produto não
          tem como mostrá-lo: `profiles_select` é "o próprio registro, ou a
          gestão", então o cliente lê o uuid de quem produz e mais nada — o
          nome não é legível para ele por desenho. Pôr o rosto ali exigiria
          abrir a tabela de perfis da agência inteira para fora, que é decisão
          de outra ordem. O que a linha diz é o que o cliente decide: o que é,
          de que demanda veio, e quanto falta. */}
      {emAndamento.length > 0 ? (
        // `items-start` PARA CADA CARTÃO TER A ALTURA DO QUE ELE TEM DENTRO.
        // Sem ele a grade estica os dois até o mais alto, e numa conta com um
        // material em produção e três com prazo o da esquerda fica com metade
        // da altura vazia.
        <section className="grid items-start gap-4 lg:grid-cols-3">
          <div
            className={cn(
              "bg-surface-card rounded-card shadow-cartao border-border border p-5",
              proximas.length > 0 && proximasAcrescentam
                ? "lg:col-span-2"
                : "lg:col-span-3",
            )}
          >
            <h2 className="text-base font-semibold">Em andamento</h2>
            <p className="text-text-muted mt-0.5 text-sm">
              O que a Full está produzindo para você agora.
            </p>

            <ul className="mt-4 space-y-4">
              {emAndamentoNaTela.map((item) => (
                <li key={`${item.tipo}-${item.conteudoId}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.titulo}
                    </p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-text-muted mt-0.5 truncate text-xs">
                    {item.demanda}
                  </p>
                  <BarraDeProgresso
                    className="mt-2"
                    valor={progressoDoMaterial(item.status)}
                    total={100}
                    rotulo={`${progressoDoMaterial(item.status)}%`}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* PRÓXIMAS ENTREGAS com o bloco de data — dia grande e mês —, que é
              o que faz a coluna responder "quando" antes de "o quê". Ela some
              inteira quando nenhuma das que estão com a Full tem prazo: uma
              coluna vazia ao lado de um cartão cheio parece defeito. */}
          {proximas.length > 0 && proximasAcrescentam ? (
            <div className="bg-surface-card rounded-card shadow-cartao border-border border p-5">
              <h2 className="text-base font-semibold">Próximas entregas</h2>
              <p className="text-text-muted mt-0.5 text-sm">
                Pelo prazo mais próximo.
              </p>

              <ul className="mt-4 space-y-3">
                {proximas.map((item) => (
                  <li
                    key={`p-${item.tipo}-${item.conteudoId}`}
                    className="flex items-center gap-3"
                  >
                    <div className="bg-neutral-soft text-text-primary flex size-11 shrink-0 flex-col items-center justify-center rounded-lg leading-none">
                      <span className="text-base font-bold tabular-nums">
                        {format(parseISO(item.prazo as string), "dd")}
                      </span>
                      <span className="text-text-muted mt-0.5 text-[10px] font-semibold uppercase">
                        {format(parseISO(item.prazo as string), "MMM", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.titulo}
                      </p>
                      <p className="text-text-muted truncate text-xs">
                        {item.demanda}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------------------ os números viram UMA LINHA --
          ELES ERAM TRÊS LADRILHOS, o primeiro com o número em tamanho de
          manchete — e o maior deles dizia "Esperando você: 3" com a lista
          desses mesmos três logo abaixo. É o cartão de "11 entregues" com
          sete na lista, que o Resumo da Agência já pagou uma vez e que o
          Início do painel desfez: quando a lista ao lado É o número, o número
          não vira cartão.

          Os outros dois ficam porque a lista NÃO os responde — "em produção"
          é o que ainda não chegou, "aprovados no mês" é o que já saiu daqui.
          Eles viram texto, e o primeiro vira o link que leva à própria lista,
          como o "ver quais" da Gestão de Tasks. */}
      {/* A ÂNCORA DO TOUR DO PORTAL (0101) vai na SEÇÃO e não no título: o
          passo diz "tudo o que a Full enviou e ainda não teve resposta aparece
          aqui", e o recorte dele é o bloco inteiro — contagem, lista e o "ver
          tudo". Com a âncora no `<h2>`, o destaque seria uma linha de texto
          com a lista inteira fora dele. */}
      <section
        id="precisa-decidir"
        className="scroll-mt-20 space-y-6"
        {...ancora(ANCORAS.portalPendencias)}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="text-xl font-bold tracking-[-0.02em]">
            {comoEquipe
              ? "Para a aprovação do cliente"
              : "Para a sua aprovação"}
          </h2>
          {itens.length > 0 ? (
            <Link
              href={`${base}/itens`}
              className="text-accent-strong inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Ver tudo
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : null}
        </div>

        {/* A LINHA DE CONTAGEM SAIU DAQUI, e subiu para os quatro
            ladrilhos do topo. Os três números que ela dizia são os mesmos:
            deixá-la seria exatamente o que a regra desta tela proíbe — o
            mesmo número duas vezes, a dois centímetros de distância. */}

        {pendentes.length === 0 ? (
          // ZERO PENDÊNCIA É BOA NOTÍCIA, e a tela diz isso. Um vazio genérico
          // ("nenhum resultado") deixa a pessoa em dúvida se ela procurou
          // errado ou se está tudo bem.
          <div className="bg-success-soft rounded-card shadow-cartao flex items-start gap-3 border border-transparent p-6">
            <PartyPopper
              aria-hidden
              className="text-success mt-0.5 size-5 shrink-0"
            />
            <div>
              <p className="font-medium">
                {comoEquipe ? "Tudo em dia por aqui." : `Tudo em dia, ${nome}.`}
              </p>
              <p className="text-text-muted mt-1 text-sm">
                {comoEquipe
                  ? "Nenhum material aguardando a decisão deste cliente."
                  : "Nada aguardando a sua aprovação. Quando a Full enviar algo novo, ele aparece aqui."}
              </p>
            </div>
          </div>
        ) : (
          /* CARTÃO SOLTO, com 9px entre eles — a decisão da lista de Minhas
             Tasks: num contêiner com fios o que se lê primeiro é a CAIXA, e
             aqui cada linha é uma decisão separada, sobre uma peça diferente. */
          <div className="space-y-[9px]">
            {pendentes.slice(0, 5).map((item, indice) => (
              <CartaoDeItem
                key={item.conteudoId}
                item={item}
                hoje={hoje}
                href={item.caminho ? `${base}${item.caminho}` : undefined}
                /* O PASSO INTERATIVO DO TOUR aponta para UM cartão, e é o
                   primeiro: marcar os cinco poria cinco elementos com o mesmo
                   `data-tour` na página, e o provedor escolhe o primeiro
                   visível de qualquer forma. */
                ancora={indice === 0 ? ANCORAS.portalMaterial : undefined}
              />
            ))}
            {pendentes.length > 5 ? (
              <Link
                href={`${base}/itens?status=em_aprovacao`}
                className="text-accent-strong block py-2 text-center text-sm hover:underline"
              >
                Ver os outros {pendentes.length - 5}
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {/* CAMPANHAS ATIVAS, ANTES DA ATIVIDADE RECENTE — decisão do usuário:
          ele precisa ver as campanhas em produção "assim que entrar". Embaixo
          do histórico elas ficavam atrás de uma rolagem, e quem abre o portal
          uma vez por semana não rola até o fim.

          A ordem da tela é a da pergunta: o que espera a decisão DELE, o que
          a Full está produzindo, e só então o que já aconteceu.

          O bloco só existe quando há campanha ativa: um quadro vazio dizendo
          "nenhuma campanha" ocupa a altura de um bloco para não informar
          nada, e o cliente que não tem campanha nunca precisa saber que o
          módulo existe. */}
      {comProgresso.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              {/* O NOME CONTINUA "ativas", e não "em produção": é o mesmo
                  nome da aba da listagem. Duas palavras para o mesmo conjunto
                  é como se aprende a ler errado as duas — o produto já pagou
                  esse preço uma vez, com dois nomes para o mesmo módulo. */}
              <h2 className="text-xl font-bold tracking-[-0.02em]">
                Campanhas ativas
              </h2>
            </div>
            <Link
              href={`${base}/campanhas`}
              className="text-accent-strong inline-flex shrink-0 items-center gap-1 text-sm hover:underline"
            >
              Ver finalizadas
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comProgresso.map(({ campanha, conta, esperando }) => (
              <li key={campanha.id}>
                <Link
                  href={`${base}/campanhas/${campanha.id}`}
                  className="bg-surface-card rounded-card shadow-cartao hover:border-accent-strong block space-y-2 border p-4 transition-colors"
                >
                  {/* A CAPA AQUI TAMBÉM (0050), e no mesmo componente do
                      cartão da listagem: é a mesma campanha em duas telas, e
                      duas proporções fariam a pessoa achar que são outras. */}
                  <CapaDoCartao
                    url={campanha.capaAssinada}
                    alt={campanha.nome}
                    semCapa="fundo"
                  />

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 font-medium">{campanha.nome}</p>
                    {esperando > 0 ? (
                      <span className="bg-warning-soft text-warning rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                        {esperando} para decidir
                      </span>
                    ) : null}
                  </div>

                  <p className="text-text-muted text-sm tabular-nums">
                    {periodoCurto(campanha.dataInicio, campanha.dataFim)}
                  </p>

                  {conta.total > 0 ? (
                    <BarraDeProgresso
                      nome="Materiais aprovados"
                      valor={conta.aprovados}
                      total={conta.total}
                      tom={
                        conta.aprovados === conta.total ? "sucesso" : "marca"
                      }
                      rotulo={`${conta.aprovados} de ${conta.total} aprovados`}
                    />
                  ) : (
                    // SEM "0 de 0", que parece conta errada. A campanha existe
                    // e ainda não teve material enviado — é a mesma frase do
                    // cartão da listagem, e sem ela o cartão terminava no
                    // período, parecendo cortado.
                    <p className="text-text-muted text-sm">
                      Os materiais desta campanha ainda estão em produção.
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {atividade.length > 0 ? (
        <section className="space-y-4">
          {/* AQUI O CONTÊINER FICA, e é a outra metade da regra dos cartões
              soltos. A lista de aprovação é uma decisão por linha; esta é um
              LOG — ninguém age sobre uma linha dela, só lê a sequência. Solta,
              cada registro pediria a atenção que a peça para aprovar merece. */}
          <h2 className="text-xl font-bold tracking-[-0.02em]">
            Atividade recente
          </h2>
          <ul className="bg-surface-card rounded-card shadow-cartao divide-y border">
            {atividade.map((linha) => (
              <li
                key={linha.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4"
              >
                <span className="text-sm font-medium">{linha.acao}</span>
                <span className="text-text-muted min-w-0 flex-1 truncate text-sm">
                  {linha.sobre}
                </span>
                <span className="text-text-muted text-xs tabular-nums">
                  {format(parseISO(linha.quando), "dd/MM", { locale: ptBR })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {pendentes.length} materiais aguardando aprovação.
      </p>
    </div>
  );
}
