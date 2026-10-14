import "server-only";

import { cache } from "react";

import { ouFalha } from "@/lib/dados/consulta";
import type {
  EventoDetalhado,
  ItemDoCalendario,
  PessoaDoCalendario,
} from "@/lib/dominio/calendario";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As consultas do Calendário Full.
 *
 * ---------------------------------------------------------------------------
 * TUDO SAI DA VIEW `calendar_events`, e nenhuma consulta aqui repete o filtro
 * de quem pode ver o quê.
 *
 * A view tem `security_invoker`, então a RLS de `events` continua valendo por
 * baixo: a equipe vê a agência e o cliente não alcança evento nenhum, nem o da
 * própria empresa. Repetir esse filtro aqui criaria um segundo lugar onde a
 * regra pode divergir — e o segundo lugar é sempre o que esquece.
 *
 * O que ESTA camada filtra é o que a pessoa PEDIU: o período visível e os
 * clientes. Isso é escolha de quem olha, não permissão.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * TRÊS FILTROS SAÍRAM COM AS CINCO ORIGENS (0105), e os três teriam ficado
 * mentindo.
 *
 *   - `camadas` escolhia entre as seis origens, e sobrou uma;
 *   - `responsaveis` perguntava por `user_id`, que nenhuma origem escreve mais
 *     — ele devolveria ZERO sempre, que é um filtro que só sabe esvaziar a
 *     tela;
 *   - `soMinhas` deixava passar o que tem o meu nome MAIS o que é da agência,
 *     e com `user_id` sempre nulo ele passou a deixar passar tudo — um botão
 *     que não muda nada.
 *
 * `clientes` fica, e é o único que continua respondendo: a feira e o feriado
 * de uma conta têm empresa, a convenção da casa não tem.
 * ---------------------------------------------------------------------------
 */

export type FiltrosDoCalendario = {
  /** A janela visível, já com a folga de uma semana em cada ponta. */
  de: string;
  ate: string;
  clientes?: string[];
};

/**
 * Os itens do período.
 *
 * **Só a janela visível, nunca o ano.** A folga de uma semana em cada ponta é
 * o que faz a grade do mês mostrar os dias vizinhos sem uma segunda ida ao
 * banco.
 *
 * **SÃO DUAS IDAS, E ERAM TRÊS.** A terceira buscava os `profiles` de todos os
 * responsáveis do mês, para desenhar o avatar de quem estava fora e a segunda
 * linha do chip — as duas peças eram da camada de ausência, que saiu na 0105.
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

    if (filtros.clientes?.length) consulta = consulta.in("client_id", filtros.clientes);

    const linhas = ouFalha("itens do calendário", await consulta);

    const idsDeClientes = [
      ...new Set(linhas.map((l) => l.client_id).filter(Boolean)),
    ] as string[];

    const nomeDoCliente = idsDeClientes.length
      ? new Map(
          ouFalha(
            "clientes do calendário",
            await supabase
              .from("clients")
              .select("id, nome_empresa")
              .in("id", idsDeClientes),
          ).map((c) => [c.id, c.nome_empresa]),
        )
      : new Map<string, string>();

    // A TRADUÇÃO DO TÍTULO SAIU COM A AUSÊNCIA, e vale dizer por quê: a view
    // escrevia `h.tipo::text` ali, que é a chave do enum em inglês — a palavra
    // que a 0016 e a 0018 tiraram do produto de propósito —, e a tela a
    // passava por `ROTULOS_DE_TIPO` do Full Days para não desenhá-la crua.
    // `check:cores` não pegaria aquilo, porque o texto vinha do banco. Com a
    // camada fora, o título é `events.nome`, que é o que alguém digitou.
    const itens: ItemDoCalendario[] = linhas.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      titulo: l.titulo,
      dataInicio: l.data_inicio,
      dataFim: l.data_fim,
      clientId: l.client_id,
      cliente: l.client_id ? (nomeDoCliente.get(l.client_id) ?? null) : null,
      status: l.status,
      link: l.link,
    }));

    return itens.sort(
      (a, b) =>
        a.dataInicio.localeCompare(b.dataInicio) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
  },
);

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

// ---------------------------------------------------------------------------
// `cargaDaEquipe()` SAIU COM A LINHA DO TEMPO.
//
// Ela era a única leitora de `carga_da_equipe()`, e aquela grade era a única
// tela que a desenhava. Deixá-la aqui seria um `export` sem chamador — a
// classe de código morto que atravessa o `tsc`, o `lint` e o `build`, e que
// `check:acoes` existe para pegar um andar acima.
//
// **A função do banco fica**, e não vira migration: ela não é schema que
// alguém consulte por engano, e quem ela chama — `carga_do_dia()` (0035) —
// continua sendo a fonte única da conta para o Feedback e para
// `disponibilidade_bruta()`. Devolver a visão é devolver esta função, que o
// git guarda.
// ---------------------------------------------------------------------------

/**
 * Quem é da equipe: o filtro "Filtrar por responsável" e os participantes do
 * evento.
 *
 * **O NOME MUDOU COM A VISÃO.** Ela se chamava `pessoasDaLinhaDoTempo` e
 * devolvia área e capacidade, porque era a Linha do Tempo que agrupava por
 * área e dividia os minutos. Um identificador nomeando uma tela que não
 * existe mais manda quem vier depois procurar por ela — é a camada que a 0088
 * deixou para trás, uma camada acima.
 *
 * Pessoa desligada fica de fora — ela não recebe trabalho novo, e oferecê-la
 * num filtro de responsável é oferecer um recorte que volta sempre vazio.
 */
export const pessoasDaEquipeNoCalendario = cache(
  async (): Promise<PessoaDoCalendario[]> => {
  const supabase = await criarClienteServidor();

  const membros = ouFalha(
    "equipe do calendário",
    await supabase.from("team_members").select("user_id, ativo").eq("ativo", true),
  );

  if (membros.length === 0) return [];

  const perfis = ouFalha(
    "perfis da equipe do calendário",
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
      };
    })
    .filter((p): p is PessoaDoCalendario => p !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
);
