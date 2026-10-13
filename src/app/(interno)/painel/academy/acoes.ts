"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import type { Resultado } from "@/lib/acoes/resultado";
import { slugDoTitulo } from "@/lib/dominio/academy";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações do Full Academy (0096).
 *
 * QUEM MONTA E QUEM ESTUDA SÃO GUARDAS DIFERENTES: o item, a versão e a
 * obrigatoriedade passam por `exigirGestorNaAcao`; o progresso, a confirmação
 * de leitura e a anotação por `exigirEquipeNaAcao`. As duas são a primeira
 * linha, e a RLS é a que vale — a guarda aqui existe para a mensagem ser
 * legível, não para ser a proteção.
 */

const ROTA = "/painel/academy";

const RECUSA =
  "O banco recusou a operação. Se você não é da gestão, montar o acervo não é seu — o conteúdo é.";

// ---------------------------------------------------------------------------
// O ITEM
// ---------------------------------------------------------------------------

const esquemaDeItem = z.object({
  tipo: z.enum(["playbook", "ebook", "curso"]),
  titulo: z.string().trim().min(2, "Dê um título ao item."),
  resumo: z.string().trim().optional().nullable(),
  descricao: z.string().trim().optional().nullable(),
  categoria: z.string().trim().optional().nullable(),
  capa_url: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  duracao_estimada_minutos: z.number().int().positive().optional().nullable(),
});

/**
 * Cria ou edita um item do acervo.
 *
 * **O ITEM NASCE EM RASCUNHO**, e não há parâmetro para mudar isso aqui:
 * `publicado` tem default `false` no banco e quem o liga é `publicarItem()`.
 * São duas decisões — escrever e deixar a equipe ver —, e juntá-las numa
 * ação só poria no acervo um playbook com o título digitado e a página em
 * branco. É a regra que a 0096 semeia dezoito vezes: *não publicar item sem
 * conteúdo apenas para preencher o acervo*.
 *
 * **O SLUG É GERADO E NUNCA MUDA depois**, mesmo que o título mude: ele é o
 * endereço, e trocá-lo quebraria o link que alguém colou numa conversa. Quem
 * precisar de outro endereço cria outro item — a mesma razão pela qual o slug
 * do cliente não acompanha o nome da empresa.
 */
export async function salvarItem(
  id: string | null,
  dados: unknown,
): Promise<Resultado<string>> {
  return executarAcao("salvarItem", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDeItem.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("salvarItem", validacao.error, dados, "Confira os dados do item."),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    if (id) {
      const { data, error } = await supabase
        .from("academy_items")
        .update({
          titulo: entrada.titulo,
          resumo: entrada.resumo || null,
          descricao: entrada.descricao || null,
          categoria: entrada.categoria || null,
          capa_url: entrada.capa_url || null,
          tags: entrada.tags,
          duracao_estimada_minutos: entrada.duracao_estimada_minutos ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) return falha(`Não foi possível salvar: ${error.message}`);
      if (!data) return falha(RECUSA);

      revalidatePath(ROTA);
      return sucesso("Item atualizado.", id);
    }

    // O SUFIXO SÓ ENTRA QUANDO PRECISA, e não sempre: `slug` é único, e dois
    // playbooks chamados "Briefing" são caso real. Um sufixo em todo item
    // deixaria o endereço feio para resolver um caso que quase não acontece.
    const base = slugDoTitulo(entrada.titulo) || "item";
    const existentes = await supabase
      .from("academy_items")
      .select("slug")
      .like("slug", `${base}%`);
    const tomados = new Set((existentes.data ?? []).map((l) => l.slug));
    let slug = base;
    for (let n = 2; tomados.has(slug); n++) slug = `${base}-${n}`;

    const { data, error } = await supabase
      .from("academy_items")
      .insert({
        tipo: entrada.tipo,
        titulo: entrada.titulo,
        slug,
        resumo: entrada.resumo || null,
        descricao: entrada.descricao || null,
        categoria: entrada.categoria || null,
        capa_url: entrada.capa_url || null,
        tags: entrada.tags,
        duracao_estimada_minutos: entrada.duracao_estimada_minutos ?? null,
        autor_id: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !data) return falha(`Não foi possível criar: ${error?.message ?? RECUSA}`);

    revalidatePath(ROTA);
    return sucesso("Rascunho criado. Ele só aparece para você e para a gestão.", data.id);
  });
}

export async function publicarItem(id: string, publicado: boolean): Promise<Resultado> {
  return executarAcao("publicarItem", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("academy_items")
      .update({ publicado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível publicar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso(publicado ? "No acervo da equipe." : "Voltou a ser rascunho.");
  });
}

export async function excluirItem(id: string): Promise<Resultado> {
  return executarAcao("excluirItem", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("academy_items")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Item excluído.");
  });
}

// ---------------------------------------------------------------------------
// A VERSÃO DO PLAYBOOK
// ---------------------------------------------------------------------------

const esquemaDeVersao = z.object({
  item_id: z.string().uuid(),
  conteudo_rico: z.unknown(),
  conteudo_texto: z.string(),
  notas_mudanca: z.string().trim().optional().nullable(),
  exige_releitura: z.boolean().default(false),
});

/**
 * Publica uma versão nova do playbook.
 *
 * **VERSÃO FECHADA NUNCA É REESCRITA**: não existe `editarVersao`, e a tabela
 * não tem policy de UPDATE. Cada publicação cria um número novo, e as
 * anteriores continuam no banco com as notas do que mudou — a regra de
 * `approval_rounds` desde a 0007. Quem confirmou a 2 precisa poder ler a 2
 * para entender o que mudou na 3.
 *
 * **`exige_releitura` É A DECISÃO DE QUEM PUBLICA, e ela devolve a pendência
 * a quem já leu.** Por isso o padrão é `false`: corrigir um telefone não pode
 * cobrar de novo quatorze pessoas, e um padrão `true` faria toda vírgula
 * trocada virar um aviso — na terceira vez ninguém mais leria nenhum.
 *
 * **O TEXTO PURO VIAJA JUNTO e não é derivado por trigger**: extrair texto de
 * um documento do TipTap em plpgsql seria um parser de jsonb escrito à mão, e
 * ele divergiria do que o editor considera texto na primeira extensão nova.
 * Quem sabe ler o documento é o editor.
 */
export async function publicarVersao(dados: unknown): Promise<Resultado<number>> {
  return executarAcao("publicarVersao", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDeVersao.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("publicarVersao", validacao.error, dados, "Confira o conteúdo."),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    // O NÚMERO SAI DO MAIOR QUE EXISTE, e o `unique (item_id, numero_versao)`
    // é a trava de verdade: duas abas publicando ao mesmo tempo passam pelas
    // duas consultas antes de qualquer uma gravar, e aí a segunda leva a
    // recusa do índice em vez de sobrescrever a primeira. É a decisão da 0040.
    const ultimas = await supabase
      .from("academy_playbook_versoes")
      .select("numero_versao")
      .eq("item_id", entrada.item_id)
      .order("numero_versao", { ascending: false })
      .limit(1);
    const numero = (ultimas.data?.[0]?.numero_versao ?? 0) + 1;

    const { data, error } = await supabase
      .from("academy_playbook_versoes")
      .insert({
        item_id: entrada.item_id,
        numero_versao: numero,
        conteudo_rico: entrada.conteudo_rico as never,
        conteudo_texto: entrada.conteudo_texto,
        notas_mudanca: entrada.notas_mudanca || null,
        exige_releitura: entrada.exige_releitura,
        publicado_por: sessao.usuarioId,
      })
      .select("numero_versao")
      .single();

    if (error || !data) return falha(`Não foi possível publicar: ${error?.message ?? RECUSA}`);

    revalidatePath(ROTA);
    return sucesso(
      entrada.exige_releitura
        ? `Versão ${numero} publicada. Quem já lei as anteriores volta a ter pendência.`
        : `Versão ${numero} publicada, sem cobrar releitura.`,
      data.numero_versao,
    );
  });
}

/**
 * Confirma que leu a versão corrente.
 *
 * **O PLAYBOOK NÃO USA `concluido`, USA `versao_confirmada`**, e são fatos
 * diferentes: "eu li" sem número não sobrevive a uma versão nova, e é
 * justamente a versão nova que o módulo existe para levar às pessoas. A
 * conclusão de um playbook é sempre a confirmação de UMA versão.
 */
export async function confirmarLeitura(
  itemId: string,
  numeroVersao: number,
): Promise<Resultado> {
  return executarAcao("confirmarLeitura", async () => {
    const sessao = await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("academy_progresso")
      .upsert(
        {
          user_id: sessao.usuarioId,
          item_id: itemId,
          aula_id: null,
          concluido: true,
          versao_confirmada: numeroVersao,
        },
        { onConflict: "user_id, item_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível confirmar: ${error.message}`);
    if (!data) return falha("O banco recusou o registro de leitura.");

    revalidatePath(ROTA);
    return sucesso(`Leitura da versão ${numeroVersao} confirmada.`);
  });
}

// ---------------------------------------------------------------------------
// O CURSO
// ---------------------------------------------------------------------------

const esquemaDeModulo = z.object({
  item_id: z.string().uuid(),
  titulo: z.string().trim().min(2, "Dê um nome ao módulo."),
  descricao: z.string().trim().optional().nullable(),
  ordem: z.number().int().min(0).default(0),
});

export async function salvarModulo(id: string | null, dados: unknown): Promise<Resultado> {
  return executarAcao("salvarModulo", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeModulo.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("salvarModulo", validacao.error, dados, "Confira os dados do módulo."),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    const { data, error } = id
      ? await supabase
          .from("academy_modulos")
          .update({
            titulo: entrada.titulo,
            descricao: entrada.descricao || null,
            ordem: entrada.ordem,
          })
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("academy_modulos")
          .insert({
            item_id: entrada.item_id,
            titulo: entrada.titulo,
            descricao: entrada.descricao || null,
            ordem: entrada.ordem,
          })
          .select("id")
          .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Módulo salvo.");
  });
}

const esquemaDeAula = z.object({
  modulo_id: z.string().uuid(),
  titulo: z.string().trim().min(2, "Dê um título à aula."),
  tipo: z.enum(["video", "texto", "pdf", "link", "exercicio"]),
  url: z.string().trim().optional().nullable(),
  arquivo_url: z.string().trim().optional().nullable(),
  duracao_minutos: z.number().int().positive().optional().nullable(),
  ordem: z.number().int().min(0).default(0),
});

export async function salvarAula(id: string | null, dados: unknown): Promise<Resultado> {
  return executarAcao("salvarAula", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeAula.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("salvarAula", validacao.error, dados, "Confira os dados da aula."),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    const corpo = {
      titulo: entrada.titulo,
      tipo: entrada.tipo,
      url: entrada.url || null,
      arquivo_url: entrada.arquivo_url || null,
      duracao_minutos: entrada.duracao_minutos ?? null,
      ordem: entrada.ordem,
    };

    const { data, error } = id
      ? await supabase
          .from("academy_aulas")
          .update(corpo)
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("academy_aulas")
          .insert({ ...corpo, modulo_id: entrada.modulo_id })
          .select("id")
          .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Aula salva.");
  });
}

export async function excluirAula(id: string): Promise<Resultado> {
  return executarAcao("excluirAula", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("academy_aulas")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Aula excluída.");
  });
}

/**
 * Marca ou desmarca uma aula.
 *
 * `concluido_em` NÃO vai no corpo, e nem poderia: ele está fora de `Insert` e
 * de `Update` no tipo justamente para tentar gravá-lo ser erro antes de ser
 * recusa — quem carimba é o trigger `academy_progresso_carimbar`, porque o
 * relógio do navegador não é prova de nada.
 */
export async function marcarAula(
  itemId: string,
  aulaId: string,
  concluido: boolean,
): Promise<Resultado> {
  return executarAcao("marcarAula", async () => {
    const sessao = await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("academy_progresso")
      .upsert(
        { user_id: sessao.usuarioId, item_id: itemId, aula_id: aulaId, concluido },
        { onConflict: "user_id, item_id, aula_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível marcar: ${error.message}`);
    if (!data) return falha("O banco recusou o registro.");

    revalidatePath(ROTA);
    return sucesso(concluido ? "Aula marcada como vista." : "Aula desmarcada.");
  });
}

/** O e-book se marca inteiro: não há aula para contar, e "li metade" não é um
 *  fato que o módulo guarda. */
export async function marcarItem(itemId: string, concluido: boolean): Promise<Resultado> {
  return executarAcao("marcarItem", async () => {
    const sessao = await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("academy_progresso")
      .upsert(
        { user_id: sessao.usuarioId, item_id: itemId, aula_id: null, concluido },
        { onConflict: "user_id, item_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível marcar: ${error.message}`);
    if (!data) return falha("O banco recusou o registro.");

    revalidatePath(ROTA);
    return sucesso(concluido ? "Marcado como lido." : "Desmarcado.");
  });
}

// ---------------------------------------------------------------------------
// A ANOTAÇÃO
// ---------------------------------------------------------------------------

/**
 * A anotação privada.
 *
 * **NINGUÉM MAIS LÊ, NEM O SÓCIO**, e a trava é a policy: as quatro operações
 * de `academy_anotacoes` fecham em `auth.uid()`. É a promessa que faz a pessoa
 * escrever "não entendi a parte do briefing" — uma anotação que a gestão
 * pudesse ler não seria escrita, e aí o campo não serviria para nada.
 *
 * Texto vazio APAGA a linha em vez de gravar string vazia: uma anotação em
 * branco é uma anotação que não existe, e deixá-la faria o indicador de "tem
 * anotação" acender numa página sem nada escrito.
 */
export async function salvarAnotacao(
  itemId: string,
  aulaId: string | null,
  texto: string,
): Promise<Resultado> {
  return executarAcao("salvarAnotacao", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    if (texto.trim().length === 0) {
      let apagar = supabase
        .from("academy_anotacoes")
        .delete()
        .eq("user_id", sessao.usuarioId)
        .eq("item_id", itemId);
      apagar = aulaId ? apagar.eq("aula_id", aulaId) : apagar.is("aula_id", null);

      const { error } = await apagar;
      if (error) return falha(`Não foi possível apagar: ${error.message}`);

      revalidatePath(ROTA);
      return sucesso("Anotação apagada.");
    }

    const { data, error } = await supabase
      .from("academy_anotacoes")
      .upsert(
        {
          user_id: sessao.usuarioId,
          item_id: itemId,
          aula_id: aulaId,
          texto: texto.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: aulaId ? "user_id, item_id, aula_id" : "user_id, item_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou a anotação.");

    revalidatePath(ROTA);
    return sucesso("Anotação salva. Só você lê isto.");
  });
}

// ---------------------------------------------------------------------------
// A OBRIGATORIEDADE
// ---------------------------------------------------------------------------

const esquemaDeObrigatorio = z.object({
  item_id: z.string().uuid(),
  funcao: z.string().trim().optional().nullable(),
  role: z.enum(["colaborador", "desenvolvedor", "socio"]).optional().nullable(),
  prazo_dias_apos_admissao: z.number().int().positive().optional().nullable(),
});

/**
 * Torna um item obrigatório.
 *
 * As duas colunas nulas querem dizer "para a agência inteira", que é o caso de
 * "Primeiros 30 dias na Full" — e `prazo_dias_apos_admissao` nulo é "sem
 * prazo": o item é obrigatório e não vence. Sem o nulo, todo obrigatório
 * precisaria de um número inventado, e prazo inventado é prazo que vence sem
 * ninguém entender por quê.
 */
export async function tornarObrigatorio(dados: unknown): Promise<Resultado> {
  return executarAcao("tornarObrigatorio", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeObrigatorio.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("tornarObrigatorio", validacao.error, dados, "Confira a regra."),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("academy_obrigatorios")
      .insert({
        item_id: entrada.item_id,
        funcao: (entrada.funcao || null) as never,
        role: entrada.role ?? null,
        prazo_dias_apos_admissao: entrada.prazo_dias_apos_admissao ?? null,
      })
      .select("id")
      .maybeSingle();

    // A MESMA REGRA DUAS VEZES É RUÍDO, e o índice único da 0096 recusa: ela
    // não muda nada e faz a contagem de quem passa a dever somar a mesma
    // pessoa duas vezes. A recusa diz isso em vez de repetir o erro do banco.
    if (error?.code === "23505") {
      return falha("Essa regra já existe para este item.");
    }
    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Item agora é obrigatório.");
  });
}

export async function tirarObrigatoriedade(id: string): Promise<Resultado> {
  return executarAcao("tirarObrigatoriedade", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("academy_obrigatorios")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível tirar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Deixou de ser obrigatório.");
  });
}
