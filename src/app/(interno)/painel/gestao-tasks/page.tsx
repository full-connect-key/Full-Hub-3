import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { filaDeAprovacoes, type FilaDeAprovacoes } from "@/lib/dados/aprovacoes";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { prazosDeHoje, souDoAtendimento } from "@/lib/dados/minhas-tasks";
import {
  buscarRecorrencia,
  feriadosParaAPrevia,
  listarRecorrencias,
  modeloDeUmaTask,
} from "@/lib/dados/recorrencias";
import {
  contadoresDeTasks,
  itensDoCalendario,
  listarTasks,
  meusRascunhos,
  type FiltrosDeTask,
} from "@/lib/dados/tasks";
import { listarTiposComFluxo } from "@/lib/dados/workflows";
import type { TaskPrioridade, TaskStatus } from "@/lib/supabase/database.types";

import { AbasDeGestaoDeTasks } from "./abas";
import { Fila } from "./aprovacoes-internas/fila";
import { ContadoresDeDemandas } from "./contadores";
import { PainelDeTasks } from "./painel-de-tasks";
import { lerAba, type Aba } from "./vocabulario";
import { EditorDeRecorrencia } from "./workflows/recorrencias/editor";
import { ListaDeRecorrencias } from "./workflows/recorrencias/lista";
import { Workflows } from "./workflows/workflows";

export const metadata: Metadata = { title: "Gestão de Tasks" };

/**
 * O trabalho da agência, numa rota só (decisão do usuário).
 *
 * ---------------------------------------------------------------------------
 * **TRÊS ITENS DO MENU VIRARAM UM, e a razão é a mesma da Gestão de Pessoas.**
 * Demandas, Workflows e Aprovações Internas respondiam à mesma pergunta em
 * três endereços — *o trabalho da agência* —, e quem monta a cadeia é quem
 * distribui a demanda, e quem distribui é quem aprova. A explicação inteira
 * mora em `abas.tsx`, ao lado da barra que ela desenha.
 * ---------------------------------------------------------------------------
 *
 * **E as três rotas antigas continuam funcionando**, por 308 em
 * `ROTAS_RENOMEADAS`. Não é gentileza com quem tem link salvo: as
 * notificações do sino gravam o endereço DENTRO da linha, e as que o Postgres
 * escreveu em `/painel/aprovacoes-internas` estão no banco de produção desde a
 * 0064. Reescrever o corpo daquelas funções seria uma migration cujo único
 * efeito é trocar um texto que o redirect já resolve — a mesma decisão dos
 * comentários datados da 0028 e da 0031.
 */
/** Traduz os parâmetros da URL nos filtros que a consulta entende. */
function filtrosDaUrl(params: Record<string, string | string[] | undefined>): FiltrosDeTask {
  const texto = (chave: string) => {
    const valor = params[chave];
    return typeof valor === "string" && valor.length > 0 ? valor : undefined;
  };

  return {
    cliente: texto("cliente"),
    tipo: texto("tipo"),
    responsavel: texto("responsavel"),
    prioridade: texto("prioridade") as TaskPrioridade | undefined,
    status: texto("status") as TaskStatus | undefined,
    de: texto("de"),
    ate: texto("ate"),
    soAtrasadas: params.atrasadas === "1",
  };
}

async function clientesAtivos() {
  const clientes = await listarClientes();
  return clientes
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa, slug: c.slug }));
}

async function AbaDeDemandas({ filtros }: { filtros: FiltrosDeTask }) {
  // Os workflows saíram daqui junto com o diálogo de criação: quem escolhe o
  // workflow agora é a tela de detalhe, e é ela que os carrega.
  const [tasks, itens, clientes, equipe, rascunhos, ehDoAtendimento, contadores] =
    await Promise.all([
      listarTasks(filtros),
      itensDoCalendario(filtros),
      listarClientes(),
      listarEquipeAtiva(),
      meusRascunhos(),
      // A MESMA PERGUNTA QUE A POLICY FAZ, por RPC — nunca um `if (role ===`
      // na tela. É o que faz "Nova recorrente" e `tasks_insert` não
      // divergirem, como já acontece com "Nova task".
      souDoAtendimento(),
      contadoresDeTasks(),
    ]);

  return (
    <div className="space-y-6">
      {/* OS CONTADORES DESCERAM DO CABEÇALHO PARA DENTRO DESTA ABA, e é o que
          a barra de abas cobrou: "3 abertas · 1 atrasada" descreve as
          DEMANDAS, e lido no topo da aba de Workflows seria um número sobre
          outra coisa — a tela afirmando com confiança algo que ela não está
          mostrando. */}
      <ContadoresDeDemandas
        abertas={contadores.abertas}
        atrasadas={contadores.atrasadas}
        concluidasNoMes={contadores.concluidasNoMes}
      />

      <PainelDeTasks
        tasks={tasks}
        rascunhos={rascunhos}
        itensDeCalendario={itens}
        clientes={clientes
          .filter((cliente) => cliente.ativo)
          .map((cliente) => ({ id: cliente.id, nome_empresa: cliente.nome_empresa }))}
        equipe={equipe}
        prazos={prazosDeHoje()}
        podeConfigurarRecorrencia={ehDoAtendimento}
      />
    </div>
  );
}

async function AbaDeWorkflows() {
  const [tipos, clientes, equipe] = await Promise.all([
    listarTiposComFluxo(),
    clientesAtivos(),
    listarEquipeAtiva(),
  ]);

  return (
    <Workflows
      tipos={tipos}
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
    />
  );
}

async function AbaDeRecorrencias({
  regra,
  deTask,
}: {
  regra: string | undefined;
  /** "Transformar em recorrente": o id da task que preenche o editor. */
  deTask: string | undefined;
}) {
  // O EDITOR E A LISTA NÃO SÃO DUAS ROTAS, e sim um parâmetro: `?regra=nova`
  // ou `?regra={id}`. É a mesma decisão do painel lateral de Minhas Tasks —
  // quem fecha o editor volta para a lista com os filtros que tinha, e não
  // para uma lista recarregada do zero.
  if (regra) {
    const [clientes, equipe, tipos, feriados, atual, daTask] = await Promise.all([
      clientesAtivos(),
      listarEquipeAtiva(),
      listarTiposComFluxo(),
      feriadosParaAPrevia(),
      regra === "nova" ? Promise.resolve(null) : buscarRecorrencia(regra),
      regra === "nova" && deTask ? modeloDeUmaTask(deTask) : Promise.resolve(null),
    ]);

    return (
      <EditorDeRecorrencia
        regra={atual}
        clientes={clientes}
        equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
        workflows={tipos.map((t) => ({
          id: t.id,
          nome: t.nome,
          etapas: t.etapas?.length ?? 0,
        }))}
        partirDe={daTask}
        feriados={feriados}
        hojeISO={new Date().toISOString().slice(0, 10)}
      />
    );
  }

  const [regras, clientes, atendimento] = await Promise.all([
    listarRecorrencias(),
    clientesAtivos(),
    souDoAtendimento(),
  ]);

  return (
    <ListaDeRecorrencias
      regras={regras}
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      podeConfigurar={atendimento}
    />
  );
}


/** O que cada aba mostra abaixo do cabeçalho. */
function Conteudo({
  aba,
  filtros,
  regra,
  deTask,
  fila,
}: {
  aba: Aba;
  filtros: FiltrosDeTask;
  regra: string | undefined;
  deTask: string | undefined;
  fila: FilaDeAprovacoes;
}) {
  if (aba === "workflows") return <AbaDeWorkflows />;
  if (aba === "recorrencias") return <AbaDeRecorrencias regra={regra} deTask={deTask} />;
  // A FILA DESCE JÁ BUSCADA, e não é buscada de novo aqui: o selo da barra
  // precisa dela em TODA aba, então a consulta acontece uma vez acima. Uma
  // segunda chamada nesta aba daria duas idas ao banco para desenhar o mesmo
  // número duas vezes na mesma tela.
  if (aba === "aprovacoes-internas") return <Fila fila={fila} />;
  return <AbaDeDemandas filtros={filtros} />;
}

export default async function PaginaDeGestaoDeTasks({
  searchParams,
}: PageProps<"/painel/gestao-tasks">) {
  await exigirAcessoARota("/painel/gestao-tasks");

  const params = await searchParams;
  const aba = lerAba(params.aba);
  const filtros = filtrosDaUrl(params);
  const regra = typeof params.regra === "string" ? params.regra : undefined;
  const deTask = typeof params.deTask === "string" ? params.deTask : undefined;

  // A CONTAGEM DA FILA SAI AQUI E NÃO DENTRO DA ABA, porque o selo mora na
  // barra — ele precisa existir enquanto a pessoa está nas Demandas, que é
  // exatamente quando ninguém olharia a fila. É a consulta que o item de menu
  // não fazia, e é o que a fusão devolve em troca do item que sumiu.
  //
  // E o número é `esperando`, nunca o total: "prontas para o cliente" já
  // passaram pelo aval e esperam um envio, não uma decisão. Somar as duas
  // faria o selo cobrar uma ação que metade da fila não pede.
  const fila = await filaDeAprovacoes();

  return (
    <div className="space-y-6">
      <PageHeader title="Gestão de Tasks" />

      <AbasDeGestaoDeTasks atual={aba} aguardando={fila.esperando.length} />

      <Suspense
        key={`${aba}:${regra ?? ""}:${deTask ?? ""}`}
        fallback={<LoadingSkeleton variant="table" rows={6} />}
      >
        <Conteudo aba={aba} filtros={filtros} regra={regra} deTask={deTask} fila={fila} />
      </Suspense>
    </div>
  );
}
