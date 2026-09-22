"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { EntregaDaSemana } from "@/lib/dados/resumo-semanal";
import {
  chaveDaSemana,
  deslocarSemana,
  ehFutura,
  nomeDaSemana,
  rotuloDaSemana,
} from "@/lib/dominio/semanas";

import { criarEntrega, editarEntrega, excluirEntrega } from "./acoes";

const SEM_VALOR = "__sem__";

type Subtarefa = { id: string; titulo: string; cliente: string | null; clientId: string | null };

/**
 * O Resumo Semanal, uma semana por vez.
 *
 * A semana está na URL (`?semana=2026-09-21`), não em estado: o link tem que
 * poder ser colado e voltar à mesma tela, e um F5 no meio do preenchimento não
 * pode jogar a pessoa de volta para hoje.
 *
 * `hojeISO` e `inicioISO` vêm do servidor. Se cada tela lesse o próprio
 * relógio, o navegador em outro fuso classificaria a mesma entrega em semanas
 * diferentes — a mesma razão pela qual as contagens de Minhas Tasks são
 * calculadas no servidor.
 */
export function SemanaDeEntregas({
  entregas,
  clientes,
  subtarefas,
  inicioISO,
  hojeISO,
  abrirNova,
}: {
  entregas: EntregaDaSemana[];
  clientes: { id: string; nome_empresa: string }[];
  subtarefas: Subtarefa[];
  inicioISO: string;
  hojeISO: string;
  abrirNova: boolean;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [salvando, iniciar] = useTransition();

  const inicio = parseISO(inicioISO);
  const hoje = parseISO(hojeISO);

  // A data padrão começa em hoje quando hoje cai na semana aberta; olhando
  // para uma semana passada, começa na segunda dela — datar no dia de hoje uma
  // entrega de três semanas atrás seria o erro mais provável.
  const dataPadrao = chaveDaSemana(hoje) === chaveDaSemana(inicio) ? hojeISO : inicioISO;

  // `abrirNova` vem de ?nova=1, o botão da tela inicial. O diálogo já NASCE
  // aberto em vez de um efeito abri-lo depois: abrir por efeito significa
  // pintar a tela fechada e então reabrir, o que pisca — e o compilador do
  // React reclama, com razão, de setState no corpo de um efeito.
  const [editando, setEditando] = useState<EntregaDaSemana | "nova" | null>(
    abrirNova ? "nova" : null,
  );
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(dataPadrao);
  const [cliente, setCliente] = useState(SEM_VALOR);
  const [subtarefa, setSubtarefa] = useState(SEM_VALOR);

  // Limpa o ?nova=1 da barra de endereço depois que o diálogo já abriu. Sem
  // isso, voltar no histórico do navegador reabriria o diálogo sozinho, e o
  // link copiado desta tela carregaria um formulário aberto para quem o
  // recebesse.
  useEffect(() => {
    if (!abrirNova) return;
    const destino = new URLSearchParams(parametros.toString());
    destino.delete("nova");
    router.replace(destino.size > 0 ? `?${destino.toString()}` : "?", { scroll: false });
  }, [abrirNova, parametros, router]);

  function irPara(novaSemana: Date) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("semana", chaveDaSemana(novaSemana));
    router.push(`?${destino.toString()}`);
  }

  function abrir(alvo: EntregaDaSemana | "nova") {
    setEditando(alvo);
    if (alvo === "nova") {
      setDescricao("");
      setData(dataPadrao);
      setCliente(SEM_VALOR);
      setSubtarefa(SEM_VALOR);
      return;
    }
    setDescricao(alvo.descricao);
    setData(alvo.data);
    setCliente(alvo.cliente?.id ?? SEM_VALOR);
    setSubtarefa(alvo.subtarefa?.id ?? SEM_VALOR);
  }

  /** Escolher a subtarefa preenche a descrição e o cliente, se estiverem vazios. */
  function escolherSubtarefa(valor: string) {
    setSubtarefa(valor);
    if (valor === SEM_VALOR) return;
    const escolhida = subtarefas.find((s) => s.id === valor);
    if (!escolhida) return;
    if (descricao.trim() === "") setDescricao(escolhida.titulo);
    if (cliente === SEM_VALOR && escolhida.clientId) setCliente(escolhida.clientId);
  }

  function salvar() {
    const carga = {
      descricao,
      data,
      client_id: cliente === SEM_VALOR ? null : cliente,
      subtask_id: subtarefa === SEM_VALOR ? null : subtarefa,
    };

    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        editando === "nova" || editando === null
          ? criarEntrega(carga)
          : editarEntrega(editando.id, carga),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setEditando(null);
        router.refresh();
      }
    });
  }

  const anterior = deslocarSemana(inicio, -1);
  const proxima = deslocarSemana(inicio, 1);
  const naoTemProxima = ehFutura(proxima, hoje);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Semana anterior"
          onClick={() => irPara(anterior)}
        >
          <ChevronLeft aria-hidden />
        </Button>

        <div className="min-w-0">
          <p className="text-text-primary text-sm font-semibold">{nomeDaSemana(inicio, hoje)}</p>
          <p className="text-text-muted text-xs">{rotuloDaSemana(inicio)}</p>
        </div>

        <Button
          variant="outline"
          size="icon"
          aria-label="Próxima semana"
          disabled={naoTemProxima}
          onClick={() => irPara(proxima)}
        >
          <ChevronRight aria-hidden />
        </Button>

        <Button size="sm" className="ml-auto" onClick={() => abrir("nova")}>
          <Plus aria-hidden />
          Adicionar Entrega
        </Button>
      </div>

      {entregas.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma entrega registrada nesta semana"
          description="Anote o que você entregou. É o seu registro — ninguém mais lê, e ele vira a base da sua conversa de desenvolvimento."
        />
      ) : (
        <ul className="space-y-2">
          {entregas.map((entrega) => (
            <li
              key={entrega.id}
              className="bg-surface-card rounded-card flex flex-wrap items-start gap-3 border p-4"
            >
              <span className="text-text-muted w-20 shrink-0 text-xs tabular-nums">
                {format(parseISO(entrega.data), "EEE, dd/MM", { locale: ptBR })}
              </span>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-text-primary text-sm">{entrega.descricao}</p>
                <div className="flex flex-wrap gap-1.5">
                  {entrega.cliente ? (
                    <Badge variant="outline">{entrega.cliente.nome_empresa}</Badge>
                  ) : null}
                  {entrega.subtarefa ? (
                    <Badge variant="secondary">{entrega.subtarefa.titulo}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar "${entrega.descricao}"`}
                  onClick={() => abrir(entrega)}
                >
                  <Pencil aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir "${entrega.descricao}"`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  title="Excluir esta entrega?"
                  description={`“${entrega.descricao}” sai do seu resumo.`}
                  confirmLabel="Excluir"
                  destructive
                  onConfirm={async () => {
                    const resultado = await chamarAcao(() => excluirEntrega(entrega.id));
                    if (!resultado.ok) toast.error(resultado.error);
                    else {
                      toast.success(resultado.mensagem);
                      router.refresh();
                    }
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando === "nova" ? "Adicionar entrega" : "Editar entrega"}
            </DialogTitle>
            <DialogDescription>
              Uma linha por coisa entregue. Este registro é seu — ninguém mais enxerga.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {subtarefas.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="entrega-subtarefa">Veio de uma etapa concluída? (opcional)</Label>
                <Select value={subtarefa} onValueChange={escolherSubtarefa}>
                  <SelectTrigger id="entrega-subtarefa" className="w-full">
                    <SelectValue placeholder="Escolher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>Nenhuma</SelectItem>
                    {subtarefas.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.titulo}
                        {s.cliente ? ` — ${s.cliente}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="entrega-descricao">O que foi entregue</Label>
              <Textarea
                id="entrega-descricao"
                rows={3}
                autoFocus
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Fechei a arte da campanha de outubro."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entrega-data">Data</Label>
                <Input
                  id="entrega-data"
                  type="date"
                  value={data}
                  onChange={(evento) => setData(evento.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entrega-cliente">Cliente (opcional)</Label>
                <Select value={cliente} onValueChange={setCliente}>
                  <SelectTrigger id="entrega-cliente" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>Sem cliente</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || descricao.trim().length < 3}>
              {salvando ? <Loader2 className="animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
