import "server-only";

import { assinarArquivos, enderecoDaArte } from "./conteudo";
import { ouFalha } from "./consulta";

import { cache } from "react";

import {
  BUCKET_DO_ACERVO,
  duracaoSomada,
  ehEstadoDoItem,
  estadoDoCurso,
  estadoDoPlaybook,
  percentual,
  semAcento,
  trechoDoCasamento,
  MINIMO_PARA_BUSCAR,
} from "@/lib/dominio/academy";
import type { EstadoDoItem } from "@/lib/dominio/academy";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  AcademyArquivo,
  AcademyAula,
  AcademyItem,
  AcademyModulo,
  AcademyTipo,
  AcademyVersao,
} from "@/lib/supabase/database.types";

/**
 * As consultas do Full Academy (0096).
 *
 * A RLS já resolve o que cada um enxerga: item em rascunho não volta para quem
 * não é autor nem gestão, e a anotação de outra pessoa não volta para ninguém
 * — nem para o sócio. Esta camada **NÃO repete essas regras**: repetir seria
 * criar um segundo lugar onde a mesma verdade pode divergir, e o segundo é
 * sempre o que esquece.
 *
 * O que ela faz é o arranjo — juntar o item, o conteúdo dele e o progresso de
 * quem está logado numa coisa só, para a tela não fazer três consultas por
 * cartão.
 *
 * **A ANOTAÇÃO NÃO ENTRA EM NENHUMA LEITURA DE LISTA**, e é deliberado: ela
 * mora em tabela própria justamente porque policy não limita coluna, e trazê-la
 * num `select *` ao lado do progresso desfaria em TypeScript a separação que a
 * 0096 montou no banco. Quem a lê é `minhaAnotacao()`, uma pergunta de cada
 * vez, sobre a própria pessoa.
 */

// ---------------------------------------------------------------------------
// O ACERVO
// ---------------------------------------------------------------------------

export type ItemDoAcervo = AcademyItem & {
  estado: EstadoDoItem;
  /** Quantos pedaços já foram vistos, e de quantos. Playbook e e-book são 0/1
   *  ou 1/1; o curso é o número de aulas. */
  vistos: number;
  total: number;
  percentual: number;
  duracaoMinutos: number | null;
  /** Obrigatório para quem está pedindo, com o prazo que a conta do banco deu. */
  obrigatorio: boolean;
  prazo: string | null;
  vencido: boolean;
};

type LinhaObrigatoria = {
  item_id: string;
  titulo: string;
  tipo: AcademyTipo;
  slug: string;
  categoria: string | null;
  estado: string;
  prazo: string | null;
  vencido: boolean;
};

/**
 * O acervo inteiro, já com o estado de quem está pedindo.
 *
 * SÃO CINCO IDAS AO BANCO, e nenhuma por cartão: os itens, as versões de
 * playbook, as aulas de curso, o progresso da pessoa e a obrigatoriedade dela.
 * Com quarenta itens na tela, uma consulta por cartão seriam duzentas idas
 * para montar uma grade — e o estado de cada um precisa das quatro.
 *
 * **O ESTADO É CALCULADO AQUI E NÃO POR `academy_estado_do_item()`**, embora a
 * função exista e seja a mesma conta. A razão é a forma da pergunta: aquela
 * responde sobre UM par (pessoa, item), e o acervo precisa de quarenta — seriam
 * quarenta chamadas de RPC. A função continua sendo quem responde no
 * acompanhamento e na obrigatoriedade, que é onde o banco precisa decidir
 * sozinho; aqui a tela faz a mesma conta com os dados que já trouxe. É a
 * decisão de `situacaoDoLancamento()` no Financeiro.
 */
export const listarAcervo = cache(async (usuarioId: string): Promise<ItemDoAcervo[]> => {
  const supabase = await criarClienteServidor();

  const itens = ouFalha(
    "o acervo do Full Academy",
    await supabase
      .from("academy_items")
      .select("*")
      .order("ordem")
      .order("titulo"),
  );

  if (itens.length === 0) return [];

  const ids = itens.map((i) => i.id);

  const [versoes, modulos, progresso, obrigatorios] = await Promise.all([
    supabase
      .from("academy_playbook_versoes")
      .select("item_id, numero_versao, exige_releitura")
      .in("item_id", ids)
      .then((r) => ouFalha("as versões dos playbooks", r)),
    supabase
      .from("academy_modulos")
      .select("id, item_id")
      .in("item_id", ids)
      .then((r) => ouFalha("os módulos dos cursos", r)),
    supabase
      .from("academy_progresso")
      .select("item_id, aula_id, concluido, versao_confirmada")
      .eq("user_id", usuarioId)
      .in("item_id", ids)
      .then((r) => ouFalha("o seu progresso no acervo", r)),
    supabase
      .rpc("academy_obrigatorios_de", { p_user: usuarioId })
      .then((r) => ouFalha("os itens obrigatórios para você", r)),
  ]);

  // As aulas vêm pelos módulos, numa ida: o curso não tem `item_id` na aula, e
  // perguntar por item seria uma consulta por curso.
  const aulas =
    modulos.length === 0
      ? []
      : ouFalha(
          "as aulas dos cursos",
          await supabase
            .from("academy_aulas")
            .select("id, modulo_id, duracao_minutos")
            .in(
              "modulo_id",
              modulos.map((m) => m.id),
            ),
        );

  const moduloDoItem = new Map(modulos.map((m) => [m.id, m.item_id]));
  const aulasPorItem = new Map<string, { id: string; duracao_minutos: number | null }[]>();
  for (const aula of aulas) {
    const item = moduloDoItem.get(aula.modulo_id);
    if (!item) continue;
    const lista = aulasPorItem.get(item) ?? [];
    lista.push({ id: aula.id, duracao_minutos: aula.duracao_minutos });
    aulasPorItem.set(item, lista);
  }

  // A versão de releitura é o MAIOR número entre as que exigem releitura, e é
  // a comparação que decide se a pendência volta. Nunca a corrente: uma
  // publicação leve não cobra de novo quem já leu.
  const releituraPorItem = new Map<string, number>();
  for (const v of versoes) {
    if (!v.exige_releitura) continue;
    const atual = releituraPorItem.get(v.item_id) ?? 0;
    if (v.numero_versao > atual) releituraPorItem.set(v.item_id, v.numero_versao);
  }

  const doItem = new Map<string, typeof progresso>();
  for (const p of progresso) {
    const lista = doItem.get(p.item_id) ?? [];
    lista.push(p);
    doItem.set(p.item_id, lista);
  }

  const obrigatorioPorItem = new Map<string, LinhaObrigatoria>(
    (obrigatorios as LinhaObrigatoria[]).map((o) => [o.item_id, o]),
  );

  return itens.map((item) => {
    const linhas = doItem.get(item.id) ?? [];
    const doItemTodo = linhas.find((l) => l.aula_id === null);
    const aulasDele = aulasPorItem.get(item.id) ?? [];

    let estado: EstadoDoItem;
    let vistos = 0;
    let total = 1;

    if (item.tipo === "playbook") {
      estado = estadoDoPlaybook(
        doItemTodo?.versao_confirmada ?? null,
        releituraPorItem.get(item.id) ?? null,
      );
      vistos = estado === "concluido" ? 1 : 0;
    } else if (item.tipo === "curso") {
      total = aulasDele.length;
      vistos = linhas.filter((l) => l.aula_id !== null && l.concluido).length;
      estado = estadoDoCurso(vistos, total);
    } else {
      vistos = doItemTodo?.concluido ? 1 : 0;
      estado = vistos === 1 ? "concluido" : "nao_iniciado";
    }

    const obrigatorio = obrigatorioPorItem.get(item.id);

    return {
      ...item,
      estado,
      vistos,
      total,
      percentual: percentual(vistos, total),
      duracaoMinutos:
        duracaoSomada(aulasDele.map((a) => a.duracao_minutos)) ??
        item.duracao_estimada_minutos,
      obrigatorio: Boolean(obrigatorio),
      prazo: obrigatorio?.prazo ?? null,
      vencido: obrigatorio?.vencido ?? false,
    };
  });
});

// ---------------------------------------------------------------------------
// UM ITEM
// ---------------------------------------------------------------------------

export type PlaybookAberto = {
  versaoCorrente: AcademyVersao | null;
  historico: AcademyVersao[];
  versaoConfirmada: number | null;
  versaoDeReleitura: number | null;
};

export type CursoAberto = {
  modulos: (AcademyModulo & { aulas: AcademyAula[] })[];
  vistas: Set<string>;
};

export type ItemAberto = {
  item: AcademyItem;
  estado: EstadoDoItem;
  vistos: number;
  total: number;
  playbook: PlaybookAberto | null;
  arquivo: AcademyArquivo | null;
  /**
   * O ENDEREÇO ASSINADO DO ARQUIVO, ao lado do caminho cru.
   *
   * São dois campos e não um, como `capa_url` e `capaAssinada` nas campanhas:
   * `arquivo.url` é o caminho no bucket — o que está GRAVADO, e o que a
   * próxima assinatura usa —, e este é o endereço que vale uma hora e serve a
   * um `href`. Sobrescrever um com o outro faria a tela e a action
   * discordarem sobre o que a coluna significa.
   *
   * **NULO QUANDO A ASSINATURA FALHA**, por `enderecoDaArte`: o bucket é
   * privado, então o caminho cru não é endereço de nada — o `href` apontaria
   * para uma rota do próprio site, que responde 404. É a decisão daquela
   * função palavra por palavra: quebrado é pior que ausente, porque a tela já
   * tem o estado de "sem arquivo" desenhado.
   */
  arquivoAssinado: string | null;
  curso: CursoAberto | null;
};

/**
 * Um item com o conteúdo do formato dele, e só do dele.
 *
 * O `switch` por tipo acontece AQUI e não na tela, e isso é o que permite a
 * tela de dentro ser uma só: ela recebe `playbook`, `arquivo` ou `curso`
 * preenchido e desenha o que veio. Três telas parecidas divergiriam na
 * primeira mudança — e a que divergiria é a do e-book, que é a que ninguém
 * abre para testar.
 *
 * Devolve `null` quando não há item com aquele slug: a RLS esconde o rascunho
 * de quem não é autor nem gestão, então "não achei" e "não é seu" chegam
 * iguais, e a tela responde 404 nos dois casos. É o certo — dizer "existe, mas
 * não é seu" contaria que ele existe.
 */
export async function abrirItem(
  slug: string,
  usuarioId: string,
): Promise<ItemAberto | null> {
  const supabase = await criarClienteServidor();

  const achados = ouFalha(
    "o item do Full Academy",
    await supabase.from("academy_items").select("*").eq("slug", slug).limit(1),
  );
  const item = achados[0];
  if (!item) return null;

  const progresso = ouFalha(
    "o seu progresso neste item",
    await supabase
      .from("academy_progresso")
      .select("aula_id, concluido, versao_confirmada")
      .eq("user_id", usuarioId)
      .eq("item_id", item.id),
  );
  const doItemTodo = progresso.find((p) => p.aula_id === null);

  if (item.tipo === "playbook") {
    const historico = ouFalha(
      "o histórico de versões",
      await supabase
        .from("academy_playbook_versoes")
        .select("*")
        .eq("item_id", item.id)
        .order("numero_versao", { ascending: false }),
    );
    const releitura =
      historico.filter((v) => v.exige_releitura).map((v) => v.numero_versao)[0] ?? null;
    const confirmada = doItemTodo?.versao_confirmada ?? null;
    const estado = estadoDoPlaybook(confirmada, releitura);

    return {
      item,
      estado,
      vistos: estado === "concluido" ? 1 : 0,
      total: 1,
      playbook: {
        versaoCorrente: historico[0] ?? null,
        historico,
        versaoConfirmada: confirmada,
        versaoDeReleitura: releitura,
      },
      arquivo: null,
      arquivoAssinado: null,
      curso: null,
    };
  }

  if (item.tipo === "ebook") {
    const arquivos = ouFalha(
      "o arquivo do e-book",
      await supabase
        .from("academy_arquivos")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const feito = Boolean(doItemTodo?.concluido);
    const arquivo = arquivos[0] ?? null;

    // O BUCKET É PRIVADO, ENTÃO O ENDEREÇO SE ASSINA AQUI. Sem esta linha o
    // botão Baixar do e-book aponta para `uuid/1234.pdf`, que o navegador lê
    // como rota do próprio site e o servidor responde 404 — o arquivo existe,
    // está certo, e não abre. `assinarArquivos` deixa passar o que já começa
    // com `http`, então um e-book que seja link de fora continua valendo.
    const assinadas = await assinarArquivos(BUCKET_DO_ACERVO, [arquivo?.url ?? null]);

    return {
      item,
      estado: feito ? "concluido" : "nao_iniciado",
      vistos: feito ? 1 : 0,
      total: 1,
      playbook: null,
      arquivo,
      arquivoAssinado: enderecoDaArte(arquivo?.url ?? null, assinadas),
      curso: null,
    };
  }

  const modulos = ouFalha(
    "os módulos do curso",
    await supabase
      .from("academy_modulos")
      .select("*")
      .eq("item_id", item.id)
      .order("ordem"),
  );

  const aulas =
    modulos.length === 0
      ? []
      : ouFalha(
          "as aulas do curso",
          await supabase
            .from("academy_aulas")
            .select("*")
            .in(
              "modulo_id",
              modulos.map((m) => m.id),
            )
            .order("ordem"),
        );

  const vistas = new Set(
    progresso.filter((p) => p.aula_id !== null && p.concluido).map((p) => p.aula_id as string),
  );

  return {
    item,
    estado: estadoDoCurso(vistas.size, aulas.length),
    vistos: vistas.size,
    total: aulas.length,
    playbook: null,
    arquivo: null,
    arquivoAssinado: null,
    curso: {
      modulos: modulos.map((m) => ({
        ...m,
        aulas: aulas.filter((a) => a.modulo_id === m.id),
      })),
      vistas,
    },
  };
}

/**
 * A anotação da própria pessoa. Consulta separada, e é o ponto.
 *
 * Ela não viaja junto com o progresso em lugar nenhum desta camada: a 0096 pôs
 * a anotação em tabela própria porque **policy não limita coluna** e a gestão
 * precisa ler `academy_progresso` para a aba Acompanhamento existir. Trazer as
 * duas no mesmo objeto refaria em TypeScript o acoplamento que o banco
 * desfez — e seria o lugar onde alguém, um dia, passa o objeto inteiro para a
 * tela da gestão.
 */
export async function minhaAnotacao(
  itemId: string,
  aulaId: string | null,
  usuarioId: string,
): Promise<string> {
  const supabase = await criarClienteServidor();
  let consulta = supabase
    .from("academy_anotacoes")
    .select("texto")
    .eq("user_id", usuarioId)
    .eq("item_id", itemId);
  consulta = aulaId ? consulta.eq("aula_id", aulaId) : consulta.is("aula_id", null);

  const linhas = ouFalha("a sua anotação", await consulta.limit(1));
  return linhas[0]?.texto ?? "";
}

// ---------------------------------------------------------------------------
// A BUSCA DO MÓDULO
// ---------------------------------------------------------------------------

export type AchadoDaBusca = ItemDoAcervo & {
  /** O trecho onde o termo casou, com reticências. `null` quando casou só no
   *  título — aí a tela mostra o resumo. */
  trecho: string | null;
};

/**
 * A BUSCA ACHA DENTRO DO CORPO DO PLAYBOOK, e é por isso que ela existe.
 *
 * A paleta da topbar busca o NOME, e o faz de propósito: uma linha que casou
 * no corpo não tem onde mostrar o porquê. Aqui tem — a linha carrega o trecho
 * com o termo no meio, e aí "onde está escrito como a gente faz briefing" vira
 * uma pergunta que o módulo responde.
 *
 * Duas consultas e não uma: o acervo (que já traz o estado de cada item) e o
 * texto das versões correntes. Juntar seria um `or` com `ilike` em duas
 * tabelas, que o PostgREST não faz num `select` só — e a alternativa, uma
 * função no banco, devolveria o item sem o estado da pessoa.
 */
export async function buscarNoAcervo(
  termo: string,
  usuarioId: string,
): Promise<AchadoDaBusca[]> {
  if (termo.trim().length < MINIMO_PARA_BUSCAR) return [];

  const [acervo, textos] = await Promise.all([
    listarAcervo(usuarioId),
    (async () => {
      const supabase = await criarClienteServidor();
      return ouFalha(
        "o texto dos playbooks",
        await supabase
          .from("academy_playbook_versoes")
          .select("item_id, numero_versao, conteudo_texto")
          .order("numero_versao", { ascending: false }),
      );
    })(),
  ]);

  // Só a versão CORRENTE de cada playbook entra na busca. Sem este corte, uma
  // frase apagada há três versões continuaria devolvendo o item — e o trecho
  // mostrado não estaria na tela que a pessoa abriria.
  const correnteDoItem = new Map<string, string>();
  for (const v of textos) {
    if (!correnteDoItem.has(v.item_id)) correnteDoItem.set(v.item_id, v.conteudo_texto);
  }

  const alvo = semAcento(termo.trim());

  return acervo
    .map((item) => {
      const noTitulo = semAcento(item.titulo).includes(alvo);
      const noResumo = semAcento(item.resumo ?? "").includes(alvo);
      const nasTags = item.tags.some((t) => semAcento(t).includes(alvo));
      const corpo = correnteDoItem.get(item.id) ?? null;
      const trecho = trechoDoCasamento(corpo, termo.trim());

      if (!noTitulo && !noResumo && !nasTags && !trecho) return null;
      return { ...item, trecho };
    })
    .filter((x): x is AchadoDaBusca => x !== null);
}

// ---------------------------------------------------------------------------
// A GESTÃO
// ---------------------------------------------------------------------------

export type LinhaDoAcompanhamento = {
  user_id: string;
  pessoa: string;
  funcao: string | null;
  item_id: string;
  item: string;
  tipo: AcademyTipo;
  estado: EstadoDoItem;
  prazo: string | null;
  vencido: boolean;
};

/**
 * Pessoa × item obrigatório, para a aba de gestão.
 *
 * `ouFalha()` e não um `?? []`: `academy_acompanhamento()` recusa quem não é
 * gestão com uma EXCEÇÃO, e sem ele a tela desenharia uma tabela vazia — que
 * se lê como "ninguém deve nada", uma afirmação falsa com toda a confiança. É
 * a mesma razão das funções de métrica da 0035.
 */
export async function acompanhamentoDaEquipe(): Promise<LinhaDoAcompanhamento[]> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "o acompanhamento da formação",
    await supabase.rpc("academy_acompanhamento"),
  );
  return linhas.map((l) => ({ ...l, estado: ehEstadoDoItem(l.estado) }));
}

/** As trilhas publicadas, para a prateleira. Elas não têm conteúdo próprio —
 *  são uma ordem sobre itens que já existem. */
export const listarTrilhas = cache(async () => {
  const supabase = await criarClienteServidor();

  const trilhas = ouFalha(
    "as trilhas do Full Academy",
    await supabase.from("academy_trilhas").select("*").order("ordem").order("nome"),
  );
  if (trilhas.length === 0) return [];

  const itens = ouFalha(
    "os itens das trilhas",
    await supabase
      .from("academy_trilha_itens")
      .select("trilha_id, item_id, ordem")
      .in(
        "trilha_id",
        trilhas.map((t) => t.id),
      )
      .order("ordem"),
  );

  return trilhas.map((trilha) => ({
    ...trilha,
    itens: itens.filter((i) => i.trilha_id === trilha.id).map((i) => i.item_id),
  }));
});
