"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Download,
  ExternalLink,
  FileText,
  PencilLine,
} from "lucide-react";
import { toast } from "sonner";

import { DateBadge } from "@/components/shared/date-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ImagemAssinada } from "@/components/shared/imagem-assinada";
import { BotaoDeDecisao } from "@/components/shared/botao-de-decisao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { DESFECHO_DA_RODADA } from "@/lib/aprovacoes/decisoes";
import type { AprovacaoDoCliente } from "@/lib/dados/portal-aprovacoes";
import { cn } from "@/lib/utils";

import { decisaoCliente } from "./acoes";

/**
 * As aprovações do cliente.
 *
 * Duas listas: o que espera a decisão dele e o que já foi decidido, com o que
 * ele escreveu da outra vez. Nada da aprovação interna aparece aqui — ele não
 * precisa (nem deve) saber quantas rodadas a equipe fez antes de mandar.
 *
 * Pedir ajustes exige escrever o motivo. Não é burocracia: sem o texto, a
 * equipe recomeça no escuro — e o banco recusa a rodada sem comentário de
 * qualquer forma.
 *
 * `somenteLeitura` é a visualização administrativa em /portal/{slug}: a equipe
 * vê o que o cliente vê, e os botões de decisão ficam desligados com a
 * explicação no lugar. O botão desligado é cortesia, não é a trava — quem
 * montasse a chamada à mão seria recusado pela função
 * `decidir_rodada_do_cliente` no Postgres, que confere se quem chama é o
 * cliente daquela rodada.
 */
export function ListaDeAprovacoes({
  esperando,
  decididas,
  base = "/portal",
  somenteLeitura = false,
}: {
  esperando: AprovacaoDoCliente[];
  decididas: AprovacaoDoCliente[];
  /** Prefixo dos links, para a peça abrir no portal certo. */
  base?: string;
  somenteLeitura?: boolean;
}) {
  if (esperando.length === 0 && decididas.length === 0) {
    return (
      <EmptyState
        icon={BadgeCheck}
        title={
          somenteLeitura ? "Nada esperando o cliente" : "Nada esperando você"
        }
        description={
          somenteLeitura
            ? "Quando a equipe enviar um material para aprovação, ele aparece aqui."
            : "Quando a agência enviar um material para a sua aprovação, ele aparece aqui."
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xl font-bold tracking-[-0.02em]">
          {somenteLeitura ? "Esperando o cliente" : "Esperando você"}
        </h2>
        {esperando.length === 0 ? (
          <p className="text-text-muted rounded-card border border-dashed p-4 text-sm">
            Nada pendente no momento.
          </p>
        ) : (
          <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {esperando.map((item) => (
              <CartaoPendente
                key={item.rodadaId}
                item={item}
                base={base}
                somenteLeitura={somenteLeitura}
              />
            ))}
          </ul>
        )}
      </section>

      {decididas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-[-0.02em]">Já decididas</h2>
          <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {decididas.map((item) => (
              <Decidida key={item.rodadaId} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CartaoPendente({
  item,
  base,
  somenteLeitura,
}: {
  item: AprovacaoDoCliente;
  base: string;
  somenteLeitura: boolean;
}) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [pedindoAjustes, setPedindoAjustes] = useState(false);
  const [motivo, setMotivo] = useState("");

  function decidir(decisao: "aprovada" | "ajustes_solicitados", texto: string) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        decisaoCliente(item.rodadaId, decisao, texto),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setPedindoAjustes(false);
        router.refresh();
      }
    });
  }

  return (
    <li className="bg-surface-card rounded-card shadow-cartao space-y-3 border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.titulo}</span>
        {/* O SELO DA RODADA SÓ APARECE COM NÚMERO. O post e a peça de
            campanha chegam aqui sem ele — o número da rodada corrente não
            viaja em `ItemDoPortal` —, e "Rodada 0" seria a tela contando uma
            coisa que não existe. */}
        {item.numeroRodada > 0 ? (
          <Badge variant="secondary">Rodada {item.numeroRodada}</Badge>
        ) : null}
        {/* O PRAZO NO CANTO, e não mais a data de envio.
            A fila passou a ordenar por ele, e uma ordem que a tela não mostra
            lê como ordem arbitrária: o material que vence amanhã aparece em
            cima do que chegou hoje, e sem a data ninguém sabe por quê.
            `DateBadge` é o mesmo de todo prazo do produto — vencido em
            vermelho, hoje e amanhã em âmbar —, então "vence hoje" tem a mesma
            cara aqui, no board e no calendário. */}
        {item.prazo ? (
          <DateBadge date={item.prazo} showIcon className="ml-auto" />
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        {item.demanda ? <>em {item.demanda} · </> : null}
        enviado em{" "}
        {format(parseISO(item.enviadaEm), "dd/MM/yy", { locale: ptBR })}
      </p>

      {item.entregas.length > 0 ? (
        <PreviaDosArquivos entregas={item.entregas} />
      ) : item.caminho ? null : (
        /* "SEM ARQUIVO ANEXADO" SÓ VALE PARA O MATERIAL DE DEMANDA, que
           entrega por `subtask_entregas` e às vezes não entrega nada. Para o
           post e a peça de campanha a frase é FALSA: a arte existe, ela só
           não mora nesta lista — ela abre grande na tela do material, que é
           para onde o botão leva. Afirmar que não há arquivo numa peça que
           tem arte é a tela dizendo o contrário do que acontece. */
        <p className="text-muted-foreground text-sm italic">
          Sem arquivo anexado.
        </p>
      )}

      {item.conversa.length > 0 ? (
        <ul className="space-y-1 border-l-2 pl-3">
          {item.conversa.map((comentario) => (
            <li key={comentario.id} className="text-sm">
              <span className="text-muted-foreground text-xs">
                {comentario.meu ? "Você" : "Full Connect Key"} ·{" "}
                {format(parseISO(comentario.created_at), "dd/MM/yy", {
                  locale: ptBR,
                })}
              </span>
              <p>{comentario.texto}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ------------------------------------------- o que o card OFERECE --
          O POST E A PEÇA DE CAMPANHA LEVAM À TELA DELES, e não trazem botão
          de decidir aqui. É a regra que a tela de material escreve em voz
          alta: a arte vem antes dos botões, porque o material que volta
          "aprovado sem ninguém ter visto" é o retrabalho mais caro — e nesta
          fila não há arte nenhuma para olhar. O material de demanda é o caso
          contrário: os arquivos entregues e a conversa estão logo acima, e
          decidir daqui é decidir com tudo à vista. */}
      {item.caminho ? (
        <Button variant="outline" asChild>
          <Link href={`${base}${item.caminho}`}>
            Abrir e decidir
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Button>
      ) : somenteLeitura ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* O <span> existe para o tooltip ter o que escutar: botão
                desabilitado não dispara evento de mouse. */}
            <span className="inline-flex flex-wrap gap-2">
              <BotaoDeDecisao decisao="ajustar" disabled />
              <BotaoDeDecisao decisao="aprovar" disabled />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            A decisão é do cliente. Você está visualizando o portal dele como
            equipe.
          </TooltipContent>
        </Tooltip>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* O ÍCONE DE APROVAR ERA `BadgeCheck` AQUI e `Check` no detalhe do
              material — o mesmo botão, a mesma decisão, dois desenhos, em duas
              telas que a pessoa atravessa num clique. É `ICONE_DA_AREA` de
              novo, e quem responde agora é o mapa. */}
          <BotaoDeDecisao
            decisao="ajustar"
            disabled={executando}
            onClick={() => {
              setMotivo("");
              setPedindoAjustes(true);
            }}
          />
          <BotaoDeDecisao
            decisao="aprovar"
            carregando={executando}
            onClick={() => decidir("aprovada", "")}
          />
        </div>
      )}

      <Dialog
        open={pedindoAjustes}
        onOpenChange={(aberto) => !aberto && setPedindoAjustes(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que precisa mudar?</DialogTitle>
            <DialogDescription>
              Quanto mais específico, menos idas e vindas. A equipe recebe o
              texto junto com o pedido.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={4}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="A cor do fundo ficou diferente da nossa marca."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedindoAjustes(false)}>
              Cancelar
            </Button>
            <BotaoDeDecisao
              decisao="ajustar"
              rotulo="Enviar pedido"
              carregando={executando}
              disabled={motivo.trim().length === 0}
              onClick={() => decidir("ajustes_solicitados", motivo)}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/* ------------------------------------------------------------------------
   A PRÉVIA DO QUE SE APROVA. Pedido do usuário: *"quero que o cliente já tenha
   uma pré-visualização do que ele vai aprovar"*. Antes eram botões com o nome
   do arquivo, e decidir pedia abrir cada um numa aba.

   Imagem aparece direto; PDF abre embutido (o `frame-src` já libera o
   armazenamento); o resto vira um ladrilho com o botão de abrir. SÓ ENTRA O
   QUE TEM ENDEREÇO ASSINADO (0121) — sem ele o quadro ficaria vazio.
   ------------------------------------------------------------------------ */
type Entrega = AprovacaoDoCliente["entregas"][number];

const EH_IMAGEM = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i;
const EH_PDF = /\.pdf(\?|$)/i;

function nomeDaEntrega(entrega: Entrega): string {
  return entrega.nome ?? "Material";
}

function familiaDaEntrega(entrega: Entrega): "imagem" | "pdf" | "outro" {
  const alvo = `${entrega.nome ?? ""} ${entrega.url}`;
  if (EH_IMAGEM.test(alvo)) return "imagem";
  if (EH_PDF.test(alvo)) return "pdf";
  return "outro";
}

function PreviaDosArquivos({ entregas }: { entregas: Entrega[] }) {
  const visiveis = entregas.filter((e) => e.assinado !== null);
  const [indice, setIndice] = useState(0);
  if (visiveis.length === 0) return null;

  const atual = visiveis[Math.min(indice, visiveis.length - 1)];
  const familia = familiaDaEntrega(atual);

  return (
    <div className="space-y-3">
      <div className="bg-muted overflow-hidden rounded-xl border">
        {familia === "imagem" ? (
          <ImagemAssinada
            src={atual.assinado}
            alt={nomeDaEntrega(atual)}
            className="mx-auto h-56 w-auto object-contain"
          />
        ) : familia === "pdf" ? (
          <iframe
            key={atual.id}
            src={`${atual.assinado}#view=FitH`}
            title={nomeDaEntrega(atual)}
            className="bg-card h-56 w-full"
          />
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <FileText aria-hidden className="text-text-muted size-10" />
            <p className="text-sm font-medium">{nomeDaEntrega(atual)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {visiveis.length > 1
          ? visiveis.map((entrega, i) => (
              <button
                key={entrega.id}
                type="button"
                aria-pressed={i === indice}
                onClick={() => setIndice(i)}
                className={cn(
                  "max-w-[160px] truncate rounded-md border px-2.5 py-1 text-xs",
                  i === indice
                    ? "bg-action-soft border-action text-action font-medium"
                    : "bg-card border-input hover:bg-muted",
                )}
              >
                {nomeDaEntrega(entrega)}
              </button>
            ))
          : null}
        <a
          href={atual.assinado!}
          target="_blank"
          rel="noreferrer"
          className="text-accent-strong ml-auto inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          {familia === "outro" ? (
            <ExternalLink aria-hidden className="size-4" />
          ) : (
            <Download aria-hidden className="size-4" />
          )}
          Abrir em outra aba
        </a>
      </div>
    </div>
  );
}

/** A linha de uma rodada já decidida: o que foi, o desfecho e quando. */
function Decidida({ item }: { item: AprovacaoDoCliente }) {
  const aprovada = item.status === "aprovada";
  const desfecho = DESFECHO_DA_RODADA[item.status];
  const capa = item.entregas.find(
    (e) => e.assinado !== null && familiaDaEntrega(e) === "imagem",
  );

  return (
    <li className="bg-surface-card rounded-card shadow-cartao flex items-start gap-4 border p-4">
      <div
        className={cn(
          "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg",
          aprovada ? "bg-success-soft text-success" : "bg-muted text-text-muted",
        )}
      >
        {capa ? (
          <ImagemAssinada
            src={capa.assinado}
            alt=""
            className="size-full object-cover"
          />
        ) : aprovada ? (
          <Check aria-hidden className="size-6" />
        ) : (
          <PencilLine aria-hidden className="size-6" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.titulo}</p>
        <p className="text-text-muted truncate text-xs">
          {item.demanda ? <>{item.demanda} · </> : null}
          {item.numeroRodada > 0 ? <>rodada {item.numeroRodada}</> : null}
        </p>
        {item.comentario ? (
          <p className="text-text-muted mt-2 text-sm">“{item.comentario}”</p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-bold", desfecho.classeDeTexto)}>
          {aprovada ? "Aprovado" : desfecho.rotulo}
        </p>
        <p className="text-text-muted text-xs tabular-nums">
          {item.decididaEm
            ? format(parseISO(item.decididaEm), "dd 'de' MMM", { locale: ptBR })
            : ""}
        </p>
      </div>
    </li>
  );
}
