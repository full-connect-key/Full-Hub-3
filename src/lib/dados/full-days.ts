import "server-only";

import { cache } from "react";

import { DIAS_DE_DESCANSO_PADRAO } from "@/lib/dominio/full-days";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  HrRequest,
  HrStatus,
  PresencaStatus,
  TeamPresence,
} from "@/lib/supabase/database.types";

/**
 * As consultas do Full Days.
 *
 * O que atravessa todas elas: **a área é o agrupamento que importa.** Quem
 * decide o descanso precisa saber quem mais do mesmo time está fora, porque duas
 * designers fora na mesma semana param a produção — e dois redatores fora não
 * se notam se o time de redação tem cinco pessoas. Por isso quase toda consulta
 * aqui devolve a área junto.
 */

export type PessoaDoTime = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  area: string;
  cargo: string | null;
  diasFeriasAno: number;
  maxParcelas: number;
};

export type DiaDaMatriz = {
  data: string;
  status: PresencaStatus;
  observacao: string | null;
  /** Veio de pedido aprovado, e por isso não se edita na mão. */
  deSolicitacao: boolean;
};

export type LinhaDaMatriz = PessoaDoTime & {
  dias: Map<string, DiaDaMatriz>;
  /**
   * Dias de descanso que ainda restam no ano.
   *
   * Fica ao lado do nome na matriz porque é a pergunta seguinte de quem está
   * olhando a grade: vi que fulana está fora, e agora quero saber quanto ela
   * ainda tem. PENDENTE CONTA COMO USADO — é a mesma régua de
   * `saldo_de_ferias()` no banco, e sem ela a pessoa proporia os 15 dias duas
   * vezes enquanto o primeiro pedido espera resposta.
   */
  saldo: number;
};

export type SolicitacaoNaTela = HrRequest & {
  pessoa: PessoaDoTime | null;
  /** Quem mais da mesma área já está fora naquele período. */
  colegasFora: { nome: string; inicio: string; fim: string }[];
};

const SEM_AREA = "Sem área";

/** Todo mundo da equipe que está ativo, com a ficha de RH. */
export const listarTime = cache(async (): Promise<PessoaDoTime[]> => {
  const supabase = await criarClienteServidor();

  const { data: perfis } = await supabase
    .from("profiles")
    .select("id, nome, avatar_url, role, ativo")
    .neq("role", "cliente")
    .eq("ativo", true)
    .order("nome");

  const pessoas = perfis ?? [];
  if (pessoas.length === 0) return [];

  const { data: fichas } = await supabase
    .from("team_members")
    .select("user_id, area, cargo, ativo, dias_ferias_ano, max_parcelas_ferias")
    .in(
      "user_id",
      pessoas.map((p) => p.id),
    );

  const porUsuario = new Map((fichas ?? []).map((f) => [f.user_id, f]));

  return pessoas
    // Quem foi desligado sai da matriz e do relatório. O registro fica no
    // banco — é o que preserva a autoria do que foi feito —, mas a pessoa não
    // aparece mais numa grade de "quem está onde hoje".
    .filter((p) => porUsuario.get(p.id)?.ativo !== false)
    .map((p) => {
      const ficha = porUsuario.get(p.id);
      return {
        id: p.id,
        nome: p.nome,
        avatarUrl: p.avatar_url,
        area: ficha?.area?.trim() || SEM_AREA,
        cargo: ficha?.cargo ?? null,
        diasFeriasAno: ficha?.dias_ferias_ano ?? DIAS_DE_DESCANSO_PADRAO,
        maxParcelas: ficha?.max_parcelas_ferias ?? 2,
      };
    });
});

/** Os feriados de um intervalo, como conjunto de datas ISO. */
export async function feriadosEntre(inicio: string, fim: string): Promise<Set<string>> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("holidays")
    .select("data")
    .gte("data", inicio)
    .lte("data", fim);
  return new Set((data ?? []).map((h) => h.data));
}

export async function feriadosComNome(
  inicio: string,
  fim: string,
): Promise<{ data: string; nome: string }[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("holidays")
    .select("data, nome")
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");
  return data ?? [];
}

/**
 * A matriz: uma linha por pessoa, um mapa de dias dentro.
 *
 * Mapa e não array porque a grade pergunta "que status tem esta pessoa neste
 * dia?" milhares de vezes ao desenhar — um `find` por célula seria quadrático
 * no tamanho do time vezes o do período.
 */
export async function matrizDoPeriodo(
  inicio: string,
  fim: string,
): Promise<LinhaDaMatriz[]> {
  const supabase = await criarClienteServidor();
  const time = await listarTime();
  if (time.length === 0) return [];

  const ano = inicio.slice(0, 4);

  // Uma consulta para a equipe inteira, e não uma por pessoa: numa agência de
  // vinte pessoas seriam vinte idas ao banco para pintar uma grade.
  const [{ data: presencas }, { data: descansos }] = await Promise.all([
    supabase.from("team_presence").select("*").gte("data", inicio).lte("data", fim),
    supabase
      .from("hr_requests")
      .select("user_id, dias_uteis, status, data_inicio")
      .eq("tipo", "ferias")
      .in("status", ["aprovada", "pendente"])
      .gte("data_inicio", `${ano}-01-01`)
      .lte("data_inicio", `${ano}-12-31`),
  ]);

  const usadosDe = new Map<string, number>();
  for (const pedido of descansos ?? []) {
    usadosDe.set(pedido.user_id, (usadosDe.get(pedido.user_id) ?? 0) + pedido.dias_uteis);
  }

  const porPessoa = new Map<string, TeamPresence[]>();
  for (const linha of presencas ?? []) {
    const atual = porPessoa.get(linha.user_id) ?? [];
    atual.push(linha);
    porPessoa.set(linha.user_id, atual);
  }

  return time.map((pessoa) => ({
    ...pessoa,
    saldo: Math.max(0, pessoa.diasFeriasAno - (usadosDe.get(pessoa.id) ?? 0)),
    dias: new Map(
      (porPessoa.get(pessoa.id) ?? []).map((linha) => [
        linha.data,
        {
          data: linha.data,
          status: linha.status,
          observacao: linha.observacao,
          deSolicitacao: linha.hr_request_id !== null,
        },
      ]),
    ),
  }));
}

/** Os pedidos de uma pessoa, do mais recente para trás. */
export async function minhasSolicitacoes(usuarioId: string): Promise<HrRequest[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("hr_requests")
    .select("*")
    .eq("user_id", usuarioId)
    .order("data_inicio", { ascending: false });
  return data ?? [];
}

/**
 * A fila de aprovações, com o contexto que o sócio precisa para decidir.
 *
 * "Quem mais da mesma área está fora neste período" é a informação que
 * transforma a decisão: aprovar duas designers na mesma semana é o erro que
 * este módulo existe para evitar, e ninguém percebe isso olhando um pedido de
 * cada vez.
 */
export async function filaDeAprovacoes(status: HrStatus): Promise<SolicitacaoNaTela[]> {
  const supabase = await criarClienteServidor();
  const time = await listarTime();
  const porPessoa = new Map(time.map((p) => [p.id, p]));

  const { data: pedidos } = await supabase
    .from("hr_requests")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: status === "pendente" });

  const lista = pedidos ?? [];
  if (lista.length === 0) return [];

  // Os aprovados servem de contexto para todos os pendentes de uma vez — uma
  // consulta, e não uma por pedido.
  const { data: aprovados } = await supabase
    .from("hr_requests")
    .select("user_id, data_inicio, data_fim")
    .eq("status", "aprovada");

  return lista.map((pedido) => {
    const pessoa = porPessoa.get(pedido.user_id) ?? null;

    const colegasFora = (aprovados ?? [])
      .filter((outro) => {
        if (outro.user_id === pedido.user_id) return false;
        const colega = porPessoa.get(outro.user_id);
        if (!colega || !pessoa || colega.area !== pessoa.area) return false;
        return outro.data_inicio <= pedido.data_fim && outro.data_fim >= pedido.data_inicio;
      })
      .map((outro) => ({
        nome: porPessoa.get(outro.user_id)?.nome ?? "—",
        inicio: outro.data_inicio,
        fim: outro.data_fim,
      }));

    return { ...pedido, pessoa, colegasFora };
  });
}

export async function contarPorStatus(): Promise<Record<HrStatus, number>> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("hr_requests").select("status");

  const contagem: Record<HrStatus, number> = {
    pendente: 0,
    aprovada: 0,
    reprovada: 0,
    cancelada: 0,
  };
  for (const linha of data ?? []) contagem[linha.status] += 1;
  return contagem;
}

/**
 * Os dias bloqueados no calendário de quem está pedindo.
 *
 * Bloqueado = já tem alguém da MESMA ÁREA com pedido aprovado naquele dia. Não
 * é uma proibição absoluta — é o que evita a agência descobrir no dia que
 * ninguém da produção está.
 *
 * Devolve o nome de quem está fora, porque "este dia está bloqueado" sem dizer
 * por quem é o tipo de recusa que a pessoa não tem como contornar nem entender.
 */
export async function diasBloqueadosDaArea(
  usuarioId: string,
  inicio: string,
  fim: string,
): Promise<Map<string, string[]>> {
  const supabase = await criarClienteServidor();
  const time = await listarTime();

  const eu = time.find((p) => p.id === usuarioId);
  if (!eu) return new Map();

  const colegas = time.filter((p) => p.area === eu.area && p.id !== usuarioId);
  if (colegas.length === 0) return new Map();

  const { data: aprovados } = await supabase
    .from("hr_requests")
    .select("user_id, data_inicio, data_fim")
    .eq("status", "aprovada")
    .in(
      "user_id",
      colegas.map((c) => c.id),
    )
    .lte("data_inicio", fim)
    .gte("data_fim", inicio);

  const porNome = new Map(colegas.map((c) => [c.id, c.nome]));
  const bloqueados = new Map<string, string[]>();

  for (const pedido of aprovados ?? []) {
    const nome = porNome.get(pedido.user_id) ?? "—";
    const cursor = new Date(`${pedido.data_inicio}T12:00:00`);
    const ate = new Date(`${pedido.data_fim}T12:00:00`);
    while (cursor <= ate) {
      const iso = cursor.toISOString().slice(0, 10);
      if (iso >= inicio && iso <= fim) {
        const atual = bloqueados.get(iso) ?? [];
        if (!atual.includes(nome)) atual.push(nome);
        bloqueados.set(iso, atual);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return bloqueados;
}

/**
 * O relatório gerencial.
 *
 * TIRADAS e AGENDADAS são coisas diferentes, e o sprint pede as duas separadas
 * por um motivo prático: quem já tirou 10 dias em março e tem 5 agendados para
 * dezembro tem saldo zero, mas a agência ainda vai ficar sem essa pessoa uma
 * semana. Um número só esconderia isso.
 *
 * O ALERTA DE QUEM ESTÁ HÁ MUITO TEMPO SEM DESCANSO é risco de entrega e de
 * esgotamento: ninguém entrega no mesmo ritmo por doze meses seguidos. Por
 * isso ele não é mais uma coluna da tabela — aparece em destaque próprio.
 *
 * O texto deste alerta já foi outro, e a versão anterior afirmava que a
 * empresa "passa a dever em dobro" — o art. 137 da CLT escrito num produto
 * usado por uma equipe toda PJ. Veja o cabeçalho de `relatorio.tsx`.
 */
export type LinhaDoRelatorio = PessoaDoTime & {
  tiradas: number;
  agendadas: number;
  pendentes: number;
  saldo: number;
  ausencias: number;
  licencas: number;
  /** Null quando nunca houve descanso: aí a conta é desde o início do contrato. */
  ultimasFerias: string | null;
  admissao: string | null;
  /** Meses desde o último descanso. Null quando não há admissão cadastrada. */
  mesesSemFerias: number | null;
  vencendo: boolean;
};

export async function relatorioDoPeriodo(
  inicio: string,
  fim: string,
  hojeISO: string,
): Promise<LinhaDoRelatorio[]> {
  const supabase = await criarClienteServidor();
  const time = await listarTime();
  if (time.length === 0) return [];

  const ano = Number(hojeISO.slice(0, 4));
  const ids = time.map((p) => p.id);

  const [{ data: pedidos }, { data: fichas }] = await Promise.all([
    supabase.from("hr_requests").select("*").in("user_id", ids),
    supabase.from("team_members").select("user_id, data_admissao").in("user_id", ids),
  ]);

  const admissaoDe = new Map((fichas ?? []).map((f) => [f.user_id, f.data_admissao]));

  return time.map((pessoa) => {
    const meus = (pedidos ?? []).filter((p) => p.user_id === pessoa.id);

    const feriasDoAno = meus.filter(
      (p) => p.tipo === "ferias" && p.data_inicio.slice(0, 4) === String(ano),
    );

    // Usada é a que já começou; agendada é a combinada que ainda vem. A régua
    // é a data de início comparada com hoje, e não o status: um descanso
    // combinado em janeiro para dezembro não foi "usado".
    const tiradas = feriasDoAno
      .filter((p) => p.status === "aprovada" && p.data_inicio <= hojeISO)
      .reduce((total, p) => total + p.dias_uteis, 0);

    const agendadas = feriasDoAno
      .filter((p) => p.status === "aprovada" && p.data_inicio > hojeISO)
      .reduce((total, p) => total + p.dias_uteis, 0);

    const pendentes = feriasDoAno
      .filter((p) => p.status === "pendente")
      .reduce((total, p) => total + p.dias_uteis, 0);

    const noPeriodo = (p: HrRequest) =>
      p.status === "aprovada" && p.data_inicio <= fim && p.data_fim >= inicio;

    const ausencias = meus
      .filter((p) => p.tipo === "ausencia" && noPeriodo(p))
      .reduce((total, p) => total + p.dias_uteis, 0);

    const licencas = meus
      .filter((p) => p.tipo === "licenca" && noPeriodo(p))
      .reduce((total, p) => total + p.dias_uteis, 0);

    const ultimasFerias =
      meus
        .filter((p) => p.tipo === "ferias" && p.status === "aprovada" && p.data_inicio <= hojeISO)
        .map((p) => p.data_fim)
        .sort()
        .at(-1) ?? null;

    const admissao = admissaoDe.get(pessoa.id) ?? null;
    const referencia = ultimasFerias ?? admissao;
    const mesesSemFerias = referencia ? mesesEntre(referencia, hojeISO) : null;

    return {
      ...pessoa,
      tiradas,
      agendadas,
      pendentes,
      saldo: pessoa.diasFeriasAno - tiradas - agendadas - pendentes,
      ausencias,
      licencas,
      ultimasFerias,
      admissao,
      mesesSemFerias,
      vencendo: mesesSemFerias !== null && mesesSemFerias >= 12,
    };
  });
}

function mesesEntre(deISO: string, ateISO: string): number {
  const [a1, m1, d1] = deISO.split("-").map(Number);
  const [a2, m2, d2] = ateISO.split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return meses;
}

/** Quem está fora hoje, para o cartão de indicador e para o Sprint 15. */
export async function foraHoje(hojeISO: string): Promise<
  { nome: string; area: string; status: PresencaStatus }[]
> {
  const supabase = await criarClienteServidor();
  const time = await listarTime();
  const porPessoa = new Map(time.map((p) => [p.id, p]));

  const { data } = await supabase
    .from("team_presence")
    .select("user_id, status")
    .eq("data", hojeISO)
    .in("status", ["ferias", "licenca", "ausente"]);

  return (data ?? [])
    .map((linha) => {
      const pessoa = porPessoa.get(linha.user_id);
      if (!pessoa) return null;
      return { nome: pessoa.nome, area: pessoa.area, status: linha.status };
    })
    .filter(Boolean) as { nome: string; area: string; status: PresencaStatus }[];
}

export type LancamentoNaTela = HrRequest & {
  pessoa: PessoaDoTime | null;
  /** Quem registrou. Nome, não id — a tela mostra "por Ana Souza". */
  lancadoPor: string | null;
};

/**
 * Os períodos que a gestão REGISTROU, e não os que alguém propôs.
 *
 * O filtro é `origem <> 'solicitacao'`, e é o que separa as duas coisas na
 * mesma tabela: um pedido tem uma decisão por trás, um lançamento tem um fato.
 * Misturá-los numa lista só faria a gestão procurar, entre trinta linhas, as
 * três que ela pode corrigir — porque `corrigir_lancamento()` recusa as
 * outras, e a tela ofereceria um botão que o banco nega.
 *
 * A ordem é por data de início, do mais recente para o mais antigo: quem abre
 * esta aba acabou de lançar alguma coisa, ou veio conferir o que lançou.
 *
 * **Não repete filtro de permissão**, e a ausência é a regra da casa: a
 * policy de SELECT de `hr_requests` já decide quem enxerga o quê. Repetir
 * aqui criaria o segundo lugar onde a regra pode divergir — e é sempre o
 * segundo que esquece.
 */
export async function lancamentosDaGestao(): Promise<LancamentoNaTela[]> {
  const supabase = await criarClienteServidor();
  const time = await listarTime();
  const porPessoa = new Map(time.map((p) => [p.id, p]));

  const { data } = await supabase
    .from("hr_requests")
    .select("*")
    .neq("origem", "solicitacao")
    .order("data_inicio", { ascending: false });

  return (data ?? []).map((pedido) => ({
    ...pedido,
    pessoa: porPessoa.get(pedido.user_id) ?? null,
    lancadoPor: pedido.lancado_por
      ? (porPessoa.get(pedido.lancado_por)?.nome ?? null)
      : null,
  }));
}

export type DescansoDoCiclo = {
  /** Quando começou o ciclo de 12 meses em que a pessoa está. */
  inicioDoCiclo: string | null;
  ciclos: number;
  diasConcedidos: number;
  diasUsados: number;
  saldo: number;
  parcelasConcedidas: number;
  parcelasUsadas: number;
};

/**
 * O saldo de descanso, perguntado ao banco.
 *
 * **A TELA NÃO SOMA MAIS ISTO SOZINHA**, e não é preferência de estilo. Até a
 * 0039 o saldo era `15 - (soma dos pedidos deste ano)`, uma conta que o
 * navegador conseguia fazer com a lista de pedidos na mão. O ciclo de 12 meses
 * depende da **data de entrada da pessoa**, que a lista de pedidos não carrega
 * — e a trava do banco depende dela também. Duas contas com entradas
 * diferentes é o começo de duas verdades, e elas divergiriam no pior lugar: a
 * tela prometendo dias que o `insert` recusa.
 *
 * É a mesma decisão de `situacaoDoLancamento()` no Financeiro, pelo avesso:
 * lá os dois lados calculam porque a tela precisa da resposta a cada segundo;
 * aqui um lado pergunta porque o outro é quem sabe.
 */
export async function descansoDoCiclo(
  usuarioId: string,
): Promise<DescansoDoCiclo | null> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("descanso_do_ciclo", {
    p_user_id: usuarioId,
  });

  const linha = data?.[0];
  if (!linha) return null;

  return {
    inicioDoCiclo: linha.inicio_do_ciclo,
    ciclos: linha.ciclos,
    diasConcedidos: linha.dias_concedidos,
    diasUsados: linha.dias_usados,
    saldo: linha.saldo,
    parcelasConcedidas: linha.parcelas_concedidas,
    parcelasUsadas: linha.parcelas_usadas,
  };
}
