import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, PartyPopper } from "lucide-react";

import { CartaoDeItem } from "@/components/portal/cartao-de-item";
import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { CapaDoCartao } from "@/components/shared/capa-do-cartao";
import { identidadeDoPortal } from "@/lib/dados/clientes";
import { IdentidadeDoCliente } from "@/components/portal/identidade-do-cliente";
import {
  campanhasDoCliente,
  entregaveisDaCampanha,
} from "@/lib/dados/campanhas";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
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
import { ordenarPorUrgencia } from "@/lib/dominio/portal";

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
  const [itens, atividade, campanhas, identidade] = await Promise.all([
    itensDoPortal(clienteId ?? undefined),
    atividadeRecente(clienteId ?? undefined, comoEquipe),
    campanhasDoCliente(clienteId ?? undefined),
    identidadeDoPortal(clienteId ?? undefined),
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
  const emProducao = itens.filter((i) => i.status === "em_producao").length;

  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  const aprovadosNoMes = itens.filter(
    (i) => i.status === "aprovado" && (i.enviadoEm ?? "") >= inicioDoMes,
  ).length;

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
      <section className="space-y-6">
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

        <p className="text-text-secondary text-sm">
          <span className="text-text-primary font-semibold tabular-nums">
            {pendentes.length}
          </span>{" "}
          {pendentes.length === 1
            ? "material esperando decisão"
            : "materiais esperando decisão"}
          <span aria-hidden> · </span>
          <span className="tabular-nums">{emProducao}</span> em produção
          <span aria-hidden> · </span>
          <span className="tabular-nums">{aprovadosNoMes}</span> aprovados no
          mês
        </p>

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
            {pendentes.slice(0, 5).map((item) => (
              <CartaoDeItem
                key={item.conteudoId}
                item={item}
                hoje={hoje}
                href={item.caminho ? `${base}${item.caminho}` : undefined}
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
