"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { ChevronRight, ListChecks, Lock, Link2 } from "lucide-react";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { Cronometro } from "@/components/shared/cronometro";
import { UserAvatarGroup } from "@/components/shared/user-avatar";
import { DateBadge } from "@/components/shared/date-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { GrupoDobravel } from "@/components/shared/grupo-dobravel";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusBadge, corDoPontoDeStatus } from "@/components/shared/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { situacaoDoPrazo } from "@/lib/dominio/tasks";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import { cn } from "@/lib/utils";

import type { Prazos } from "@/lib/dados/minhas-tasks";

import { ICONE_DA_AREA, STATUS_EM_ORDEM, type LinhaPessoal } from "./linhas";

/** O selo da peça usa o ÍCONE DA ÁREA, e não um desenho escolhido aqui: ele
 *  aponta para a campanha, que é a área cujo cabeçalho está duas linhas acima.
 *  Dois desenhos na mesma tela para a mesma coisa é o que este mapa saiu de
 *  três lugares para evitar. */
const IconeDaCampanha = ICONE_DA_AREA.campanhas;

/**
 * Lista de Minhas Tasks — uma linha por ETAPA minha.
 *
 * "Conteúdo" e "Layout" da mesma demanda são dois itens, porque são dois
 * trabalhos com dois prazos que eu faço em dois momentos. A demanda vira a
 * linhagem embaixo do título, e clicar abre o painel com ela inteira: é lá
 * que se vê que as duas são da mesma mãe e o que as outras pessoas estão
 * fazendo nela.
 *
 * O botão de cada etapa sai de `AcoesDaSubtarefa`, o mesmo componente do
 * detalhe da Task e da fila de aprovações. Por isso "Concluir" nunca aparece
 * numa etapa que exige aprovação, e "Enviar para o cliente" nunca aparece aqui
 * — esse botão é do Desenvolvedor, na fila dele.
 */
export function MinhaLista({
  linhas,
  prazos,
  usuarioId,
  souGestor,
  aoAbrir,
}: {
  linhas: LinhaPessoal[];
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  aoAbrir: (taskId: string) => void;
}) {
  if (linhas.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nada por aqui"
        description="Nenhuma etapa sua com este filtro. Troque o foco no cabeçalho para ver o resto."
      />
    );
  }

  // AS LINHAS SE SEPARAM POR STATUS DA ETAPA, na ordem em que ela anda.
  //
  // A ordem DENTRO de cada grupo continua sendo a global de `montarLinhas` —
  // o que vence amanhã no topo —, porque ela já veio ordenada: separar não
  // reordena. É o que faz a etapa atrasada aparecer no começo do grupo dela
  // em vez de no meio.
  //
  // `STATUS_EM_ORDEM` é a mesma lista do board, que fica no seletor de visão
  // ao lado, e o porquê está escrito lá em `linhas.ts`.
  const porStatus = STATUS_EM_ORDEM.map(({ status, titulo }) => ({
    status,
    titulo,
    // GRUPO VAZIO SOME, em vez de virar um cabeçalho com nada embaixo. É a
    // decisão da lista da Gestão de Tasks, e a mesma dos blocos de exceção da
    // Home: quem não tem etapa em ajustes não precisa ler todo dia que não
    // tem.
    itens: linhas.filter((l) => l.subtarefa.status === status),
  })).filter((g) => g.itens.length > 0);

  // COM UM GRUPO SÓ, O CABEÇALHO SOME. Uma seção única com um título em cima é
  // moldura sem função — a mesma razão pela qual as abas de Equipe sumiram
  // quando sobrou uma, e pela qual o agrupamento por área já fazia isto antes
  // deste. O agrupamento existe para separar; sem o que separar, ele é uma
  // linha a mais entre a pessoa e o trabalho dela.
  const agrupar = porStatus.length > 1;

  return (
    <div className="space-y-5">
      {porStatus.map((grupo) => {
        const conteudo = (
          <Linhas
            linhas={grupo.itens}
            prazos={prazos}
            usuarioId={usuarioId}
            souGestor={souGestor}
            aoAbrir={aoAbrir}
            // O SELO DE STATUS SOME DENTRO DO GRUPO, e é a mesma decisão do
            // selo da campanha: dentro da seção que já diz o nome, ele
            // repetiria o cabeçalho uma vez por linha sem informar nada. É
            // também o que o board faz — o card não carrega selo, porque a
            // coluna já disse.
            //
            // **E ele VOLTA quando não há cabeçalho**, que é o caso de quem
            // tem tudo no mesmo status: sem o selo e sem o título, o status
            // sumiria da tela inteira.
            mostrarStatus={!agrupar}
          />
        );

        // SEM CABEÇALHO NÃO HÁ O QUE DOBRAR. Com um grupo só a lista é a
        // tela inteira, e um botão que esconde tudo o que existe não é
        // organização, é um interruptor de luz.
        if (!agrupar) return <div key={grupo.status}>{conteudo}</div>;

        return (
          <GrupoDobravel
            key={grupo.status}
            // A CHAVE É O VALOR DO STATUS e não o rótulo: "Iniciar" muda de
            // palavra, `nao_iniciada` não — e é ela que fica no link.
            chave={grupo.status}
            titulo={grupo.titulo}
            contagem={grupo.itens.length}
            // O PONTO COLORIDO É O MESMO DO SELETOR DE STATUS e do selo de
            // cada linha, e não um segundo jeito de pintar a mesma coisa.
            // Sem ele o cabeçalho é a única parte da tela em que o status
            // aparece sem cor, e o olho não liga o grupo às linhas que estão
            // dentro dele.
            ponto={corDoPontoDeStatus(grupo.status)}
          >
            {conteudo}
          </GrupoDobravel>
        );
      })}
    </div>
  );
}

function Linhas({
  linhas,
  prazos,
  usuarioId,
  souGestor,
  aoAbrir,
  mostrarStatus,
}: {
  linhas: LinhaPessoal[];
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  aoAbrir: (taskId: string) => void;
  mostrarStatus: boolean;
}) {
  return (
    <div className="divide-y rounded-lg border">
      {linhas.map((linha) => {
        const sub = linha.subtarefa;
        const situacao = situacaoDoPrazo(
          sub.prazo,
          sub.status === "concluida",
          prazos.hoje,
          prazos.fimDaSemana,
        );

        return (
          <div
            key={linha.chave}
            className={cn(
              "flex flex-wrap items-center gap-2 p-3",
              // A LINHA ATRASADA PRECISA SER ACHADA, e `bg-destructive/5`
              // não achava ninguém: 5% de uma cor sobre o fundo do cartão é
              // um tom que não se distingue do branco. O contador dizia "1
              // atrasada" e a pessoa varria a lista sem encontrar qual —
              // que foi exatamente o relato.
              //
              // Par nomeado e não opacidade, que é a regra do produto desde
              // o selo de estado: opacidade sobre um fundo qualquer dá uma
              // cor que ninguém mediu, e no tema escuro dá outra. A borda
              // esquerda é o que sobrevive à varredura do olho numa lista
              // longa — o fundo sozinho se perde entre dois cartões.
              situacao === "atrasada" &&
                "bg-danger-soft border-danger border-l-4 pl-2",
            )}
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="hover:text-accent-strong block max-w-full truncate text-left text-sm font-medium"
                onClick={() => aoAbrir(linha.taskId)}
              >
                {sub.titulo}
              </button>

              {/* A LINHAGEM, e não uma linha de cabeçalho por demanda: ela
                  responde "por que estou fazendo isto?" sem gastar uma linha
                  inteira da lista, e clicar abre a demanda completa, onde se
                  vê as etapas das outras pessoas.

                  E A PILHA DE QUEM MAIS ESTÁ NELA vem logo depois, na mesma
                  linha, porque é a pergunta seguinte: a linhagem diz por que
                  estou fazendo isto, a pilha diz quem está com o resto — que é
                  o que explica a etapa parada esperando a arte de outra
                  pessoa. Ela é irmã do `<p>` e não filha dele: avatar é um
                  `<div>`, e `<div>` dentro de `<p>` faz o navegador fechar o
                  parágrafo antes da hora, partindo a linha em duas sem ninguém
                  pedir.

                  Não custa consulta nenhuma: `carregar()` já trazia as etapas
                  dos outros com a ficha de cada responsável desde o Sprint 4,
                  para o painel lateral. */}
              <div className="flex min-w-0 items-center gap-2">
                <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
                  {linha.demanda.cliente ? (
                    <>
                      <span className="truncate">{linha.demanda.cliente}</span>
                      <span aria-hidden>·</span>
                    </>
                  ) : null}
                  <span className="truncate">{linha.demanda.titulo}</span>
                  {sub.etapaDeCima ? (
                    <>
                      <ChevronRight aria-hidden className="size-3 shrink-0" />
                      <span className="truncate">{sub.etapaDeCima}</span>
                    </>
                  ) : null}
                  {linha.demanda.minhas > 1 ? (
                    <span className="shrink-0">
                      {" "}
                      · {linha.demanda.minhas} etapas minhas aqui
                    </span>
                  ) : null}
                  {/* O SELO DA CAMPANHA, e ele é um LINK para onde o arquivo
                      sobe (0051 + Sprint das Campanhas).

                      A peça de campanha já era uma etapa minha — abrir a
                      campanha cria a demanda com uma etapa por entregável —, e
                      o que faltava era o caminho de volta: clicar na linha abre
                      a DEMANDA, e o PDF da lâmina sobe em
                      `/painel/aprovacoes/campanhas/{id}`. Sem o selo, quem
                      produz lia "Lâmina A5" e caía numa tela sem lugar para o
                      arquivo.

                      `stopPropagation` porque a linha inteira abre o painel
                      lateral: sem ele o clique no selo abriria os dois. */}
                  {sub.campanha ? (
                    <Link
                      href={`/painel/aprovacoes/campanhas/${sub.campanha.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-blue-soft text-accent-strong ms-1 inline-flex min-w-0 max-w-[14rem] items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                      title={`Peça da campanha ${sub.campanha.nome} — abre onde o material sobe`}
                    >
                      <IconeDaCampanha aria-hidden className="size-3 shrink-0" />
                      {/* O SELO DIZ QUAL CAMPANHA, e não a palavra "Campanha".
                          Dentro da seção Campanhas ele repetiria o cabeçalho
                          cinco vezes sem informar nada; o nome diz de qual peça
                          é esta etapa — que é a pergunta de quem tem três
                          campanhas correndo. */}
                      <span className="truncate">{sub.campanha.nome}</span>
                    </Link>
                  ) : null}
                </p>

                {linha.demanda.outros.length > 0 ? (
                  <UserAvatarGroup
                    max={3}
                    users={linha.demanda.outros.map((p) => ({ name: p.nome, src: p.avatar_url }))}
                  />
                ) : null}
              </div>
            </div>

            {sub.requer_aprovacao ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground inline-flex">
                    <Lock className="size-3.5" aria-label="Exige aprovação" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Exige aprovação {ROTULO_DA_APROVACAO[sub.tipo_aprovacao ?? "interna"]}
                </TooltipContent>
              </Tooltip>
            ) : null}

            {sub.dependenciasAbertas.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-warning inline-flex">
                    <Link2 className="size-3.5" aria-label="Aguardando outra etapa" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Aguardando: {sub.dependenciasAbertas.join(", ")}</TooltipContent>
              </Tooltip>
            ) : null}

            <PriorityBadge priority={sub.prioridade} />

            {/* DateBadge é para prazo a vencer; etapa concluída mostra a data
                crua, senão o passado apareceria em vermelho como atraso. */}
            {sub.prazo ? (
              sub.status === "concluida" ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {format(parseISO(sub.prazo), "dd/MM/yy", { locale: ptBR })}
                </span>
              ) : (
                <DateBadge date={sub.prazo} />
              )
            ) : (
              <span className="text-muted-foreground text-xs">Sem prazo</span>
            )}

            {mostrarStatus ? <StatusBadge status={sub.status} /> : null}

            {/* O relógio corre enquanto a etapa está em andamento. Fica à
                vista para a pessoa reparar que esqueceu a etapa aberta — é o
                que impede o número de chegar pronto e estranho no diálogo de
                conclusão. */}
            <Cronometro dados={sub} agoraDoServidor={prazos.agora} />

            <AcoesDaSubtarefa
              subtarefa={sub}
              usuarioId={usuarioId}
              souGestor={souGestor}
              rodadaPendenteId={sub.rodadas.find((r) => r.status === "pendente")?.id ?? null}
            />
          </div>
        );
      })}
    </div>
  );
}
