"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { QuadroDePedidos } from "@/components/shared/quadro-de-pedidos";
import {
  COLUNAS_DA_FILA_DE_PEDIDOS,
  DIAS_ATE_DESTACAR,
  TETO_DA_COLUNA_ENCERRADA,
  diasEsperando,
  ehAberta,
  estaEsquecida,
  rotuloDaFrente,
} from "@/lib/dominio/solicitacoes";
import type { PedidoNaLista } from "@/lib/dados/solicitacoes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** O valor que o `Select` do Radix usa para "sem recorte": ele não aceita "". */
const TODOS = "__todos__";

/**
 * O card de um pedido na fila do Atendimento.
 *
 * ---------------------------------------------------------------------------
 * **O QUE ELE RESPONDE É "de quem é isto e há quanto tempo espera"**, que é a
 * pergunta desta tela — a do cliente, no quadro dele, é outra, e por isso os
 * dois cards são dois (a casca é que é compartilhada).
 *
 * **O AVATAR DE QUEM ESCREVEU SAIU, e é dito em vez de escondido.** A coluna
 * tem cerca de 200px, e o rosto disputava a linha do rodapé com a frente e com
 * a idade — que é o que decide a ordem de quem atende. A identidade que importa
 * aqui é a EMPRESA, e ela está na segunda linha; quem escreveu continua no
 * detalhe, que é onde o pedido se lê inteiro antes de ser decidido. É a conta
 * do avatar na célula do calendário, que tem ~90px e cede o círculo ao título.
 *
 * **A IDADE SÓ APARECE NA COLUNA ABERTA; na encerrada aparece a DATA.** "há 40
 * dias" num card da coluna "Concluído" lê como quarenta dias de espera, e o
 * pedido foi atendido — a idade é a informação da fila, e na coluna de quem já
 * foi atendido o que resta é quando ele chegou.
 * ---------------------------------------------------------------------------
 */
function CardDoPedido({
  pedido,
  hojeISO,
}: {
  pedido: PedidoNaLista;
  hojeISO: string;
}) {
  const p = pedido;
  const dias = diasEsperando(p.created_at, hojeISO);
  const esquecido = estaEsquecida(p, hojeISO);
  const aberto = ehAberta(p.status);

  // OS CONTADORES ENTRAM NA LINHA DE METADADOS, e não como ícones no rodapé:
  // ali eles disputariam com a frente e com a idade numa coluna de 200px, e o
  // que eles dizem — que há conversa e anexo — cabe em palavras. É a forma que
  // a lista do cliente já usava.
  const extras = [
    p.tipo,
    p.quantosAnexos > 0
      ? `${p.quantosAnexos} anexo${p.quantosAnexos > 1 ? "s" : ""}`
      : null,
    p.quantasMensagens > 0
      ? `${p.quantasMensagens} mensage${p.quantasMensagens > 1 ? "ns" : "m"}`
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/painel/solicitacoes/${p.id}`}
      className={cn(
        "bg-card rounded-card shadow-cartao hover:border-accent-strong block min-w-0 border p-3 transition-colors",
        /* O DESTAQUE É A IDADE E NÃO O STATUS, e por isso ele é uma borda e um
           chão e não um selo a mais: o selo seria a terceira coisa dizendo em
           que pé está, e a coluna já diz.

           **E O CHÃO É O PAR NOMEADO CHEIO, nunca `bg-warning-soft/40`:**
           opacidade sobre um fundo qualquer dá uma cor que ninguém mediu, e no
           tema escuro dá outra. `--warning` e nunca `--danger` — um pedido de
           três dias é uma cobrança, não um erro. */
        esquecido && "border-warning border-s-2 bg-warning-soft",
      )}
    >
      {/* DUAS LINHAS DE TÍTULO E NÃO UMA TRUNCADA: numa coluna estreita o
          título é a única coisa que identifica o pedido, e "Arte para a semana
          do…" cortado no meio não identifica nenhum. É o piso de 14rem do nome
          na tabela da Gestão de Tasks, aplicado onde não há largura para dar. */}
      <p className="line-clamp-2 text-sm font-semibold">{p.titulo}</p>

      <p className="text-text-secondary mt-1 truncate text-xs">
        {p.empresa ?? "—"}
        {/* A VERTENTE ENCOSTA NA EMPRESA, e não numa linha nova: ela É parte da
            conta — "Mundo Verde · Lojas Próprias" se lê como um endereço. */}
        {p.vertente ? ` · ${p.vertente}` : ""}
      </p>

      {extras.length > 0 ? (
        <p className="text-text-muted truncate text-xs">
          {extras.join(" · ")}
        </p>
      ) : null}

      {/* A DEMANDA EM LINHA PRÓPRIA, porque ela é o que o pedido VIROU: na
          linha dos metadados ela se leria como mais um atributo dele. Ela só
          existe nas duas colunas da direita, então não gasta altura nas três
          primeiras. */}
      {p.demanda ? (
        <p className="text-text-muted mt-1 truncate text-xs">
          Demanda: {p.demanda.titulo}
        </p>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {/* ----------------------------------------------------------------
            A FRENTE APARECE EM TODO CARD, e não só quando falta.

            A regra da matriz do Day Off — pinta-se a exceção — vale para
            ESTADO, e a frente não é estado: é a informação de quem produz, e
            com o recorte por status virando coluna ela passou a ser a única
            dimensão escrita no card. **O par é NEUTRO nas duas e `--warning`
            na ausência:** aí sim é exceção, e é a única das três que pede uma
            ação — classificar.
            ---------------------------------------------------------------- */}
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

        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            esquecido ? "text-warning font-medium" : "text-text-muted",
          )}
          title={format(parseISO(p.created_at), "dd/MM/yyyy 'às' HH:mm", {
            locale: ptBR,
          })}
        >
          {aberto
            ? dias === 0
              ? "hoje"
              : dias === 1
                ? "ontem"
                : `há ${dias} dias`
            : format(parseISO(p.created_at), "dd/MM/yy", { locale: ptBR })}
        </span>
      </div>
    </Link>
  );
}

/**
 * A fila do Atendimento, em QUADRO.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"mude as solicitações, para uma visualização kan ban"*
 * e *"faça uma proposta melhor de visualização das solicitações"*.
 *
 * **ERA UMA LISTA CORRIDA COM UMA FILEIRA DE CHIPS POR CIMA**, e o problema
 * não era a lista: era que o estado de cada pedido — a única coisa que decide
 * o que fazer com ele — se lia num selo no fim da linha, e para ver "o que
 * está parado comigo" era preciso escolher um chip e perder os outros quatro
 * de vista. No quadro os cinco estados estão na tela ao mesmo tempo, com a
 * contagem de cada um, e o chip de status deixou de existir porque a coluna é
 * ele.
 *
 * **A ORDEM DENTRO DA COLUNA ABERTA CONTINUA SENDO DO MAIS ANTIGO PARA O MAIS
 * NOVO**, que é a decisão desta tela desde a 0068: a pergunta não é "o que
 * chegou?", é "quem está esperando há mais tempo?" — e uma fila em que o
 * pedido de ontem aparece acima do de semana passada é a fila em que o de
 * semana passada nunca é atendido. Quem ordena é a consulta; a coluna
 * `encerrada` inverte, porque ali a pergunta é o que foi fechado por último.
 * ---------------------------------------------------------------------------
 */
export function CaixaDeEntrada({
  pedidos,
  hojeISO,
  clienteAtivo,
}: {
  pedidos: PedidoNaLista[];
  hojeISO: string;
  clienteAtivo: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  /**
   * O RECORTE QUE SOBROU MORA NA URL, como todo filtro de listagem do produto:
   * "o quadro da Mundo Verde" é um link, e é a pergunta que a fila responde na
   * segunda-feira.
   */
  function filtrar(valor: string | null) {
    const proximos = new URLSearchParams(parametros.toString());
    if (valor) proximos.set("cliente", valor);
    else proximos.delete("cliente");
    const consulta = proximos.toString();
    router.replace(consulta ? `${pathname}?${consulta}` : pathname, {
      scroll: false,
    });
  }

  /**
   * AS OPÇÕES SAEM DA FILA INTEIRA, nunca do que sobrou do recorte.
   *
   * `caixaDeEntrada()` desce a fila toda (0134), então uma conta continua na
   * lista de clientes qualquer que seja a coluna em que os pedidos dela caem.
   * É a decisão dos contadores de Minhas Tasks pela enésima vez.
   */
  const clientes = [
    ...new Map(
      pedidos
        .filter((p) => p.empresa)
        .map((p) => [p.client_id, p.empresa as string] as const),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  const visiveis = clienteAtivo
    ? pedidos.filter((p) => p.client_id === clienteAtivo)
    : pedidos;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------
          O RECORTE POR CLIENTE, e ele é o único que sobrou.

          **É SELETOR E NÃO FILEIRA DE CHIPS, e a diferença é quantos são.** O
          cliente cresce com a carteira, e vinte e oito chips são a faixa de
          catorze pílulas que o portal já desfez uma vez — é a decisão da
          Biblioteca: a frente em chips e o que cresce em seletor.

          **E ELE LISTA SÓ QUEM TEM PEDIDO NA FILA**, nunca a carteira inteira:
          uma conta sem pedido nenhum é uma opção que, escolhida, esvazia as
          cinco colunas — e um controle que só sabe esvaziar é o interruptor da
          0088.
          ------------------------------------------------------------------ */}
      {clientes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted w-full text-[11px] font-medium tracking-wide uppercase sm:w-auto">
            Cliente
          </span>
          <Select
            value={clienteAtivo ?? TODOS}
            onValueChange={(v) => filtrar(v === TODOS ? null : v)}
          >
            <SelectTrigger className="w-56" aria-label="Filtrar por cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os clientes</SelectItem>
              {clientes.map(([id, nome]) => (
                <SelectItem key={id} value={id}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {visiveis.length === 0 ? (
        /* DUAS FRASES E NÃO UMA: a fila sem pedido nenhum e o recorte sem
           resultado são fatos diferentes, e a primeira dita sobre um filtro
           escolhido faria o Atendimento concluir que nenhum cliente pediu
           nada. É a decisão das colunas em branco da fila de notas.

           **E O QUADRO NÃO É DESENHADO NO VAZIO**, ao contrário do que ele faz
           com uma coluna sozinha: cinco colunas tracejadas dizendo "nada" cada
           uma são cinco vezes a mesma frase onde uma basta. */
        <EmptyState
          icon={Inbox}
          title={
            clienteAtivo ? "Nenhum pedido desta conta" : "Nenhum pedido aqui"
          }
          description={
            clienteAtivo
              ? "Esta conta não tem pedido nenhum na fila — escolha “Todos os clientes” para ver o quadro inteiro."
              : "Quando um cliente abrir um pedido pelo Portal dele, ele aparece na primeira coluna — e as colunas seguintes são o caminho dele até a entrega."
          }
        />
      ) : (
        <QuadroDePedidos
          colunas={COLUNAS_DA_FILA_DE_PEDIDOS}
          itens={visiveis}
          colunaDe={(p) => p.status}
          idDe={(p) => p.id}
          teto={TETO_DA_COLUNA_ENCERRADA}
          card={(p) => <CardDoPedido pedido={p} hojeISO={hojeISO} />}
        />
      )}

      <p className="text-text-muted text-xs">
        Um pedido em aberto há {DIAS_ATE_DESTACAR} dias ou mais aparece em
        destaque. Quem move um pedido de coluna é o botão do detalhe dele — e as
        duas últimas colunas são escritas pela demanda que ele virou.
      </p>
    </div>
  );
}
