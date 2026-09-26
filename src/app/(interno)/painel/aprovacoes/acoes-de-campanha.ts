"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  exigirAtendimentoNaAcao,
  exigirGestorNaAcao,
  exigirRotaNaAcao,
} from "@/lib/acoes/guardas";
import {
  executarAcao,
  falha,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { colunasDoConteudo, doEntregavel } from "@/lib/aprovacoes/conteudo";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Criar a campanha, enviar o entregável, registrar a versão.
 *
 * Tudo passa pelo cliente Supabase da própria pessoa: quem pode criar e editar
 * é o RLS que decide (`campaigns_insert` e `deliverables_insert` exigem
 * `is_staff()`). A checagem de rota aqui é a primeira barreira, não a única.
 *
 * **Enviar ao cliente não tem ação própria, e é de propósito.** Enviar É abrir
 * a rodada de escopo cliente: o carimbo em `deliverables.enviado_em` sai do
 * trigger `approval_rounds_marca_conteudo`. Uma ação que escrevesse a coluna
 * daria material carimbado sem rodada nenhuma — o cliente vendo a peça sem ter
 * onde decidir.
 */

const ROTA = "/painel/aprovacoes";

const CAMPOS = {
  nome: "nome da campanha",
  clienteId: "cliente",
  dataInicio: "data de início",
  dataFim: "data de encerramento",
};

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data.");
const dataOpcional = z.union([data, z.literal(""), z.null()]).optional();

const esquemaDoItem = z.object({
  nome: z.string().trim().min(1, "Todo item precisa de um nome."),
  prazo: dataOpcional,
  responsavelId: z.string().uuid().nullable().optional(),
});

const esquemaDoNo = esquemaDoItem.extend({
  filhos: z.array(esquemaDoItem).default([]),
});

const esquemaDaCampanha = z
  .object({
    nome: z.string().trim().min(2, "Dê um nome à campanha."),
    clienteId: z.string().uuid("Escolha o cliente."),
    descricao: z.string().trim().optional(),
    dataInicio: data,
    dataFim: data,
    /** De onde a estrutura saiu. Guardado como procedência, não como regra. */
    templateId: z.string().uuid().nullable().optional(),
    /**
     * O estado da campanha, e ele PRECISA estar aqui.
     *
     * A coluna tem default `planejamento` no banco, e a primeira versão desta
     * tela não oferecia o campo — então toda campanha nascia em planejamento,
     * e tanto a listagem do portal (que abre em "Ativas") quanto o bloco
     * "Campanhas ativas" da tela inicial a escondiam. Ela existia e não
     * aparecia em lugar nenhum, que é o pior desfecho possível para um
     * "Criar".
     */
    status: z
      .enum(["planejamento", "ativa", "finalizada", "cancelada"])
      .default("ativa"),
    /** A pasta de entrega da Task da campanha. */
    linkEntrega: z.string().trim().optional(),
    /** O briefing da Task, em JSON do TipTap. */
    briefing: z.unknown().nullable().optional(),
    /**
     * A ÁRVORE COMO A PESSOA A DEIXOU, e não o modelo de onde ela saiu.
     *
     * Quem expande o template é a tela, no instante em que ele é escolhido —
     * e daí em diante o Atendimento acrescenta, remove e datilografa prazos.
     * Se a action reexpandisse o modelo, tudo isso seria desfeito no clique
     * de salvar: a pessoa veria uma árvore e gravaria outra.
     */
    estrutura: z.array(esquemaDoNo).default([]),
  })
  .refine((v) => v.dataFim >= v.dataInicio, {
    path: ["dataFim"],
    message: "O encerramento não pode ser antes do início.",
  });

export type NovaCampanha = z.input<typeof esquemaDaCampanha>;

/**
 * Cria a campanha, a DEMANDA dela e a árvore — numa transação só.
 *
 * **Quem grava é `abrir_campanha()` no Postgres** (migration 0051), e não
 * cinco chamadas daqui. São cinco escritas encadeadas — a demanda, a
 * campanha, uma etapa por entregável, o entregável apontando para a etapa, e
 * as sub-etapas —, e pelo PostgREST seriam cinco transações: a terceira
 * falhando deixaria uma campanha ligada a uma demanda com metade das etapas,
 * sem nada na tela dizendo o que faltou. É a mesma razão de `decidir_solicitacao()`
 * e de `lancar_periodo()` viverem no banco.
 *
 * A RPC **não** é `security definer`: quem não pode abrir campanha
 * (`campaigns_insert`) e quem não pode abrir demanda (`tasks_insert`)
 * continua não podendo.
 *
 * **Os entregáveis nascem em `aguardando_informacoes` e SEM `enviado_em`.** A
 * estrutura existe para a equipe se organizar; o cliente só passa a enxergar
 * cada peça quando ela for enviada, uma a uma. Criar a campanha já visível
 * com quarenta linhas vazias faria a tela dele prometer material que ninguém
 * começou.
 */
export async function criarCampanha(entrada: NovaCampanha): Promise<Resultado> {
  return executarAcao("criarCampanha", async () => {
    // `exigirAtendimentoNaAcao` E NÃO `exigirRotaNaAcao`: desde a 0054 a rota
    // é de `EQUIPE` — o colaborador entra para subir a arte da peça dele —, e
    // abrir campanha continua sendo de quem abre demanda. A guarda que nomeia
    // a regra sobrevive à mudança de menu; a que depende dele, não.
    await exigirAtendimentoNaAcao();
    await exigirRotaNaAcao(ROTA);

    const validado = esquemaDaCampanha.safeParse(entrada);
    if (!validado.success) {
      return falha(recusaDeValidacao("criarCampanha", validado.error, entrada, "Confira os dados da campanha.", CAMPOS));
    }
    const dados = validado.data;

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("abrir_campanha", {
      p_cliente: dados.clienteId,
      p_nome: dados.nome,
      p_descricao: dados.descricao ?? null,
      p_data_inicio: dados.dataInicio,
      p_data_fim: dados.dataFim,
      p_status: dados.status,
      p_link_entrega: dados.linkEntrega ?? null,
      p_briefing_rico: (dados.briefing ?? null) as Json,
      // O TEXTO PURO É PARA A BUSCA, e sai do próprio JSON: a task guarda os
      // dois desde a 0004 porque o JSON preserva a formatação e o texto é o
      // que um `ilike` consegue varrer.
      p_briefing_texto: textoDoBriefing(dados.briefing),
      p_template: dados.templateId ?? null,
      p_estrutura: dados.estrutura.map((no) => ({
        nome: no.nome,
        prazo: no.prazo || null,
        responsavel: no.responsavelId ?? null,
        filhos: no.filhos.map((f) => ({
          nome: f.nome,
          prazo: f.prazo || null,
          responsavel: f.responsavelId ?? null,
        })),
      })) as unknown as Json,
    });

    if (error) return falha(error.message);
    if (!data) {
      return falha(
        "O banco recusou a criação. Normalmente é o RLS: abrir campanha é da equipe interna.",
      );
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso("Campanha criada, com a demanda e as etapas.");
  });
}

/**
 * O briefing em texto puro, para a busca.
 *
 * Anda o JSON do TipTap juntando os nós de texto. Não existe biblioteca disso
 * no servidor sem arrastar o editor inteiro para o bundle — e o editor é
 * `"use client"`, então ele não atravessa a fronteira de qualquer jeito.
 */
function textoDoBriefing(conteudo: unknown): string | null {
  const pedacos: string[] = [];

  function andar(no: unknown) {
    if (!no || typeof no !== "object") return;
    const atual = no as { type?: string; text?: string; content?: unknown[] };
    if (typeof atual.text === "string") pedacos.push(atual.text);
    if (Array.isArray(atual.content)) atual.content.forEach(andar);
  }

  andar(conteudo);
  const texto = pedacos.join(" ").trim();
  return texto.length > 0 ? texto : null;
}

/**
 * Manda o entregável ao cliente — abrindo a rodada de escopo cliente.
 *
 * Uma escrita só, e é a rodada. O `enviado_em` e o `status` do entregável saem
 * do trigger, na mesma transação: separá-los daria rodada de cliente num
 * material que ele não enxerga (a fila mostraria uma decisão impossível) e
 * material carimbado sem rodada nenhuma.
 *
 * Quem recusa o resto é `validar_nova_rodada`: aval interno antes do envio,
 * e, até a 0060, quem tinha produzido a peça.
 */
export async function enviarEntregavelAoCliente(
  entregavelId: string,
): Promise<Resultado> {
  return executarAcao("enviarEntregavelAoCliente", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const conteudo = doEntregavel(entregavelId);

    // A numeração continua de onde a anterior parou. Rodada fechada nunca é
    // reescrita nem apagada — cada ciclo de ajuste cria uma nova, com número
    // maior, e as anteriores ficam com o que foi pedido e decidido.
    const { data: anteriores } = await supabase
      .from("approval_rounds")
      .select("numero_rodada")
      .eq("content_type", conteudo.tipo)
      .eq("content_id", conteudo.id)
      .order("numero_rodada", { ascending: false })
      .limit(1);

    const numero = (anteriores?.[0]?.numero_rodada ?? 0) + 1;

    const { data, error } = await supabase
      .from("approval_rounds")
      .insert({
        ...colunasDoConteudo(conteudo),
        numero_rodada: numero,
        escopo: "cliente",
        solicitado_por: sessao.usuarioId,
      })
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O banco recusou o envio deste material.");
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso("Enviado ao cliente.");
  });
}

/**
 * Troca — ou tira — a capa do cartão da campanha.
 *
 * **O arquivo sobe pelo navegador, e aqui só entra o CAMINHO.** É a mesma
 * divisão do editor de post: quem sobe é a sessão da própria pessoa, então a
 * policy do Storage continua valendo; mandar o binário por Server Action o
 * faria atravessar o servidor do Next sem ganhar nenhuma checagem.
 *
 * **O caminho precisa começar pela pasta do cliente**, senão a capa aparece
 * para a equipe e some para quem ela foi feita: `"campanhas: cliente le"`
 * compara `(storage.foldername(name))[1]` com as empresas de quem pede. Quem
 * monta o caminho é a tela, e esta checagem é a segunda leitura da mesma
 * regra — barata, e o sintoma dela é uma imagem quebrada no portal.
 *
 * **Tirar a capa é `null`, e não apagar o arquivo.** O cartão volta ao
 * desenho de texto na hora; o arquivo fica no bucket, que é onde ele não
 * incomoda ninguém. Apagar junto transformaria um clique de "não era esta" em
 * perda de arquivo.
 */
export async function trocarCapaDaCampanha(
  campanhaId: string,
  caminho: string | null,
): Promise<Resultado> {
  return executarAcao("trocarCapaDaCampanha", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const { data: campanha } = await supabase
      .from("campaigns")
      .select("client_id")
      .eq("id", campanhaId)
      .maybeSingle();

    if (!campanha) {
      return falha("Esta campanha não existe, ou o seu acesso não a alcança.");
    }

    if (caminho && !caminho.startsWith(`${campanha.client_id}/`)) {
      return falha(
        "A capa precisa ficar na pasta do cliente, senão ela não aparece no portal dele.",
      );
    }

    // `.select()` porque o RLS pode recusar em silêncio: sem ele, um update
    // barrado volta sem erro e sem linha, e a tela diz "pronto" à toa.
    const { data, error } = await supabase
      .from("campaigns")
      .update({ capa_url: caminho })
      .eq("id", campanhaId)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O banco recusou a troca da capa. Trocar capa é da equipe interna.");
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso(caminho ? "Capa trocada." : "Capa retirada.");
  });
}

/**
 * Apaga a campanha — sócio e desenvolvedor, e mais ninguém.
 *
 * **A trava já existia, e é `campaigns_delete` desde a 0033:** `is_gestor()`,
 * que é exatamente desenvolvedor e sócio. Não houve migration nova aqui, e
 * essa é a resposta certa — criar uma segunda policy dizendo a mesma coisa é
 * criar o lugar onde as duas verdades divergem. O que faltava era a tela.
 *
 * **`exigirGestorNaAcao()` e não só `exigirRotaNaAcao()`**, apesar de a rota
 * já ser de gestão: o dia em que `/painel/aprovacoes` for aberta ao
 * colaborador — e o módulo de Social Media já foi, pelo mesmo argumento de
 * "quem produz precisa chegar ao trabalho dele" — a rota deixa de responder
 * por quem apaga. A guarda que nomeia a regra sobrevive à mudança; a que
 * depende do menu, não.
 *
 * **APAGAR LEVA A ÁRVORE INTEIRA**, por chave estrangeira: entregáveis, os
 * filhos deles, versões, comentários e rodadas de aprovação. Isso inclui o
 * que o cliente já aprovou. É por isso que a tela exige o nome digitado e
 * conta o que vai junto, em vez de um "tem certeza?" — a contagem é a única
 * coisa que faz alguém parar.
 *
 * **E é apagar de verdade, não desativar**, ao contrário de pessoa e de
 * cliente. Lá o nome preserva a autoria do que foi feito; aqui `campaigns`
 * não assina nada — quem assina uma aprovação é `approval_rounds`, e a
 * campanha some com ela junto. Uma campanha "cancelada" parada na lista do
 * portal seria o que `cancelada` era no board da Task: uma linha que só
 * acumula, na tela de quem não quer vê-la.
 */
export async function apagarCampanha(campanhaId: string): Promise<Resultado> {
  return executarAcao("apagarCampanha", async () => {
    await exigirGestorNaAcao();
    await exigirRotaNaAcao(ROTA);

    const supabase = await criarClienteServidor();

    // `.select()` porque o RLS recusa em silêncio: um delete barrado volta sem
    // erro e sem linha, e a tela diria "apagada" com ela ainda lá.
    const { data, error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campanhaId)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha(
        "O banco recusou. Apagar campanha é de sócio ou desenvolvedor — e a campanha precisa existir.",
      );
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso("Campanha apagada.");
  });
}

const ARQUIVO = z.object({
  url: z.string().trim().min(1),
  nome: z.string().trim().min(1),
});

const esquemaDaVersao = z.object({
  arquivos: z.array(ARQUIVO).min(1, "Suba pelo menos um arquivo."),
  notas: z.string().trim().optional(),
});

/**
 * Grava uma VERSÃO do entregável — os arquivos e a justificativa.
 *
 * **Toda subida é uma versão nova, e nenhuma reescreve a anterior.** É a
 * regra do módulo desde a 0033, e é ela que faz o histórico valer: a v2 conta
 * o que mudou em relação à v1, e a v1 continua lá com o arquivo que o cliente
 * viu quando pediu o ajuste. Reescrever a corrente seria a única forma de uma
 * troca sumir do histórico.
 *
 * `numero_versao` é do trigger `deliverable_versions_numera`, e a capa e o
 * nome saem de `sincronizar_entregavel_com_a_versao` — não desta action.
 * Escrever os três aqui seria a segunda verdade sobre a mesma coisa, e a que
 * diverge no dia em que alguém gravar uma versão por outro caminho.
 *
 * **O binário sobe pelo navegador**, com a sessão de quem está clicando, e
 * para cá vem só o caminho: a policy `"campanhas: equipe escreve"` continua
 * valendo, e mandar o arquivo por Server Action o faria atravessar o servidor
 * do Next sem ganhar checagem nenhuma no caminho.
 */
export async function gravarVersaoDoEntregavel(
  entregavelId: string,
  entrada: { arquivos: { url: string; nome: string }[]; notas?: string },
): Promise<Resultado> {
  return executarAcao("gravarVersaoDoEntregavel", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validado = esquemaDaVersao.safeParse(entrada);
    if (!validado.success) {
      return falha(
        recusaDeValidacao("gravarVersaoDoEntregavel", validado.error, entrada, "Confira os arquivos.", {
          arquivos: "arquivos",
          notas: "o que mudou",
        }),
      );
    }

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("deliverable_versions")
      .insert({
        deliverable_id: entregavelId,
        arquivos: validado.data.arquivos as unknown as Json,
        notas_mudanca: validado.data.notas || null,
        criado_por: sessao.usuarioId,
      })
      .select("id, numero_versao");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha(
        "O banco recusou a versão. Subir material da campanha é da equipe interna.",
      );
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso(`Versão ${data[0].numero_versao} gravada.`);
  });
}

/**
 * Troca o status do entregável dentro da agência.
 *
 * **`aprovado` e `rejeitado` NÃO passam por aqui**, e a ausência é a regra:
 * quem aprova é o cliente, pela rodada dele. Oferecer os dois na tela da
 * agência seria oferecer um jeito de carimbar a aprovação sem o cliente ter
 * visto nada — e o `content_status` gravado assim ficaria dizendo que ele
 * decidiu.
 */
export async function moverEntregavel(
  entregavelId: string,
  status: "aguardando_informacoes" | "em_producao" | "stand_by",
): Promise<Resultado> {
  return executarAcao("moverEntregavel", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("deliverables")
      .update({ status })
      .eq("id", entregavelId)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O banco recusou. Mexer no entregável é da equipe interna.");
    }

    revalidatePath(ROTA);
    return sucesso("Entregável atualizado.");
  });
}
