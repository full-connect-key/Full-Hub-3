"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileSignature, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SeletorDeMes } from "@/components/shared/seletor-de-mes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { ContratoComCliente } from "@/lib/dados/financeiro";
import {
  formatarDinheiro,
  lerDinheiro,
  ROTULOS_DE_RECORRENCIA,
  VEZES_POR_ANO,
} from "@/lib/dominio/financeiro";
import type { ContratoRecorrencia } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { excluirContrato, gerarLancamentosDoMes, salvarContrato } from "./acoes";

/**
 * Os contratos e o botão que os transforma em receita prevista.
 *
 * "Gerar lançamentos do mês" não roda sozinho ao virar o mês, e é decisão, não
 * esquecimento: receita que aparece no sistema sem ninguém ter mandado é
 * receita que o sócio vai conferir uma por uma antes de confiar no relatório.
 * Clicar custa menos que desconfiar.
 *
 * Rodar duas vezes não duplica — a trava é o índice único
 * `(contract_id, competencia)` no Postgres, não a contagem desta tela.
 */
export function Contratos({
  contratos,
  clientes,
  competencia,
  quantosPendentes,
}: {
  contratos: ContratoComCliente[];
  clientes: { id: string; nome_empresa: string }[];
  competencia: string;
  quantosPendentes: number;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<ContratoComCliente | "novo" | null>(null);
  const [gerando, iniciar] = useTransition();

  const recorrenteMensal = contratos
    .filter((c) => c.ativo && VEZES_POR_ANO[c.recorrencia] > 0)
    .reduce((t, c) => t + (Number(c.valor) * VEZES_POR_ANO[c.recorrencia]) / 12, 0);

  function gerar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => gerarLancamentosDoMes(competencia));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorDeMes competencia={competencia} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={gerando} onClick={gerar}>
            {gerando ? <Loader2 className="animate-spin" /> : <Sparkles aria-hidden />}
            Gerar lançamentos do mês
            {quantosPendentes > 0 ? ` (${quantosPendentes})` : ""}
          </Button>
          <Button size="sm" onClick={() => setEditando("novo")}>
            <Plus aria-hidden />
            Novo contrato
          </Button>
        </div>
      </div>

      <p className="text-text-secondary text-sm">
        Receita recorrente contratada:{" "}
        <strong className="text-text-primary tabular-nums">
          {formatarDinheiro(recorrenteMensal)}
        </strong>{" "}
        por mês.{" "}
        {quantosPendentes === 0 ? (
          <span className="text-text-muted">
            Os contratos que cobram neste mês já têm lançamento.
          </span>
        ) : (
          <span className="text-text-muted">
            {quantosPendentes} contrato(s) ainda sem lançamento neste mês.
          </span>
        )}
      </p>

      {contratos.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nenhum contrato cadastrado"
          description="O contrato é o que faz a receita prevista de cada mês aparecer sozinha, em vez de ser digitada doze vezes por ano."
          action={
            <Button size="sm" onClick={() => setEditando("novo")}>
              <Plus aria-hidden />
              Cadastrar o primeiro
            </Button>
          }
        />
      ) : (
        <ul className="bg-surface-card rounded-card divide-y border">
          {contratos.map((contrato) => (
            <li
              key={contrato.id}
              className={cn("flex flex-wrap items-center gap-3 p-4", !contrato.ativo && "opacity-60")}
            >
              <div className="min-w-48 flex-1">
                <p className="text-text-primary text-sm font-medium">{contrato.nome}</p>
                <p className="text-text-muted text-xs">
                  {contrato.cliente?.nome_empresa ?? "Cliente removido"}
                </p>
              </div>

              <Badge variant="secondary">{ROTULOS_DE_RECORRENCIA[contrato.recorrencia]}</Badge>
              {!contrato.ativo ? <Badge variant="outline">Inativo</Badge> : null}

              <div className="text-right">
                <p className="text-text-primary text-sm tabular-nums">
                  {formatarDinheiro(Number(contrato.valor))}
                </p>
                {contrato.dia_vencimento ? (
                  <p className="text-text-muted text-xs">vence dia {contrato.dia_vencimento}</p>
                ) : null}
              </div>

              <p className="text-text-muted w-44 text-xs">
                {format(parseISO(contrato.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                {contrato.data_fim
                  ? ` até ${format(parseISO(contrato.data_fim), "dd/MM/yyyy", { locale: ptBR })}`
                  : " — sem fim definido"}
              </p>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${contrato.nome}`}
                  onClick={() => setEditando(contrato)}
                >
                  <Pencil aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${contrato.nome}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  title={`Excluir ${contrato.nome}?`}
                  description="Contrato que já gerou lançamento não é excluído — o sistema recusa e sugere desativar, para o histórico continuar explicando de onde veio cada receita."
                  confirmLabel="Excluir"
                  destructive
                  onConfirm={async () => {
                    const resultado = await chamarAcao(() => excluirContrato(contrato.id));
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

      <Dialog open={editando !== null} onOpenChange={(a) => !a && setEditando(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando === "novo" ? "Novo contrato" : "Editar contrato"}</DialogTitle>
            <DialogDescription>
              A recorrência conta a partir do mês de início: um contrato anual assinado em março
              cobra em março, não em janeiro.
            </DialogDescription>
          </DialogHeader>

          {editando !== null ? (
            <CamposDoContrato
              key={editando === "novo" ? "novo" : editando.id}
              contrato={editando === "novo" ? null : editando}
              clientes={clientes}
              aoFechar={() => setEditando(null)}
              aoSalvar={() => {
                setEditando(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CamposDoContrato({
  contrato,
  clientes,
  aoFechar,
  aoSalvar,
}: {
  contrato: ContratoComCliente | null;
  clientes: { id: string; nome_empresa: string }[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [salvando, iniciar] = useTransition();

  const [clientId, setClientId] = useState(contrato?.client_id ?? "");
  const [nome, setNome] = useState(contrato?.nome ?? "");
  const [valor, setValor] = useState(
    contrato ? Number(contrato.valor).toFixed(2).replace(".", ",") : "",
  );
  const [recorrencia, setRecorrencia] = useState<ContratoRecorrencia>(
    contrato?.recorrencia ?? "mensal",
  );
  const [diaVencimento, setDiaVencimento] = useState(
    contrato?.dia_vencimento ? String(contrato.dia_vencimento) : "",
  );
  const [dataInicio, setDataInicio] = useState(contrato?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(contrato?.data_fim ?? "");
  const [ativo, setAtivo] = useState(contrato?.ativo ?? true);
  const [observacoes, setObservacoes] = useState(contrato?.observacoes ?? "");

  const valorLido = lerDinheiro(valor);
  const valorInvalido = valor.trim() !== "" && (valorLido === undefined || valorLido === null);

  function enviar() {
    if (valorLido === undefined || valorLido === null || valorLido <= 0) {
      toast.error("Informe o valor do contrato.");
      return;
    }
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        salvarContrato(contrato?.id ?? null, {
          client_id: clientId,
          nome,
          valor: valorLido,
          recorrencia,
          dia_vencimento: diaVencimento ? Number(diaVencimento) : null,
          data_inicio: dataInicio,
          data_fim: dataFim || null,
          ativo,
          observacoes: observacoes || null,
        }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        aoSalvar();
      }
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ct-cliente">Cliente *</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="ct-cliente" className="w-full">
              <SelectValue placeholder="Escolha a empresa" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ct-nome">Nome do contrato *</Label>
          <Input
            id="ct-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Fee mensal — social media"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ct-valor">Valor *</Label>
          <Input
            id="ct-valor"
            inputMode="decimal"
            placeholder="4.500,00"
            aria-invalid={valorInvalido}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ct-recorrencia">Recorrência</Label>
          <Select
            value={recorrencia}
            onValueChange={(v) => setRecorrencia(v as ContratoRecorrencia)}
          >
            <SelectTrigger id="ct-recorrencia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROTULOS_DE_RECORRENCIA) as ContratoRecorrencia[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROTULOS_DE_RECORRENCIA[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {recorrencia === "pontual" ? (
            <p className="text-text-muted text-xs">
              Cobra uma vez só, no mês de início. Não entra na receita recorrente.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ct-dia">Dia do vencimento</Label>
          <Input
            id="ct-dia"
            type="number"
            min={1}
            max={31}
            value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)}
            placeholder="10"
          />
          <p className="text-text-muted text-xs">Dia 31 em fevereiro vira o último dia do mês.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ct-inicio">Início da vigência *</Label>
          <Input
            id="ct-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ct-fim">Fim da vigência</Label>
          <Input
            id="ct-fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Switch id="ct-ativo" checked={ativo} onCheckedChange={setAtivo} />
          <Label htmlFor="ct-ativo" className="font-normal">
            Contrato ativo — gera lançamento todo mês em que cobra
          </Label>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ct-obs">Observações</Label>
          <Textarea
            id="ct-obs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button
          onClick={enviar}
          disabled={salvando || !clientId || nome.trim().length < 2 || !dataInicio || valorInvalido}
        >
          {salvando ? <Loader2 className="animate-spin" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </>
  );
}
