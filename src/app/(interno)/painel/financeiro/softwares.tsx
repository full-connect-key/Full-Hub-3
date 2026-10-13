"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Loader2, Pencil, Plus, Receipt, Trash2, Upload } from "lucide-react";
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
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import {
  CORES_DE_STATUS,
  formatarDinheiro,
  lerDinheiro,
  ROTULOS_DE_STATUS,
  STATUS_ESCOLHIVEIS,
} from "@/lib/dominio/financeiro";
import type { FinanceCategory, FinStatus } from "@/lib/supabase/database.types";

import {
  criarLancamento,
  editarLancamento,
  excluirLancamento,
  importarLancamentosCSV,
  marcarComoPago,
} from "./acoes";

/**
 * OS GASTOS DA AGÊNCIA — a aba Softwares.
 *
 * ---------------------------------------------------------------------------
 * **ERAM QUATRO TELAS E É UMA (0095).** A Visão Geral, os Lançamentos, os
 * Contratos e os Relatórios respondiam sobre faturamento, margem e
 * inadimplência; a receita saiu do produto, e o que sobrou de verdade é esta
 * lista — toda linha é um gasto, com categoria, competência, vencimento,
 * pagamento e fornecedor.
 *
 * **OS NÚMEROS SÃO UMA LINHA DE TEXTO, e não três ladrilhos.** A lista logo
 * abaixo É esses números, item por item: um cartão grande dizendo "R$ 4.300 no
 * mês" acima de nove linhas que somam isso é o cartão de "11 entregues" com
 * sete na lista embaixo, que o Resumo da Agência já pagou uma vez. E eles saem
 * da MESMA lista que desenha as linhas — o recorte acontece na tela, então
 * filtrar por categoria muda a soma e o total continua concordando com o que
 * está à vista.
 * ---------------------------------------------------------------------------
 *
 * Os filtros moram na URL, como em toda listagem do produto: o sócio precisa
 * poder mandar "olha os gastos atrasados de agosto" por mensagem.
 *
 * A SITUAÇÃO mostrada é a derivada (`lancamento.situacao`), não o `status`
 * gravado. É por isso que "Atrasado" aparece sem ninguém ter mexido na linha —
 * e por isso que ele não está entre as opções do formulário: atraso é
 * consequência da data, não uma escolha.
 */

type Cliente = { id: string; nome_empresa: string };

const SEM_VALOR = "__sem__";

export function Softwares({
  gastos,
  vencidos,
  clientes,
  categorias,
  competencia,
  hojeISO,
}: {
  gastos: LancamentoComRelacoes[];
  /**
   * O que venceu e ninguém pagou, de QUALQUER competência.
   *
   * Consulta à parte de propósito: a assinatura de março que ninguém pagou não
   * está na lista de setembro, e sem ela a tela diria "nada atrasado" num mês
   * em que há seis meses de atraso logo atrás.
   */
  vencidos: LancamentoComRelacoes[];
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
    for (const chave of ["cliente", "categoria", "situacao"]) destino.delete(chave);
    router.replace(`${pathname}?${destino.toString()}`, { scroll: false });
  }

  const visiveis = useMemo(
    () =>
      gastos.filter((g) => {
        if (filtroDeCliente !== SEM_FILTRO && g.client_id !== filtroDeCliente) return false;
        if (filtroDeCategoria !== SEM_FILTRO && g.category_id !== filtroDeCategoria) return false;
        if (filtroDeSituacao !== SEM_FILTRO && g.situacao !== filtroDeSituacao) return false;
        return true;
      }),
    [gastos, filtroDeCliente, filtroDeCategoria, filtroDeSituacao],
  );

  const totais = useMemo(() => {
    const noMes = visiveis.filter((g) => g.situacao !== "cancelado");
    const somar = (lista: LancamentoComRelacoes[]) =>
      lista.reduce((t, g) => t + Number(g.valor), 0);
    const pago = noMes.filter((g) => g.situacao === "pago");
    return {
      total: somar(noMes),
      pago: somar(pago),
      falta: somar(noMes.filter((g) => g.situacao !== "pago")),
    };
  }, [visiveis]);

  /**
   * O ATRASO DO MÊS SAI DA LISTA; o de fora dela, da consulta própria.
   *
   * Contar os dois juntos somaria a mesma linha duas vezes quando o atrasado
   * for do mês que está na tela — e é o caso mais comum.
   */
  const atrasados = useMemo(
    () => vencidos.filter((g) => g.competencia !== competencia),
    [vencidos, competencia],
  );
  const atrasadoDeFora = atrasados.reduce((t, g) => t + Number(g.valor), 0);

  function pagar(gasto: LancamentoComRelacoes) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => marcarComoPago(gasto.id, hojeISO));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  function exportar() {
    const csv = montarCSV(
      [
        "competencia",
        "categoria",
        "descricao",
        "fornecedor",
        "cliente",
        "valor",
        "vencimento",
        "pagamento",
        "situacao",
      ],
      visiveis.map((g) => [
        g.competencia,
        g.categoria?.nome ?? "",
        g.descricao,
        g.fornecedor ?? "",
        g.cliente?.nome_empresa ?? "",
        // Vírgula decimal: o arquivo abre no Excel em português, e lá
        // "1234.56" vira mil duzentos e trinta e quatro vírgula cinquenta e
        // seis só por acidente de configuração.
        Number(g.valor).toFixed(2).replace(".", ","),
        g.vencimento ?? "",
        g.pagamento ?? "",
        ROTULOS_DE_STATUS[g.situacao],
      ]),
    );
    baixarCSV(csv, `gastos-${competencia.slice(0, 7)}.csv`);
  }

  const colunas: Column<LancamentoComRelacoes>[] = [
    {
      id: "descricao",
      header: "Gasto",
      cell: (g) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{g.descricao}</p>
          {g.fornecedor ? (
            <p className="text-text-muted truncate text-xs">{g.fornecedor}</p>
          ) : null}
        </div>
      ),
      sortValue: (g) => g.descricao,
      searchValue: (g) => `${g.descricao} ${g.fornecedor ?? ""}`,
    },
    {
      id: "categoria",
      header: "Categoria",
      cell: (g) => <span className="text-text-secondary text-sm">{g.categoria?.nome ?? "—"}</span>,
      sortValue: (g) => g.categoria?.nome ?? null,
      searchValue: (g) => g.categoria?.nome ?? "",
    },
    {
      id: "cliente",
      header: "Cliente",
      // Gasto de cliente existe — a mídia paga de uma campanha, a ferramenta
      // assinada para uma conta — e é o que permite saber quanto uma conta
      // custa. Sem dono fica "—", que é a verdade: gasto da casa.
      cell: (g) => (
        <span className="text-text-secondary text-sm">{g.cliente?.nome_empresa ?? "—"}</span>
      ),
      sortValue: (g) => g.cliente?.nome_empresa ?? null,
      searchValue: (g) => g.cliente?.nome_empresa ?? "",
    },
    {
      id: "valor",
      header: "Valor",
      align: "right",
      cell: (g) => (
        <span className="text-sm tabular-nums whitespace-nowrap">
          {formatarDinheiro(Number(g.valor))}
        </span>
      ),
      sortValue: (g) => Number(g.valor),
    },
    {
      id: "vencimento",
      header: "Vencimento",
      cell: (g) => (
        <span className="text-text-secondary text-xs whitespace-nowrap">
          {g.vencimento ? format(parseISO(g.vencimento), "dd/MM/yyyy") : "—"}
        </span>
      ),
      sortValue: (g) => g.vencimento ?? null,
    },
    {
      id: "situacao",
      header: "Situação",
      cell: (g) => (
        <Badge variant="outline" className={`${CORES_DE_STATUS[g.situacao]} border-0 whitespace-nowrap`}>
          {ROTULOS_DE_STATUS[g.situacao]}
        </Badge>
      ),
      sortValue: (g) => g.situacao,
      searchValue: (g) => ROTULOS_DE_STATUS[g.situacao],
    },
    {
      id: "acoes",
      header: "",
      align: "right",
      cell: (g) => (
        <div className="flex justify-end gap-1">
          {g.situacao !== "pago" && g.situacao !== "cancelado" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={salvando}
              onClick={() => pagar(g)}
              className="text-xs"
            >
              Marcar pago
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${g.descricao}`}
            onClick={() => setEditando(g)}
          >
            <Pencil aria-hidden />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Excluir ${g.descricao}`}>
                <Trash2 aria-hidden />
              </Button>
            }
            title="Excluir este gasto?"
            description={`“${g.descricao}” sai do financeiro. Não dá para desfazer.`}
            confirmLabel="Excluir"
            destructive
            onConfirm={async () => {
              const resultado = await chamarAcao(() => excluirLancamento(g.id));
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
            Novo gasto
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-text-secondary text-sm">
          <strong className="text-text-primary tabular-nums">
            {formatarDinheiro(totais.total)}
          </strong>{" "}
          no mês
        </p>
        <p className="text-text-secondary text-sm">
          <strong className="text-text-primary tabular-nums">{formatarDinheiro(totais.pago)}</strong>{" "}
          pago
        </p>
        <p className="text-text-secondary text-sm">
          <strong className="text-text-primary tabular-nums">
            {formatarDinheiro(totais.falta)}
          </strong>{" "}
          a pagar
        </p>
      </div>

      {/* O ATRASO DE OUTROS MESES É UM AVISO, e `--warning` e nunca
          `--danger`: uma assinatura vencida é uma cobrança, não um erro — e
          vermelho numa tela que se abre uma vez por mês treina o hábito de
          ignorar vermelho. Ele SOME quando não há nada atrasado, como os
          blocos de exceção do Início: uma caixa fixa dizendo "nada atrasado"
          gastaria a linha todo mês para informar em alguns. */}
      {atrasados.length > 0 ? (
        <p className="bg-warning-soft text-warning rounded-card px-3 py-2 text-sm">
          <strong className="tabular-nums">{formatarDinheiro(atrasadoDeFora)}</strong> venceram em
          meses anteriores e continuam sem pagamento ({atrasados.length}{" "}
          {atrasados.length === 1 ? "gasto" : "gastos"}
          ). O mais antigo é de{" "}
          {format(parseISO(atrasados[0].competencia), "MMMM 'de' yyyy", { locale: ptBR })}.
        </p>
      ) : null}

      <DataTable
        data={visiveis}
        columns={colunas}
        getRowId={(g) => g.id}
        searchPlaceholder="Buscar por gasto, fornecedor ou cliente…"
        pageSize={15}
        initialSort={{ colunaId: "vencimento", direcao: "asc" }}
        emptyIcon={Receipt}
        emptyTitle="Nenhum gasto neste mês"
        emptyDescription="Cadastre um gasto avulso ou importe a planilha do mês. A nota fiscal que você marcar como paga entra aqui sozinha."
        toolbar={
          <FilterBar
            selects={[
              {
                id: "categoria",
                label: "Categoria",
                value: filtroDeCategoria,
                allLabel: "Todas as categorias",
                options: categorias.map((c) => ({ value: c.id, label: c.nome })),
                onChange: (v) => aplicarFiltro("categoria", v),
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

      <FormularioDeGasto
        aberto={editando !== null}
        gasto={editando === "novo" ? null : editando}
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

function FormularioDeGasto({
  aberto,
  gasto,
  competencia,
  clientes,
  categorias,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  gasto: LancamentoComRelacoes | null;
  competencia: string;
  clientes: Cliente[];
  categorias: FinanceCategory[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [salvando, iniciar] = useTransition();

  // `key` no Dialog remonta o formulário a cada abertura, e é por isso que o
  // estado pode nascer dos props sem um efeito de sincronização — remontar é
  // o caminho que evita o setState-dentro-de-efeito.
  const chave = gasto?.id ?? `novo-${competencia}`;

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{gasto ? "Editar gasto" : "Novo gasto"}</DialogTitle>
          <DialogDescription>
            Competência é o mês a que o gasto se refere. Vencimento e pagamento são outras duas
            datas, e é a diferença entre elas que mostra o que falta pagar.
          </DialogDescription>
        </DialogHeader>

        <Campos
          key={chave}
          gasto={gasto}
          competencia={competencia}
          clientes={clientes}
          categorias={categorias}
          salvando={salvando}
          aoEnviar={(carga) => {
            iniciar(async () => {
              const resultado = await chamarAcao(() =>
                gasto ? editarLancamento(gasto.id, carga) : criarLancamento(carga),
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
  gasto,
  competencia,
  clientes,
  categorias,
  salvando,
  aoEnviar,
  aoCancelar,
}: {
  gasto: LancamentoComRelacoes | null;
  competencia: string;
  clientes: Cliente[];
  categorias: FinanceCategory[];
  salvando: boolean;
  aoEnviar: (carga: Record<string, unknown>) => void;
  aoCancelar: () => void;
}) {
  const [descricao, setDescricao] = useState(gasto?.descricao ?? "");
  const [valor, setValor] = useState(
    gasto ? Number(gasto.valor).toFixed(2).replace(".", ",") : "",
  );
  const [mes, setMes] = useState((gasto?.competencia ?? competencia).slice(0, 7));
  const [vencimento, setVencimento] = useState(gasto?.vencimento ?? "");
  const [pagamento, setPagamento] = useState(gasto?.pagamento ?? "");
  const [status, setStatus] = useState<FinStatus>(
    gasto && STATUS_ESCOLHIVEIS.includes(gasto.status) ? gasto.status : "previsto",
  );
  const [cliente, setCliente] = useState(gasto?.client_id ?? SEM_VALOR);
  const [categoria, setCategoria] = useState(gasto?.category_id ?? SEM_VALOR);
  const [fornecedor, setFornecedor] = useState(gasto?.fornecedor ?? "");
  const [observacoes, setObservacoes] = useState(gasto?.observacoes ?? "");

  const valorLido = lerDinheiro(valor);
  const valorInvalido =
    valor.trim() !== "" && (valorLido === undefined || valorLido === null || valorLido === 0);

  function enviar() {
    if (valorLido === undefined || valorLido === null || valorLido === 0) {
      toast.error("Informe um valor. Aceita 1.234,56 ou 1234,56.");
      return;
    }
    aoEnviar({
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
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="gasto-descricao">Descrição *</Label>
          <Input
            id="gasto-descricao"
            autoFocus
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Assinatura do Adobe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasto-valor">Valor *</Label>
          <Input
            id="gasto-valor"
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

        <div className="space-y-2">
          <Label htmlFor="gasto-fornecedor">Fornecedor</Label>
          <Input
            id="gasto-fornecedor"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            placeholder="Adobe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasto-mes">Competência *</Label>
          <Input id="gasto-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          <p className="text-text-muted text-xs">O mês a que o gasto se refere.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasto-vencimento">Vencimento</Label>
          <Input
            id="gasto-vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
          <p className="text-text-muted text-xs">Vencido e não pago vira “atrasado” sozinho.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasto-categoria">Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger aria-label="Categoria" id="gasto-categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Sem categoria</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasto-cliente">Cliente</Label>
          <Select value={cliente} onValueChange={setCliente}>
            <SelectTrigger aria-label="Cliente" id="gasto-cliente" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Gasto da casa</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-text-muted text-xs">
            Só quando o gasto é de uma conta — mídia paga, ferramenta assinada para ela.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasto-pagamento">Pagamento</Label>
          <Input
            id="gasto-pagamento"
            type="date"
            value={pagamento}
            onChange={(e) => setPagamento(e.target.value)}
          />
          <p className="text-text-muted text-xs">Preencher já marca como pago.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasto-status">Situação</Label>
          <Select
            value={pagamento ? "pago" : status}
            disabled={!!pagamento}
            onValueChange={(v) => setStatus(v as FinStatus)}
          >
            <SelectTrigger aria-label="Situação" id="gasto-status" className="w-full">
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

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="gasto-obs">Observações</Label>
          <Textarea
            id="gasto-obs"
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
          <DialogTitle>Importar gastos</DialogTitle>
          <DialogDescription>
            A primeira linha é o cabeçalho, e é ele que manda — a ordem das colunas não importa.
            Obrigatórias: <code>descricao</code> e <code>valor</code>. Opcionais:{" "}
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
              aria-label="Arquivo CSV com os gastos"
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
              placeholder={
                "descricao;valor;vencimento;categoria;fornecedor\nAssinatura do Adobe;289,00;2026-09-10;Software;Adobe"
              }
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
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
