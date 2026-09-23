import type { Metadata } from "next";
import { Suspense } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { forbidden } from "next/navigation";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor, ehSocio } from "@/lib/auth/roles";
import {
  contarPorStatus,
  diasBloqueadosDaArea,
  feriadosComNome,
  feriadosEntre,
  filaDeAprovacoes,
  listarTime,
  matrizDoPeriodo,
  minhasSolicitacoes,
  relatorioDoPeriodo,
} from "@/lib/dados/full-days";
import type { HrStatus, UserRole } from "@/lib/supabase/database.types";

import { AbasDoFullDays, type Aba } from "./abas";
import { Aprovacoes } from "./aprovacoes";
import { MatrizDaEquipe } from "./matriz";
import { RelatorioGerencial } from "./relatorio";
import { Solicitar } from "./solicitar";

export const metadata: Metadata = { title: "Full Days" };

/**
 * Quem enxerga cada aba.
 *
 * Sai daqui e de mais nenhum lugar: a lista de abas visíveis e a guarda da
 * rota leem a mesma constante, então não existe o caso de a aba aparecer e a
 * tela recusar — nem o contrário, que é pior.
 */
const QUEM_VE: Record<Aba, (role: UserRole) => boolean> = {
  matriz: ehGestor,
  relatorio: ehGestor,
  solicitar: () => true,
  aprovacoes: ehSocio,
};

const PADRAO: Aba = "solicitar";

function lerAba(valor: string | string[] | undefined): Aba {
  const texto = typeof valor === "string" ? valor : PADRAO;
  return (["matriz", "relatorio", "solicitar", "aprovacoes"] as Aba[]).includes(texto as Aba)
    ? (texto as Aba)
    : PADRAO;
}

export default async function PaginaDoFullDays({
  searchParams,
}: PageProps<"/painel/full-days">) {
  const sessao = await exigirAcessoARota("/painel/full-days");
  const parametros = await searchParams;

  const aba = lerAba(parametros.aba);

  // Esconder a aba não é proteção: quem digitar ?aba=aprovacoes na barra de
  // endereço tem que receber 403, e é isto que devolve.
  if (!QUEM_VE[aba](sessao.profile.role)) forbidden();

  const visiveis = (Object.keys(QUEM_VE) as Aba[]).filter((chave) =>
    QUEM_VE[chave](sessao.profile.role),
  );

  // Hoje, o início e o fim do período são calculados AQUI e descem prontos.
  // Se cada componente lesse o próprio relógio, o navegador em outro fuso
  // classificaria um dia de descanso num mês diferente do que o contador soma.
  const hoje = new Date();
  const hojeISO = format(hoje, "yyyy-MM-dd");
  const mes = typeof parametros.mes === "string" ? parametros.mes : format(hoje, "yyyy-MM");
  const referencia = new Date(`${mes}-01T12:00:00`);
  const valida = Number.isNaN(referencia.getTime()) ? hoje : referencia;
  const inicio = format(startOfMonth(valida), "yyyy-MM-dd");
  const fim = format(endOfMonth(valida), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Full Days"
      />

      <AbasDoFullDays atual={aba} visiveis={visiveis} />

      <Suspense key={`${aba}-${mes}`} fallback={<LoadingSkeleton variant="table" rows={6} />}>
        {aba === "matriz" ? (
          <ConteudoDaMatriz inicio={inicio} fim={fim} mes={mes} podeEditar={ehGestor(sessao.profile.role)} />
        ) : aba === "relatorio" ? (
          <ConteudoDoRelatorio inicio={inicio} fim={fim} mes={mes} hojeISO={hojeISO} />
        ) : aba === "aprovacoes" ? (
          <ConteudoDasAprovacoes status={lerStatus(parametros.fila)} />
        ) : (
          <ConteudoDeSolicitar usuarioId={sessao.usuarioId} hojeISO={hojeISO} mes={mes} />
        )}
      </Suspense>
    </div>
  );
}

function lerStatus(valor: string | string[] | undefined): HrStatus {
  const texto = typeof valor === "string" ? valor : "pendente";
  return (["pendente", "aprovada", "reprovada"] as HrStatus[]).includes(texto as HrStatus)
    ? (texto as HrStatus)
    : "pendente";
}

async function ConteudoDaMatriz({
  inicio,
  fim,
  mes,
  podeEditar,
}: {
  inicio: string;
  fim: string;
  mes: string;
  podeEditar: boolean;
}) {
  const [linhas, feriados] = await Promise.all([
    matrizDoPeriodo(inicio, fim),
    feriadosComNome(inicio, fim),
  ]);
  return (
    <MatrizDaEquipe
      linhas={linhas.map((linha) => ({
        ...linha,
        dias: Object.fromEntries(linha.dias),
      }))}
      feriados={feriados}
      inicio={inicio}
      fim={fim}
      mes={mes}
      podeEditar={podeEditar}
    />
  );
}

async function ConteudoDoRelatorio({
  inicio,
  fim,
  mes,
  hojeISO,
}: {
  inicio: string;
  fim: string;
  mes: string;
  hojeISO: string;
}) {
  const [linhas, contagem, feriados] = await Promise.all([
    relatorioDoPeriodo(inicio, fim, hojeISO),
    contarPorStatus(),
    feriadosEntre(inicio, fim),
  ]);

  return (
    <RelatorioGerencial
      linhas={linhas}
      pendentes={contagem.pendente}
      inicio={inicio}
      fim={fim}
      mes={mes}
      feriados={[...feriados]}
      hojeISO={hojeISO}
    />
  );
}

async function ConteudoDasAprovacoes({ status }: { status: HrStatus }) {
  const [fila, contagem] = await Promise.all([filaDeAprovacoes(status), contarPorStatus()]);
  return <Aprovacoes fila={fila} contagem={contagem} filaAtual={status} />;
}

async function ConteudoDeSolicitar({
  usuarioId,
  hojeISO,
  mes,
}: {
  usuarioId: string;
  hojeISO: string;
  mes: string;
}) {
  // O calendário navega por mês, mas a janela de consulta é maior: quem olha
  // dezembro precisa ver o bloqueio que começou em novembro e atravessa.
  const janelaInicio = `${hojeISO.slice(0, 4)}-01-01`;
  const janelaFim = `${Number(hojeISO.slice(0, 4)) + 1}-12-31`;

  const [time, solicitacoes, feriados, bloqueados] = await Promise.all([
    listarTime(),
    minhasSolicitacoes(usuarioId),
    feriadosComNome(janelaInicio, janelaFim),
    diasBloqueadosDaArea(usuarioId, janelaInicio, janelaFim),
  ]);

  const eu = time.find((p) => p.id === usuarioId);
  const usadosNoAno = solicitacoes
    .filter(
      (s) =>
        s.tipo === "ferias" &&
        (s.status === "aprovada" || s.status === "pendente") &&
        s.data_inicio.slice(0, 4) === hojeISO.slice(0, 4),
    )
    .reduce((total, s) => total + s.dias_uteis, 0);

  const parcelasUsadas = solicitacoes.filter(
    (s) =>
      s.tipo === "ferias" &&
      (s.status === "aprovada" || s.status === "pendente") &&
      s.data_inicio.slice(0, 4) === hojeISO.slice(0, 4),
  ).length;

  return (
    <Solicitar
      solicitacoes={solicitacoes}
      feriados={feriados}
      bloqueados={Object.fromEntries(bloqueados)}
      hojeISO={hojeISO}
      mes={mes}
      diasFeriasAno={eu?.diasFeriasAno ?? 15}
      maxParcelas={eu?.maxParcelas ?? 2}
      usadosNoAno={usadosNoAno}
      parcelasUsadas={parcelasUsadas}
      minhaArea={eu?.area ?? "Sem área"}
    />
  );
}
