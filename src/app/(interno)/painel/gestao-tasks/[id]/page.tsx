import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Megaphone } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { campanhaDaTask } from "@/lib/dados/campanhas";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { prazosDeHoje, souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { obterTask, urlsDosArquivos } from "@/lib/dados/tasks";
import { listarWorkflows } from "@/lib/dados/workflows";
import { EXPLICACAO_DO_STATUS } from "@/lib/tasks/state-machine";

import { Comentarios } from "./comentarios";
import { HistoricoDaTask } from "./historico";
import { AcoesDaTask } from "./acoes-da-task";
import { PropriedadesDaTask } from "./propriedades";
import { PrincipalDaTask } from "./principal";
import { CabecalhoDaTask } from "./cabecalho-da-task";
import { Referencias } from "./referencias";
import { Subtarefas } from "./subtarefas";

export const metadata: Metadata = { title: "Task" };

export default async function PaginaDaTask({ params }: PageProps<"/painel/gestao-tasks/[id]">) {
  const sessao = await exigirAcessoARota("/painel/gestao-tasks");
  const { id } = await params;

  const task = await obterTask(id);
  if (!task) notFound();

  const [clientes, equipe, tipos, ehDoAtendimento] = await Promise.all([
    listarClientes(),
    listarEquipeAtiva(),
    listarWorkflows(task.client_id),
    souDoAtendimento(),
  ]);

  const urls = await urlsDosArquivos(
    task.referencias.filter((r) => r.tipo === "arquivo").map((r) => r.url),
  );

  const souGestor = ehGestor(sessao.profile.role);

  // Rascunho é `publicada_em is null` (migration 0028). A RLS já garante que
  // só quem criou chega até aqui; esta linha decide o que a TELA mostra.
  const ehRascunho = task.publicada_em === null;

  // Espelha a regra do RLS: mexer na Task é do Atendimento e da gestão.
  // Trabalhar nas subtarefas é de quem é responsável por elas — e isso o
  // componente de ações resolve linha a linha. Ver é aberto para toda a
  // equipe; o banco é quem barra de verdade.
  const podeGerenciar = ehDoAtendimento || souGestor;

  // A CAMPANHA DESTA DEMANDA, quando ela veio de uma (0051). É o outro lado
  // do "Abrir a demanda" que a tela da campanha oferece: quem clica numa
  // etapa em Minhas Tasks chega aqui, e daqui precisa alcançar o lugar onde
  // se sobe a arte. Sem este botão, o caminho era o menu e uma busca na lista.
  const campanha = await campanhaDaTask(task.id);

  // A linha de contexto, montada só com o que existe.
  const contexto = [
    task.cliente?.nome_empresa,
    task.data_fim
      ? `${format(parseISO(task.data_inicio), "dd/MM/yy", { locale: ptBR })} → ${format(parseISO(task.data_fim), "dd/MM/yy", { locale: ptBR })}`
      : null,
    task.subtarefasTotal > 0
      ? `${task.subtarefasConcluidas} de ${task.subtarefasTotal} concluída${task.subtarefasTotal === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/painel/gestao-tasks">
            <ArrowLeft aria-hidden />
            Gestão de Tasks
          </Link>
        </Button>

        {ehRascunho ? (
          <Badge variant="outline" className="uppercase">
            Rascunho
          </Badge>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <StatusBadge status={task.status} />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {EXPLICACAO_DO_STATUS[task.status]}
            </TooltipContent>
          </Tooltip>
        )}

        {/* OS PEDAÇOS VAZIOS NÃO APARECEM. Num rascunho recém-aberto não há
            cliente, não há período e não há etapa — e "— · — · 0 de 0" é uma
            linha que só informa que a tela não tem o que dizer. */}
        {contexto.length > 0 ? (
          <span className="text-muted-foreground text-sm">{contexto.join(" · ")}</span>
        ) : null}

        {!podeGerenciar ? (
          <span className="text-muted-foreground text-xs">
            Você vê a demanda inteira; edita as subtarefas que são suas.
          </span>
        ) : null}

        {campanha ? (
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href={`/painel/aprovacoes/campanhas/${campanha.id}`}>
              <Megaphone aria-hidden className="size-4" />
              Ver campanha
            </Link>
          </Button>
        ) : null}
      </div>

      <CabecalhoDaTask
        task={task}
        podeEditar={podeGerenciar}
        temEtapas={task.subtarefas.length > 0}
      />

      {/* As propriedades vêm ANTES das abas, e fora delas.
          Elas descrevem a demanda inteira — trocar para o Histórico e perder
          de vista o cliente e o prazo é perder o contexto do que se está
          lendo. Só o CONTEÚDO (trabalho / histórico) troca. */}
      <PropriedadesDaTask
        task={task}
        clientes={clientes
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
        tipos={tipos.map((t) => ({ id: t.id, nome: t.nome }))}
        podeEditar={podeGerenciar}
      />

      <div className="min-w-0">
          <Tabs defaultValue="trabalho">
            <TabsList>
              <TabsTrigger value="trabalho">Trabalho</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="trabalho" className="space-y-8 pt-4">
              <PrincipalDaTask task={task} podeEditar={podeGerenciar} />

              <Subtarefas
                taskId={task.id}
                subtarefas={task.subtarefas}
                equipe={equipe.map((p) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url }))}
                podeGerenciar={podeGerenciar}
                souGestor={souGestor}
                usuarioId={sessao.usuarioId}
                /* Hoje e agora saem do SERVIDOR e descem prontos, como em
                   toda tela do produto: se cada navegador lesse o próprio
                   relógio, o cronômetro renderizado aqui e o hidratado lá
                   começariam de números diferentes. É a mesma régua que
                   Minhas Tasks usa — e ela mora na camada de dados porque
                   ler o relógio é efeito, e o compilador do React recusa uma
                   chamada dessas no corpo de um componente. */
                agoraDoServidor={prazosDeHoje().agora}
              />

              <Referencias
                taskId={task.id}
                referencias={task.referencias}
                urls={urls}
                podeEditar={podeGerenciar}
              />

              <Comentarios
                taskId={task.id}
                comentarios={task.comentarios}
                usuarioId={sessao.usuarioId}
                podeModerar={souGestor}
              />

              <AcoesDaTask
                task={task}
                podeExcluir={souGestor}
                podeConfigurarRecorrencia={podeGerenciar}
              />
            </TabsContent>

            <TabsContent value="historico" className="pt-4">
              <HistoricoDaTask eventos={task.historico} />
            </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}
