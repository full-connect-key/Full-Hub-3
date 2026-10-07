"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, CalendarRange, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { porContaEAno, type MesNaArvore } from "@/lib/dominio/posts";
import type { MesDeSocial, SituacaoDoMes } from "@/lib/dados/social-media";
import type { FluxoDeSocial } from "@/lib/dominio/social-flows";
import { cn } from "@/lib/utils";
import { AbrirOMes } from "./abrir-o-mes";

/**
 * A PORTA DO SOCIAL: uma conta por cartão, com os meses dela dentro.
 *
 * ---------------------------------------------------------------------------
 * **A ABA POSTS SAIU, e esta é a tela que ficou no lugar dela.** Decisão do
 * usuário: *"a aba Posts pode deletar, quero que a visualização seja apenas
 * por contas e separada por meses"*. Até aqui o módulo abria numa lista de
 * posts de todas as contas misturadas, com `?mes=` e `?cliente=` como o único
 * jeito de recortar — e nada na tela dizia quais meses existem.
 *
 * **OS POSTS NÃO SUMIRAM: eles passaram a morar DENTRO do mês.** Clicar num
 * mês troca o conteúdo desta mesma seção pelo mês aberto, com a trilha de
 * volta no topo. É a forma da ficha do equipamento em Comodatos — o índice
 * responde "onde", e a tela de dentro responde "o quê".
 *
 * **O DESENHO É A PROPOSTA A, escolhida pelo usuário entre três.** As outras
 * duas ficam registradas porque a decisão pode voltar: **B**, uma matriz conta
 * × mês com um quadradinho colorido por célula — a única das três que
 * respondia de relance *"o mês que vem já foi aberto para todas as contas?"*,
 * e que em troca não dizia quem está com o quê; e **C**, uma linha larga por
 * conta com só o mês da vez em destaque e os demais atrás de um contador —
 * a mais parecida com um painel de operação, e a pior para achar um mês
 * antigo.
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

/**
 * QUANTOS MESES CABEM NA FAIXA DE UM CARTÃO, antes do "Todos os meses".
 *
 * Quatro, e o número é de largura: a faixa é uma grade de colunas iguais, e no
 * quinto cada mês fica com menos de 180px — onde "Envio · 6 com o cliente" não
 * cabe mais e vira reticências. Quatro também é o recorte que responde: o mês
 * que vem, o corrente e os dois que fecharam.
 */
const MESES_NA_FAIXA = 4;

export function IndiceDoSocial({
  meses,
  situacao,
  contaFixada,
  clientes,
  equipe,
  fluxos,
  driveLigado,
  souGestor,
}: {
  meses: MesDeSocial[];
  situacao: SituacaoDoMes;
  /** Quando a URL traz `?cliente=`, o índice mostra só ela — e todos os meses. */
  contaFixada: string | null;
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
  fluxos: FluxoDeSocial[];
  driveLigado: boolean;
  souGestor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const contas = porContaEAno(meses);

  function trocarSituacao(nova: SituacaoDoMes) {
    const proximos = new URLSearchParams(parametros.toString());
    if (nova === "producao") proximos.delete("situacao");
    else proximos.set("situacao", nova);
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  function limparConta() {
    const proximos = new URLSearchParams(parametros.toString());
    proximos.delete("cliente");
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* O FILTRO É BOTÃO E NÃO LINK, como o seletor de visão: com `<Link>`
            cada troca viraria uma entrada no histórico, e quem voltasse de um
            mês percorreria os quatro recortes antes de sair da tela. */}
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

        {/* A CONTA FIXADA SE DESFAZ NA PRÓPRIA TELA, e não só pelo botão de
            voltar: quem chegou aqui por "Todos os meses" de uma conta está a
            um clique de querer as outras, e mandá-lo ao histórico para isso é
            a tela escondendo o caminho de volta. */}
        {contaFixada ? (
          <Button variant="outline" size="sm" onClick={limparConta}>
            Ver todas as contas
          </Button>
        ) : null}

        <span className="grow" />

        {/* "ABRIR O MÊS" MUDOU DE TELA, e é consequência da aba Posts ter
            saído: ele vivia no cabeçalho da lista de posts, que era a porta do
            módulo. A porta agora é este índice, e um botão de criar que mora
            dentro de um mês já aberto é um botão que só se encontra depois de
            entrar em outro lugar. */}
        {souGestor ? (
          <AbrirOMes
            clientes={clientes}
            equipe={equipe}
            fluxos={fluxos}
            driveLigado={driveLigado}
          />
        ) : null}
      </div>

      {contas.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhum mês neste recorte"
          description={
            situacao === "producao"
              ? "Todo mês de social desta agência já foi concluído ou arquivado. Abra o próximo no botão acima."
              : "Troque o recorte acima para encontrar o mês."
          }
        />
      ) : (
        <ul className="space-y-3">
          {contas.map((conta) => {
            const todos = conta.anos.flatMap((a) => a.meses);
            const naFaixa = contaFixada ? todos : todos.slice(0, MESES_NA_FAIXA);
            const sobram = todos.length - naFaixa.length;

            return (
              <li
                key={conta.clienteId}
                className="bg-surface-card rounded-card shadow-cartao space-y-3 border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className="bg-muted text-text-secondary grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                  >
                    {sigla(conta.cliente)}
                  </span>
                  <h2 className="text-text-primary text-base font-semibold">
                    {conta.cliente}
                  </h2>
                  <span className="text-text-muted text-xs">
                    {conta.meses === 1 ? "1 mês" : `${conta.meses} meses`}
                  </span>

                  <span className="grow" />

                  {/* "N ESPERANDO" É A ÚNICA COISA DESTA TELA QUE COBRA UMA
                      AÇÃO, e por isso é o único selo em âmbar. **No zero ele
                      não aparece** — "0 esperando" em nove das dez contas é a
                      mesma linha com um número a mais, e a ausência é a
                      resposta, como no selo da fila de aprovações. */}
                  {conta.esperandoCliente > 0 ? (
                    <span className="bg-warning-soft text-warning rounded-full px-2.5 py-1 text-xs font-semibold">
                      {conta.esperandoCliente}{" "}
                      {conta.esperandoCliente === 1 ? "peça" : "peças"} com o
                      cliente
                    </span>
                  ) : null}

                  {sobram > 0 ? (
                    <Link
                      href={`?aba=social&situacao=todos&cliente=${conta.clienteId}`}
                      className="text-accent-strong text-xs font-semibold hover:underline"
                      scroll={false}
                    >
                      Todos os meses →
                    </Link>
                  ) : null}
                </div>

                {/* A FAIXA É GRADE DE COLUNAS FIXAS, e as duas metades da
                    decisão saíram da imagem.

                    **Grade e não `flex`** porque em `flex` cada mês fica do
                    tamanho do próprio texto, e as faixas de duas contas
                    diferentes deixam de se alinhar — que é justamente o que
                    permite comparar uma conta com a de baixo.

                    **E colunas de 250px e não quatro iguais**, que foi a
                    primeira versão: com "Em produção" quase toda conta tem UM
                    mês, e um cartão de 350px sozinho num cartão de conta de
                    1500 deixava três quartos da linha vazios. Com a coluna
                    fixa, um mês ocupa 250 e quatro ocupam mil — e a largura de
                    cada um é a mesma em toda a tela. */}
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(0,250px))] gap-2.5">
                  {naFaixa.map((m) => (
                    <li key={m.taskId}>
                      <CartaoDoMes mes={m} clienteId={conta.clienteId} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {/* A REGRA DO ARQUIVAMENTO FICA ESCRITA, e não só acontece. Um mês que
          sai da lista noventa dias depois de concluído, sem nada ter dito que
          ele sairia, lê como mês perdido — e a pessoa vai procurá-lo no board
          da agência. A frase não cita rotina nem agendamento: o vocabulário de
          desenvolvimento não vai para a tela. */}
      {situacao !== "arquivados" && contas.length > 0 ? (
        <p className="text-text-muted text-xs">
          Um mês concluído sai desta lista depois de 90 dias e passa a aparecer
          em Arquivados. Nada dele é apagado.
        </p>
      ) : null}
    </div>
  );
}

/**
 * UM MÊS NA FAIXA: o nome, o andamento, e o que está acontecendo nele.
 *
 * **A BARRA É O ANDAMENTO DO CLIENTE, e não o da produção** — quantas peças
 * ele já aprovou sobre quantas o mês tem. É o número que fecha o mês: a
 * produção pode estar inteira pronta e o mês continua aberto enquanto o
 * cliente não responde, e uma barra cheia num mês que ninguém aprovou seria a
 * tela dizendo que acabou.
 *
 * **E A TERCEIRA LINHA É A FASE COM O NOME DE QUEM A TEM**, que é a diferença
 * entre este cartão e uma linha de inventário: "Layout · Bruno" responde o que
 * está acontecendo agora, e nenhum dos dois números acima responde isso.
 */
function CartaoDoMes({
  mes,
  clienteId,
}: {
  mes: MesNaArvore;
  clienteId: string;
}) {
  const fracao = mes.pecas === 0 ? null : mes.aprovadas / mes.pecas;

  // O TOM É O ESTADO, e a ordem das perguntas é a da urgência: peça esperando
  // o cliente ganha de tudo (é o que cobra), depois concluído, depois em
  // produção, e o cinza para o mês que nasceu e ainda não tem peça.
  const tom =
    mes.esperandoCliente > 0
      ? { fio: "bg-warning", texto: "text-warning" }
      : mes.concluido
        ? { fio: "bg-success", texto: "text-success" }
        : mes.pecas > 0
          ? { fio: "bg-action", texto: "text-action-text" }
          : { fio: "bg-neutral", texto: "text-neutral" };

  return (
    <Link
      href={`?aba=social&mes=${mes.mes.slice(0, 7)}&cliente=${clienteId}`}
      className={cn(
        "hover:bg-muted block space-y-2 rounded-xl border p-3 transition-colors",
        mes.arquivadaEm ? "bg-muted/40" : "bg-surface-card",
      )}
    >
      <span className="flex items-baseline gap-1.5">
        <span className="text-text-primary text-sm font-semibold">
          {comInicialMaiuscula(format(parseISO(mes.mes), "MMMM", { locale: ptBR }))}
        </span>
        <span className="text-text-muted text-[11px]">
          {format(parseISO(mes.mes), "yyyy")}
        </span>
        <span className="grow" />
        <span className={cn("text-[11px] font-semibold tabular-nums", tom.texto)}>
          {mes.pecas === 0 ? "—" : `${mes.aprovadas}/${mes.pecas}`}
        </span>
      </span>

      {/* O FIO É `aria-hidden` porque a fração acima já diz o número, e um
          `progressbar` aqui faria o leitor de tela ouvir "4 de 18" duas vezes
          em cada um dos quatro cartões. */}
      <span
        aria-hidden
        className="bg-border block h-1.5 overflow-hidden rounded-full"
      >
        <span
          className={cn("block h-full rounded-full", tom.fio)}
          style={{ width: fracao === null ? "0%" : `${Math.round(fracao * 100)}%` }}
        />
      </span>

      <span className="text-text-secondary flex items-center gap-1.5 text-[11px]">
        {mes.arquivadaEm ? (
          <>
            <Archive aria-hidden className="size-3 shrink-0" />
            Arquivado
          </>
        ) : mes.concluido ? (
          <>
            <CheckCircle2 aria-hidden className="text-success size-3 shrink-0" />
            Concluído
          </>
        ) : (
          <span className="truncate">{oQueEstaAcontecendo(mes)}</span>
        )}
      </span>
    </Link>
  );
}

/**
 * A TERCEIRA LINHA DO CARTÃO, em uma frase.
 *
 * A ordem das perguntas é a mesma do tom, e é deliberada: com peça esperando o
 * cliente, o nome de quem produz não é mais a informação — o mês está parado
 * fora da agência, e é isso que precisa ser dito.
 */
function oQueEstaAcontecendo(mes: MesNaArvore): string {
  if (mes.esperandoCliente > 0) {
    return `${mes.fase?.titulo ?? "Envio"} · ${mes.esperandoCliente} com o cliente`;
  }
  if (mes.pecas === 0) return "Aberto, sem peça ainda";
  if (!mes.fase) return `${mes.aprovadas} de ${mes.pecas} aprovadas`;
  // SEM DONO A FRASE DIZ ISSO, e não some: etapa sem responsável não aparece
  // no "Minhas Tasks" de ninguém, e é o pior tipo de trabalho — o que existe e
  // ninguém sabe que é seu. É a mesma decisão do Resumo da Agência.
  return `${mes.fase.titulo} · ${mes.fase.responsavel ?? "sem dono"}`;
}

/**
 * `MMMM` do date-fns devolve "outubro" em minúscula, porque é assim que o mês
 * se escreve no meio de uma frase em português. Aqui ele é um TÍTULO de
 * cartão, e título começa com maiúscula — é a mesma função que a prévia da
 * recorrência já usava pelo mesmo motivo.
 */
function comInicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** As duas primeiras iniciais do nome da empresa, para o ladrilho do cartão. */
function sigla(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
