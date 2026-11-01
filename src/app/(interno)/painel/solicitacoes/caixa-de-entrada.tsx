"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox, MessageSquare, Paperclip } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SeloDaSolicitacao } from "@/components/shared/selo-da-solicitacao";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DIAS_ATE_DESTACAR,
  FRENTES_DA_SOLICITACAO,
  ROTULOS_DE_FRENTE,
  ROTULOS_PARA_A_EQUIPE,
  STATUS_DA_SOLICITACAO,
  diasEsperando,
  estaEsquecida,
  rotuloDaFrente,
} from "@/lib/dominio/solicitacoes";
import type { PedidoNaLista, RecorteDeFrente } from "@/lib/dados/solicitacoes";
import { cn } from "@/lib/utils";

/**
 * A fila do Atendimento.
 *
 * ---------------------------------------------------------------------------
 * **DO MAIS ANTIGO PARA O MAIS NOVO**, ao contrário de toda outra listagem do
 * produto. A pergunta desta tela não é "o que chegou?", é "quem está esperando
 * há mais tempo?" — e uma fila em que o pedido de ontem aparece acima do de
 * semana passada é a fila em que o de semana passada nunca é atendido. Quem
 * ordena é a consulta; aqui só se desenha.
 * ---------------------------------------------------------------------------
 *
 * **O destaque é a IDADE e não o status**, e por isso ele é uma borda e não
 * um selo a mais: o selo já diz em que pé está. O que a borda diz é outra
 * coisa — que este aqui está esperando demais.
 *
 * `--warning` e nunca `--danger`: um pedido de três dias não é um erro, é uma
 * cobrança. Vermelho numa fila que se abre todo dia treina o hábito de ignorar
 * vermelho — a mesma razão do alerta de 7 dias do portal.
 */
/**
 * Uma fileira de filtro, com o rótulo do que ela recorta.
 *
 * ---------------------------------------------------------------------------
 * **SÃO DUAS FILEIRAS E NÃO UMA, e cada uma leva o nome da dimensão.**
 *
 * Status e frente são perguntas diferentes, e numa fileira só os dez chips se
 * leem como dez chips soltos — é a faixa de catorze pílulas do portal, que
 * esta casa já desfez uma vez. O rótulo em caixa alta é o que separa as duas
 * sem um segundo contêiner, que daria dois `gap` diferentes entre os chips.
 *
 * E ela é um componente porque são DUAS: a segunda cópia do mesmo chip seria a
 * que divergisse no dia em que alguém mexesse numa.
 * ---------------------------------------------------------------------------
 */
function FileiraDeFiltro({
  rotulo,
  opcoes,
  ativo,
  aoEscolher,
  children,
}: {
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  ativo: string | null;
  aoEscolher: (valor: string | null) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-text-muted w-full text-[11px] font-medium tracking-wide uppercase sm:w-auto">
        {rotulo}
      </span>
      <button
        type="button"
        onClick={() => aoEscolher(null)}
        aria-pressed={!ativo}
        className={cn(
          "rounded-full border px-3 py-1 text-sm transition-colors",
          !ativo ? "border-accent-strong bg-accent" : "hover:bg-accent",
        )}
      >
        Todos
      </button>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => aoEscolher(o.valor)}
          aria-pressed={ativo === o.valor}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            ativo === o.valor ? "border-accent-strong bg-accent" : "hover:bg-accent",
          )}
        >
          {o.rotulo}
        </button>
      ))}
      {children}
    </div>
  );
}

export function CaixaDeEntrada({
  pedidos,
  hojeISO,
  statusAtivo,
  frenteAtiva,
}: {
  pedidos: PedidoNaLista[];
  hojeISO: string;
  statusAtivo: string | null;
  frenteAtiva: RecorteDeFrente | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  /**
   * OS DOIS RECORTES MORAM NA URL, como todo filtro de listagem do produto, e
   * eles NÃO se apagam um ao outro: "os pedidos de campanha que estão novos" é
   * um link, e é a pergunta que a fila responde na segunda-feira.
   */
  function filtrar(chave: "status" | "frente", valor: string | null) {
    const proximos = new URLSearchParams(parametros.toString());
    if (valor) proximos.set(chave, valor);
    else proximos.delete(chave);
    const consulta = proximos.toString();
    router.replace(consulta ? `${pathname}?${consulta}` : pathname, {
      scroll: false,
    });
  }

  const esperando = pedidos.filter((p) => p.status === "nova" || p.status === "em_analise").length;

  return (
    <div className="space-y-4">
      <FileiraDeFiltro
        rotulo="Situação"
        ativo={statusAtivo}
        aoEscolher={(v) => filtrar("status", v)}
        opcoes={STATUS_DA_SOLICITACAO.map((s) => ({
          valor: s,
          rotulo: ROTULOS_PARA_A_EQUIPE[s],
        }))}
      >
        {/* O CONTADOR CONTA SÓ O QUE ESPERA ALGUÉM, e nunca o total: um pedido
            já em produção não pede decisão nenhuma, e somá-lo faria o número
            cobrar uma ação que metade da fila não pede. */}
        {esperando > 0 ? (
          <span className="text-muted-foreground ms-auto text-sm">
            {esperando} esperando você
          </span>
        ) : null}
      </FileiraDeFiltro>

      {/* ------------------------------------------------------------------
          O RECORTE POR FRENTE (0124), com o balde do não classificado.

          **"Sem classificação" é um chip de verdade**, e é onde mora o pedido
          anterior à regra: sem ele, aquele pedido só seria alcançável em
          "Todos" — no meio da fila inteira, que é onde ninguém o procura. E é
          justamente ele que pede ação: classificar.

          **E O CHIP APARECE MESMO COM ZERO**, ao contrário do selo da aba: a
          fileira RESPONDE o que existe no recorte, e "nenhum pedido de
          campanha" é resposta — é a decisão da faixa de áreas de Minhas
          Tasks. O selo cobra uma ação, e aí o zero não cobraria nada.
          ------------------------------------------------------------------ */}
      <FileiraDeFiltro
        rotulo="Frente"
        ativo={frenteAtiva}
        aoEscolher={(v) => filtrar("frente", v)}
        opcoes={[
          ...FRENTES_DA_SOLICITACAO.map((f) => ({
            valor: f,
            rotulo: ROTULOS_DE_FRENTE[f],
          })),
          { valor: "sem", rotulo: "Sem classificação" },
        ]}
      />

      {pedidos.length === 0 ? (
        /* DUAS FRASES E NÃO UMA: a fila sem pedido nenhum e o recorte sem
           resultado são fatos diferentes, e a primeira dita sobre um filtro
           escolhido faria o Atendimento concluir que nenhum cliente pediu
           nada. É a decisão das quatro colunas em branco da fila de notas. */
        <EmptyState
          icon={Inbox}
          title={
            statusAtivo || frenteAtiva
              ? "Nenhum pedido neste recorte"
              : "Nenhum pedido aqui"
          }
          description={
            statusAtivo || frenteAtiva
              ? "Nenhum pedido se encaixa nos filtros escolhidos acima — tire um deles para ver a fila inteira."
              : "Quando um cliente abrir um pedido pelo Portal dele, ele aparece nesta fila — do que espera há mais tempo para o mais recente."
          }
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {pedidos.map((p) => {
            const dias = diasEsperando(p.created_at, hojeISO);
            const esquecido = estaEsquecida(p, hojeISO);

            return (
              <Link
                key={p.id}
                href={`/painel/solicitacoes/${p.id}`}
                className={cn(
                  "hover:bg-accent flex flex-wrap items-center gap-3 p-3 transition-colors",
                  esquecido && "border-warning border-s-2 bg-warning-soft/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.titulo}</p>
                  <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-xs">
                    <span className="truncate">{p.empresa ?? "—"}</span>
                    {/* A VERTENTE ENCOSTA NA EMPRESA, e não numa linha nova:
                        ela É parte da conta — "Mundo Verde · Lojas Próprias"
                        se lê como um endereço, e separá-las faria a linha de
                        cima dizer uma empresa que a de baixo qualifica. */}
                    {p.vertente ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{p.vertente}</span>
                      </>
                    ) : null}
                    {p.tipo ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{p.tipo}</span>
                      </>
                    ) : null}
                    {p.demanda ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">Demanda: {p.demanda.titulo}</span>
                      </>
                    ) : null}
                  </p>
                </div>

                {p.quantosAnexos > 0 ? (
                  <span
                    className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                    title={`${p.quantosAnexos} arquivo(s)`}
                  >
                    <Paperclip aria-hidden className="size-3.5" />
                    {p.quantosAnexos}
                  </span>
                ) : null}

                {p.quantasMensagens > 0 ? (
                  <span
                    className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                    title={`${p.quantasMensagens} mensagem(ns)`}
                  >
                    <MessageSquare aria-hidden className="size-3.5" />
                    {p.quantasMensagens}
                  </span>
                ) : null}

                {p.autor ? (
                  <UserAvatar name={p.autor.nome} src={p.autor.avatar_url} size="sm" />
                ) : null}

                {/* A IDADE POR EXTENSO, e não só a data: "há 4 dias" é o que
                    decide a ordem de quem atende; "23/09" pede a conta de
                    cabeça. A data exata fica no `title`. */}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    esquecido ? "text-warning font-medium" : "text-muted-foreground",
                  )}
                  title={format(parseISO(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                >
                  {dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`}
                </span>

                {/* ------------------------------------------------------
                    A FRENTE APARECE EM TODA LINHA, e não só quando falta.

                    A regra da matriz do Day Off — pinta-se a exceção — vale
                    para ESTADO, e a frente não é estado: é a informação de
                    quem produz, e é o recorte da fileira acima. Um filtro
                    "Campanha" cujo resultado não diz em nenhuma linha que
                    aquele pedido É de campanha é um recorte que a pessoa não
                    tem como conferir, que é a lição do filtro de formato da
                    Biblioteca.

                    **O par é NEUTRO nas duas, e `--warning` na ausência:**
                    aí sim é exceção, e é a única das três que pede uma ação —
                    classificar. Par nomeado sempre, nunca opacidade.
                    ------------------------------------------------------ */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    p.frente
                      ? "bg-neutral-soft text-neutral"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {rotuloDaFrente(p.frente)}
                </span>

                <SeloDaSolicitacao status={p.status} lado="equipe" />
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Um pedido em aberto há {DIAS_ATE_DESTACAR} dias ou mais aparece em destaque.
      </p>
    </div>
  );
}
