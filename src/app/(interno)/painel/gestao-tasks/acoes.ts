"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { interpretarTempo } from "@/lib/dominio/tempo";
import { podeMoverTaskPara } from "@/lib/tasks/state-machine";
import { fluxoDoWorkflow, type EtapaAplicada } from "@/lib/dados/workflows";
import { pastaDaEntregaDaDemanda } from "@/lib/drive/pastas";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * Ações da Task.
 *
 * Tudo passa pelo cliente Supabase da própria pessoa: quem pode criar e editar
 * é o RLS que decide. A checagem de rota aqui é a primeira barreira, não a
 * única.
 *
 * A Task não tem responsável, prazo nem tempo próprios desde o Sprint 3B —
 * ela tem período e um status calculado pelas subtarefas. O que esta ação
 * grava em `status` são só os três estados manuais; os outros o trigger
 * `recalcular_status_task` devolve por cima na mesma transação.
 */

/**
 * Mensagem de quando o Postgres devolve zero linhas sem erro. Isso é o RLS
 * recusando: a policy filtra a linha em vez de reclamar.
 *
 * NÃO exporte esta constante. Um arquivo "use server" só pode exportar função
 * assíncrona — exportar uma string faz o módulo inteiro falhar ao carregar, e
 * com ele TODAS as actions daqui. O build não avisa: a checagem é em tempo de
 * execução, e o sintoma é um "não foi possível falar com o servidor" em cada
 * botão da tela.
 */
const RECUSA_DO_BANCO =
  "O banco recusou a operação. Normalmente é o RLS: mexer numa task é do " +
  "Atendimento ou da gestão.";

type EdicaoDeTask = Database["public"]["Tables"]["tasks"]["Update"];

const ROTA = "/painel/gestao-tasks";

const prioridade = z.enum(["baixa", "normal", "alta", "urgente"]);
const statusDeTask = z.enum([
  "nao_iniciada",
  "em_andamento",
  "aguardando_informacoes",
  "entregue",
  "em_aprovacao",
  "em_ajustes",
  "concluido",
]);
const tipoDeAprovacao = z.enum(["interna", "cliente"]);

function vazioParaNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/** Tempo chega como texto livre ("2h30", "150"). Aqui vira minuto inteiro. */
function minutosOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor) : null;
  const lido = interpretarTempo(String(valor));
  return lido ?? null;
}

const esquemaDeSubtarefa = z.object({
  titulo: z.string().min(1, "A subtarefa precisa de um título."),
  /** A etapa de cima, quando esta é uma sub-etapa. Quem recusa o neto é o
   *  trigger `subtasks_agrupadora` (migration 0022) — aqui o campo só existe
   *  para a ação poder passá-lo adiante. */
  parent_id: z.string().uuid().optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  prazo: z.string().optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
  prioridade: prioridade.default("normal"),
  requer_aprovacao: z.boolean().default(false),
  tipo_aprovacao: tipoDeAprovacao.optional().nullable(),
  estimativa: z.union([z.number(), z.string(), z.null()]).optional(),
  /** Posição (1-based) da subtarefa de que esta depende, dentro do formulário. */
  depende_de: z.number().int().positive().optional().nullable(),
});

const esquemaDeReferencia = z.object({
  tipo: z.enum(["link", "arquivo"]),
  url: z.string().min(1),
  titulo: z.string().optional().nullable(),
  arquivo_nome: z.string().optional().nullable(),
});

const esquemaDeTask = z.object({
  titulo: z.string().min(2, "Informe o título da task."),
  client_id: z.string().uuid("Toda task pertence a um cliente."),
  task_type_id: z.string().uuid().optional().nullable(),
  workflow_snapshot: z.unknown().optional().nullable(),
  briefing_rico: z.unknown().optional().nullable(),
  briefing_texto: z.string().optional().nullable(),
  data_inicio: z.string().min(1, "Informe a data de início."),
  data_fim: z.string().optional().nullable(),
  prioridade: prioridade.default("normal"),
  // O mesmo formato que o check `tasks_link_entrega_http` cobra no banco. Os
  // dois existem de propósito: aqui sai a mensagem que a pessoa lê, lá é o que
  // vale para quem chamar a API direto.
  // Obrigatória na criação. O trigger `tasks_exige_pasta_de_entrega`
  // (migration 0015) recusa do mesmo jeito para quem chamar a API direto --
  // aqui sai a mensagem que a pessoa lê, lá é o que vale.
  link_entrega: z
    .string()
    .trim()
    .min(1, "Informe a pasta de entrega: onde o material final vai ficar.")
    .regex(/^https?:\/\/\S+$/, {
      message: "A pasta de entrega precisa ser um endereço começando com http:// ou https://.",
    }),
  subtarefas: z.array(esquemaDeSubtarefa).default([]),
  referencias: z.array(esquemaDeReferencia).default([]),
});

/**
 * Como a TELA chama cada campo.
 *
 * Existe porque a recusa precisa nomear o campo com a palavra que está no
 * rótulo — "Faltou preencher: pasta de entrega" manda a pessoa a um lugar;
 * "link_entrega" manda a um nome de coluna que ela nunca viu. Mora ao lado do
 * esquema de propósito: campo novo aqui embaixo, rótulo novo aqui em cima, na
 * mesma tela do editor.
 */
const ROTULOS_DA_TASK = {
  titulo: "título da demanda",
  client_id: "cliente",
  task_type_id: "workflow",
  data_inicio: "data de início",
  data_fim: "data de encerramento",
  prioridade: "prioridade",
  link_entrega: "pasta de entrega",
  briefing_texto: "briefing",
  subtarefas: "subtarefa",
  referencias: "material",
  "subtarefas.titulo": "título da etapa",
  "subtarefas.prazo": "prazo da etapa",
  "referencias.url": "endereço do material",
};

/**
 * Cria a task com as subtarefas de uma vez.
 *
 * Se as subtarefas falharem depois da task criada, a task é apagada: demanda
 * pela metade é pior que nenhuma — ela aparece na lista sem nada dentro e
 * ninguém entende o que aconteceu.
 */
export async function criarTask(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("criarTask", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validacao = esquemaDeTask.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("criarTask", validacao.error, dados, "Confira os dados da task.", ROTULOS_DA_TASK));
    }
    const entrada = validacao.data;

    for (const sub of entrada.subtarefas) {
      if (sub.requer_aprovacao && !sub.tipo_aprovacao) {
        return falha(`Diga de que tipo é a aprovação de "${sub.titulo}": interna ou do cliente.`);
      }
    }

    const supabase = await criarClienteServidor();

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        titulo: entrada.titulo.trim(),
        client_id: entrada.client_id,
        task_type_id: entrada.task_type_id || null,
        workflow_snapshot: (entrada.workflow_snapshot ?? null) as Json | null,
        briefing_rico: (entrada.briefing_rico ?? null) as Json | null,
        briefing_texto: vazioParaNulo(entrada.briefing_texto),
        data_inicio: entrada.data_inicio,
        data_fim: vazioParaNulo(entrada.data_fim),
        prioridade: entrada.prioridade,
        link_entrega: entrada.link_entrega,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !task) {
      return falha(`Não foi possível criar a task: ${error?.message ?? RECUSA_DO_BANCO}`);
    }

    if (entrada.subtarefas.length > 0) {
      const { data: criadas, error: erroDasSubtarefas } = await supabase
        .from("subtasks")
        .insert(
          entrada.subtarefas.map((sub, indice) => ({
            task_id: task.id,
            titulo: sub.titulo.trim(),
            prazo: vazioParaNulo(sub.prazo),
            responsavel_id: sub.responsavel_id || null,
            prioridade: sub.prioridade,
            requer_aprovacao: sub.requer_aprovacao,
            tipo_aprovacao: sub.requer_aprovacao ? (sub.tipo_aprovacao ?? "interna") : null,
            estimativa_minutos: minutosOuNulo(sub.estimativa),
            ordem: indice + 1,
          })),
        )
        .select("id, ordem");

      if (erroDasSubtarefas || !criadas) {
        await supabase.from("tasks").delete().eq("id", task.id);
        return falha(
          `As subtarefas falharam, então a task não foi criada: ${erroDasSubtarefas?.message ?? RECUSA_DO_BANCO}`,
        );
      }

      const porOrdem = new Map(criadas.map((s) => [s.ordem, s.id]));
      const vinculos = entrada.subtarefas
        .map((sub, indice) => ({ sub, ordem: indice + 1 }))
        .filter(({ sub }) => sub.depende_de)
        .map(({ sub, ordem }) => ({
          subtask_id: porOrdem.get(ordem)!,
          depende_de_id: porOrdem.get(sub.depende_de!)!,
        }))
        .filter((v) => v.subtask_id && v.depende_de_id && v.subtask_id !== v.depende_de_id);

      if (vinculos.length > 0) {
        const { error: erroDasDependencias } = await supabase
          .from("subtask_dependencies")
          .insert(vinculos);
        if (erroDasDependencias) {
          return falha(
            `Task criada, mas as dependências falharam: ${erroDasDependencias.message}`,
          );
        }
      }

      await supabase.from("task_history").insert(
        criadas.map((s) => ({
          task_id: task.id,
          subtask_id: s.id,
          acao: "subtarefa_criada",
          autor_id: sessao.usuarioId,
        })),
      );
    }

    if (entrada.referencias.length > 0) {
      await supabase.from("task_referencias").insert(
        entrada.referencias.map((ref) => ({
          task_id: task.id,
          tipo: ref.tipo,
          url: ref.url,
          titulo: vazioParaNulo(ref.titulo),
          arquivo_nome: vazioParaNulo(ref.arquivo_nome),
          adicionado_por: sessao.usuarioId,
        })),
      );
    }

    await supabase.from("task_history").insert({
      task_id: task.id,
      acao: "task_criada",
      para_valor: entrada.titulo.trim(),
      autor_id: sessao.usuarioId,
    });

    revalidatePath(ROTA);
    return sucesso("Task criada.", task.id);
  });
}

const esquemaDeEdicao = z.object({
  // SEM `min(2)`, e é por causa do rascunho (migration 0028): ele nasce sem
  // título e a pessoa digita letra a letra, com o campo salvando sozinho. Um
  // mínimo aqui recusaria o primeiro caractere e a pessoa veria "erro ao
  // salvar" no meio de uma palavra.
  //
  // Quem cobra o título é a PUBLICAÇÃO, no banco: enquanto é rascunho ele
  // pode estar vazio, e a lista o chama de "Sem título".
  titulo: z.string().optional(),
  client_id: z.string().uuid().optional(),
  task_type_id: z.string().uuid().nullable().optional(),
  briefing_rico: z.unknown().optional(),
  briefing_texto: z.string().nullable().optional(),
  // `data_inicio` e `data_fim` saíram: o período é derivado das etapas desde
  // a 0028, e aceitá-los de volta recriaria a segunda verdade.
  prioridade: prioridade.optional(),
  status: statusDeTask.optional(),
  // Na edição dá para TROCAR, nunca para esvaziar: apagar o endereço deixa o
  // material sem paradeiro conhecido, e é uma perda que só aparece quando
  // alguém vai procurar. Quem recusa de verdade é o trigger da 0015.
  link_entrega: z
    .string()
    .trim()
    .min(1, "A pasta de entrega não se apaga — dá para trocar por outro endereço.")
    .regex(/^https?:\/\/\S+$/, {
      message: "A pasta de entrega precisa ser um endereço começando com http:// ou https://.",
    })
    .optional(),
});

/**
 * Edição pontual — o arrastar do board, a edição inline da lista e o detalhe.
 * Recebe só os campos que mudaram.
 */
export async function atualizarTask(id: string, campos: unknown): Promise<Resultado> {
  return executarAcao("atualizarTask", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validacao = esquemaDeEdicao.safeParse(campos);
    if (!validacao.success) {
      return falha(recusaDeValidacao("atualizarTask", validacao.error, campos, "Confira os dados da task.", ROTULOS_DA_TASK));
    }

    const entrada = validacao.data;
    const mudancas: EdicaoDeTask = {};

    if (entrada.titulo !== undefined) mudancas.titulo = entrada.titulo.trim();
    if (entrada.client_id !== undefined) mudancas.client_id = entrada.client_id;
    if (entrada.task_type_id !== undefined) mudancas.task_type_id = entrada.task_type_id;
    // O conteúdo do editor chega como unknown (é JSON arbitrário do TipTap);
    // o banco guarda em jsonb, então a conversão é declarada aqui, num lugar só.
    if (entrada.briefing_rico !== undefined)
      mudancas.briefing_rico = (entrada.briefing_rico ?? null) as Json | null;
    if (entrada.briefing_texto !== undefined) mudancas.briefing_texto = entrada.briefing_texto;
    // O PERÍODO NÃO ENTRA MAIS AQUI. Desde a 0028 ele é derivado das etapas
    // e escrito por trigger; aceitar as duas datas de volta recriaria a
    // segunda verdade que a migration acabou de eliminar — a que a pessoa
    // digitou no topo contra a que as etapas dizem.
    if (entrada.prioridade !== undefined) mudancas.prioridade = entrada.prioridade;
    if (entrada.link_entrega !== undefined) mudancas.link_entrega = entrada.link_entrega;

    const supabase = await criarClienteServidor();

    // Escolher o status é sempre escolher À MÃO (migration 0025): os sete são
    // marcáveis, e `status_manual` é o que faz a escolha durar. Sem ele, o
    // recálculo desfaria tudo na próxima mexida numa etapa.
    if (entrada.status !== undefined) {
      const atual = await lerContextoDaTask(supabase, id, sessao.profile.role);
      if (!atual) return falha("Task não encontrada.");

      const veredito = podeMoverTaskPara(atual, entrada.status);
      if (!veredito.ok) return falha(veredito.motivo);

      mudancas.status = entrada.status;
      mudancas.status_manual = true;
    }

    if (Object.keys(mudancas).length === 0) return sucesso("Nada a alterar.");

    // `.select()` no fim porque um update barrado pelo RLS volta sem erro e
    // sem linha: sem conferir, a tela diria "Salvo." sem nada ter mudado.
    const { data, error } = await supabase
      .from("tasks")
      .update(mudancas)
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    // O `hint` do Postgres é onde mora a SAÍDA, não o problema: a trava de
    // `entregue` (migration 0014) recusa dizendo o que falta, e o hint diz o
    // que fazer a respeito. Descartá-lo deixaria a pessoa com um "não pode"
    // sem caminho — e o caminho aqui não é óbvio: às vezes é marcar a etapa
    // que precisa de aval, não aprovar mais rápido.
    if (error) {
      return falha(
        `Não foi possível salvar: ${error.message}${error.hint ? ` ${error.hint}` : ""}`,
      );
    }
    if (!data) return falha(RECUSA_DO_BANCO);

    if (entrada.status !== undefined) {
      await supabase.from("task_history").insert({
        task_id: id,
        acao: "status_da_task",
        para_valor: data.status,
        autor_id: sessao.usuarioId,
      });
    }

    revalidatePath(ROTA);
    revalidatePath(`${ROTA}/${id}`);
    return sucesso("Salvo.");
  });
}

type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;

async function lerContextoDaTask(
  supabase: ClienteSupabase,
  id: string,
  role: string,
): Promise<{
  status: Database["public"]["Enums"]["task_status"];
  souGestorOuAtendimento: boolean;
} | null> {
  const { data: task } = await supabase.from("tasks").select("status").eq("id", id).maybeSingle();
  if (!task) return null;

  // A pessoa do Atendimento pode não ser gestora, e mesmo assim manda na task:
  // é o que `is_atendimento()` diz no banco. Aqui vale a pergunta ao banco.
  const { data: ehDoAtendimento } = await supabase.rpc("is_atendimento");

  return {
    status: task.status,
    souGestorOuAtendimento:
      ehDoAtendimento === true || role === "desenvolvedor" || role === "socio",
  };
}

/**
 * Devolver o volante: o status da Task volta a sair do andamento das etapas.
 *
 * É o par de marcar à mão, e por isso é uma ação própria em vez de um campo em
 * `atualizarTask`: limpar `status_manual` por dentro de uma edição qualquer
 * deixaria a regra escondida num `if`, e qualquer campo novo poderia zerá-la
 * por engano.
 *
 * O recálculo em si é do banco — o trigger `tasks_volta_a_calcular` (0025)
 * percebe a transição e roda na hora. Sem ele a Task ficaria no último valor
 * até alguém mexer numa etapa, e quem clicou concluiria que não funcionou.
 */
export async function voltarACalcularStatus(id: string): Promise<Resultado> {
  return executarAcao("voltarACalcularStatus", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const atual = await lerContextoDaTask(supabase, id, sessao.profile.role);
    if (!atual) return falha("Task não encontrada.");
    if (!atual.souGestorOuAtendimento) {
      return falha("Mudar o status da Task é da gestão ou do Atendimento.");
    }

    const { data, error } = await supabase
      .from("tasks")
      .update({ status_manual: false })
      .eq("id", id)
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("O banco recusou a mudança — confira se você ainda alcança esta demanda.");
    }

    revalidatePath(ROTA);
    return sucesso("O status voltou a ser calculado pelas etapas.");
  });
}

/** Ações em massa da visão Lista. */
export async function atualizarTasksEmMassa(ids: string[], campos: unknown): Promise<Resultado> {
  return executarAcao("atualizarTasksEmMassa", async () => {
    await exigirRotaNaAcao(ROTA);
    if (ids.length === 0) return falha("Nenhuma task selecionada.");

    const validacao = esquemaDeEdicao.safeParse(campos);
    if (!validacao.success) return falha("Dados inválidos.");

    const entrada = validacao.data;
    const mudancas: EdicaoDeTask = {};
    if (entrada.prioridade !== undefined) mudancas.prioridade = entrada.prioridade;
    if (entrada.status !== undefined) {
      mudancas.status = entrada.status;
      mudancas.status_manual = true;
    }

    if (Object.keys(mudancas).length === 0) return falha("Escolha o que alterar.");

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("tasks").update(mudancas).in("id", ids).select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) return falha(RECUSA_DO_BANCO);
    if (data.length < ids.length) {
      return falha(
        `Só ${data.length} de ${ids.length} task(s) foram alteradas — nas outras seu perfil não permite editar.`,
      );
    }

    revalidatePath(ROTA);
    return sucesso(`${ids.length} task(s) atualizada(s).`);
  });
}

export async function excluirTask(id: string): Promise<Resultado> {
  return executarAcao("excluirTask", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha(RECUSA_DO_BANCO);
    revalidatePath(ROTA);
    return sucesso("Task excluída.");
  });
}

/**
 * As etapas que um workflow sugere, já com os prazos calculados.
 *
 * Isto é leitura, não escrita: o que volta é uma sugestão para o formulário,
 * que a pessoa ainda edita, reordena e completa antes de confirmar. Nada é
 * gravado até ela clicar em Criar.
 *
 * O snapshot volta junto e é guardado na Task: alterar o workflow depois não
 * muda nenhuma demanda já criada, e o snapshot é o que diz qual versão do
 * fluxo gerou aquelas subtarefas.
 */
export async function sugerirEtapasDoTipo(
  tipoId: string,
  dataInicio: string,
): Promise<Resultado<{ etapas: EtapaAplicada[]; snapshot: unknown } | null>> {
  return executarAcao("sugerirEtapasDoTipo", async () => {
    await exigirRotaNaAcao(ROTA);

    const aplicado = await fluxoDoWorkflow(tipoId, dataInicio);
    if (!aplicado) return sucesso("Este tipo não tem fluxo — monte as etapas à mão.", null);

    return sucesso("Fluxo aplicado.", aplicado);
  });
}

// ---------------------------------------------------------------------------
// O ciclo de vida do rascunho (migration 0028)
// ---------------------------------------------------------------------------

/**
 * "+ Nova Task" cria a demanda AGORA, vazia, e devolve o id.
 *
 * A tela que abre em seguida é a de detalhe de verdade — a mesma da edição.
 * Não é atalho: subtarefa, referência e comentário precisam de um `task_id`
 * para serem gravados, e sem a linha no banco a tela de criação teria que
 * guardar tudo em memória e reimplementar cada comportamento. Seriam dois
 * componentes que divergem na primeira semana.
 *
 * Nasce sem título, sem cliente e sem pasta de entrega, e é por isso que o
 * rascunho existe: exigir qualquer um dos três aqui traria de volta a etapa a
 * mais que este sprint elimina. Quem cobra os três é a publicação.
 */
export async function criarRascunho(): Promise<Resultado<string>> {
  return executarAcao("criarRascunho", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        titulo: "",
        client_id: null,
        criado_por: sessao.usuarioId,
        // O explícito que faz dela um rascunho. O default do banco é
        // publicada: esquecer aqui criaria uma demanda visível, não uma
        // demanda invisível — que é o erro seguro dos dois.
        publicada_em: null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return falha(
        `Não foi possível abrir a demanda: ${error?.message ?? "o banco recusou a criação."}`,
      );
    }

    revalidatePath(ROTA);
    return sucesso("Rascunho aberto.", data.id);
  });
}

/**
 * O rascunho passa a existir para a equipe.
 *
 * A validação do mínimo — título, cliente e pasta — é do banco
 * (`tasks_publicar_exige_minimo`), e a mensagem dele vem pronta com o `hint`
 * dizendo que o rascunho continua salvo. Aqui não se repete a checagem: duas
 * listas do que é obrigatório divergiriam no dia em que uma mudasse.
 *
 * **E É AQUI QUE AS NOTIFICAÇÕES SAEM.** Enquanto era rascunho ninguém foi
 * avisado, nem os responsáveis já atribuídos às etapas — montar a demanda é
 * pensar em voz alta, e avisar a cada etapa rascunhada seria transformar o
 * sino em ruído. Notificar acontece uma vez, no instante em que a demanda
 * vira real.
 */
export async function publicarTask(id: string): Promise<Resultado> {
  return executarAcao("publicarTask", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("tasks")
      .update({ publicada_em: new Date().toISOString() })
      .eq("id", id)
      .is("publicada_em", null)
      .select("id, titulo");

    if (error) {
      // A recusa do banco vem com `hint`: "o rascunho continua salvo — é só
      // dar um nome a ele". Descartá-lo deixaria a pessoa achando que perdeu
      // o que escreveu.
      // O `hint` vem junto de propósito: é ele que diz "o rascunho continua
      // salvo — é só dar um nome a ele". Descartá-lo deixaria a pessoa com um
      // "não pode" e a impressão de ter perdido o que escreveu.
      return falha(`${error.message}${error.hint ? ` ${error.hint}` : ""}`);
    }
    if (!data || data.length === 0) {
      return falha("Este rascunho não existe mais, ou já foi criado.");
    }

    const { data: etapas } = await supabase
      .from("subtasks")
      .select("responsavel_id")
      .eq("task_id", id);

    const aAvisar = [
      ...new Set(
        (etapas ?? [])
          .map((e) => e.responsavel_id)
          .filter((quem): quem is string => Boolean(quem) && quem !== sessao.usuarioId),
      ),
    ];

    // Uma chamada por pessoa, e não por etapa: quem tem três etapas na mesma
    // demanda recebe um aviso, não três.
    for (const quem of aAvisar) {
      await supabase.rpc("notificar", {
        p_user_id: quem,
        p_tipo: "task",
        p_titulo: "Você tem etapa numa demanda nova",
        p_corpo: data[0].titulo,
        p_link: `/painel/gestao-tasks/${id}`,
      });
    }

    revalidatePath(ROTA);
    revalidatePath(`${ROTA}/${id}`);
    return sucesso(
      aAvisar.length === 0
        ? "Demanda criada."
        : `Demanda criada, e ${aAvisar.length} pessoa${aAvisar.length === 1 ? " foi avisada" : "s foram avisadas"}.`,
    );
  });
}

/**
 * Descartar o rascunho.
 *
 * Confirmação simples, e não dupla: nada foi publicado, ninguém foi avisado,
 * não há o que preservar. O `is("publicada_em", null)` é a trava: esta ação
 * nunca apaga uma demanda que já existe para a equipe, mesmo que alguém
 * mande o id dela.
 */
export async function descartarRascunho(id: string): Promise<Resultado> {
  return executarAcao("descartarRascunho", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .is("publicada_em", null)
      .select("id");

    if (error) return falha(`Não foi possível descartar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Este rascunho não existe mais, ou já virou uma demanda.");
    }

    revalidatePath(ROTA);
    return sucesso("Rascunho descartado.");
  });
}

/**
 * Escolher o workflow MATERIALIZA as etapas na hora.
 *
 * Antes isso só acontecia no diálogo de criação, que montava as etapas em
 * memória e gravava tudo junto ao salvar. Com a tela única a demanda já
 * existe, então o workflow se aplica direto: as subtarefas entram no banco,
 * editáveis, e uma cópia do fluxo vai para `workflow_snapshot`.
 *
 * **O SNAPSHOT É O PONTO.** Editar o workflow depois não muda nenhuma Task
 * existente — o que ficou gravado é o que valia no dia em que a demanda
 * nasceu. Sem ele, mexer num modelo reescreveria o passado de todas as
 * campanhas que o usaram.
 *
 * **SUBSTITUI as etapas que estiverem lá**, e por isso a tela pergunta antes:
 * trocar de workflow com trabalho já montado dentro apagaria o trabalho. O
 * `replace` só acontece porque a pessoa disse que pode.
 */
export async function aplicarWorkflowNaTask(
  taskId: string,
  tipoId: string | null,
): Promise<Resultado> {
  return executarAcao("aplicarWorkflowNaTask", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    if (tipoId === null) {
      const { error } = await supabase
        .from("tasks")
        .update({ task_type_id: null, workflow_snapshot: null })
        .eq("id", taskId);
      if (error) return falha(`Não foi possível salvar: ${error.message}`);
      revalidatePath(`${ROTA}/${taskId}`);
      return sucesso("Workflow removido. As etapas que estavam lá continuam onde estão.");
    }

    const { data: task } = await supabase
      .from("tasks")
      .select("data_inicio")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) return falha("Task não encontrada.");

    const aplicado = await fluxoDoWorkflow(tipoId, task.data_inicio);

    const { error: erroDaTask } = await supabase
      .from("tasks")
      .update({
        task_type_id: tipoId,
        workflow_snapshot: (aplicado?.snapshot ?? null) as Json,
      })
      .eq("id", taskId);
    if (erroDaTask) return falha(`Não foi possível salvar: ${erroDaTask.message}`);

    if (!aplicado || aplicado.etapas.length === 0) {
      revalidatePath(`${ROTA}/${taskId}`);
      return sucesso("Este workflow não tem etapas — monte-as à mão.");
    }

    // Fora as antigas. A pergunta já foi feita na tela; aqui só se executa.
    await supabase.from("subtasks").delete().eq("task_id", taskId);

    const { error: erroDasEtapas } = await supabase.from("subtasks").insert(
      aplicado.etapas.map((etapa, indice) => ({
        task_id: taskId,
        titulo: etapa.titulo,
        prazo: etapa.prazo,
        responsavel_id: etapa.responsavel_id,
        prioridade: etapa.prioridade,
        requer_aprovacao: etapa.requer_aprovacao,
        tipo_aprovacao: etapa.requer_aprovacao ? (etapa.tipo_aprovacao ?? "interna") : null,
        ordem: indice + 1,
      })),
    );

    if (erroDasEtapas) {
      return falha(`As etapas não entraram: ${erroDasEtapas.message}`);
    }

    revalidatePath(`${ROTA}/${taskId}`);
    return sucesso(
      `${aplicado.etapas.length} etapa${aplicado.etapas.length === 1 ? "" : "s"} do workflow ${aplicado.etapas.length === 1 ? "entrou" : "entraram"}. Dá para editar tudo.`,
    );
  });
}

/**
 * Cria a pasta desta demanda no Drive e grava o endereço (Sprint 16, Parte C).
 *
 * ---------------------------------------------------------------------------
 * **É UM BOTÃO, E NÃO ACONTECE SOZINHO.** A tentação é criar a pasta no
 * instante em que o cliente é escolhido — o campo fica preenchido e ninguém
 * precisa pensar nele. Três coisas desaconselham:
 *
 * 1. **É escrita num sistema de fora.** Toda demanda rascunhada criaria uma
 *    pasta, e a 0028 já diz que rascunho é pensamento pela metade: o Drive da
 *    agência encheria de pasta de demanda que ninguém publicou.
 * 2. **A pasta já pode existir.** Quem abre uma demanda de um cliente antigo
 *    costuma ter o endereço na mão, e a 0015 diz em quantas palavras que
 *    pasta muda de lugar — o campo continua editável de propósito.
 * 3. **O título ainda está sendo digitado.** A tela de task salva sozinha,
 *    campo a campo; criar a pasta no primeiro salvamento a nomearia com o
 *    título pela metade, e o Drive não desfaz isso sozinho.
 * ---------------------------------------------------------------------------
 *
 * **Não é `after()`, ao contrário do e-mail.** Aqui a pessoa está esperando o
 * resultado: o endereço da pasta é o que ela veio buscar, e uma ação que
 * responde "pronto" sem ter criado nada mandaria ela procurar no Drive uma
 * pasta que talvez não exista. O e-mail é aviso; isto é o trabalho.
 */
export async function criarPastaDeEntrega(id: string): Promise<Resultado<string>> {
  return executarAcao("criarPastaDeEntrega", async () => {
    await exigirRotaNaAcao(ROTA);

    const supabase = await criarClienteServidor();
    const { data: task, error } = await supabase
      .from("tasks")
      .select("titulo, client_id, link_entrega")
      .eq("id", id)
      .maybeSingle();

    if (error) return falha(error.message);
    if (!task) return falha("Task não encontrada.");
    if (!task.client_id) {
      return falha("Escolha o cliente antes — a pasta nasce dentro da pasta dele.");
    }
    if (!task.titulo.trim()) {
      return falha("Dê um título à demanda antes: é ele que nomeia a pasta.");
    }

    const { url, clienteNasceuAgora } = await pastaDaEntregaDaDemanda(
      task.client_id,
      task.titulo,
    );

    // A ESCRITA VEM DEPOIS DA CRIAÇÃO, e é o que fecha o ciclo: sem ela a
    // pasta existiria no Drive e o campo continuaria vazio, que é o pior dos
    // dois estados — o trabalho feito e nenhum sinal dele.
    const { data: gravado, error: erroGravar } = await supabase
      .from("tasks")
      .update({ link_entrega: url })
      .eq("id", id)
      .select("id");

    if (erroGravar) return falha(erroGravar.message);
    if (!gravado || gravado.length === 0) {
      return falha(
        `A pasta foi criada (${url}), mas não deu para gravá-la nesta demanda. ` +
          "Cole o endereço no campo.",
      );
    }

    revalidatePath(`${ROTA}/${id}`);
    return sucesso(
      clienteNasceuAgora
        ? "Pasta criada. O cliente também ganhou a dele, no Drive da agência."
        : "Pasta criada dentro da pasta do cliente.",
      url,
    );
  });
}
