"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BadgeCheck, CheckCheck, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
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
import { chamarAcao } from "@/lib/acoes/cliente";
import type { SolicitacaoNaTela } from "@/lib/dados/full-days";
import {
  ROTULOS_DE_TIPO,
  podeCancelar,
  rotuloDosDias,
} from "@/lib/dominio/full-days";
import type { HrStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { aprovarEmLote, cancelarSolicitacao, decidir } from "./acoes";

/**
 * AS QUATRO FILAS, e a quarta entrou com o cancelamento (0106).
 *
 * `cancelada` está no enum desde a 0011 e **não tinha fila nenhuma**: era um
 * status que o banco produzia e que tela nenhuma listava — a entrada que sai
 * da barra e a rota que fica, vista do avesso. Com o cancelamento existindo
 * nos dois sentidos, é aqui que o motivo escrito pelo sócio e o período que a
 * pessoa devolveu podem ser lidos depois.
 *
 * `contarPorStatus()` já contava as quatro, e o `Record<HrStatus, number>` já
 * era total — a fila nova não custou uma linha de consulta.
 */
const FILTROS: { chave: HrStatus; label: string }[] = [
  { chave: "pendente", label: "Pendentes" },
  { chave: "aprovada", label: "De acordo" },
  { chave: "reprovada", label: "A remarcar" },
  { chave: "cancelada", label: "Canceladas" },
];

/**
 * A fila do sócio.
 *
 * O que faz esta tela valer mais que uma lista: **cada cartão mostra quem mais
 * da mesma área já está fora naquele período.** Dizer "de acordo" para duas
 * designers na mesma semana é o erro que este módulo existe para evitar, e
 * ninguém percebe isso olhando um pedido de cada vez — o conflito só aparece
 * quando os dois períodos estão lado a lado.
 *
 * NÃO SE CHAMA APROVAR, e a escolha das palavras aqui não é estética. A equipe
 * é toda PJ, e hierarquia de aprovação é um dos indícios de subordinação que
 * sustentam um pedido de reconhecimento de vínculo. O que acontece nesta tela
 * é um combinado entre duas partes: quem presta serviço informa o período, a
 * agência confirma que consegue cobrir ou pede para remarcar.
 *
 * Pedir para remarcar pede o motivo. Ele não é obrigatório no banco, mas a
 * caixa abre assim mesmo e o texto do diálogo explica por quê: um "remarca"
 * sem explicação volta como pergunta, e a conversa acontece de qualquer forma
 * — só que fora do sistema.
 */
export function Aprovacoes({
  fila,
  contagem,
  filaAtual,
  hojeISO,
  quemSouEu,
}: {
  fila: SolicitacaoNaTela[];
  contagem: Record<HrStatus, number>;
  filaAtual: HrStatus;
  hojeISO: string;
  quemSouEu: string;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [executando, iniciar] = useTransition();

  const [selecionados, setSelecionados] = useState<string[]>([]);
  // UM PAR DE ESTADO PARA AS DUAS AÇÕES, e não dois diálogos: as duas pedem
  // um motivo pelo mesmo caminho, e duas cópias divergiriam no tratamento
  // dele — que é justamente a parte que o banco cobra numa e não na outra.
  const [emFoco, setEmFoco] = useState<{
    pedido: SolicitacaoNaTela;
    acao: "remarcar" | "cancelar";
  } | null>(null);
  const [motivo, setMotivo] = useState("");

  // O MOTIVO É OBRIGATÓRIO QUANDO QUEM CANCELA NÃO É O DONO, e a pergunta é a
  // da própria função do banco (0106): desfazer o período de outra pessoa sem
  // dizer por quê manda ela adivinhar. O sócio desfazendo o PRÓPRIO período
  // está fazendo o que ele faz na aba Solicitar, onde nada é pedido — cobrar
  // uma explicação dele para ele mesmo seria a tela inventando uma trava.
  const souODono = emFoco?.pedido.user_id === quemSouEu;
  const motivoObrigatorio = emFoco?.acao === "cancelar" && !souODono;
  const motivoEmFalta = motivoObrigatorio && motivo.trim().length === 0;

  function trocarFila(status: HrStatus) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("fila", status);
    setSelecionados([]);
    router.push(`?${destino.toString()}`);
  }

  function responder(resultado: { ok: boolean; mensagem?: string; error?: string }) {
    if (!resultado.ok) toast.error(resultado.error ?? "Não deu certo.");
    else {
      toast.success(resultado.mensagem ?? "Pronto.");
      setSelecionados([]);
      setEmFoco(null);
      router.refresh();
    }
  }

  function aprovar(id: string) {
    iniciar(async () => responder(await chamarAcao(() => decidir(id, "aprovada", ""))));
  }

  function confirmar() {
    const alvo = emFoco;
    if (!alvo || motivoEmFalta) return;
    iniciar(async () =>
      responder(
        await chamarAcao(() =>
          alvo.acao === "cancelar"
            ? cancelarSolicitacao(alvo.pedido.id, motivo)
            : decidir(alvo.pedido.id, "reprovada", motivo),
        ),
      ),
    );
  }

  function abrir(pedido: SolicitacaoNaTela, acao: "remarcar" | "cancelar") {
    setMotivo("");
    setEmFoco({ pedido, acao });
  }

  function aprovarSelecionados() {
    iniciar(async () => responder(await chamarAcao(() => aprovarEmLote(selecionados))));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((filtro) => {
          const ativo = filtro.chave === filaAtual;
          return (
            <button
              key={filtro.chave}
              type="button"
              onClick={() => trocarFila(filtro.chave)}
              aria-pressed={ativo}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                ativo
                  ? "border-accent-strong bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {filtro.label}
              <span className="tabular-nums">{contagem[filtro.chave]}</span>
            </button>
          );
        })}

        {filaAtual === "pendente" && selecionados.length > 0 ? (
          <Button size="sm" className="ml-auto" disabled={executando} onClick={aprovarSelecionados}>
            {executando ? <Loader2 className="animate-spin" /> : <CheckCheck aria-hidden />}
            De acordo com {selecionados.length} selecionado(s)
          </Button>
        ) : null}
      </div>

      {fila.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={filaAtual === "pendente" ? "Nada esperando você" : "Nenhuma nesta lista"}
          description={
            filaAtual === "pendente"
              ? "Quando alguém informar um day off, um afastamento ou uma ausência, o pedido aparece aqui."
              : "Troque o filtro acima para ver as outras."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {fila.map((pedido) => (
            <li key={pedido.id} className="bg-surface-card rounded-card shadow-cartao border p-4">
              <div className="flex flex-wrap items-start gap-3">
                {filaAtual === "pendente" ? (
                  <input
                    type="checkbox"
                    className="accent-brand mt-1.5 size-4"
                    checked={selecionados.includes(pedido.id)}
                    aria-label={`Selecionar o pedido de ${pedido.pessoa?.nome ?? "—"}`}
                    onChange={(evento) =>
                      setSelecionados((atual) =>
                        evento.target.checked
                          ? [...atual, pedido.id]
                          : atual.filter((i) => i !== pedido.id),
                      )
                    }
                  />
                ) : null}

                <UserAvatar
                  name={pedido.pessoa?.nome ?? "—"}
                  src={pedido.pessoa?.avatarUrl}
                  size="md"
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold tracking-[-0.02em]">
                      {pedido.pessoa?.nome ?? "—"}
                    </span>
                    <Badge variant="secondary">{pedido.pessoa?.area ?? "Sem área"}</Badge>
                    <Badge variant="outline">{ROTULOS_DE_TIPO[pedido.tipo]}</Badge>
                  </div>

                  <p className="text-sm tabular-nums">
                    {format(parseISO(pedido.data_inicio), "dd/MM/yyyy")} a{" "}
                    {format(parseISO(pedido.data_fim), "dd/MM/yyyy")} ·{" "}
                    <strong>{rotuloDosDias(pedido.tipo, pedido.dias_uteis)}</strong>
                  </p>

                  {pedido.motivo ? (
                    <p className="text-text-secondary text-sm">“{pedido.motivo}”</p>
                  ) : null}

                  {pedido.colegasFora.length > 0 ? (
                    <p className="bg-warning-soft text-warning mt-2 flex items-start gap-2 rounded-md p-2 text-xs">
                      <Users aria-hidden className="mt-px size-3.5 shrink-0" />
                      <span>
                        Da mesma área, já {pedido.colegasFora.length === 1 ? "está" : "estão"} fora
                        neste período:{" "}
                        {pedido.colegasFora
                          .map(
                            (c) =>
                              `${c.nome} (${format(parseISO(c.inicio), "dd/MM")}–${format(
                                parseISO(c.fim),
                                "dd/MM",
                              )})`,
                          )
                          .join(", ")}
                        .
                      </span>
                    </p>
                  ) : null}

                  {pedido.status === "reprovada" && pedido.motivo_reprovacao ? (
                    <p className="text-text-secondary text-sm">
                      Remarcar: {pedido.motivo_reprovacao}
                    </p>
                  ) : null}

                  {/* O MOTIVO DO CANCELAMENTO (0106), em `--warning` e nunca
                      `--danger`: o período foi desfeito, não houve erro — a
                      mesma régua do alerta de 7 dias do portal. Ele some
                      quando quem cancelou foi a própria pessoa, que não
                      escreve motivo nenhum, e aí o selo "Cancelada" é a
                      resposta inteira. */}
                  {pedido.status === "cancelada" && pedido.motivo_cancelamento ? (
                    <p className="bg-warning-soft text-warning mt-2 rounded-md p-2 text-xs">
                      Cancelado pela agência: {pedido.motivo_cancelamento}
                    </p>
                  ) : null}
                </div>

                <span className="text-text-muted shrink-0 text-xs tabular-nums">
                  informado em {format(parseISO(pedido.created_at), "dd/MM/yy", { locale: ptBR })}
                </span>
              </div>

              {/* OS DOIS BOTÕES DESCERAM PARA O PÉ DO CARTÃO, e não é
                  arrumação: eles ficavam numa coluna à direita, na altura do
                  NOME — ou seja, ao lado do aviso de quem da mesma área já
                  está fora, e não abaixo dele. A informação que decide um
                  "preciso remarcar" é exatamente esse aviso, e um botão que
                  divide a linha com ele pode ser clicado sem que ele tenha
                  sido lido. No pé, ele está sempre acima da decisão. */}
              {pedido.status === "pendente" ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    className="rounded-full px-5"
                    disabled={executando}
                    onClick={() => aprovar(pedido.id)}
                  >
                    De acordo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-5"
                    disabled={executando}
                    onClick={() => abrir(pedido, "remarcar")}
                  >
                    Preciso remarcar
                  </Button>
                </div>
              ) : null}

              {/* CANCELAR O QUE JÁ FOI COMBINADO (0106), e ele mora na fila
                  "De acordo" em vez de numa seção nova: é lá que o sócio
                  encontra o que ele combinou, e a fila já existia. Um bloco
                  próprio seria um segundo lugar listando as mesmas linhas.

                  O botão SOME depois de o período começar, e não aparece
                  desligado: a razão — "tem dias vividos" — não é um passo que
                  falta, é uma porta que fechou, e um botão permanentemente
                  desligado em toda linha antiga é ruído. Quem recusa de
                  verdade é o banco, nomeando a data. */}
              {pedido.status === "aprovada" && podeCancelar(pedido, hojeISO) ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-5"
                    disabled={executando}
                    onClick={() => abrir(pedido, "cancelar")}
                  >
                    Cancelar o período
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* UM DIÁLOGO PARA AS DUAS AÇÕES, e o que troca é o texto: as duas
          pedem um motivo, e a diferença é quem o cobra. Dois diálogos seriam
          dois tratamentos do mesmo campo, e o que divergiria é o do
          cancelamento — o que o sócio usa menos. */}
      <Dialog open={emFoco !== null} onOpenChange={(aberto) => !aberto && setEmFoco(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {emFoco?.acao === "cancelar"
                ? souODono
                  ? "Cancelar este período combinado?"
                  : `Cancelar o período de ${emFoco?.pedido.pessoa?.nome ?? "—"}?`
                : `Pedir para ${emFoco?.pedido.pessoa?.nome ?? "—"} remarcar?`}
            </DialogTitle>
            {/* A DESCRIÇÃO DIZ O QUE ACONTECE, e ela é diferente nas duas: o
                "remarcar" devolve um pedido para quem o fez, o cancelamento
                apaga dias que já estão PINTADOS na matriz e devolve o saldo —
                e quem combinou precisa saber disso antes de clicar. "Tem
                certeza?" não informa nada, que é a decisão do diálogo de
                apagar campanha. */}
            <DialogDescription>
              {emFoco?.acao === "cancelar" ? (
                <>
                  Os dias saem da matriz, o saldo volta
                  {souODono ? "" : " para a pessoa"}, e o aviso chega pelo sino.
                  {motivoObrigatorio
                    ? " O motivo é obrigatório — é o que ela vai ler."
                    : ""}
                </>
              ) : (
                <>
                  O motivo não é obrigatório, mas vale escrever: um &ldquo;remarca&rdquo; sem
                  explicação volta como pergunta, e a conversa acontece de qualquer forma — só
                  que fora do sistema.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            autoFocus
            rows={3}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            aria-label={emFoco?.acao === "cancelar" ? "Motivo do cancelamento" : "Motivo"}
            placeholder={
              emFoco?.acao === "cancelar"
                ? "Precisamos de você na semana do lançamento da Mundo Verde."
                : "A Marina já está fora nessa semana e ficaríamos sem design."
            }
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmFoco(null)}>
              Voltar
            </Button>
            {/* DESLIGADO COM A RAZÃO ESCRITA quando o motivo falta, em vez de
                aceitar e levar a recusa do banco: a trava é dele, e esta
                linha existe só para dizer o que falta antes do clique. */}
            <Button
              variant="destructive"
              disabled={executando || motivoEmFalta}
              onClick={confirmar}
            >
              {executando ? <Loader2 className="animate-spin" /> : null}
              {emFoco?.acao === "cancelar"
                ? motivoEmFalta
                  ? "Escreva o motivo"
                  : "Cancelar o período"
                : "Pedir para remarcar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
