"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAtendimentoNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { camposDoRoteiro, respostasParaLer } from "@/lib/dominio/solicitacoes";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O que o Atendimento faz com um pedido do cliente (0068).
 *
 * ---------------------------------------------------------------------------
 * **A CONVERSÃO NUNCA É AUTOMÁTICA, e esta é a única porta.**
 *
 * Não existe trigger que crie demanda a partir de pedido, e não é omissão: um
 * pedido chega sem prazo combinado, sem responsável, sem prioridade e às vezes
 * sem ser um trabalho — e são essas quatro coisas que o Atendimento decide.
 * Uma rotina que criasse a task sozinha poria no board da agência trabalho que
 * ninguém aceitou, e o board é o lugar onde a equipe confia que tudo tem dono.
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/solicitacoes";
const ROTA_DO_CLIENTE = "/portal/solicitacoes";

function revalidarOsDoisLados(id?: string) {
  revalidatePath(ROTA);
  revalidatePath(ROTA_DO_CLIENTE);
  if (id) {
    revalidatePath(`${ROTA}/${id}`);
    revalidatePath(`${ROTA_DO_CLIENTE}/${id}`);
  }
}

/**
 * "Estou olhando isto."
 *
 * Move o pedido de `nova` para `em_analise`, e é a única transição que o
 * Atendimento escreve à mão sem um desfecho junto. As outras duas — virou
 * demanda, foi entregue — são consequência da demanda andar, escritas pelo
 * trigger `tasks_espelha_no_pedido`.
 *
 * **Ela não é automática ao abrir a tela**, e é decisão: um status que muda
 * porque alguém clicou num link ensina o cliente a contar visualização, e o
 * que ele quer saber é se alguém PEGOU o pedido dele — não se alguém passou o
 * olho.
 */
export async function triarSolicitacao(id: string): Promise<Resultado> {
  return executarAcao("triarSolicitacao", async () => {
    await exigirAtendimentoNaAcao("Triar um pedido do cliente");
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("client_requests")
      .update({ status: "em_analise" })
      .eq("id", id)
      .eq("status", "nova")
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível: ${error.message}`);
    // Zero linhas aqui não é recusa: pode ser um pedido que outra pessoa já
    // pegou enquanto esta tela estava aberta. Avisar de erro por uma coisa que
    // deu certo é a mesma armadilha de `marcarComoLida`.
    if (!data) return sucesso("Este pedido já saiu da fila de novos.");

    revalidarOsDoisLados(id);
    return sucesso("Pedido em análise.");
  });
}

/**
 * Recusar, com motivo.
 *
 * **O motivo é obrigatório na ação E no banco** (`client_requests_recusa_com_motivo`),
 * e é a linha da nota fiscal recusada e do pedido de ajustes do post: recusa
 * sem motivo manda a pessoa adivinhar, e o próximo pedido volta igual. Com a
 * diferença de que aqui quem adivinha é o CLIENTE, que não tem a quem
 * perguntar dentro do produto.
 *
 * O aviso para ele sai do banco, não daqui — `client_requests_avisa_decisao`,
 * pela razão da auditoria: a recusa pode vir por outro caminho um dia, e um
 * aviso escrito na camada de aplicação cobre só o que passou pela tela.
 */
export async function recusarSolicitacao(id: string, motivo: unknown): Promise<Resultado> {
  return executarAcao("recusarSolicitacao", async () => {
    await exigirAtendimentoNaAcao("Recusar um pedido do cliente");

    const validacao = z
      .string()
      .trim()
      .min(5, "Diga por quê — o cliente vai ler essa frase.")
      .safeParse(motivo);

    if (!validacao.success) {
      return falha(
        recusaDeValidacao("recusarSolicitacao", validacao.error, motivo, "Informe o motivo."),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_requests")
      .update({ status: "recusada", motivo_recusa: validacao.data })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível recusar: ${error.message}`);
    if (!data) return falha("O banco recusou. Triar pedido é de quem abre demanda.");

    revalidarOsDoisLados(id);
    return sucesso("Pedido recusado, e o cliente foi avisado com o motivo.");
  });
}

/**
 * Apagar — da gestão, e para o pedido em duplicidade.
 *
 * Não é o caminho de "limpar a fila": recusar com motivo deixa rastro dos dois
 * lados, e apagar não deixa nenhum do lado do cliente.
 */
export async function apagarSolicitacao(id: string): Promise<Resultado> {
  return executarAcao("apagarSolicitacao", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("client_requests")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível apagar: ${error.message}`);
    if (!data) return falha("O banco recusou. Apagar pedido é da gestão.");

    revalidarOsDoisLados();
    return sucesso("Pedido apagado.");
  });
}

/**
 * O briefing da demanda, montado a partir do pedido.
 *
 * **Ele repete o que o cliente escreveu, e não um resumo.** O Atendimento vai
 * editar isto na tela de detalhe; o que não pode acontecer é ele abrir a
 * demanda e ter que voltar ao pedido para copiar as respostas uma a uma — que
 * é exatamente o trabalho manual que este sprint elimina.
 *
 * **A data desejada entra no TEXTO e não em `data_fim`**, e é a regra do
 * sprint escrita em código: `data_desejada` é o que o cliente gostaria,
 * `tasks.data_fim` é o que a agência assume. Copiar uma na outra transformaria
 * um desejo em compromisso sem ninguém ter concordado.
 */
function briefingDoPedido(pedido: {
  descricao: string | null;
  respostas: Record<string, string>;
  data_desejada: string | null;
  empresa: string | null;
}, campos: ReturnType<typeof camposDoRoteiro>): string {
  const linhas: string[] = ["Pedido aberto pelo cliente no Portal.", ""];

  if (pedido.descricao?.trim()) {
    linhas.push(pedido.descricao.trim(), "");
  }

  for (const r of respostasParaLer(campos, pedido.respostas)) {
    linhas.push(`${r.rotulo}: ${r.valor}`);
  }

  if (pedido.data_desejada) {
    linhas.push(
      "",
      `O cliente gostaria para ${pedido.data_desejada}. É o desejo dele, não o prazo combinado — o prazo é o que a agência assumir aqui.`,
    );
  }

  return linhas.join("\n").trim();
}

/**
 * O pedido vira uma demanda — e o que nasce é um RASCUNHO.
 *
 * ---------------------------------------------------------------------------
 * **É A DECISÃO CENTRAL DO SPRINT, e ela tem duas metades.**
 *
 * A primeira: o que nasce é rascunho (`publicada_em` nulo, 0028), com os
 * campos preenchidos e a tela de detalhe abrindo em seguida. O Atendimento
 * escolhe o workflow, distribui as etapas e ajusta o prazo — que são as quatro
 * decisões que o pedido não traz.
 *
 * A segunda: **o status do pedido NÃO anda aqui.** Quem o move é o trigger
 * `tasks_espelha_no_pedido`, quando a demanda é PUBLICADA. Andar na criação do
 * rascunho diria ao cliente "estamos fazendo" sobre uma demanda que ninguém da
 * equipe enxerga ainda, e que pode ser abandonada.
 * ---------------------------------------------------------------------------
 *
 * **Os anexos são COPIADOS, não movidos.** Eles continuam no pedido, que é a
 * tela do cliente; a cópia vai para `task_referencias` como `link`, apontando
 * para o endereço assinado... não: apontando para o CAMINHO no bucket dos
 * pedidos, porque endereço assinado vale uma hora e a demanda vive meses. A
 * equipe abre o anexo pela tela do pedido, que o botão "Ver o pedido" leva a um
 * clique — duplicar o arquivo em dois buckets criaria duas cópias que divergem
 * quando o cliente apaga a dele.
 *
 * **Não é transação.** `abrir_campanha()` é uma função no banco justamente
 * porque são cinco escritas encadeadas; aqui são duas, e a segunda falhando
 * deixa uma demanda sem as referências — visível, corrigível, e sem nada
 * escondido. Uma função `security definer` para isto furaria `tasks_insert`,
 * que é quem decide se esta pessoa pode abrir demanda.
 */
export async function converterEmDemanda(id: string): Promise<Resultado<string>> {
  return executarAcao("converterEmDemanda", async () => {
    const sessao = await exigirAtendimentoNaAcao("Converter um pedido em demanda");
    const supabase = await criarClienteServidor();

    const { data: pedido, error: erroDoPedido } = await supabase
      .from("client_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (erroDoPedido) return falha(`Não foi possível ler o pedido: ${erroDoPedido.message}`);
    if (!pedido) return falha("Este pedido não existe mais.");
    if (pedido.status === "recusada") {
      return falha("Este pedido foi recusado. Reabra a conversa com o cliente antes.");
    }

    const [{ data: jaExiste }, { data: empresa }, { data: tipo }, { data: padroes }] =
      await Promise.all([
        supabase.from("tasks").select("id").eq("request_id", id).maybeSingle(),
        supabase.from("clients").select("nome_empresa").eq("id", pedido.client_id).maybeSingle(),
        pedido.request_type_id
          ? supabase
              .from("request_types")
              .select("campos_json")
              .eq("id", pedido.request_type_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("client_flow_defaults")
          .select("pasta_entrega_url")
          .eq("client_id", pedido.client_id)
          .maybeSingle(),
      ]);

    // O ÍNDICE ÚNICO JÁ GARANTE ISTO, e a consulta existe para a frase: sem
    // ela a pessoa levaria a recusa crua do Postgres, com o nome do índice.
    // É a mesma razão de `podeEnviarAoCliente()` no Social — a tela existe
    // para escrever a frase que o banco vai confirmar.
    if (jaExiste) {
      return falha("Este pedido já virou uma demanda.");
    }

    const briefing = briefingDoPedido(
      { ...pedido, empresa: empresa?.nome_empresa ?? null },
      camposDoRoteiro(tipo?.campos_json),
    );

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        titulo: pedido.titulo,
        client_id: pedido.client_id,
        briefing_texto: briefing,
        // A PASTA PADRÃO DA CONTA PREENCHE (0064), e a publicação cobra os
        // três mínimos. Sem ela o rascunho nasce sem pasta, que é estado
        // legítimo — `tasks_publicar_exige_minimo` é quem recusa publicar
        // assim, com a frase certa.
        link_entrega: padroes?.pasta_entrega_url ?? null,
        criado_por: sessao.usuarioId,
        // RASCUNHO. O explícito é o que faz dela um: o default do banco é
        // publicada.
        publicada_em: null,
        request_id: id,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível abrir a demanda: ${error.message}`);
    if (!task) return falha("O banco recusou. Abrir demanda é do Atendimento e da gestão.");

    const { data: anexos } = await supabase
      .from("request_attachments")
      .select("caminho, nome")
      .eq("request_id", id);

    if (anexos && anexos.length > 0) {
      const { error: erroDasReferencias } = await supabase.from("task_referencias").insert(
        anexos.map((a) => ({
          task_id: task.id,
          tipo: "arquivo" as const,
          url: a.caminho,
          titulo: a.nome,
          arquivo_nome: a.nome,
          adicionado_por: sessao.usuarioId,
        })),
      );
      // A demanda já existe, e ela é o que importa. Uma referência que não
      // copiou não pode desfazer a conversão — mas também não pode sumir
      // calada: o Atendimento precisa saber que o anexo ficou só no pedido.
      if (erroDasReferencias) {
        console.error("[solicitacao:anexos]", id, erroDasReferencias);
        revalidarOsDoisLados(id);
        return sucesso(
          "Rascunho aberto, mas os anexos não vieram junto — eles continuam no pedido.",
          task.id,
        );
      }
    }

    revalidarOsDoisLados(id);
    revalidatePath("/painel/gestao-tasks");
    return sucesso("Rascunho aberto com o que o cliente escreveu.", task.id);
  });
}
