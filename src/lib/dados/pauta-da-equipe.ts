import "server-only";

import { cache } from "react";

import { ouFalha } from "@/lib/dados/consulta";
import { MINIMO_PARA_BUSCAR } from "@/lib/dominio/busca";
import { hojeNaAgencia, segundaDaSemana, somarDias } from "@/lib/dominio/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A CARGA DA EQUIPE NESTA SEMANA — a primeira leitura de `carga_da_equipe()`.
 *
 * ---------------------------------------------------------------------------
 * ELA EXISTE NO BANCO DESDE A 0055 E NUNCA TEVE LEITOR, e o CLAUDE.md escreve
 * a instrução de onde ele voltaria: *"`carga_da_equipe()` fica no banco, sem
 * leitor (…) devolver a visão é devolver uma função em `lib/dados/`, que o git
 * guarda"*. É esta função.
 *
 * **O QUE ELA DEVOLVE É A PERGUNTA QUE FICOU SEM CASA.** A Linha do Tempo do
 * Calendário Full era a única tela que respondia *"a equipe aguenta?"* — a cor
 * da célula dela era OCUPAÇÃO e não camada —, e ela saiu por decisão do
 * usuário. O que ficou no lugar responde por UMA pessoa (a faixa de
 * disponibilidade) ou por um mês que passou (os alertas de carga do
 * Feedback). O retrato da equipe inteira na semana corrente não existia.
 *
 * **E A ESCALA É A MESMA**, pelos mesmos quatro degraus: quem desenha chama
 * `nivelDaCarga()` e `COR_DO_NIVEL` de `lib/dominio/calendario.ts`. Duas
 * escalas para a mesma pergunta seriam descobertas pela pessoa no dia em que
 * uma tela pintasse de verde o dia que a outra pintou de âmbar.
 * ---------------------------------------------------------------------------
 *
 * **A SEMANA É A CORRENTE, e não há navegação**, que é uma ausência escolhida:
 * a pergunta desta tela é a da segunda-feira — *o que acontece nesta semana?*
 * —, e um seletor de semana aqui seria um terceiro estado na URL de uma tela
 * que já carrega a seção e a pessoa escolhida. Quem quiser a semana que vem
 * pede, e aí é um parâmetro só.
 *
 * **SÃO OS CINCO DIAS ÚTEIS, porque é o que a função devolve:**
 * `carga_da_equipe()` filtra `extract(isodow from d) < 6` desde a 0055 — fim
 * de semana não tem coluna, e inventar duas vazias diria que a agência
 * trabalha sábado.
 *
 * **ELA NÃO DERRUBA A TELA, e é a exceção declarada ao `ouFalha` do RPC.** A
 * seção inteira funciona sem a grade — a pauta de cada pessoa é outra consulta
 * —, e o que uma grade vazia afirmaria é que ninguém tem nada esta semana, que
 * é o pior jeito de uma leitura falhar. Devolvendo nulo, a tela diz que não
 * conseguiu ler; o erro vai para o log, pela regra de nada falhar calado. É a
 * decisão de `portaoDoPost()` e do selo de "programado".
 */
export type DiaDaCarga = {
  /** `AAAA-MM-DD`. */
  dia: string;
  minutos: number;
  etapas: number;
  /** A pessoa está fora neste dia — day off, afastamento ou ausência pontual. */
  ausente: boolean;
};

export type PessoaNaPauta = {
  id: string;
  nome: string;
  avatar_url: string | null;
  /** O expediente dela, por dia. 540 minutos é o padrão da casa (0081). */
  capacidadeMinutos: number;
  /** Um por dia útil da semana, na ordem de `dias`. */
  dias: DiaDaCarga[];
};

export type CargaDaEquipe = {
  /** Os cinco dias úteis, de segunda a sexta. */
  dias: string[];
  /** O dia de hoje, quando ele cai nesta semana — a coluna que a grade marca. */
  hoje: string | null;
  pessoas: PessoaNaPauta[];
};

export const cargaDaEquipeNaSemana = cache(
  async (): Promise<CargaDaEquipe | null> => {
    const supabase = await criarClienteServidor();

    // O FUSO É O DA AGÊNCIA, e não o do processo: o container roda em UTC, e
    // das 21h à meia-noite "hoje" já é amanhã — numa segunda-feira à noite a
    // grade abriria na semana seguinte.
    const hoje = hojeNaAgencia();
    const segunda = segundaDaSemana(hoje);
    const dias = [0, 1, 2, 3, 4].map((n) => somarDias(segunda, n));
    const sexta = dias[4];

    const { data: carga, error } = await supabase.rpc("carga_da_equipe", {
      p_inicio: segunda,
      p_fim: sexta,
    });

    if (error) {
      console.error("[consulta:carga da equipe]", error);
      return null;
    }

    const membros = ouFalha(
      "equipe da pauta",
      await supabase
        .from("team_members")
        .select("user_id, capacidade_minutos_dia, ativo")
        .eq("ativo", true),
    );

    if (membros.length === 0) return { dias, hoje: dias.includes(hoje) ? hoje : null, pessoas: [] };

    const perfis = ouFalha(
      "perfis da pauta da equipe",
      await supabase
        .from("profiles")
        .select("id, nome, avatar_url, ativo")
        .in(
          "id",
          membros.map((m) => m.user_id),
        ),
    );

    const porId = new Map(perfis.filter((p) => p.ativo).map((p) => [p.id, p]));

    // A CARGA DE CADA PESSOA EM CADA DIA, indexada pelo par. A função devolve
    // uma linha por pessoa por dia útil, então o mapa é a forma de a grade
    // perguntar sem varrer a lista cinco vezes por pessoa.
    const porPessoaEDia = new Map<string, DiaDaCarga>();
    for (const linha of carga ?? []) {
      porPessoaEDia.set(`${linha.user_id}|${linha.dia}`, {
        dia: linha.dia,
        minutos: linha.minutos_comprometidos,
        etapas: linha.etapas,
        ausente: linha.ausente,
      });
    }

    const pessoas = membros
      .map((membro) => {
        const perfil = porId.get(membro.user_id);
        if (!perfil) return null;
        return {
          id: perfil.id,
          nome: perfil.nome,
          avatar_url: perfil.avatar_url,
          capacidadeMinutos: membro.capacidade_minutos_dia,
          dias: dias.map(
            (dia) =>
              porPessoaEDia.get(`${perfil.id}|${dia}`) ?? {
                dia,
                minutos: 0,
                etapas: 0,
                ausente: false,
              },
          ),
        };
      })
      .filter((p): p is PessoaNaPauta => p !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return { dias, hoje: dias.includes(hoje) ? hoje : null, pessoas };
  },
);

/** O status da etapa, como o banco o devolve — nunca `string`: `StatusBadge`
 * pede o tipo, e um `string` aqui obrigaria a tela a converter. */
type StatusDaSubtarefa = Database["public"]["Enums"]["subtask_status"];

/**
 * UMA ETAPA ACHADA PELO TÍTULO, com a PESSOA que a faz.
 *
 * `pessoa` é nula quando a etapa não tem responsável — e a tela escreve isso,
 * em vez de esconder a linha: *"ninguém"* é a resposta mais cara de **quem
 * fez**, porque etapa sem dono não aparece no "Minhas Tasks" de ninguém.
 */
export type EtapaAchada = {
  subtaskId: string;
  taskId: string;
  etapa: string;
  demanda: string;
  cliente: string | null;
  status: StatusDaSubtarefa;
  prazo: string | null;
  pessoas: { id: string; nome: string; avatar_url: string | null }[];
};

export type BuscaNaPauta = {
  termo: string;
  achadas: EtapaAchada[];
  /** Quantas ETAPAS casaram no total — o número ANTES do corte. */
  total: number;
};

/**
 * ACHAR A ETAPA PELO TÍTULO — a segunda metade do pedido, *"poder pesquisar
 * por titulo, para achar a task caso não lembre quem fez"*.
 *
 * ---------------------------------------------------------------------------
 * **ELA VARRE A EQUIPE E NÃO A PESSOA ESCOLHIDA**, e a razão está na segunda
 * metade da frase: uma busca que exige escolher o nome primeiro não responde
 * nada a quem não sabe o nome. Por isso a resposta de cada linha é a PESSOA.
 *
 * **A PRIMEIRA METADE DO PEDIDO JÁ ERA VERDADE**, e ir medir antes de escrever
 * é o que fez esta entrega ser uma função: `carregar()` em
 * `lib/dados/minhas-tasks.ts` traz toda demanda publicada em que a pessoa tem
 * uma folha, sem janela de data e sem filtro de status; a seção chama
 * `minhasTasks(pessoa.id, null, …)`, e o `null` é o foco; e `MinhaLista`
 * esconde grupo VAZIO e nada mais. A pauta já era desde sempre — o que faltava
 * era a tela DIZER isso, porque ela mora embaixo de uma grade da semana.
 *
 * **O AGRUPAMENTO POR ETAPA É AQUI E NÃO NO BANCO.** A função devolve uma
 * linha por (etapa, pessoa) de propósito: juntar as pessoas em SQL pediria um
 * `jsonb` no `returns table`, e `check:tipos` liga coluna e parâmetro e **não**
 * confere a forma de um `returns table` — seria um molde que nenhuma
 * verificação olha. É a decisão do marcador do carrossel: *a conta é na tela*.
 * ---------------------------------------------------------------------------
 */
export async function acharEtapaPeloTitulo(
  termo: string,
  limite = 40,
): Promise<BuscaNaPauta> {
  const limpo = termo.trim();

  // O PISO É CONFERIDO DOS DOIS LADOS, e aqui ele poupa a ida ao banco: a
  // função também devolve vazio com menos de duas letras, então quem montar a
  // chamada à mão recebe a mesma resposta.
  if (limpo.length < MINIMO_PARA_BUSCAR) {
    return { termo: limpo, achadas: [], total: 0 };
  }

  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "busca na pauta da equipe",
    await supabase.rpc("pauta_por_titulo", {
      p_termo: limpo,
      p_limite: limite,
    }),
  );

  // UMA ENTRADA POR ETAPA, na ordem em que o banco devolveu -- `Map` preserva
  // a ordem de insercao, e e ela que carrega o `strpos` e o prazo.
  const porEtapa = new Map<string, EtapaAchada>();
  let total = 0;

  for (const linha of linhas ?? []) {
    total = linha.total;

    const achada = porEtapa.get(linha.subtask_id) ?? {
      subtaskId: linha.subtask_id,
      taskId: linha.task_id,
      etapa: linha.etapa,
      demanda: linha.demanda,
      cliente: linha.cliente,
      status: linha.status,
      prazo: linha.prazo,
      pessoas: [],
    };

    if (linha.pessoa_id && linha.pessoa) {
      achada.pessoas.push({
        id: linha.pessoa_id,
        nome: linha.pessoa,
        avatar_url: linha.avatar_url,
      });
    }

    porEtapa.set(linha.subtask_id, achada);
  }

  return { termo: limpo, achadas: [...porEtapa.values()], total };
}
