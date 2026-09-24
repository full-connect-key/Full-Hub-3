import type { Metadata } from "next";
import { Suspense } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { forbidden } from "next/navigation";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor, ehSocio } from "@/lib/auth/roles";
import {
  PRIMEIRO_MES_DO_CALENDARIO,
  ULTIMO_MES_DO_CALENDARIO,
} from "@/lib/dominio/full-days";
import {
  contarPorStatus,
  descansoDoCiclo,
  diasBloqueadosDaArea,
  feriadosComNome,
  feriadosEntre,
  filaDeAprovacoes,
  lancamentosDaGestao,
  listarTime,
  matrizDoPeriodo,
  minhasSolicitacoes,
  relatorioDoPeriodo,
} from "@/lib/dados/full-days";
import type { HrStatus, UserRole } from "@/lib/supabase/database.types";

import { AbasDoFullDays, type Aba } from "./abas";
import { Aprovacoes } from "./aprovacoes";
import { Lancamentos } from "./lancamentos";
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
  // DESENVOLVEDOR E SÓCIO, e não só o sócio como a fila de pedidos. Responder
  // a um pedido é decidir sobre o trabalho de alguém, e essa é a decisão que
  // o produto reserva ao sócio; registrar o que já aconteceu é lançar
  // histórico, e trava-lo numa pessoa só é parar o trabalho no dia em que ela
  // estiver fora. É o mesmo `is_gestor()` que a policy de INSERT de
  // `hr_requests` exige para qualquer origem que não seja `solicitacao`.
  lancamentos: ehGestor,
};

const PADRAO: Aba = "solicitar";

function lerAba(valor: string | string[] | undefined): Aba {
  const texto = typeof valor === "string" ? valor : PADRAO;
  return (
    ["matriz", "relatorio", "solicitar", "aprovacoes", "lancamentos"] as Aba[]
  ).includes(
    texto as Aba,
  )
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
  const mes =
    typeof parametros.mes === "string"
      ? parametros.mes
      : format(hoje, "yyyy-MM");
  const referencia = new Date(`${mes}-01T12:00:00`);
  const valida = Number.isNaN(referencia.getTime()) ? hoje : referencia;
  const inicio = format(startOfMonth(valida), "yyyy-MM-dd");
  const fim = format(endOfMonth(valida), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      {/* QUEM RESPONDE FICA NO CABEÇALHO, e é informação e não enfeite: o
          Full Days é o único módulo em que o desenvolvedor NÃO é gestão — a
          primeira linha de `decidir_solicitacao()` exige sócio. Sem essa
          linha, o desenvolvedor abre a tela, não acha a aba de pedidos da
          equipe e conclui que falta permissão a ele. */}
      <PageHeader
        title="Full Days"
        actions={
          <div className="bg-surface-card rounded-card border px-4 py-2.5">
            <p className="text-text-muted text-[11px]">Quem responde</p>
            <p className="text-sm font-medium">
              Sócio — retorno final dos pedidos
            </p>
          </div>
        }
      />

      <AbasDoFullDays atual={aba} visiveis={visiveis} />

      {/* O `key` é DA ABA, e nunca do mês — era o mês nele que zerava a
          seleção do calendário. Trocar `?mes=` remontava esta subárvore
          inteira, e o `Solicitar` novo nascia sem `de` nem `ate`: escolher
          28/10, virar o mês e clicar em 03/11 era impossível. A aba Solicitar
          não usa mais `mes` (o calendário rola), e as outras duas leem o mês
          por propriedade — o esqueleto reaparecer a cada mês custava a
          seleção de quem estava no meio de um pedido. */}
      <Suspense
        key={aba}
        fallback={<LoadingSkeleton variant="table" rows={6} />}
      >
        {aba === "matriz" ? (
          <ConteudoDaMatriz
            inicio={inicio}
            fim={fim}
            mes={mes}
            podeEditar={ehGestor(sessao.profile.role)}
            quemSouEu={sessao.usuarioId}
          />
        ) : aba === "relatorio" ? (
          <ConteudoDoRelatorio
            inicio={inicio}
            fim={fim}
            mes={mes}
            hojeISO={hojeISO}
          />
        ) : aba === "aprovacoes" ? (
          <ConteudoDasAprovacoes status={lerStatus(parametros.fila)} />
        ) : aba === "lancamentos" ? (
          <ConteudoDosLancamentos hojeISO={hojeISO} />
        ) : (
          <ConteudoDeSolicitar usuarioId={sessao.usuarioId} hojeISO={hojeISO} />
        )}
      </Suspense>
    </div>
  );
}

function lerStatus(valor: string | string[] | undefined): HrStatus {
  const texto = typeof valor === "string" ? valor : "pendente";
  return (["pendente", "aprovada", "reprovada"] as HrStatus[]).includes(
    texto as HrStatus,
  )
    ? (texto as HrStatus)
    : "pendente";
}

async function ConteudoDaMatriz({
  inicio,
  fim,
  mes,
  podeEditar,
  quemSouEu,
}: {
  inicio: string;
  fim: string;
  mes: string;
  podeEditar: boolean;
  quemSouEu: string;
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
      quemSouEu={quemSouEu}
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
  const [fila, contagem] = await Promise.all([
    filaDeAprovacoes(status),
    contarPorStatus(),
  ]);
  return <Aprovacoes fila={fila} contagem={contagem} filaAtual={status} />;
}

async function ConteudoDeSolicitar({
  usuarioId,
  hojeISO,
}: {
  usuarioId: string;
  hojeISO: string;
}) {
  // OS BLOQUEIOS VÊM DA JANELA INTEIRA, de uma vez. Buscá-los um mês de cada
  // vez faria o bug voltar de outra forma: a pessoa rolaria até março e veria
  // um mês sem bloqueio nenhum, porque a consulta dele ainda não aconteceu.
  //
  // E a janela é EXATAMENTE a do calendário, pelas mesmas duas constantes.
  // Uma janela menor que ele não recusa nada nem avisa: a pessoa rola até um
  // mês que existe na tela e o vê sem feriado e sem ninguém fora — o que não
  // parece uma consulta curta, parece um mês vazio.
  const janelaInicio = `${PRIMEIRO_MES_DO_CALENDARIO}-01`;
  const janelaFim = `${ULTIMO_MES_DO_CALENDARIO}-31`;

  const [time, solicitacoes, feriados, bloqueados, descanso] = await Promise.all([
    listarTime(),
    minhasSolicitacoes(usuarioId),
    feriadosComNome(janelaInicio, janelaFim),
    diasBloqueadosDaArea(usuarioId, janelaInicio, janelaFim),
    descansoDoCiclo(usuarioId),
  ]);

  const eu = time.find((p) => p.id === usuarioId);

  // O SALDO VEM DO BANCO, e a tela não o recalcula. Ele depende do ciclo de
  // 12 meses contado da entrada da pessoa (migration 0039), e a data de
  // entrada não viaja na lista de pedidos — somar aqui daria um número que a
  // trava do `insert` não cumpre.
  return (
    <Solicitar
      solicitacoes={solicitacoes}
      feriados={feriados}
      bloqueados={Object.fromEntries(bloqueados)}
      hojeISO={hojeISO}
      diasPorCiclo={eu?.diasFeriasAno ?? 15}
      parcelasPorCiclo={eu?.maxParcelas ?? 2}
      descanso={descanso}
      minhaArea={eu?.area ?? "Sem área"}
    />
  );
}

/**
 * Os dados da aba de lançamentos.
 *
 * A janela de feriados é a MESMA do calendário, pelas duas constantes de
 * `lib/dominio/full-days.ts`. Ela serve à conta de dias úteis dos outros dois
 * tipos: um ano sem feriado na tabela não aparece vazio, aparece normal — o
 * Natal de 2029 viraria um dia útil qualquer e um afastamento de três dias em
 * cima dele sairia com três no lugar de dois.
 */
async function ConteudoDosLancamentos({ hojeISO }: { hojeISO: string }) {
  const [lancamentos, time, feriados] = await Promise.all([
    lancamentosDaGestao(),
    listarTime(),
    feriadosComNome(
      `${PRIMEIRO_MES_DO_CALENDARIO}-01`,
      `${ULTIMO_MES_DO_CALENDARIO}-31`,
    ),
  ]);

  return (
    <Lancamentos
      lancamentos={lancamentos}
      time={time}
      feriados={feriados}
      hojeISO={hojeISO}
    />
  );
}
