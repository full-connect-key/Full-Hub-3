import type { Metadata } from "next";
import { Suspense } from "react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirAcessoARota, primeiroNome } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import {
  contadoresPessoais,
  etapaEmAndamento,
  itensPessoaisDoCalendario,
  meuDia,
  minhasTasks,
  prazosDeHoje,
  souDoAtendimento,
} from "@/lib/dados/minhas-tasks";
import { resumoDaHome } from "@/lib/dados/home";
import { minhasNovidades } from "@/lib/dados/novidades";
import { minhasEtapasDeSocial } from "@/lib/dados/social-media";
import type { FocoDoDia } from "@/lib/dominio/tasks";

import { saudacaoDaAgencia } from "@/lib/dominio/datas";

import { montarLinhas } from "./linhas";
import { PainelPessoal } from "./painel-pessoal";

export const metadata: Metadata = { title: "Minhas Tasks" };

const VISOES = ["board", "lista", "calendario"] as const;
const FOCOS = ["atrasadas", "hoje", "semana"] as const;

async function Conteudo({
  usuarioId,
  nome,
  souGestor,
  visao,
  foco,
}: {
  usuarioId: string;
  nome: string;
  souGestor: boolean;
  visao: (typeof VISOES)[number];
  foco: FocoDoDia | null;
}) {
  // Uma régua de datas só para tudo nesta tela: contador, lista e calendário
  // classificam o mesmo prazo do mesmo jeito.
  const prazos = prazosDeHoje();

  const [
    tasks,
    itensDeCalendario,
    itensDoDia,
    contadores,
    equipe,
    podeCriarTask,
    etapasDeSocial,
    novidades,
    correndoAgora,
    resumo,
  ] = await Promise.all([
    minhasTasks(usuarioId, foco, prazos),
    itensPessoaisDoCalendario(usuarioId, foco, prazos),
    meuDia(usuarioId, prazos),
    contadoresPessoais(usuarioId, prazos),
    listarEquipeAtiva(),
    souDoAtendimento(),
    minhasEtapasDeSocial(usuarioId),
    // O SINAL DE "CHEGOU COISA NOVA" (decisão do usuário). Ele lê as
    // notificações por ler desta pessoa e as separa por área pelo endereço —
    // é o sino visto de outro ângulo, e não um estado novo ao lado dele.
    minhasNovidades(),
    // AS DUAS PEÇAS DA COLUNA DA DIREITA, e elas já existiam: o cronômetro da
    // etapa esquecida aberta e quem não está hoje moram na Home desde o
    // Sprint 15, e o artifact aprovado as traz para cá com a frase que explica
    // por quê — "as três coisas que hoje moram na Home e que ninguém vê
    // estando em Minhas Tasks".
    //
    // São as MESMAS consultas e os MESMOS componentes, nunca cópias: duas
    // versões do cronômetro divergiriam no número que a pessoa usa para
    // declarar quanto tempo a etapa levou.
    etapaEmAndamento(usuarioId),
    resumoDaHome(),
  ]);

  return (
    <PainelPessoal
      linhas={montarLinhas(tasks)}
      itensDeCalendario={itensDeCalendario}
      itensDoDia={itensDoDia}
      etapasDeSocial={etapasDeSocial}
      novidades={novidades}
      contadores={contadores}
      equipe={equipe}
      prazos={prazos}
      usuarioId={usuarioId}
      souGestor={souGestor}
      primeiroNome={nome}
      podeCriarTask={podeCriarTask}
      visao={visao}
      foco={foco}
      correndoAgora={correndoAgora}
      foraHoje={resumo.fora_hoje}
      saudacao={saudacaoDaAgencia()}
      dataPorExtenso={format(prazos.agora, "EEEE, d 'de' MMMM", {
        locale: ptBR,
      })}
      agoraDoServidor={prazos.agora}
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
      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo
          usuarioId={sessao.usuarioId}
          nome={nome}
          souGestor={ehGestor(sessao.profile.role)}
          visao={visao}
          foco={foco}
        />
      </Suspense>
    </div>
  );
}
