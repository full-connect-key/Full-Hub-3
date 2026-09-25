import "server-only";

import { cache } from "react";

import { ouFalha } from "@/lib/dados/consulta";
import type {
  CargaDeUmDia,
  ItemDoCalendario,
} from "@/lib/dominio/calendario";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EventoTipo, TipoNoCalendario } from "@/lib/supabase/database.types";

/**
 * As consultas do Calendário Full.
 *
 * ---------------------------------------------------------------------------
 * TUDO SAI DA VIEW `calendar_events`, e nenhuma consulta aqui repete o filtro
 * de quem pode ver o quê.
 *
 * A view tem `security_invoker`, então a RLS das sete tabelas de origem
 * continua valendo por baixo: a equipe vê a agência, o cliente vê o que foi
 * enviado para ele, e o rascunho não existe para ninguém. Repetir esses
 * filtros aqui criaria um segundo lugar onde a regra pode divergir — e o
 * segundo lugar é sempre o que esquece.
 *
 * O que ESTA camada filtra é o que a pessoa PEDIU: o período visível, os
 * clientes, os responsáveis. Isso é escolha de quem olha, não permissão.
 * ---------------------------------------------------------------------------
 */

export type FiltrosDoCalendario = {
  /** A janela visível, já com a folga de uma semana em cada ponta. */
  de: string;
  ate: string;
  clientes?: string[];
  responsaveis?: string[];
  camadas?: TipoNoCalendario[];
  /** "Só minha pauta": o que tem o meu nome, mais o que é da agência inteira. */
  soMinhas?: string | null;
};

/**
 * Os itens do período.
 *
 * **Só a janela visível, nunca o ano.** A view lê sete tabelas; pedir doze
 * meses de uma vez é pedir sete varreduras grandes para desenhar trinta e um
 * dias. A folga de uma semana em cada ponta é o que faz a grade do mês
 * mostrar os dias vizinhos sem uma segunda ida ao banco.
 */
export const itensDoCalendario = cache(
  async (filtros: FiltrosDoCalendario): Promise<ItemDoCalendario[]> => {
    const supabase = await criarClienteServidor();

    let consulta = supabase
      .from("calendar_events")
      .select("*")
      // Um item entra quando ATRAVESSA a janela, e não quando começa dentro
      // dela: uma feira de 28/09 a 03/10 precisa aparecer em outubro. Com
      // `gte(data_inicio)` ela sumiria do mês em que está acontecendo.
      .lte("data_inicio", filtros.ate)
      .gte("data_fim", filtros.de);

    if (filtros.camadas?.length) consulta = consulta.in("tipo", filtros.camadas);
    if (filtros.clientes?.length) consulta = consulta.in("client_id", filtros.clientes);
    if (filtros.responsaveis?.length)
      consulta = consulta.in("user_id", filtros.responsaveis);

    const linhas = ouFalha("itens do calendário", await consulta);

    const idsDeClientes = [
      ...new Set(linhas.map((l) => l.client_id).filter(Boolean)),
    ] as string[];
    const idsDePessoas = [
      ...new Set(linhas.map((l) => l.user_id).filter(Boolean)),
    ] as string[];

    const [clientes, pessoas] = await Promise.all([
      idsDeClientes.length
        ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
        : Promise.resolve({ data: [], error: null }),
      idsDePessoas.length
        ? supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDePessoas)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const nomeDoCliente = new Map(
      ouFalha("clientes do calendário", clientes).map((c) => [c.id, c.nome_empresa]),
    );
    const porPessoa = new Map(
      ouFalha("pessoas do calendário", pessoas).map((p) => [p.id, p]),
    );

    const itens: ItemDoCalendario[] = linhas.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      titulo: l.titulo,
      dataInicio: l.data_inicio,
      dataFim: l.data_fim,
      clientId: l.client_id,
      cliente: l.client_id ? (nomeDoCliente.get(l.client_id) ?? null) : null,
      userId: l.user_id,
      pessoa: l.user_id ? (porPessoa.get(l.user_id) ?? null) : null,
      prioridade: l.prioridade,
      status: l.status,
      link: l.link,
    }));

    // "SÓ MINHA PAUTA" INCLUI O QUE É DA AGÊNCIA, e é o ponto do filtro. Ele
    // responde "o que eu preciso saber hoje", e a convenção da semana que vem
    // é parte disso mesmo não tendo o meu nome. Filtrar só por `user_id`
    // esconderia justamente o que muda o meu dia sem ser meu.
    const meus = filtros.soMinhas
      ? itens.filter((i) => i.userId === filtros.soMinhas || i.userId === null)
      : itens;

    return meus.sort(
      (a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
  },
);

export type EventoDetalhado = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: EventoTipo;
  clientId: string | null;
  cliente: string | null;
  dataInicio: string;
  dataFim: string;
  diaInteiro: boolean;
  horaInicio: string | null;
  horaFim: string | null;
  local: string | null;
  link: string | null;
  bloqueiaFerias: boolean;
  participantes: { id: string; nome: string; avatar_url: string | null }[];
};

export const obterEvento = cache(
  async (id: string): Promise<EventoDetalhado | null> => {
    const supabase = await criarClienteServidor();

    // `limit(1)` E NAO `maybeSingle()`, e nao e estilo.
    //
    // A resposta de `maybeSingle()` e uma UNIAO de duas formas -- a de sucesso
    // com `data: Row | null` e a de falha com `data: null` --, e a inferencia
    // de `ouFalha` colapsa as duas em `never`: o tipo some e tudo depois vira
    // erro de compilacao. `campanhas.ts` resolve isso com um `as`, que faz o
    // erro calar sem fazer o tipo voltar. Com `limit(1)` a forma e uma so,
    // `Row[]`, e o tipo continua de pe ate o fim da funcao. O `id` e chave
    // primaria: nao ha caso de duas linhas para a checagem do `maybeSingle`
    // proteger.
    const achados = ouFalha(
      "evento",
      await supabase.from("events").select("*").eq("id", id).limit(1),
    );
    const evento = achados[0];
    if (!evento) return null;

    const vinculos = ouFalha(
      "participantes do evento",
      await supabase.from("event_participants").select("user_id").eq("event_id", id),
    );

    const ids = vinculos.map((v) => v.user_id);
    const pessoas = ids.length
      ? ouFalha(
          "pessoas do evento",
          await supabase.from("profiles").select("id, nome, avatar_url").in("id", ids),
        )
      : [];

    const empresas = evento.client_id
      ? ouFalha(
          "cliente do evento",
          await supabase
            .from("clients")
            .select("nome_empresa")
            .eq("id", evento.client_id)
            .limit(1),
        )
      : [];

    return {
      id: evento.id,
      nome: evento.nome,
      descricao: evento.descricao,
      tipo: evento.tipo,
      clientId: evento.client_id,
      cliente: empresas[0]?.nome_empresa ?? null,
      dataInicio: evento.data_inicio,
      dataFim: evento.data_fim,
      diaInteiro: evento.dia_inteiro,
      horaInicio: evento.hora_inicio,
      horaFim: evento.hora_fim,
      local: evento.local,
      link: evento.link,
      bloqueiaFerias: evento.bloqueia_ferias,
      participantes: pessoas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    };
  },
);

/**
 * A carga de cada pessoa em cada dia útil do período.
 *
 * **Uma chamada só, e ela não recalcula nada:** `carga_da_equipe()` percorre e
 * chama `carga_do_dia()`, que é a fonte única desde a 0035. Uma chamada por
 * célula seriam trezentas idas ao banco para desenhar uma tela.
 */
export const cargaDaEquipe = cache(
  async (inicio: string, fim: string): Promise<CargaDeUmDia[]> => {
    const supabase = await criarClienteServidor();

    const linhas = ouFalha(
      "carga da equipe",
      await supabase.rpc("carga_da_equipe", { p_inicio: inicio, p_fim: fim }),
    );

    return (linhas ?? []).map((l) => ({
      userId: l.user_id,
      dia: l.dia,
      minutos: l.minutos_comprometidos,
      etapas: l.etapas,
      semEstimativa: l.etapas_sem_estimativa,
      ausente: l.ausente,
    }));
  },
);

export type PessoaDaLinha = {
  id: string;
  nome: string;
  avatar_url: string | null;
  area: string | null;
  capacidadeMinutos: number;
};

/**
 * As linhas da Linha do Tempo: quem é da equipe, agrupado por área.
 *
 * Pessoa desligada fica de fora — ela não recebe trabalho novo, e uma linha
 * vazia por alguém que saiu empurra para baixo quem está trabalhando.
 */
export const pessoasDaLinhaDoTempo = cache(async (): Promise<PessoaDaLinha[]> => {
  const supabase = await criarClienteServidor();

  const membros = ouFalha(
    "equipe da linha do tempo",
    await supabase
      .from("team_members")
      .select("user_id, area, capacidade_minutos_dia, ativo")
      .eq("ativo", true),
  );

  if (membros.length === 0) return [];

  const perfis = ouFalha(
    "perfis da linha do tempo",
    await supabase
      .from("profiles")
      .select("id, nome, avatar_url, ativo")
      .in(
        "id",
        membros.map((m) => m.user_id),
      ),
  );

  const porId = new Map(perfis.filter((p) => p.ativo).map((p) => [p.id, p]));

  return membros
    .map((m) => {
      const perfil = porId.get(m.user_id);
      if (!perfil) return null;
      return {
        id: perfil.id,
        nome: perfil.nome,
        avatar_url: perfil.avatar_url,
        area: m.area,
        capacidadeMinutos: m.capacidade_minutos_dia,
      };
    })
    .filter((p): p is PessoaDaLinha => p !== null)
    .sort(
      (a, b) =>
        (a.area ?? "zzz").localeCompare(b.area ?? "zzz", "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
});
