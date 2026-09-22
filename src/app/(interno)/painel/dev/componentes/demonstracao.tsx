"use client";

import { useState } from "react";
import { addDays, formatISO } from "date-fns";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DateBadge } from "@/components/shared/date-badge";
import { GraficoDeBarras } from "@/components/shared/grafico-de-barras";
import { GraficoDeLinhas } from "@/components/shared/grafico-de-linhas";
import { GraficoDeSaldo } from "@/components/shared/grafico-de-saldo";
import { SeletorDeMes } from "@/components/shared/seletor-de-mes";
import { formatarDinheiro, formatarDinheiroCurto } from "@/lib/dominio/financeiro";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, SEM_FILTRO } from "@/components/shared/filter-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import {
  PriorityBadge,
  PRIORIDADES_DISPONIVEIS,
  rotuloDaPrioridade,
  type Prioridade,
} from "@/components/shared/priority-badge";
import {
  StatusBadge,
  STATUS_DE_CONTEUDO,
  STATUS_DE_TASK,
  rotuloDoStatus,
  type Status,
} from "@/components/shared/status-badge";
import { UserAvatar, UserAvatarGroup } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";

/** Dados inventados, só para a vitrine. Nada aqui vem do banco. */
type Exemplo = {
  id: string;
  titulo: string;
  cliente: string;
  responsavel: string;
  status: Status;
  prioridade: Prioridade;
  prazo: string;
};

const hoje = new Date();
const emDias = (dias: number) => formatISO(addDays(hoje, dias), { representation: "date" });

const EXEMPLOS: Exemplo[] = [
  { id: "1", titulo: "Carrossel de lançamento", cliente: "Cliente Alfa", responsavel: "Carla Nunes", status: "em_producao", prioridade: "alta", prazo: emDias(-2) },
  { id: "2", titulo: "Roteiro do reels institucional", cliente: "Cliente Beta", responsavel: "Diego Reis", status: "em_aprovacao", prioridade: "normal", prazo: emDias(0) },
  { id: "3", titulo: "Ajustes no post de aniversário", cliente: "Cliente Alfa", responsavel: "Ana Souza", status: "ajustes", prioridade: "urgente", prazo: emDias(1) },
  { id: "4", titulo: "Plano de mídia do trimestre", cliente: "Cliente Beta", responsavel: "Ana Souza", status: "aprovado", prioridade: "baixa", prazo: emDias(12) },
  { id: "5", titulo: "Briefing da campanha de inverno", cliente: "Cliente Alfa", responsavel: "Carla Nunes", status: "aguardando_informacoes", prioridade: "normal", prazo: emDias(5) },
  { id: "6", titulo: "Landing page da promoção", cliente: "Cliente Beta", responsavel: "Diego Reis", status: "stand_by", prioridade: "baixa", prazo: emDias(30) },
];

const EQUIPE_EXEMPLO = [
  { name: "Ana Souza" },
  { name: "Diego Reis" },
  { name: "Carla Nunes" },
  { name: "Bruno Lima" },
  { name: "Marina Alves" },
];

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold tracking-tight">{titulo}</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{descricao}</p>
      </div>
      {children}
    </section>
  );
}

export function DemonstracaoDeComponentes() {
  const [statusFiltrado, setStatusFiltrado] = useState(SEM_FILTRO);
  const [prioridadeFiltrada, setPrioridadeFiltrada] = useState(SEM_FILTRO);
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);

  const filtrados = EXEMPLOS.filter((linha) => {
    if (statusFiltrado !== SEM_FILTRO && linha.status !== statusFiltrado) return false;
    if (prioridadeFiltrada !== SEM_FILTRO && linha.prioridade !== prioridadeFiltrada) return false;
    if (somenteAtrasadas && new Date(linha.prazo) >= hoje) return false;
    return true;
  });

  const colunas: Column<Exemplo>[] = [
    {
      id: "titulo",
      header: "Título",
      cell: (linha) => <span className="font-medium">{linha.titulo}</span>,
      sortValue: (linha) => linha.titulo,
      searchValue: (linha) => linha.titulo,
    },
    {
      id: "cliente",
      header: "Cliente",
      cell: (linha) => linha.cliente,
      sortValue: (linha) => linha.cliente,
      searchValue: (linha) => linha.cliente,
    },
    {
      id: "responsavel",
      header: "Responsável",
      cell: (linha) => <UserAvatar name={linha.responsavel} size="sm" />,
      sortValue: (linha) => linha.responsavel,
      searchValue: (linha) => linha.responsavel,
    },
    {
      id: "status",
      header: "Status",
      cell: (linha) => <StatusBadge status={linha.status} />,
      sortValue: (linha) => rotuloDoStatus(linha.status),
    },
    {
      id: "prioridade",
      header: "Prioridade",
      cell: (linha) => <PriorityBadge priority={linha.prioridade} />,
      sortValue: (linha) => PRIORIDADES_DISPONIVEIS.indexOf(linha.prioridade),
    },
    {
      id: "prazo",
      header: "Prazo",
      cell: (linha) => <DateBadge date={linha.prazo} />,
      sortValue: (linha) => linha.prazo,
      align: "right",
    },
  ];

  return (
    <div className="space-y-12">
      <Secao
        titulo="StatusBadge"
        descricao="Os 7 status do fluxo de conteúdo e os status de task. Nenhuma tela monta esses rótulos à mão."
      >
        <div className="flex flex-wrap gap-2">
          {STATUS_DE_CONTEUDO.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_DE_TASK.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Secao>

      <Secao titulo="PriorityBadge" descricao="Quatro níveis fixos. Urgente precisa saltar aos olhos.">
        <div className="flex flex-wrap gap-2">
          {PRIORIDADES_DISPONIVEIS.map((prioridade) => (
            <PriorityBadge key={prioridade} priority={prioridade} />
          ))}
        </div>
      </Secao>

      <Secao
        titulo="DateBadge"
        descricao="A cor sai do quanto falta: vencida em vermelho, hoje e amanhã em âmbar, o resto neutro."
      >
        <div className="flex flex-wrap items-center gap-2">
          <DateBadge date={emDias(-5)} showIcon />
          <DateBadge date={emDias(0)} showIcon />
          <DateBadge date={emDias(1)} showIcon />
          <DateBadge date={emDias(9)} showIcon />
        </div>
      </Secao>

      <Secao titulo="UserAvatar" descricao="Foto ou iniciais, com o nome no tooltip. Em grupo, o excedente é contado.">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <UserAvatar name="Ana Souza" size="sm" />
            <UserAvatar name="Diego Reis" />
            <UserAvatar name="Carla Nunes" size="lg" />
          </div>
          <UserAvatarGroup users={EQUIPE_EXEMPLO} max={3} />
        </div>
      </Secao>

      <Secao
        titulo="FilterBar + DataTable"
        descricao="A combinação que quase todo módulo vai usar: filtros acima, tabela com busca, ordenação e paginação abaixo."
      >
        <DataTable
          data={filtrados}
          columns={colunas}
          getRowId={(linha) => linha.id}
          pageSize={4}
          searchPlaceholder="Buscar por título, cliente ou responsável…"
          emptyIcon={FolderOpen}
          emptyTitle="Nenhum item com esses filtros"
          emptyDescription="Ajuste ou limpe os filtros para ver a lista completa."
          toolbar={
            <FilterBar
              selects={[
                {
                  id: "status",
                  label: "Status",
                  value: statusFiltrado,
                  allLabel: "Todos os status",
                  onChange: setStatusFiltrado,
                  options: STATUS_DE_CONTEUDO.map((status) => ({
                    value: status,
                    label: rotuloDoStatus(status),
                  })),
                },
                {
                  id: "prioridade",
                  label: "Prioridade",
                  value: prioridadeFiltrada,
                  allLabel: "Todas as prioridades",
                  onChange: setPrioridadeFiltrada,
                  options: PRIORIDADES_DISPONIVEIS.map((prioridade) => ({
                    value: prioridade,
                    label: rotuloDaPrioridade(prioridade),
                  })),
                },
              ]}
              chips={[
                {
                  id: "atrasadas",
                  label: "Só atrasadas",
                  active: somenteAtrasadas,
                  onToggle: () => setSomenteAtrasadas((atual) => !atual),
                },
              ]}
              onClear={() => {
                setStatusFiltrado(SEM_FILTRO);
                setPrioridadeFiltrada(SEM_FILTRO);
                setSomenteAtrasadas(false);
              }}
            />
          }
        />
      </Secao>

      <Secao titulo="EmptyState" descricao="Nenhuma tela mostra área em branco: o vazio explica o que houve e oferece a saída.">
        <EmptyState
          icon={FolderOpen}
          title="Nenhum cliente cadastrado"
          description="Quando o primeiro cliente entrar, ele aparece aqui com contatos e acessos ao portal."
          action={
            <Button size="sm">
              <Plus aria-hidden />
              Cadastrar cliente
            </Button>
          }
        />
      </Secao>

      <Secao titulo="ConfirmDialog" descricao="Confirmação simples e, para o que não tem volta, a exigência de digitar o nome.">
        <div className="flex flex-wrap gap-2">
          <ConfirmDialog
            trigger={<Button variant="outline">Arquivar projeto</Button>}
            title="Arquivar este projeto?"
            description="Ele sai das listas ativas, mas continua acessível pelo histórico."
            confirmLabel="Arquivar"
            onConfirm={() => {
              toast.success("Projeto arquivado.");
            }}
          />
          <ConfirmDialog
            trigger={
              <Button variant="destructive">
                <Trash2 aria-hidden />
                Excluir cliente
              </Button>
            }
            title="Excluir Cliente Alfa?"
            description="Isso apaga o cliente, os vínculos de acesso ao portal e todo o histórico. Não dá para desfazer."
            confirmLabel="Excluir definitivamente"
            confirmationText="Cliente Alfa"
            destructive
            onConfirm={() => {
              toast.success("Cliente excluído.");
            }}
          />
        </div>
      </Secao>

      <Secao titulo="LoadingSkeleton" descricao="O que aparece enquanto os dados chegam. Nunca uma tela branca.">
        <div className="space-y-6">
          <LoadingSkeleton variant="table" rows={3} />
          <LoadingSkeleton variant="card" rows={3} />
          <LoadingSkeleton variant="list" rows={3} />
        </div>
      </Secao>

      <Secao
        titulo="SeletorDeMes"
        descricao="Navegação por mês, na URL (?mes=2026-09). O link tem que poder ser colado."
      >
        <SeletorDeMes competencia="2026-09-01" />
      </Secao>

      <Secao
        titulo="GraficoDeLinhas"
        descricao="Duas séries no tempo. Azul e roxo, e não verde e vermelho: o par verde/vermelho dá ΔE 4,2 em deuteranopia — as duas linhas ficam idênticas para quem tem daltonismo vermelho-verde. Este dá 9,4."
      >
        <GraficoDeLinhas
          pontos={[
            { rotulo: "abr", valores: [28000, 19000] },
            { rotulo: "mai", valores: [31000, 21000] },
            { rotulo: "jun", valores: [29500, 24000] },
            { rotulo: "jul", valores: [36000, 22500] },
            { rotulo: "ago", valores: [34000, 26000] },
            { rotulo: "set", valores: [41000, 25000] },
          ]}
          series={["Receita", "Despesa"]}
          formatarValor={formatarDinheiroCurto}
        />
      </Secao>

      <Secao
        titulo="GraficoDeBarras"
        descricao="Magnitude por identidade. Horizontal porque os rótulos são nomes, e de uma cor só: o comprimento já codifica a grandeza, e oito cores não diriam nada."
      >
        <GraficoDeBarras
          barras={[
            { nome: "Mundo Verde", valor: 18400 },
            { nome: "Óptica Visão", valor: 12250 },
            { nome: "Padaria do Bairro", valor: 6800 },
            { nome: "Sem cliente", valor: 3550 },
          ]}
          formatarValor={formatarDinheiro}
        />
      </Secao>

      <Secao
        titulo="GraficoDeSaldo"
        descricao="Colunas que crescem dos dois lados do zero. O trabalho aqui é polaridade, e numa linha o cruzar do zero é fácil de não ver."
      >
        <GraficoDeSaldo
          meses={[
            { rotulo: "abr", valor: 1200 },
            { rotulo: "mai", valor: -450 },
            { rotulo: "jun", valor: 890 },
            { rotulo: "jul", valor: 2100 },
            { rotulo: "ago", valor: -320 },
            { rotulo: "set", valor: 1640 },
          ]}
          formatarValor={formatarDinheiro}
        />
      </Secao>
    </div>
  );
}
