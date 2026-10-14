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
// O ARQUIVO DO E-BOOK
// ---------------------------------------------------------------------------

const esquemaDeArquivo = z.object({
  item_id: z.string().uuid(),
  // O CAMINHO NO BUCKET, e não o endereço assinado. A assinatura vale uma hora
  // e o e-book vive anos: gravar a assinada deixaria o acervo cheio de links
  // vencidos, e quem abrisse o item em novembro baixaria um 400.
  url: z.string().trim().min(3, "Anexe o arquivo antes de salvar."),
  nome: z.string().trim().min(1, "O arquivo precisa de um nome."),
  tamanho_bytes: z.number().int().positive().optional().nullable(),
  paginas: z.number().int().positive().optional().nullable(),
  formato: z.enum(["pdf", "html_interativo"]).default("pdf"),
  versao: z.number().int().positive().default(1),
  notas_mudanca: z.string().trim().optional().nullable(),
  exige_releitura: z.boolean().default(false),
});

/**
 * Anexa o arquivo de um e-book.
 *
 * ---------------------------------------------------------------------------
 * **ELA INSERE, E NUNCA REESCREVE A LINHA ANTERIOR**, e a decisão não é minha:
 * ela já estava tomada do outro lado. `abrirItem()` lê
 * `order created_at desc limit 1` desde a 0096 — o e-book mostra o arquivo
 * MAIS NOVO —, e um `update` na linha existente faria aquela ordenação não
 * decidir nada. É a regra de `post_versions` e das versões de campanha vista
 * de outro ângulo: trocar o arquivo é gravar um a mais, não apagar um.
 *
 * **O ARQUIVO ANTERIOR CONTINUA NO BUCKET**, como na 0048: a linha antiga
 * aponta para ele, e apagar o objeto deixaria o histórico apontando para o
 * vazio. Apagar não é desfazer.
 *
 * **E NÃO EXISTE AÇÃO DE TIRAR O ARQUIVO.** Subir outro substitui o que a tela
 * mostra, que é o que alguém quer dizer com "errei o PDF"; uma segunda ação
 * para esvaziar o e-book deixaria um item publicado sem conteúdo nenhum, que
 * é exatamente o que a 0096 semeia dezoito vezes contra.
 * ---------------------------------------------------------------------------
 */
export async function anexarArquivo(dados: unknown): Promise<Resultado> {
  return executarAcao("anexarArquivo", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeArquivo.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "anexarArquivo",
          validacao.error,
          dados,
          "Confira o arquivo do e-book.",
        ),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("academy_arquivos")
      .insert({
        item_id: entrada.item_id,
        url: entrada.url,
        nome: entrada.nome,
        tamanho_bytes: entrada.tamanho_bytes ?? null,
        paginas: entrada.paginas ?? null,
        formato: entrada.formato,
        versao: entrada.versao,
        notas_mudanca: entrada.notas_mudanca || null,
        exige_releitura: entrada.exige_releitura,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível anexar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso(
      entrada.versao > 1 ? `Versão ${entrada.versao} publicada.` : "Arquivo anexado.",
    );
  });
}


// ---------------------------------------------------------------------------
// A PONTE DO E-BOOK INTERATIVO
//
// As tres acoes que o iframe alimenta. **Elas sao de `exigirEquipeNaAcao` e
// nao da gestao**: quem marca capitulo e quem le, e a RLS fecha cada tabela no
// proprio `auth.uid()` -- a guarda aqui existe para a mensagem ser legivel.
//
// **E NENHUMA DELAS RECEBE `user_id`.** Ele sai da sessao, dentro da action:
// com o id vindo do corpo, a pagina -- que roda num iframe sandboxado e cujo
// script veio de um arquivo que alguem subiu -- poderia gravar progresso no
// nome de outra pessoa. A policy recusaria, mas a recusa chegaria como erro
// numa tela de leitura, e o furo so nao existe porque o parametro nao existe.
// ---------------------------------------------------------------------------

const esquemaDeCapitulo = z.object({
  item_id: z.string().uuid(),
  chave: z.string().trim().min(1),
  lido: z.boolean(),
});

/**
 * Marca (ou desmarca) um capitulo lido.
 *
 * **CHAVE DESCONHECIDA E IGNORADA EM SILENCIO, e devolve sucesso.** A `chave`
 * e o contrato entre o HTML e o banco: se alguem renomear um id dentro do
 * arquivo, aquele capitulo deixa de casar. Gravar a linha solta seria um
 * progresso apontando para nada -- ele inflaria o "X de 23" sem ninguem
 * conseguir dizer qual capitulo e. E devolver erro quebraria a leitura inteira
 * por causa de um id trocado, numa tela onde a pessoa nao tem o que fazer com
 * a mensagem. O que fica e a contagem honesta: aquele capitulo aparece como
 * nao lido, que e a verdade do ponto de vista do banco.
 */
export async function marcarCapitulo(dados: unknown): Promise<Resultado> {
  return executarAcao("marcarCapitulo", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = esquemaDeCapitulo.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "marcarCapitulo",
          validacao.error,
          dados,
          "Não deu para registrar a leitura deste capítulo.",
        ),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    const achados = await supabase
      .from("academy_ebook_capitulos")
      .select("id")
      .eq("item_id", entrada.item_id)
      .eq("chave", entrada.chave)
      .limit(1);

    if (achados.error) return falha(`Não foi possível registrar: ${achados.error.message}`);
    const capitulo = achados.data?.[0];
    if (!capitulo) {
      console.warn("[academy] capítulo sem correspondência:", entrada.chave);
      return sucesso("Capítulo desconhecido, ignorado.");
    }

    const { data, error } = await supabase
      .from("academy_progresso")
      .upsert(
        {
          user_id: sessao.usuarioId,
          item_id: entrada.item_id,
          capitulo_id: capitulo.id,
          concluido: entrada.lido,
        },
        { onConflict: "user_id,item_id,capitulo_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível registrar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso(entrada.lido ? "Capítulo lido." : "Capítulo desmarcado.");
  });
}

const esquemaDeChecklist = z.object({
  item_id: z.string().uuid(),
  versao: z.number().int().positive(),
  chave: z.string().trim().min(1),
  marcados: z.array(z.string().trim().min(1)).max(200),
});

/**
 * Grava um bloco de checklist inteiro.
 *
 * **O BLOCO VAI INTEIRO, e nao um item por vez.** A pagina ja manda a lista
 * completa do bloco a cada clique, e gravar assim faz desmarcar ser a mesma
 * escrita que marcar -- sem uma segunda acao para "tirar", que e onde as duas
 * divergiriam. E o criterio de `post_versions.arquivos`: escrito de uma vez,
 * lido inteiro.
 *
 * **A VERSAO VEM DE FORA e e conferida contra a vigente.** Sem isso, uma aba
 * velha aberta na v1 continuaria gravando na v1 depois de a v2 ser publicada
 * -- e a v2, que deve comecar limpa, voltaria com marcacoes de um texto que
 * nao existe mais.
 */
export async function salvarChecklist(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarChecklist", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = esquemaDeChecklist.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "salvarChecklist",
          validacao.error,
          dados,
          "Não deu para registrar as marcações.",
        ),
      );
    }
    const entrada = validacao.data;
    const supabase = await criarClienteServidor();

    const vigente = await supabase
      .from("academy_arquivos")
      .select("versao")
      .eq("item_id", entrada.item_id)
      .order("versao", { ascending: false })
      .limit(1);

    if (vigente.error) return falha(`Não foi possível registrar: ${vigente.error.message}`);
    if (vigente.data?.[0]?.versao !== entrada.versao) {
      // A ABA VELHA NAO ESCREVE NA VERSAO NOVA, e nao e erro de ninguem:
      // alguem deixou a pagina aberta e o e-book foi republicado no meio.
      return sucesso("Este e-book tem uma versão nova. Recarregue a página.");
    }

    const { data, error } = await supabase
      .from("academy_ebook_checklists")
      .upsert(
        {
          user_id: sessao.usuarioId,
          item_id: entrada.item_id,
          versao: entrada.versao,
          chave: entrada.chave,
          itens_marcados: entrada.marcados,
        },
        { onConflict: "user_id,item_id,versao,chave" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível registrar: ${error.message}`);
    if (!data) return falha(RECUSA);

    return sucesso("Marcações salvas.");
  });
}

/**
 * "Li e estou ciente" de um e-book.
 *
 * **A VERSAO CONFIRMADA SAI DO BANCO, nunca do corpo do pedido.** Ela e o que
 * a releitura compara: aceitando um numero de fora, qualquer pessoa marcaria
 * `versao_confirmada = 99` e nunca mais seria cobrada por releitura nenhuma --
 * numa coluna que existe justamente para dizer que o processo mudou e ela
 * precisa ler de novo.
 *
 * **E ela NAO exige os capitulos todos marcados.** Quem ja conhece o processo
 * nao vai clicar em vinte e tres caixas para poder dizer que esta ciente; o
 * que o produto faz e NOMEAR o que falta antes de aceitar, e isso acontece na
 * tela. A regra escrita e `exige_confirmacao_leitura` do item, e nao a
 * contagem.
 */
export async function confirmarLeituraDoEbook(itemId: string): Promise<Resultado> {
  return executarAcao("confirmarLeituraDoEbook", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const vigente = await supabase
      .from("academy_arquivos")
      .select("versao")
      .eq("item_id", itemId)
      .order("versao", { ascending: false })
      .limit(1);

    if (vigente.error) return falha(`Não foi possível confirmar: ${vigente.error.message}`);

    const { data, error } = await supabase
      .from("academy_progresso")
      .upsert(
        {
          user_id: sessao.usuarioId,
          item_id: itemId,
          concluido: true,
          versao_confirmada: vigente.data?.[0]?.versao ?? 1,
        },
        { onConflict: "user_id,item_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível confirmar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Leitura confirmada.");
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
