import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota, primeiroNome } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import {
  contadoresPessoais,
  itensPessoaisDoCalendario,
  meuDia,
  minhasTasks,
  prazosDeHoje,
  souDoAtendimento,
} from "@/lib/dados/minhas-tasks";
import type { FocoDoDia } from "@/lib/dominio/tasks";

import { montarLinhas } from "./linhas";
import { PainelPessoal } from "./painel-pessoal";

export const metadata: Metadata = { title: "Minhas Tasks" };

const VISOES = ["board", "lista", "calendario"] as const;
const FOCOS = ["atrasadas", "hoje", "semana"] as const;

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

async function Conteudo({
  usuarioId,
  nome,
  visao,
  foco,
}: {
  usuarioId: string;
  nome: string;
  visao: (typeof VISOES)[number];
  foco: FocoDoDia | null;
}) {
  // Uma régua de datas só para tudo nesta tela: contador, lista e calendário
  // classificam o mesmo prazo do mesmo jeito.
  const prazos = prazosDeHoje();

  const [tasks, itensDeCalendario, itensDoDia, contadores, clientes, equipe, podeCriarTask] =
    await Promise.all([
      minhasTasks(usuarioId, foco, prazos),
      itensPessoaisDoCalendario(usuarioId, foco, prazos),
      meuDia(usuarioId, prazos),
      contadoresPessoais(usuarioId, prazos),
      listarClientes(),
      listarEquipeAtiva(),
      souDoAtendimento(),
    ]);

  return (
    <PainelPessoal
      tasks={tasks}
      linhas={montarLinhas(tasks)}
      itensDeCalendario={itensDeCalendario}
      itensDoDia={itensDoDia}
      contadores={contadores}
      clientes={clientes
        .filter((cliente) => cliente.ativo)
        .map((cliente) => ({ id: cliente.id, nome_empresa: cliente.nome_empresa }))}
      equipe={equipe}
      prazos={prazos}
      usuarioId={usuarioId}
      primeiroNome={nome}
      podeCriarTask={podeCriarTask}
      visao={visao}
      foco={foco}
    />
  );
}

export default async function PaginaDeMinhasTasks({
  searchParams,
}: PageProps<"/painel/minhas-tasks">) {
  const sessao = await exigirAcessoARota("/painel/minhas-tasks");
  const params = await searchParams;

  const visaoPedida = typeof params.visao === "string" ? params.visao : "";
  const visao = (VISOES as readonly string[]).includes(visaoPedida)
    ? (visaoPedida as (typeof VISOES)[number])
    : "lista";

  const focoPedido = typeof params.foco === "string" ? params.foco : "";
  const foco = (FOCOS as readonly string[]).includes(focoPedido)
    ? (focoPedido as FocoDoDia)
    : null;

  const nome = primeiroNome(sessao.profile.nome);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${saudacao()}, ${nome}`}
        description="O que está no seu nome hoje — incluindo as subtarefas dentro de tasks de outras pessoas."
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo usuarioId={sessao.usuarioId} nome={nome} visao={visao} foco={foco} />
      </Suspense>
    </div>
  );
}
