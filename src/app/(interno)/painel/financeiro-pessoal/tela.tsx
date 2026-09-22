"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CopyPlus,
  Download,
  Loader2,
  Lock,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { GraficoDeBarras } from "@/components/shared/grafico-de-barras";
import { GraficoDeSaldo } from "@/components/shared/grafico-de-saldo";
import { SeletorDeMes } from "@/components/shared/seletor-de-mes";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { MesPessoal } from "@/lib/dados/financeiro-pessoal";
import { formatarDinheiro, lerDinheiro, montarCSV } from "@/lib/dominio/financeiro";
import type { PersonalFinanceEntry, PfTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  apagarTudoDoFinanceiroPessoal,
  criarLancamentoPessoal,
  editarLancamentoPessoal,
  excluirLancamentoPessoal,
  replicarRecorrentes,
} from "./acoes";

/**
 * O Financeiro Pessoal.
 *
 * MÓDULO OPCIONAL, e a tela diz isso em vez de fingir que é obrigatório: o
 * aviso de primeira visita explica de quem são os dados, o módulo não aparece
 * na tela inicial, não manda notificação e não tem selo de pendência. Quem
 * não quiser usar nunca é lembrado de que ele existe.
 *
 * "Apagar todos os meus dados" existe pela mesma razão: um módulo do qual não
 * se consegue sair não é opcional.
 */

const CATEGORIAS_SUGERIDAS = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Renda",
  "Investimento",
  "Outros",
];

export function FinanceiroPessoal({
  lancamentos,
  meses,
  porCategoria,
  competencia,
  hojeISO,
  primeiraVisita,
  quantosRecorrentes,
}: {
  lancamentos: PersonalFinanceEntry[];
  meses: MesPessoal[];
  porCategoria: { nome: string; valor: number }[];
  competencia: string;
  hojeISO: string;
  primeiraVisita: boolean;
  quantosRecorrentes: number;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [avisoAberto, setAvisoAberto] = useState(primeiraVisita);
  const [editando, setEditando] = useState<PersonalFinanceEntry | null>(null);

  const doMes = meses[meses.length - 1] ?? { entradas: 0, saidas: 0, saldo: 0 };

  function replicar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => replicarRecorrentes(competencia));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  function exportar() {
    const csv = montarCSV(
      ["data", "tipo", "descricao", "categoria", "valor", "recorrente"],
      lancamentos.map((l) => [
        l.data,
        l.tipo === "entrada" ? "Entrada" : "Saída",
        l.descricao,
        l.categoria ?? "",
        Number(l.valor).toFixed(2).replace(".", ","),
        l.recorrente ? "sim" : "não",
      ]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro-pessoal-${competencia.slice(0, 7)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {avisoAberto ? (
        <div className="bg-blue-soft rounded-card relative border p-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar aviso"
            className="absolute top-2 right-2 size-7"
            onClick={() => setAvisoAberto(false)}
          >
            <X aria-hidden />
          </Button>
          <p className="text-text-primary flex items-center gap-2 text-sm font-medium">
            <Lock aria-hidden className="size-4" />
            Módulo opcional
          </p>
          <p className="text-text-secondary mt-1 max-w-2xl text-sm">
            Estes dados são privados e visíveis apenas para você — nem a gestão tem acesso. Ninguém
            precisa usar este módulo, e dá para apagar tudo a qualquer momento, sem deixar rastro.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SeletorDeMes competencia={competencia} />

        <div className="ml-auto flex flex-wrap gap-2">
          {quantosRecorrentes > 0 ? (
            <Button variant="outline" size="sm" disabled={salvando} onClick={replicar}>
              {salvando ? <Loader2 className="animate-spin" /> : <CopyPlus aria-hidden />}
              Repetir {quantosRecorrentes} no mês seguinte
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={lancamentos.length === 0} onClick={exportar}>
            <Download aria-hidden />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao rotulo="Entradas" valor={doMes.entradas} />
        <Cartao rotulo="Saídas" valor={doMes.saidas} />
        <Cartao rotulo="Saldo do mês" valor={doMes.saldo} colorirPeloSinal />
      </div>

      <AdicaoRapida
        competencia={competencia}
        hojeISO={hojeISO}
        aoLancar={() => router.refresh()}
      />

      {lancamentos.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Nenhum lançamento neste mês"
          description="Anote uma entrada ou uma saída na linha acima. É o seu controle — ninguém mais enxerga."
        />
      ) : (
        <ul className="bg-surface-card rounded-card divide-y border">
          {lancamentos.map((lancamento) => (
            <li key={lancamento.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="text-text-muted w-16 shrink-0 text-xs tabular-nums">
                {format(parseISO(lancamento.data), "dd/MM", { locale: ptBR })}
              </span>

              <div className="min-w-32 flex-1">
                <p className="text-text-primary text-sm">{lancamento.descricao}</p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {lancamento.categoria ? (
                    <Badge variant="outline">{lancamento.categoria}</Badge>
                  ) : null}
                  {lancamento.recorrente ? <Badge variant="secondary">Recorrente</Badge> : null}
                </div>
              </div>

              <span
                className={cn(
                  "shrink-0 text-sm tabular-nums",
                  lancamento.tipo === "entrada" ? "text-success" : "text-text-primary",
                )}
              >
                {lancamento.tipo === "entrada" ? "+" : "−"}
                {formatarDinheiro(Number(lancamento.valor))}
              </span>

              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${lancamento.descricao}`}
                  onClick={() => setEditando(lancamento)}
                >
                  <Pencil aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${lancamento.descricao}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  title="Excluir este lançamento?"
                  description={`“${lancamento.descricao}” sai do seu controle.`}
                  confirmLabel="Excluir"
                  destructive
                  onConfirm={async () => {
                    const resultado = await chamarAcao(() =>
                      excluirLancamentoPessoal(lancamento.id),
                    );
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-surface-card rounded-card border p-4">
          <h2 className="text-text-primary mb-3 text-sm font-semibold">Saldo dos últimos 6 meses</h2>
          <GraficoDeSaldo
            meses={meses.map((m) => ({
              rotulo: format(parseISO(m.competencia), "MMM", { locale: ptBR }),
              valor: m.saldo,
            }))}
            formatarValor={formatarDinheiro}
          />
        </section>

        <section className="bg-surface-card rounded-card border p-4">
          <h2 className="text-text-primary mb-3 text-sm font-semibold">Saídas por categoria</h2>
          {porCategoria.length === 0 ? (
            <p className="text-text-muted rounded-card border border-dashed p-8 text-center text-sm">
              Nenhuma saída neste mês.
            </p>
          ) : (
            <GraficoDeBarras
              barras={porCategoria}
              formatarValor={formatarDinheiro}
              cor="serie-2"
            />
          )}
        </section>
      </div>

      <ZonaDeSaida />

      <EdicaoDeLancamento
        lancamento={editando}
        aoFechar={() => setEditando(null)}
        aoSalvar={() => {
          setEditando(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  colorirPeloSinal,
}: {
  rotulo: string;
  valor: number;
  colorirPeloSinal?: boolean;
}) {
  return (
    <div className="bg-surface-card rounded-card border p-4">
      <p className="text-text-muted text-xs">{rotulo}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          colorirPeloSinal && valor < 0 && "text-danger",
          colorirPeloSinal && valor >= 0 && "text-success",
          !colorirPeloSinal && "text-text-primary",
        )}
      >
        {formatarDinheiro(valor)}
      </p>
    </div>
  );
}

/**
 * Uma linha só para lançar.
 *
 * Diálogo para cada gasto de padaria mataria o hábito na primeira semana. A
 * linha fica sempre visível, aceita Enter, e depois de lançar mantém o foco e
 * a data — quem está pondo o mês em dia lança cinco seguidos.
 */
function AdicaoRapida({
  competencia,
  hojeISO,
  aoLancar,
}: {
  competencia: string;
  hojeISO: string;
  aoLancar: () => void;
}) {
  const [tipo, setTipo] = useState<PfTipo>("saida");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  // Olhando o mês corrente, a data começa em hoje; olhando um mês passado,
  // começa no dia 1 dele — datar no dia de hoje um gasto de três meses atrás
  // seria o erro mais provável.
  const [data, setData] = useState(
    competencia.slice(0, 7) === hojeISO.slice(0, 7) ? hojeISO : competencia,
  );
  const [recorrente, setRecorrente] = useState(false);
  const [salvando, iniciar] = useTransition();

  const valorLido = lerDinheiro(valor);
  const pronto = descricao.trim().length >= 2 && typeof valorLido === "number" && valorLido > 0;

  function lancar() {
    if (!pronto) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        criarLancamentoPessoal({
          tipo,
          descricao,
          categoria: categoria || null,
          valor: valorLido,
          data,
          recorrente,
        }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setDescricao("");
        setValor("");
        setRecorrente(false);
        aoLancar();
      }
    });
  }

  return (
    <div className="bg-surface-card rounded-card border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="pf-descricao" className="text-xs">
            O que foi
          </Label>
          <Input
            id="pf-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lancar()}
            placeholder="Mercado"
          />
        </div>

        <div className="w-28 space-y-1.5">
          <Label htmlFor="pf-valor" className="text-xs">
            Valor
          </Label>
          <Input
            id="pf-valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lancar()}
            placeholder="0,00"
          />
        </div>

        <div className="w-36 space-y-1.5">
          <Label htmlFor="pf-categoria" className="text-xs">
            Categoria
          </Label>
          <Input
            id="pf-categoria"
            list="pf-categorias"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Alimentação"
          />
          {/* `datalist` e não `select`: as sugestões ajudam, mas o controle é
              da pessoa — é o gasto dela, e a lista da casa não tem por que
              limitar. */}
          <datalist id="pf-categorias">
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="w-36 space-y-1.5">
          <Label htmlFor="pf-data" className="text-xs">
            Data
          </Label>
          <Input
            id="pf-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        <div className="w-28 space-y-1.5">
          <Label htmlFor="pf-tipo" className="text-xs">
            Tipo
          </Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as PfTipo)}>
            <SelectTrigger id="pf-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button disabled={!pronto || salvando} onClick={lancar}>
          {salvando ? <Loader2 className="animate-spin" /> : <Plus aria-hidden />}
          Lançar
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Switch id="pf-recorrente" checked={recorrente} onCheckedChange={setRecorrente} />
        <Label htmlFor="pf-recorrente" className="text-text-secondary text-xs font-normal">
          Recorrente — aparece no botão de repetir para o mês seguinte
        </Label>
      </div>
    </div>
  );
}

function EdicaoDeLancamento({
  lancamento,
  aoFechar,
  aoSalvar,
}: {
  lancamento: PersonalFinanceEntry | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  return (
    <Dialog open={lancamento !== null} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            Este registro é seu. Ninguém mais o enxerga, nem a gestão.
          </DialogDescription>
        </DialogHeader>

        {lancamento ? (
          /* `key` remonta o formulário a cada lançamento aberto, e é o que
             permite o estado nascer dos props sem um efeito de sincronização
             — o mesmo caminho do formulário de lançamento do financeiro. */
          <CamposDaEdicao
            key={lancamento.id}
            lancamento={lancamento}
            aoFechar={aoFechar}
            aoSalvar={aoSalvar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CamposDaEdicao({
  lancamento,
  aoFechar,
  aoSalvar,
}: {
  lancamento: PersonalFinanceEntry;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [salvando, iniciar] = useTransition();
  const [tipo, setTipo] = useState<PfTipo>(lancamento.tipo);
  const [descricao, setDescricao] = useState(lancamento.descricao);
  const [valor, setValor] = useState(Number(lancamento.valor).toFixed(2).replace(".", ","));
  const [categoria, setCategoria] = useState(lancamento.categoria ?? "");
  const [data, setData] = useState(lancamento.data);
  const [recorrente, setRecorrente] = useState(lancamento.recorrente);

  const valorLido = lerDinheiro(valor);
  const pronto = descricao.trim().length >= 2 && typeof valorLido === "number" && valorLido > 0;

  function salvar() {
    if (!pronto) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        editarLancamentoPessoal(lancamento.id, {
          tipo,
          descricao,
          categoria: categoria || null,
          valor: valorLido,
          data,
          recorrente,
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
          <Label htmlFor="ed-descricao">O que foi</Label>
          <Input
            id="ed-descricao"
            autoFocus
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ed-valor">Valor</Label>
          <Input
            id="ed-valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ed-tipo">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as PfTipo)}>
            <SelectTrigger id="ed-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ed-categoria">Categoria</Label>
          <Input
            id="ed-categoria"
            list="pf-categorias"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ed-data">Data</Label>
          <Input id="ed-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Switch id="ed-recorrente" checked={recorrente} onCheckedChange={setRecorrente} />
          <Label htmlFor="ed-recorrente" className="font-normal">
            Recorrente
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={!pronto || salvando}>
          {salvando ? <Loader2 className="animate-spin" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * A saída do módulo.
 *
 * Duas etapas de propósito: a primeira abre a zona, a segunda confirma o
 * apagamento com o texto dizendo o que vai acontecer. Um botão só, mesmo com
 * confirmação, fica perto demais de um clique errado — e aqui não há desfazer.
 */
function ZonaDeSaida() {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [apagando, iniciar] = useTransition();

  if (!aberta) {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-text-muted text-xs" onClick={() => setAberta(true)}>
          Quero sair deste módulo
        </Button>
      </div>
    );
  }

  return (
    <section className="border-destructive/30 rounded-card space-y-3 border p-4">
      <div>
        <h2 className="text-destructive text-sm font-semibold">Apagar todos os meus dados</h2>
        <p className="text-text-secondary mt-1 max-w-2xl text-sm">
          Todos os seus lançamentos deste e de qualquer outro mês são apagados. Não dá para
          desfazer, e nada disso vai para relatório nenhum — nunca foi. O módulo continua
          disponível se você mudar de ideia, só estará vazio.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="sm" disabled={apagando}>
              {apagando ? <Loader2 className="animate-spin" /> : <Trash2 aria-hidden />}
              Apagar tudo
            </Button>
          }
          title="Apagar todos os seus lançamentos?"
          description="Isto remove cada entrada e cada saída que você registrou, de todos os meses. Não existe desfazer."
          confirmLabel="Apagar tudo, sem volta"
          destructive
          onConfirm={() => {
            iniciar(async () => {
              const resultado = await chamarAcao(() => apagarTudoDoFinanceiroPessoal());
              if (!resultado.ok) toast.error(resultado.error);
              else {
                toast.success(resultado.mensagem);
                setAberta(false);
                router.refresh();
              }
            });
          }}
        />
        <Button variant="outline" size="sm" onClick={() => setAberta(false)}>
          Deixa pra lá
        </Button>
      </div>
    </section>
  );
}
