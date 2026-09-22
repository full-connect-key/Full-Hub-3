"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CircleDollarSign, Download, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FilterBar, SEM_FILTRO } from "@/components/shared/filter-bar";
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
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { LancamentoComRelacoes } from "@/lib/dados/financeiro";
import {
  CORES_DE_STATUS,
  formatarDinheiro,
  lerDinheiro,
  montarCSV,
  ROTULOS_DE_STATUS,
  ROTULOS_DE_TIPO,
  STATUS_ESCOLHIVEIS,
} from "@/lib/dominio/financeiro";
import type { FinanceCategory, FinStatus, FinTipo } from "@/lib/supabase/database.types";

import {
  criarLancamento,
  editarLancamento,
  excluirLancamento,
  importarLancamentosCSV,
  marcarComoPago,
} from "./acoes";

/**
 * Os lançamentos do mês.
 *
 * Os filtros moram na URL, como em toda listagem do produto: o sócio precisa
 * poder mandar "olha as despesas atrasadas de agosto" por mensagem.
 *
 * A SITUAÇÃO mostrada é a derivada (`lancamento.situacao`), não o `status`
 * gravado. É por isso que "Atrasado" aparece sem ninguém ter mexido na linha —
 * e por isso que ele não está entre as opções do formulário: atraso é
 * consequência da data, não uma escolha.
 */

type Cliente = { id: string; nome_empresa: string };

const SEM_VALOR = "__sem__";

export function Lancamentos({
  lancamentos,
  clientes,
  categorias,
  competencia,
  hojeISO,
}: {
  lancamentos: LancamentoComRelacoes[];
  clientes: Cliente[];
  categorias: FinanceCategory[];
  competencia: string;
  hojeISO: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [salvando, iniciar] = useTransition();

  const [editando, setEditando] = useState<LancamentoComRelacoes | "novo" | null>(null);
  const [importando, setImportando] = useState(false);

  const filtroDeTipo = parametros.get("tipo") ?? SEM_FILTRO;
  const filtroDeCliente = parametros.get("cliente") ?? SEM_FILTRO;
  const filtroDeCategoria = parametros.get("categoria") ?? SEM_FILTRO;
  const filtroDeSituacao = parametros.get("situacao") ?? SEM_FILTRO;

  function aplicarFiltro(chave: string, valor: string) {
    const destino = new URLSearchParams(parametros.toString());
    if (valor === SEM_FILTRO) destino.delete(chave);
    else destino.set(chave, valor);
    router.replace(`${pathname}?${destino.toString()}`, { scroll: false });
  }

  function limparFiltros() {
    const destino = new URLSearchParams(parametros.toString());
    for (const chave of ["tipo", "cliente", "categoria", "situacao"]) destino.delete(chave);
    router.replace(`${pathname}?${destino.toString()}`, { scroll: false });
  }

  const visiveis = useMemo(
    () =>
      lancamentos.filter((l) => {
        if (filtroDeTipo !== SEM_FILTRO && l.tipo !== filtroDeTipo) return false;
        if (filtroDeCliente !== SEM_FILTRO && l.client_id !== filtroDeCliente) return false;
        if (filtroDeCategoria !== SEM_FILTRO && l.category_id !== filtroDeCategoria) return false;
        if (filtroDeSituacao !== SEM_FILTRO && l.situacao !== filtroDeSituacao) return false;
        return true;
      }),
    [lancamentos, filtroDeTipo, filtroDeCliente, filtroDeCategoria, filtroDeSituacao],
  );

  const totais = useMemo(() => {
    const conta = (tipo: FinTipo) =>
      visiveis
        .filter((l) => l.tipo === tipo && l.situacao !== "cancelado")
        .reduce((t, l) => t + Number(l.valor), 0);
    return { receita: conta("receita"), despesa: conta("despesa") };
  }, [visiveis]);

  function pagar(lancamento: LancamentoComRelacoes) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => marcarComoPago(lancamento.id, hojeISO));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  function exportar() {
    const csv = montarCSV(
      ["competencia", "tipo", "cliente", "categoria", "descricao", "valor", "vencimento", "pagamento", "situacao"],
      visiveis.map((l) => [
        l.competencia,
        ROTULOS_DE_TIPO[l.tipo],
        l.cliente?.nome_empresa ?? "",
        l.categoria?.nome ?? "",
        l.descricao,
        // Vírgula decimal: o arquivo abre no Excel em português, e lá
        // "1234.56" vira mil duzentos e trinta e quatro vírgula cinquenta e
        // seis só por acidente de configuração.
        Number(l.valor).toFixed(2).replace(".", ","),
        l.vencimento ?? "",
        l.pagamento ?? "",
        ROTULOS_DE_STATUS[l.situacao],
      ]),
    );
    baixar(csv, `lancamentos-${competencia.slice(0, 7)}.csv`);
  }

  const colunas: Column<LancamentoComRelacoes>[] = [
    {
      id: "competencia",
      header: "Competência",
      cell: (l) => (
        <span className="text-text-muted text-xs whitespace-nowrap first-letter:uppercase">
          {format(parseISO(l.competencia), "MMM/yy", { locale: ptBR })}
        </span>
      ),
      sortValue: (l) => l.competencia,
    },
    {
      id: "tipo",
      header: "Tipo",
      cell: (l) => (
        <Badge variant="outline" className="whitespace-nowrap">
          {ROTULOS_DE_TIPO[l.tipo]}
        </Badge>
      ),
      sortValue: (l) => l.tipo,
      searchValue: (l) => ROTULOS_DE_TIPO[l.tipo],
    },
    {
      id: "descricao",
      header: "Descrição",
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{l.descricao}</p>
          {l.contrato ? (
            <p className="text-text-muted truncate text-xs">de {l.contrato.nome}</p>
          ) : l.fornecedor ? (
            <p className="text-text-muted truncate text-xs">{l.fornecedor}</p>
          ) : null}
        </div>
      ),
      sortValue: (l) => l.descricao,
      searchValue: (l) => `${l.descricao} ${l.fornecedor ?? ""} ${l.contrato?.nome ?? ""}`,
    },
    {
      id: "cliente",
      header: "Cliente",
      cell: (l) => (
        <span className="text-text-secondary text-sm">{l.cliente?.nome_empresa ?? "—"}</span>
      ),
      sortValue: (l) => l.cliente?.nome_empresa ?? null,
      searchValue: (l) => l.cliente?.nome_empresa ?? "",
    },
    {
      id: "categoria",
      header: "Categoria",
      cell: (l) => <span className="text-text-secondary text-sm">{l.categoria?.nome ?? "—"}</span>,
      sortValue: (l) => l.categoria?.nome ?? null,
      searchValue: (l) => l.categoria?.nome ?? "",
    },
    {
      id: "valor",
      header: "Valor",
      align: "right",
      cell: (l) => (
        <span className="text-sm tabular-nums whitespace-nowrap">
          {l.tipo === "despesa" ? "−" : ""}
          {formatarDinheiro(Number(l.valor))}
        </span>
      ),
      sortValue: (l) => Number(l.valor),
    },
    {
      id: "vencimento",
      header: "Vencimento",
      cell: (l) => (
        <span className="text-text-secondary text-xs whitespace-nowrap">
          {l.vencimento ? format(parseISO(l.vencimento), "dd/MM/yyyy") : "—"}
        </span>
      ),
      sortValue: (l) => l.vencimento ?? null,
    },
    {
      id: "situacao",
      header: "Situação",
      cell: (l) => (
        <Badge variant="outline" className={`${CORES_DE_STATUS[l.situacao]} border-0 whitespace-nowrap`}>
          {ROTULOS_DE_STATUS[l.situacao]}
        </Badge>
      ),
      sortValue: (l) => l.situacao,
      searchValue: (l) => ROTULOS_DE_STATUS[l.situacao],
    },
    {
      id: "acoes",
      header: "",
      align: "right",
      cell: (l) => (
        <div className="flex justify-end gap-1">
          {l.situacao !== "pago" && l.situacao !== "cancelado" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={salvando}
              onClick={() => pagar(l)}
              className="text-xs"
            >
              Marcar pago
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${l.descricao}`}
            onClick={() => setEditando(l)}
          >
            <Pencil aria-hidden />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Excluir ${l.descricao}`}>
                <Trash2 aria-hidden />
              </Button>
            }
            title="Excluir este lançamento?"
            description={`“${l.descricao}” sai do financeiro. Não dá para desfazer.`}
            confirmLabel="Excluir"
            destructive
            onConfirm={async () => {
              const resultado = await chamarAcao(() => excluirLancamento(l.id));
              if (!resultado.ok) toast.error(resultado.error);
              else {
                toast.success(resultado.mensagem);
                router.refresh();
              }
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorDeMes competencia={competencia} />

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportando(true)}>
            <Upload aria-hidden />
            Importar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download aria-hidden />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setEditando("novo")}>
            <Plus aria-hidden />
            Novo lançamento
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <p className="text-text-secondary text-sm">
          Receitas <strong className="text-text-primary tabular-nums">{formatarDinheiro(totais.receita)}</strong>
        </p>
        <p className="text-text-secondary text-sm">
          Despesas <strong className="text-text-primary tabular-nums">{formatarDinheiro(totais.despesa)}</strong>
        </p>
        <p className="text-text-secondary text-sm">
          Resultado{" "}
          <strong className="text-text-primary tabular-nums">
            {formatarDinheiro(totais.receita - totais.despesa)}
          </strong>
        </p>
      </div>

      <DataTable
        data={visiveis}
        columns={colunas}
        getRowId={(l) => l.id}
        searchPlaceholder="Buscar por descrição, cliente ou fornecedor…"
        pageSize={15}
        initialSort={{ colunaId: "vencimento", direcao: "asc" }}
        emptyIcon={CircleDollarSign}
        emptyTitle="Nenhum lançamento neste mês"
        emptyDescription="Cadastre um lançamento avulso, gere os do contrato na aba Contratos, ou importe um CSV."
        toolbar={
          <FilterBar
            selects={[
              {
                id: "tipo",
                label: "Tipo",
                value: filtroDeTipo,
                allLabel: "Receitas e despesas",
                options: [
                  { value: "receita", label: "Receitas" },
                  { value: "despesa", label: "Despesas" },
                ],
                onChange: (v) => aplicarFiltro("tipo", v),
              },
              {
                id: "cliente",
                label: "Cliente",
                value: filtroDeCliente,
                allLabel: "Todos os clientes",
                options: clientes.map((c) => ({ value: c.id, label: c.nome_empresa })),
                onChange: (v) => aplicarFiltro("cliente", v),
              },
              {
                id: "categoria",
                label: "Categoria",
                value: filtroDeCategoria,
                allLabel: "Todas as categorias",
                options: categorias.map((c) => ({
                  value: c.id,
                  label: `${c.nome} (${ROTULOS_DE_TIPO[c.tipo].toLowerCase()})`,
                })),
                onChange: (v) => aplicarFiltro("categoria", v),
              },
              {
                id: "situacao",
                label: "Situação",
                value: filtroDeSituacao,
                allLabel: "Qualquer situação",
                options: (["previsto", "faturado", "pago", "atrasado", "cancelado"] as FinStatus[]).map(
                  (s) => ({ value: s, label: ROTULOS_DE_STATUS[s] }),
                ),
                onChange: (v) => aplicarFiltro("situacao", v),
              },
            ]}
            onClear={limparFiltros}
          />
        }
      />

      <FormularioDeLancamento
        aberto={editando !== null}
        lancamento={editando === "novo" ? null : editando}
        competencia={competencia}
        clientes={clientes}
        categorias={categorias}
        aoFechar={() => setEditando(null)}
        aoSalvar={() => {
          setEditando(null);
          router.refresh();
        }}
      />

      <ImportadorDeCSV
        aberto={importando}
        competencia={competencia}
        aoFechar={() => setImportando(false)}
        aoImportar={() => {
          setImportando(false);
          router.refresh();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function FormularioDeLancamento({
  aberto,
  lancamento,
  competencia,
  clientes,
  categorias,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  lancamento: LancamentoComRelacoes | null;
  competencia: string;
  clientes: Cliente[];
  categorias: FinanceCategory[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [salvando, iniciar] = useTransition();

  // `key` no Dialog remonta o formulário a cada abertura, e é por isso que o
  // estado pode nascer dos props sem um efeito de sincronização — o mesmo
  // caminho que evitou o setState-em-efeito no Resumo Semanal.
  const chave = lancamento?.id ?? `novo-${competencia}`;

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lancamento ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            Competência é o mês a que o valor se refere. Vencimento e pagamento são outras duas
            datas, e é a diferença entre elas que mostra o que falta receber.
          </DialogDescription>
        </DialogHeader>

        <Campos
          key={chave}
          lancamento={lancamento}
          competencia={competencia}
          clientes={clientes}
          categorias={categorias}
          salvando={salvando}
          aoEnviar={(carga) => {
            iniciar(async () => {
              const resultado = await chamarAcao(() =>
                lancamento ? editarLancamento(lancamento.id, carga) : criarLancamento(carga),
              );
              if (!resultado.ok) toast.error(resultado.error);
              else {
                toast.success(resultado.mensagem);
                aoSalvar();
              }
            });
          }}
          aoCancelar={aoFechar}
        />
      </DialogContent>
    </Dialog>
  );
}

function Campos({
  lancamento,
  competencia,
  clientes,
  categorias,
  salvando,
  aoEnviar,
  aoCancelar,
}: {
  lancamento: LancamentoComRelacoes | null;
  competencia: string;
  clientes: Cliente[];
  categorias: FinanceCategory[];
  salvando: boolean;
  aoEnviar: (carga: Record<string, unknown>) => void;
  aoCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<FinTipo>(lancamento?.tipo ?? "receita");
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState(
    lancamento ? Number(lancamento.valor).toFixed(2).replace(".", ",") : "",
  );
  const [mes, setMes] = useState((lancamento?.competencia ?? competencia).slice(0, 7));
  const [vencimento, setVencimento] = useState(lancamento?.vencimento ?? "");
  const [pagamento, setPagamento] = useState(lancamento?.pagamento ?? "");
  const [status, setStatus] = useState<FinStatus>(
    lancamento && STATUS_ESCOLHIVEIS.includes(lancamento.status) ? lancamento.status : "previsto",
  );
  const [cliente, setCliente] = useState(lancamento?.client_id ?? SEM_VALOR);
  const [categoria, setCategoria] = useState(lancamento?.category_id ?? SEM_VALOR);
  const [fornecedor, setFornecedor] = useState(lancamento?.fornecedor ?? "");
  const [observacoes, setObservacoes] = useState(lancamento?.observacoes ?? "");

  const valorLido = lerDinheiro(valor);
  const valorInvalido = valor.trim() !== "" && (valorLido === undefined || valorLido === null || valorLido === 0);

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  function enviar() {
    if (valorLido === undefined || valorLido === null || valorLido === 0) {
      toast.error("Informe um valor. Aceita 1.234,56 ou 1234,56.");
      return;
    }
    aoEnviar({
      tipo,
      descricao,
      valor: Math.abs(valorLido),
      competencia: `${mes}-01`,
      vencimento: vencimento || null,
      // Preencher a data de pagamento já marca como pago — é o que o trigger
      // do banco faz de qualquer jeito, e a tela não pode discordar dele.
      pagamento: pagamento || null,
      status: pagamento ? "pago" : status,
      client_id: cliente === SEM_VALOR ? null : cliente,
      category_id: categoria === SEM_VALOR ? null : categoria,
      fornecedor: fornecedor || null,
      observacoes: observacoes || null,
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lanc-tipo">Tipo</Label>
          <Select
            value={tipo}
            onValueChange={(v) => {
              setTipo(v as FinTipo);
              // A categoria é por tipo: manter a de receita numa despesa
              // gravaria um vínculo que o relatório não sabe ler.
              setCategoria(SEM_VALOR);
            }}
          >
            <SelectTrigger id="lanc-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lanc-valor">Valor *</Label>
          <Input
            id="lanc-valor"
            inputMode="decimal"
            placeholder="1.234,56"
            aria-invalid={valorInvalido}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          {valorInvalido ? (
            <p className="text-destructive text-xs">Não entendi este valor. Tente 1.234,56.</p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="lanc-descricao">Descrição *</Label>
          <Input
            id="lanc-descricao"
            autoFocus
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === "receita" ? "Fee de setembro" : "Assinatura do Adobe"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lanc-mes">Competência *</Label>
          <Input id="lanc-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          <p className="text-text-muted text-xs">O mês a que o valor se refere.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lanc-vencimento">Vencimento</Label>
          <Input
            id="lanc-vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
          <p className="text-text-muted text-xs">Vencido e não pago vira “atrasado” sozinho.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lanc-cliente">Cliente</Label>
          <Select value={cliente} onValueChange={setCliente}>
            <SelectTrigger id="lanc-cliente" className="w-full">
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

        <div className="space-y-2">
          <Label htmlFor="lanc-categoria">Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger id="lanc-categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Sem categoria</SelectItem>
              {categoriasDoTipo.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lanc-pagamento">Pagamento</Label>
          <Input
            id="lanc-pagamento"
            type="date"
            value={pagamento}
            onChange={(e) => setPagamento(e.target.value)}
          />
          <p className="text-text-muted text-xs">Preencher já marca como pago.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lanc-status">Situação</Label>
          <Select
            value={pagamento ? "pago" : status}
            disabled={!!pagamento}
            onValueChange={(v) => setStatus(v as FinStatus)}
          >
            <SelectTrigger id="lanc-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ESCOLHIVEIS.map((s) => (
                <SelectItem key={s} value={s}>
                  {ROTULOS_DE_STATUS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* "Atrasado" não é opção de propósito: ele é consequência do
              vencimento, e oferecê-lo criaria duas verdades sobre a mesma
              linha. */}
          <p className="text-text-muted text-xs">“Atrasado” o sistema calcula.</p>
        </div>

        {tipo === "despesa" ? (
          <div className="space-y-2">
            <Label htmlFor="lanc-fornecedor">Fornecedor</Label>
            <Input
              id="lanc-fornecedor"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="lanc-obs">Observações</Label>
          <Textarea
            id="lanc-obs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button onClick={enviar} disabled={salvando || descricao.trim().length < 2 || valorInvalido}>
          {salvando ? <Loader2 className="animate-spin" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * Importação de CSV.
 *
 * Aceita arquivo E texto colado: quem tem a planilha aberta copia três linhas
 * mais rápido do que exporta um arquivo, e quem recebeu o extrato do contador
 * tem o arquivo na mão. Os dois caminhos passam pelo mesmo parser.
 */
function ImportadorDeCSV({
  aberto,
  competencia,
  aoFechar,
  aoImportar,
}: {
  aberto: boolean;
  competencia: string;
  aoFechar: () => void;
  aoImportar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, iniciar] = useTransition();

  function enviar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => importarLancamentosCSV(texto, competencia));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setTexto("");
        aoImportar();
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar lançamentos</DialogTitle>
          <DialogDescription>
            A primeira linha é o cabeçalho, e é ele que manda — a ordem das colunas não importa.
            Obrigatórias: <code>tipo</code>, <code>descricao</code>, <code>valor</code>. Opcionais:{" "}
            <code>competencia</code>, <code>vencimento</code>, <code>cliente</code>,{" "}
            <code>categoria</code>, <code>fornecedor</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="csv-arquivo">Arquivo</Label>
            <Input
              id="csv-arquivo"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={async (e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) setTexto(await arquivo.text());
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-texto">ou cole aqui</Label>
            <Textarea
              id="csv-texto"
              rows={8}
              className="font-mono text-xs"
              placeholder={"tipo;descricao;valor;vencimento;cliente\nreceita;Fee de setembro;4500,00;2026-09-10;Mundo Verde"}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <p className="text-text-muted text-xs">
              Linha sem competência entra no mês aberto. Linha que não dá para entender é recusada
              sozinha, e as outras entram — a mensagem diz quais ficaram de fora.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando || texto.trim() === ""}>
            {enviando ? <Loader2 className="animate-spin" /> : <Upload aria-hidden />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Baixa um texto como arquivo, sem passar pelo servidor. */
export function baixar(conteudo: string, nome: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
