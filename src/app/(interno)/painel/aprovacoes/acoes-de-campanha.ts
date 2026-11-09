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
import {
  colunasDoConteudo,
  doEntregavel,
  esquemaDeEnvio,
  ROTULOS_DO_ENVIO,
} from "@/lib/aprovacoes/conteudo";
import { gravarOsOutrosAprovadores } from "@/lib/aprovacoes/aprovadores";
import {
  canaisNormalizados,
  entregaveisDoWorkflow,
  TIPOS_DE_MATERIAL,
  type NoDeModelo,
} from "@/lib/dominio/campanhas";
import { hojeNaAgencia } from "@/lib/dominio/datas";
import { fluxoDoWorkflow } from "@/lib/dados/workflows";
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

/**
 * Os rótulos do briefing para a frase da recusa (0125).
 *
 * Eles NÃO saem de `CAMPOS_DO_BRIEFING`, que é do domínio: aquele mapa é a
 * pergunta que a TELA faz ("Com quem ela fala?"), e a recusa de validação
 * precisa do nome do campo numa frase — *"Confira o campo: público"*. Duas
 * coisas diferentes com o mesmo nome seriam uma só, divergindo.
 *
 * *(E o nome da função que monta essa frase não aparece escrito acima de
 * propósito: `check:mensagens` casa por posição e leria a menção como uma
 * chamada sem o nome da action — a armadilha de a explicação carregar o que
 * ela proíbe, que este projeto já pagou sete vezes.)*
 */
const CAMPOS_DO_BRIEFING_NA_RECUSA = {
  objetivo: "objetivo",
  publico: "público",
  mensagem: "mensagem central",
  produtos: "produtos ou serviços",
  tomDeVoz: "tom de voz",
  canais: "canais",
  restricoes: "restrições",
};

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data.");
const dataOpcional = z.union([data, z.literal(""), z.null()]).optional();

const esquemaDoItem = z.object({
  nome: z.string().trim().min(1, "Todo item precisa de um nome."),
  prazo: dataOpcional,
  responsavelId: z.string().uuid().nullable().optional(),
  /**
   * De que tipo é o material (0122).
   *
   * **A lista vem de `TIPOS_DE_MATERIAL` e não é copiada aqui**, que é a
   * lição que `TIPOS_DE_EVENTO` pagou: a 0109 acrescentou o oitavo tipo de
   * evento ao enum do banco e à lista de domínio, a cópia escrita à mão
   * dentro do `z.enum` da action ficou com sete, e o chip novo era recusado
   * no clique com "Confira o campo: tipo" — sem o banco nunca ser chamado.
   */
  tipo: z.enum(TIPOS_DE_MATERIAL).nullable().optional(),
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
     * A FRENTE DA CONTA a que esta campanha pertence (0118).
     *
     * Ela mora na DEMANDA e não em `campaigns`, pela razão de o briefing e a
     * pasta de entrega também morarem lá: a campanha nasce com uma demanda, e
     * uma segunda coluna com o mesmo papel em outra tabela é o lugar onde as
     * duas divergem. Quem classifica por vertente — o filtro do board, a
     * Biblioteca do cliente, o relatório — lê `tasks.vertente_id`.
     */
    vertenteId: z.string().uuid().nullable().optional(),
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
    /** As OBSERVAÇÕES, em JSON do TipTap — o briefing em prosa da Task. */
    briefing: z.unknown().nullable().optional(),
    /**
     * O BRIEFING ESTRUTURADO (0125), e ele é de `campaigns` e não da Task.
     *
     * **Os sete campos são opcionais**, pela razão da 0015: há campanha
     * gravada antes desta regra, e exigi-los faria a pessoa inventar um
     * objetivo e um público para poder abrir a campanha de hoje — que é pior
     * que não classificar, porque o relatório somaria o inventado.
     *
     * **E eles NÃO entram no briefing em texto**, que é a lição da 0124: o
     * que virou coluna não se escreve também em prosa, senão são duas
     * verdades e a do texto é a que envelhece.
     */
    objetivo: z.string().trim().optional(),
    publico: z.string().trim().optional(),
    mensagem: z.string().trim().optional(),
    produtos: z.string().trim().optional(),
    tomDeVoz: z.string().trim().optional(),
    canais: z.array(z.string()).default([]),
    restricoes: z.string().trim().optional(),
    /**
     * O FORMATO E A MEDIDA de cada tipo da composição (0125).
     *
     * Ela viaja à parte de `estrutura` porque quem escreve
     * `campaign_composicao` é `abrir_campanha()`, contando as FOLHAS — o
     * formato não sai de folha nenhuma, então ele é uma segunda escrita,
     * por tipo, depois de a RPC devolver.
     */
    composicao: z
      .array(
        z.object({
          tipo: z.enum(TIPOS_DE_MATERIAL),
          formato: z.string().trim().optional(),
          dimensoes: z.string().trim().optional(),
        }),
      )
      .default([]),
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
      return falha(
        recusaDeValidacao(
          "criarCampanha",
          validado.error,
          entrada,
          "Confira os dados da campanha.",
          CAMPOS,
        ),
      );
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
        tipo: no.tipo ?? null,
        filhos: no.filhos.map((f) => ({
          nome: f.nome,
          prazo: f.prazo || null,
          responsavel: f.responsavelId ?? null,
          // O FILHO MANDA O DELE quando tem; sem isso, `abrir_campanha()`
          // faz ele herdar o do grupo — que é o caso normal de "dez
          // estáticos", onde o tipo foi escolhido uma vez.
          tipo: f.tipo ?? null,
        })),
      })) as unknown as Json,
    });

    if (error) return falha(error.message);
    if (!data) {
      return falha(
        "O banco recusou a criação. Normalmente é o RLS: abrir campanha é da equipe interna.",
      );
    }

    // ------------------------------------------------- a vertente da demanda
    //
    // ELA É UMA SEGUNDA ESCRITA, e não um parâmetro de `abrir_campanha()`.
    //
    // `create or replace` não troca a lista de argumentos — ele cria uma
    // SEGUNDA função ao lado, e a chamada antiga vira ambígua (a lição da
    // 0061, que custou um "Could not find the function" ao usuário). Um
    // `drop`+`create` abriria uma janela em que a tela no ar chama uma função
    // que não existe, e este produto pagou por isso com a 0120.
    //
    // **E ela não pode derrubar a campanha que acabou de nascer.** A demanda,
    // as etapas e as peças já estão gravadas; uma recusa aqui — o trigger
    // `tasks_vertente_da_conta` (0118) recusando uma frente de outra empresa,
    // por exemplo — não desfaz nada, então o que ela pode fazer é avisar. É a
    // decisão de `etapa_acompanha_o_entregavel` (0052): o trigger está do
    // outro lado, e uma recusa dele apareceria como o clique DA PESSOA
    // falhando, com uma mensagem sobre outra coisa.
    // SAO TRES SEGUNDAS ESCRITAS e UMA frase, e a diferença importa: um
    // `return` por escrita faria a pessoa ler sobre a frente e nunca saber
    // que o briefing também ficou de fora. Elas contam o que falhou e
    // mandam para onde se conserta — a decisão da recusa da 0023, que nomeia
    // CADA etapa sem aprovação em vez de dizer "há etapa sem aprovação".
    const naoGravou: string[] = [];

    if (dados.vertenteId) {
      const { error: erroDaVertente } = await supabase
        .from("tasks")
        .update({ vertente_id: dados.vertenteId })
        .eq("id", (await demandaDaCampanha(supabase, data)) ?? "")
        .select("id");

      if (erroDaVertente) {
        console.error(
          "[criarCampanha] a vertente não foi gravada",
          erroDaVertente,
        );
        naoGravou.push("a frente da conta");
      }
    }

    // ------------------------------------------------- o briefing estruturado
    //
    // ELE É UMA SEGUNDA ESCRITA pela mesma razão da vertente: `create or
    // replace` não troca a lista de argumentos de `abrir_campanha()` (0061), e
    // um `drop`+`create` abriria a janela que a 0120 pagou.
    //
    // O `update` passa pelo trigger `campaigns_protege_colunas`, que desde a
    // 0125 recusa o briefing para quem não é `is_atendimento()` — e quem chega
    // aqui já passou por `exigirAtendimentoNaAcao()`, então a recusa só
    // apareceria se as duas perguntas divergissem. É a mesma trava nos dois
    // idiomas da casa.
    const briefing = {
      objetivo: dados.objetivo || null,
      publico: dados.publico || null,
      mensagem: dados.mensagem || null,
      produtos: dados.produtos || null,
      tom_de_voz: dados.tomDeVoz || null,
      // A NORMALIZAÇÃO É AQUI e não no banco, e a razão está escrita em
      // `canaisNormalizados()`: nenhuma conta depende de `canais`, então uma
      // trava de repetição no Postgres seria a 0060 de novo.
      canais: canaisNormalizados(dados.canais).slice(0, 20),
      restricoes: dados.restricoes || null,
    };

    if (
      briefing.canais.length > 0 ||
      Object.values(briefing).some((v) => typeof v === "string" && v)
    ) {
      const { error: erroDoBriefing } = await supabase
        .from("campaigns")
        .update(briefing)
        .eq("id", data)
        .select("id");

      if (erroDoBriefing) {
        console.error(
          "[criarCampanha] o briefing não foi gravado",
          erroDoBriefing,
        );
        naoGravou.push("o briefing");
      }
    }

    // --------------------------------- o formato e a medida de cada tipo
    //
    // UM `update` POR TIPO, e não um `upsert`: as linhas já existem — quem as
    // inseriu foi `abrir_campanha()`, contando as FOLHAS (0122) —, e um
    // `upsert` precisaria mandar `quantidade` de volta, que é justamente o
    // número que a função acabou de contar. Mandá-lo daqui seria a segunda
    // verdade sobre quantos materiais a campanha combinou.
    const comFormato = dados.composicao.filter(
      (linha) => linha.formato || linha.dimensoes,
    );

    if (comFormato.length > 0) {
      const resultados = await Promise.all(
        comFormato.map((linha) =>
          supabase
            .from("campaign_composicao")
            .update({
              formato: linha.formato || null,
              dimensoes: linha.dimensoes || null,
            })
            .eq("campaign_id", data)
            .eq("tipo", linha.tipo)
            .select("tipo"),
        ),
      );

      const falhou = resultados.filter((r) => r.error);
      if (falhou.length > 0) {
        console.error(
          "[criarCampanha] o formato de algum tipo não foi gravado",
          falhou.map((r) => r.error),
        );
        naoGravou.push("o formato de algum material");
      }
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");

    if (naoGravou.length > 0) {
      return sucesso(
        `Campanha criada, mas ${listar(naoGravou)} não ${
          naoGravou.length === 1 ? "foi" : "foram"
        } gravad${naoGravou.length === 1 ? "o" : "os"}. Complete no painel da campanha.`,
      );
    }

    return sucesso("Campanha criada, com a demanda e as etapas.");
  });
}

/**
 * "a frente da conta e o briefing" — a lista por extenso, para a frase.
 *
 * Local e não em `lib/dominio/`: ela tem UM chamador, e um utilitário
 * compartilhado com um dono é o que alguém reaproveita três sprints depois
 * achando que ele decide alguma coisa.
 */
function listar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/** O id da demanda que `abrir_campanha()` acabou de criar. */
async function demandaDaCampanha(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  campanhaId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("campaigns")
    .select("task_id")
    .eq("id", campanhaId)
    .limit(1);

  return data?.[0]?.task_id ?? null;
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
  envio: unknown,
): Promise<Resultado> {
  return executarAcao("enviarEntregavelAoCliente", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    // QUEM RECEBE VEM COM O ENVIO (0128). A trava que vale é
    // `validar_nova_rodada`; esta validação escreve a frase antes do clique.
    const validacao = esquemaDeEnvio.safeParse(envio);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "enviarEntregavelAoCliente",
          validacao.error,
          envio,
          "Confira o envio.",
          ROTULOS_DO_ENVIO,
        ),
      );
    }

    const supabase = await criarClienteServidor();
    const conteudo = doEntregavel(entregavelId);

    // -----------------------------------------------------------------------
    // O NÚMERO DA RODADA É A VERSÃO DA PEÇA, e não "a próxima".
    //
    // Era `max(numero_rodada) + 1`, e com isso o envio NUNCA passava: desde a
    // 0033 o trigger exige a rodada INTERNA do MESMO número aprovada antes da
    // de cliente, e um número sempre maior que o da interna não casa com
    // nenhuma. O botão existia e o banco recusava com *"esta rodada ainda não
    // passou pela aprovação interna"* — sobre uma aprovação que, até agora,
    // não tinha por onde acontecer.
    //
    // Casando o número com `versao_atual`, as duas rodadas da mesma versão se
    // encontram, e subir uma versão nova depois do aval deixa a nova SEM aval
    // — que é o que tem de acontecer: o que a gestão aprovou não é mais o que
    // iria ao cliente. Rodada fechada continua sem ser reescrita, porque cada
    // versão nova traz um número novo.
    // -----------------------------------------------------------------------
    const { data: peca } = await supabase
      .from("deliverables")
      .select("id, versao_atual")
      .eq("id", entregavelId)
      .maybeSingle();

    if (!peca)
      return falha("Este material não existe, ou o seu acesso não o alcança.");

    const { data, error } = await supabase
      .from("approval_rounds")
      .insert({
        ...colunasDoConteudo(conteudo),
        numero_rodada: peca.versao_atual,
        escopo: "cliente",
        solicitado_por: sessao.usuarioId,
        aprovador_id: validacao.data.aprovadorIds[0],
        mensagem: validacao.data.mensagem,
      })
      .select("id");

    if (error)
      return falha(`${error.message}${error.hint ? ` ${error.hint}` : ""}`);
    if (!data || data.length === 0) {
      return falha("O banco recusou o envio deste material.");
    }

    // OS OUTROS APROVADORES ENTRAM DEPOIS, e um aviso no lugar de uma recusa:
    // a peça já está no portal do cliente.
    const avisoDosOutros = await gravarOsOutrosAprovadores(
      supabase,
      data[0].id,
      validacao.data.aprovadorIds,
    );

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso(avisoDosOutros ?? "Enviado ao cliente.");
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
      return falha(
        "O banco recusou a troca da capa. Trocar capa é da equipe interna.",
      );
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
        recusaDeValidacao(
          "gravarVersaoDoEntregavel",
          validado.error,
          entrada,
          "Confira os arquivos.",
          {
            arquivos: "arquivos",
            notas: "o que mudou",
          },
        ),
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

// ---------------------------------------------------------------------------
// EDITAR A CAMPANHA DEPOIS DE ABERTA (0078) — decisão do usuário.
//
// A tela de produção mostrava nome, cliente, período e estado como TEXTO desde
// que nasceu, e a única coisa que se trocava ali era a capa. Um nome digitado
// errado na abertura ficava para sempre: no board da agência, no portal do
// cliente e no calendário.
// ---------------------------------------------------------------------------

const esquemaDaEdicao = z
  .object({
    nome: z.string().trim().min(2, "Dê um nome à campanha."),
    descricao: z.string().trim().optional(),
    dataInicio: data,
    dataFim: data,
    status: z.enum(["planejamento", "ativa", "finalizada", "cancelada"]),
  })
  .refine((v) => v.dataFim >= v.dataInicio, {
    path: ["dataFim"],
    message: "O encerramento não pode ser antes do início.",
  });

export type EdicaoDaCampanha = z.input<typeof esquemaDaEdicao>;

/**
 * Edita o que foi combinado: nome, descrição, período e estado.
 *
 * ---------------------------------------------------------------------------
 * **O CLIENTE NÃO ESTÁ AQUI, e a ausência é a regra.** `abrir_campanha()`
 * (0051) cria a demanda com o mesmo `client_id`, e a visibilidade de cada
 * entregável no portal sai dali — trocar a empresa deixaria a demanda
 * apontando para a antiga e as peças já enviadas visíveis para quem não as
 * pediu. O campo que não existe não volta no dia em que alguém copiar este
 * formulário; e, de qualquer forma, `campaigns_protege_colunas` recusa.
 *
 * **`exigirAtendimentoNaAcao` e não `exigirRotaNaAcao`**, pela razão da
 * criação: desde a 0054 a rota é de `EQUIPE` — o colaborador entra para subir
 * a arte da peça dele —, e nome, período e estado são o combinado com o
 * cliente. **E a guarda não é a trava**: quem recusa é o trigger da 0078, que
 * vale para quem chamar a API direto. Esta existe para a pessoa ler uma frase
 * em vez de levar um erro de banco.
 *
 * **O título da demanda acompanha o nome, e o período NÃO** — quem espelha é
 * `campaigns_espelha_na_demanda`, e o porquê da assimetria está lá: o período
 * da demanda é derivado das etapas desde a 0028, e gravá-lo aqui seria
 * escrever um valor que o próximo recálculo desfaz.
 *
 * **E o estado pode voltar sozinho.** `campanha_finaliza_sozinha` (0051) põe
 * `finalizada` quando toda folha está aprovada e devolve para `ativa` quando
 * uma peça volta à produção. Marcar `ativa` à mão numa campanha com tudo
 * aprovado é uma escolha que o trigger desfaz na próxima escrita — e isso é
 * dito na tela, em vez de a pessoa descobrir sozinha.
 * ---------------------------------------------------------------------------
 */
export async function editarCampanha(
  campanhaId: string,
  entrada: EdicaoDaCampanha,
): Promise<Resultado> {
  return executarAcao("editarCampanha", async () => {
    await exigirAtendimentoNaAcao();

    const validacao = esquemaDaEdicao.safeParse(entrada);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "editarCampanha",
          validacao.error,
          entrada,
          "Confira os dados da campanha.",
          CAMPOS,
        ),
      );
    }
    const dados = validacao.data;

    const supabase = await criarClienteServidor();

    // `.select()` porque o RLS e o trigger podem recusar: sem ele, um update
    // barrado volta sem erro e sem linha, e a tela diz "pronto" à toa.
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        nome: dados.nome,
        descricao: dados.descricao?.trim() || null,
        data_inicio: dados.dataInicio,
        data_fim: dados.dataFim,
        status: dados.status,
      })
      .eq("id", campanhaId)
      .select("id");

    if (error)
      return falha(`${error.message}${error.hint ? ` ${error.hint}` : ""}`);
    if (!data || data.length === 0) {
      return falha(
        "O banco recusou. Editar a campanha é de quem abre demanda.",
      );
    }

    revalidatePath(ROTA);
    revalidatePath(`${ROTA}/campanhas/${campanhaId}`);
    revalidatePath("/portal/campanhas");
    return sucesso("Campanha atualizada.");
  });
}

/**
 * "Pedir aval interno" — a rodada INTERNA da peça de campanha.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário, citada no CLAUDE.md: a arte que o colaborador sobe
 * passa pelo aval da gestão antes de sair da agência, e é a gestão que avisa
 * quem produziu quando ela pede ajuste. A frase dele mora lá, e não aqui,
 * porque ela nomeia o rótulo antigo e `check:cores` varre `src/` atrás dele.
 *
 * **NÃO HÁ MIGRATION, e é a parte que importa.** `validar_nova_rodada` recusa
 * uma rodada de escopo `cliente` num entregável enquanto não houver a INTERNA
 * do mesmo número aprovada — está no banco desde a 0033, na mesma forma do
 * post —, `approval_rounds_decide` já aceita `deliverable` por
 * `pode_aprovar_entregavel()`, e `approval_rounds_avisa_aprovador` (0064) já
 * toca o sino quando uma rodada interna nasce pendente.
 *
 * O que faltava era ESTA ação. Até aqui a tela de produção tinha "Enviar ao
 * cliente" e mais nada: quem clicava levava do banco um *"esta rodada ainda não
 * passou pela aprovação interna"* sobre uma aprovação que não tinha por onde
 * acontecer. É a ponte construída e nunca atravessada — a mesma situação do
 * aval interno do post antes de ele entrar na fila.
 *
 * **O NÚMERO É A VERSÃO, e não "a próxima rodada".** O trigger compara
 * `numero_rodada` entre a interna e a de cliente, e `deliverable_versions`
 * numera as versões: casando os dois, subir a v2 depois do aval da v1 deixa a
 * v2 sem aval — que é exatamente o que tem de acontecer, porque o que a gestão
 * aprovou não é mais o que iria ao cliente. Com um contador próprio, a v2
 * herdaria o aval da v1 e sairia sem ninguém ter olhado.
 *
 * **Quem abre é o responsável pela peça, ou a gestão** — a pergunta é do
 * trigger (*"só quem produziu o entregável envia para aprovação"*), e aqui não
 * se repete: `exigirRotaNaAcao` é a porta do módulo, e o resto é do banco.
 * ---------------------------------------------------------------------------
 */
export async function pedirAnaliseDoEntregavel(
  entregavelId: string,
): Promise<Resultado> {
  return executarAcao("pedirAnaliseDoEntregavel", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const conteudo = doEntregavel(entregavelId);

    const { data: peca } = await supabase
      .from("deliverables")
      .select("id, nome, versao_atual, arte_url, campaign_id")
      .eq("id", entregavelId)
      .maybeSingle();

    if (!peca)
      return falha("Este material não existe, ou o seu acesso não o alcança.");
    if (!peca.arte_url) {
      return falha("Suba pelo menos um arquivo antes de pedir o aval interno.");
    }

    const { data: jaTem } = await supabase
      .from("approval_rounds")
      .select("id")
      .eq("content_type", conteudo.tipo)
      .eq("content_id", conteudo.id)
      .eq("escopo", "interna")
      .eq("numero_rodada", peca.versao_atual)
      .limit(1);

    if (jaTem && jaTem.length > 0) {
      return falha(
        "Esta versão já pediu o aval interno. Suba uma versão nova para pedir de novo.",
      );
    }

    const { data, error } = await supabase
      .from("approval_rounds")
      .insert({
        ...colunasDoConteudo(conteudo),
        numero_rodada: peca.versao_atual,
        escopo: "interna",
        solicitado_por: sessao.usuarioId,
      })
      .select("id");

    if (error)
      return falha(`${error.message}${error.hint ? ` ${error.hint}` : ""}`);
    if (!data || data.length === 0) {
      return falha(
        "O banco recusou: só quem produziu o material pede o aval interno dele.",
      );
    }

    revalidatePath(ROTA);
    revalidatePath(`${ROTA}/campanhas/${peca.campaign_id}`);
    // A FILA MORA EM GESTÃO DE TASKS desde que as três telas viraram uma.
    revalidatePath("/painel/gestao-tasks");
    return sucesso(
      "Aval interno pedido. A gestão decide na fila de aprovações internas.",
    );
  });
}

/**
 * A ÁRVORE QUE UM WORKFLOW SUGERE PARA ESTA CAMPANHA (migration 0108).
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"quando crio um workflow, ele nao está permitindo que
 * eu aplique ela na campanha"*. O seletor "Partir de um modelo" lia
 * `campaign_templates` e nada mais — outra tabela, que nenhuma tela do produto
 * cria. Agora ele oferece as duas origens, e esta é a leitura da segunda.
 *
 * **É LEITURA NUMA ACTION, e tem precedente**: `buscarDisponibilidade` e
 * `buscarPreviaDoLink` fazem o mesmo. A convenção manda leitura para
 * `lib/dados/`, que é `server-only` e serve quem renderiza no servidor; aqui
 * quem pergunta é o formulário, que é `"use client"` e só sabe o cliente
 * depois de a pessoa escolher.
 *
 * **E É POR ISSO QUE ELA NÃO PODE SER RESOLVIDA NA PÁGINA**: o responsável de
 * cada etapa sai de `etapas_resolvidas_do_workflow()` (0064), que recebe a
 * CONTA — e a conta é escolhida na tela. Pré-resolver na página exigiria
 * resolver todo workflow para todo cliente, que é a matriz inteira para usar
 * uma linha dela.
 * ---------------------------------------------------------------------------
 *
 * Ela usa o cliente da própria pessoa, então a RLS de `workflow_templates` e
 * `workflow_steps` continua decidindo o que volta — e a guarda é a mesma de
 * `criarCampanha`, porque quem monta a árvore é quem vai abrir a campanha.
 */
export async function arvoreDoWorkflowParaCampanha(
  templateId: string,
  clienteId: string | null,
  dataInicio: string,
): Promise<Resultado<NoDeModelo[]>> {
  return executarAcao("arvoreDoWorkflowParaCampanha", async () => {
    await exigirAtendimentoNaAcao();

    // SEM DATA DE INÍCIO NÃO HÁ PRAZO A SUGERIR, e a volta é uma árvore de
    // nomes: `prazo_offset_dias` é contado do início, e inventar uma data aqui
    // faria toda peça nascer com um prazo que ninguém escolheu. É a razão pela
    // qual o offset existe no modelo (0008).
    const base = dataInicio || hojeNaAgencia();

    const aplicado = await fluxoDoWorkflow(templateId, base, clienteId);
    if (!aplicado) {
      return falha(
        "Este workflow não foi encontrado, ou não tem cadeia de etapas.",
      );
    }

    return sucesso(
      aplicado.semDono.length > 0
        ? `Árvore montada. Sem ninguém na conta para: ${aplicado.semDono.join(", ")}.`
        : "Árvore montada a partir do workflow.",
      entregaveisDoWorkflow(aplicado.etapas, base),
    );
  });
}

const esquemaDoBriefing = z.object({
  objetivo: z.string().trim(),
  publico: z.string().trim(),
  mensagem: z.string().trim(),
  produtos: z.string().trim(),
  tomDeVoz: z.string().trim(),
  canais: z.array(z.string()),
  restricoes: z.string().trim(),
  /** O formato e a medida de cada tipo da composição (0125). */
  composicao: z
    .array(
      z.object({
        tipo: z.enum(TIPOS_DE_MATERIAL),
        formato: z.string().trim(),
        dimensoes: z.string().trim(),
      }),
    )
    .default([]),
});

export type BriefingParaSalvar = z.input<typeof esquemaDoBriefing>;

/**
 * Salvar o briefing de uma campanha que já existe (0125).
 *
 * **A SEÇÃO TEM BOTÃO e não salva sozinha**, ao contrário da tela de task
 * (0028). Lá o rascunho é de quem o criou e não existe para mais ninguém;
 * aqui cada salvamento parcial muda o combinado que quem produz vai ler, e um
 * objetivo pela metade lido por quem está desenhando a peça é pior que o
 * objetivo antigo. É a decisão do editor de recorrência.
 *
 * **Quem pode é `is_atendimento()` nos DOIS idiomas da casa**:
 * `exigirAtendimentoNaAcao()` aqui e o trigger `campaigns_protege_colunas`
 * (0125) no banco — `campaigns_update` é `is_staff()` desde a 0033 porque é
 * por ela que quem produz troca a CAPA, e **policy não limita coluna**.
 *
 * As OBSERVAÇÕES e os ANEXOS não passam por aqui: eles são o briefing em
 * prosa e as referências da DEMANDA, e quem os grava é `atualizarTask` e
 * `adicionarReferencia`, que já existem. Uma segunda porta para a mesma
 * escrita seria a segunda verdade sobre o mesmo material.
 */
export async function salvarBriefingDaCampanha(
  campanhaId: string,
  entrada: BriefingParaSalvar,
): Promise<Resultado> {
  return executarAcao("salvarBriefingDaCampanha", async () => {
    await exigirAtendimentoNaAcao();
    await exigirRotaNaAcao(ROTA);

    const validacao = esquemaDoBriefing.safeParse(entrada);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "salvarBriefingDaCampanha",
          validacao.error,
          entrada,
          "Confira o briefing.",
          CAMPOS_DO_BRIEFING_NA_RECUSA,
        ),
      );
    }
    const dados = validacao.data;

    const supabase = await criarClienteServidor();

    // `.select()` porque o RLS e o trigger podem recusar: sem ele, um update
    // barrado volta sem erro e sem linha, e a tela diz "pronto" à toa.
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        objetivo: dados.objetivo || null,
        publico: dados.publico || null,
        mensagem: dados.mensagem || null,
        produtos: dados.produtos || null,
        tom_de_voz: dados.tomDeVoz || null,
        canais: canaisNormalizados(dados.canais).slice(0, 20),
        restricoes: dados.restricoes || null,
      })
      .eq("id", campanhaId)
      .select("id");

    if (error) {
      return falha(`${error.message}${error.hint ? ` ${error.hint}` : ""}`);
    }
    if (!data || data.length === 0) {
      return falha(
        "O banco recusou. O briefing é de quem abre a campanha — o Atendimento e a gestão.",
      );
    }

    // ------------------------------------- o formato e a medida de cada tipo
    //
    // UM `update` POR TIPO e nunca um `upsert`, pela razão da criação: a
    // QUANTIDADE é contada das folhas por `abrir_campanha()` (0122), e
    // mandá-la daqui seria a segunda verdade sobre quantos materiais a
    // campanha combinou. Tipo que ainda não tem linha simplesmente não casa,
    // e isso é o certo — o plano nasce da árvore, não daqui.
    const comFormato = dados.composicao.filter(
      (linha) => linha.formato || linha.dimensoes,
    );

    let algumFormatoFalhou = false;
    if (comFormato.length > 0) {
      const resultados = await Promise.all(
        comFormato.map((linha) =>
          supabase
            .from("campaign_composicao")
            .update({
              formato: linha.formato || null,
              dimensoes: linha.dimensoes || null,
            })
            .eq("campaign_id", campanhaId)
            .eq("tipo", linha.tipo)
            .select("tipo"),
        ),
      );

      const falhou = resultados.filter((r) => r.error);
      if (falhou.length > 0) {
        console.error(
          "[salvarBriefingDaCampanha] o formato de algum tipo",
          falhou.map((r) => r.error),
        );
        algumFormatoFalhou = true;
      }
    }

    revalidatePath(`${ROTA}/campanhas/${campanhaId}`);

    return sucesso(
      algumFormatoFalhou
        ? "Briefing salvo, mas o formato de algum material não foi gravado."
        : "Briefing salvo.",
    );
  });
}

/**
 * O briefing de OUTRA campanha, para partir dele (0125).
 *
 * É o *"reutilizável"* do pedido, e **o que ele devolve cai no rascunho da
 * tela e não no banco**: a pessoa confere e ajusta antes de salvar. Gravar no
 * clique poria o público de outra campanha no combinado desta sem ninguém ter
 * lido — e "reutilizável" quer dizer *partir de*, não *herdar*.
 *
 * **ELA LÊ E NÃO ESCREVE, e é por isso que é uma action e não
 * `lib/dados/`.** A convenção manda leitura para lá, que é `server-only` e
 * serve quem renderiza no servidor; aqui quem pergunta é a seção do briefing,
 * que é `"use client"` e troca de campanha sem recarregar a página. É o
 * precedente de `buscarPreviaDoLink` e de `buscarDisponibilidade`.
 *
 * **A trava é a RLS e não uma pergunta aqui**: ela usa o cliente da própria
 * pessoa, então `campaigns_select` decide — e `briefingsParaCopiar()`, que
 * monta a lista, já recorta pela MESMA conta. Um `client_id` repetido aqui
 * seria a segunda pergunta embaixo de uma primeira que já barra todo mundo.
 */
export async function copiarBriefingDeOutraCampanha(
  deCampanhaId: string,
): Promise<Resultado<BriefingParaSalvar>> {
  return executarAcao("copiarBriefingDeOutraCampanha", async () => {
    await exigirAtendimentoNaAcao();
    await exigirRotaNaAcao(ROTA);

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "objetivo, publico, mensagem, produtos, tom_de_voz, canais, restricoes",
      )
      .eq("id", deCampanhaId)
      .limit(1);

    if (error) return falha(error.message);

    const linha = data?.[0];
    if (!linha) {
      return falha("Essa campanha não foi encontrada, ou não é desta conta.");
    }

    return sucesso("Briefing copiado.", {
      objetivo: linha.objetivo ?? "",
      publico: linha.publico ?? "",
      mensagem: linha.mensagem ?? "",
      produtos: linha.produtos ?? "",
      tomDeVoz: linha.tom_de_voz ?? "",
      canais: linha.canais ?? [],
      restricoes: linha.restricoes ?? "",
      // O FORMATO NÃO VEM NA CÓPIA, e a ausência é decisão: ele é do TIPO de
      // material desta campanha, e a outra pode ter tipos que esta não tem.
      // Copiar "1080x1350" para um tipo que não existe aqui não grava nada, e
      // copiá-lo para o tipo errado é pior que não copiar.
      composicao: [],
    });
  });
}
