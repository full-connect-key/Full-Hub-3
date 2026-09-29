"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  exigirEquipeNaAcao,
  exigirGestorNaAcao,
  exigirSocioNaAcao,
} from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import {
  PROMPT_VERSAO,
  lerContexto,
  lerMetricas,
  verificarOTexto,
} from "@/lib/dominio/feedback";
import { escreverOFeedback, temChaveDaAnthropic } from "@/lib/feedback/gerar";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * AS AÇÕES DO FEEDBACK DE DESENVOLVIMENTO (Sprint 3H).
 *
 * ---------------------------------------------------------------------------
 * **AS GUARDAS AQUI NÃO SÃO A TRAVA.** Quem decide é o Postgres:
 * `feedback_reports_*` exige `is_gestor()` para escrever e
 * `status = 'enviado'` para a pessoa ler; `feedback_config_update` exige
 * `is_socio()`. Estas guardas escrevem a frase em português ANTES de alguém
 * levar um "nenhuma linha voltou".
 *
 * E elas espelham a primeira linha de cada policy, nunca uma pergunta
 * diferente — a lição da 0059, onde a action ficou mais apertada que o banco e
 * a pessoa do Atendimento lia "seu perfil não permite" numa ação que o produto
 * diz que é dela.
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/feedback";
const ROTA_HOME = "/painel";

const esquemaDeGeracao = z.object({
  user_id: z.string().uuid("Escolha a pessoa."),
  periodo_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o início do período."),
  periodo_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o fim do período."),
  periodicidade: z.enum(["mensal", "trimestral"]),
});

const ROTULOS_GERACAO = {
  user_id: "pessoa",
  periodo_inicio: "início do período",
  periodo_fim: "fim do período",
  periodicidade: "periodicidade",
};

/**
 * Gera o feedback de UMA pessoa num período.
 *
 * A ORDEM É A TRAVA, e não a consulta que vem antes: a linha nasce em `gerando`
 * **antes** de a API ser chamada, e o índice único
 * `(user_id, periodo_inicio, periodicidade)` recusa a segunda. Duas abas
 * clicando ao mesmo tempo passariam pelas duas consultas antes de qualquer uma
 * gravar — a decisão da 0040 —, e aqui o custo de errar é uma chamada de IA
 * paga duas vezes pelo mesmo texto.
 *
 * AS TRÊS TRAVAS DO SPRINT VÊM ANTES DA CHAMADA, e duas delas nem criam linha:
 *
 * - quem optou por não receber é PULADO, sem linha nenhuma. Um relatório
 *   `descartado` no nome dela registraria uma decisão que ela já tomou;
 * - menos etapas que o mínimo vira `dados_insuficientes` COM linha, e aí a
 *   linha é o ponto: ela diz que o período foi olhado e não tinha o que dizer.
 *   Sem ela, "não gerou" e "não olhou" ficariam iguais;
 * - ausência acima de 40% do período NÃO impede, e isso é decisão: o sprint
 *   oferece as duas saídas ("não gera, ou gera explicitamente reduzido"), e a
 *   segunda é melhor porque o contexto já carrega a ressalva em português e o
 *   prompt já tem a instrução de mencionar a ausência ao falar de volume.
 *   Recusar deixaria quem tirou descanso sem retorno nenhum sobre o mês, que é
 *   o oposto do que o módulo existe para fazer.
 */
export async function gerarFeedback(
  entrada: unknown,
): Promise<Resultado<{ id: string; status: string }>> {
  return executarAcao("gerarFeedback", async () => {
    await exigirGestorNaAcao();

    const lido = esquemaDeGeracao.safeParse(entrada);
    if (!lido.success) {
      return falha(
        recusaDeValidacao(
          "gerarFeedback",
          lido.error,
          entrada,
          "Confira o período e a pessoa.",
          ROTULOS_GERACAO,
        ),
      );
    }
    const { user_id, periodo_inicio, periodo_fim, periodicidade } = lido.data;

    const supabase = await criarClienteServidor();

    // QUEM OPTOU POR NÃO RECEBER É PULADO, e a recusa diz isso em vez de
    // "nenhuma linha": a geração em massa chama esta ação por pessoa, e um erro
    // mudo faria a tela mostrar uma falha para uma escolha.
    const { data: ficha } = await supabase
      .from("team_members")
      .select("recebe_feedback_ia")
      .eq("user_id", user_id)
      .limit(1);
    if (ficha?.[0] && ficha[0].recebe_feedback_ia === false) {
      return falha(
        "Esta pessoa escolheu não receber o feedback de desenvolvimento. Nada foi gerado.",
      );
    }

    const { data: config } = await supabase
      .from("feedback_config")
      .select("minimo_subtarefas, exige_revisao")
      .limit(1);
    const minimo = config?.[0]?.minimo_subtarefas ?? 5;

    const [metricasBrutas, contextoBrutos] = await Promise.all([
      supabase.rpc("feedback_metricas", {
        p_user_id: user_id,
        p_de: periodo_inicio,
        p_ate: periodo_fim,
      }),
      supabase.rpc("feedback_contexto", {
        p_user_id: user_id,
        p_de: periodo_inicio,
        p_ate: periodo_fim,
      }),
    ]);

    if (metricasBrutas.error) return falha(metricasBrutas.error.message);
    if (contextoBrutos.error) return falha(contextoBrutos.error.message);

    const metricas = lerMetricas(metricasBrutas.data);
    const contexto = lerContexto(contextoBrutos.data);
    if (!metricas || !contexto) {
      return falha("As métricas do período não voltaram. Tente de novo.");
    }

    const concluidas = metricas.entrega?.concluidas ?? 0;

    // A LINHA NASCE ANTES DA CHAMADA. É ela que faz o índice único ser a trava.
    const { data: criado, error: erroDeCriacao } = await supabase
      .from("feedback_reports")
      .insert({
        user_id,
        periodo_inicio,
        periodo_fim,
        periodicidade,
        metricas_json: metricasBrutas.data,
        contexto_json: contextoBrutos.data,
        status: concluidas < minimo ? "dados_insuficientes" : "gerando",
      })
      .select("id, status")
      .limit(1);

    if (erroDeCriacao) {
      // O índice único falando. A mensagem diz o caminho em vez de mostrar o
      // nome da restrição — quem clicou não sabe o que é `um_por_periodo`.
      if (erroDeCriacao.code === "23505") {
        return falha(
          "Já existe um relatório desta pessoa para este período. Abra o que existe, ou apague-o antes de gerar outro.",
        );
      }
      return falha(erroDeCriacao.message);
    }

    const relatorio = criado?.[0];
    if (!relatorio) {
      return falha(
        "O relatório não foi criado — provavelmente o seu perfil não permite gerar feedback.",
      );
    }

    // FEEDBACK EM CIMA DE TRÊS ETAPAS É INVENÇÃO, e a linha fica para dizer
    // que o período foi olhado.
    if (concluidas < minimo) {
      revalidatePath(ROTA);
      return sucesso(
        `${concluidas} etapa(s) concluída(s) no período, abaixo do mínimo de ${minimo}. O relatório ficou marcado como sem dados suficientes, e nenhum texto foi gerado.`,
        { id: relatorio.id, status: "dados_insuficientes" },
      );
    }

    if (!temChaveDaAnthropic()) {
      // A LINHA JÁ NASCEU, então ela volta para `rascunho` sem texto em vez de
      // ficar presa em `gerando` — um relatório parado nesse estado é um
      // relatório que ninguém consegue nem abrir nem apagar sem entender por
      // quê.
      await supabase
        .from("feedback_reports")
        .update({ status: "rascunho" })
        .eq("id", relatorio.id);
      revalidatePath(ROTA);
      return falha(
        "A ANTHROPIC_API_KEY não está no ambiente do servidor, então o texto não foi escrito. As métricas do período ficaram gravadas.",
      );
    }

    const { data: perfil } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user_id)
      .limit(1);
    const nome = perfil?.[0]?.nome ?? "esta pessoa";

    let texto: string;
    let modelo: string;
    try {
      const escrito = await escreverOFeedback(nome, metricas, contexto);
      texto = escrito.texto;
      modelo = escrito.modelo;
    } catch (erro) {
      // O MESMO CUIDADO DO CASO SEM CHAVE: a linha não fica em `gerando`.
      await supabase
        .from("feedback_reports")
        .update({ status: "rascunho" })
        .eq("id", relatorio.id);
      revalidatePath(ROTA);
      return falha(
        erro instanceof Error
          ? erro.message
          : "A geração do texto falhou. As métricas do período ficaram gravadas.",
      );
    }

    // A VERIFICAÇÃO SINALIZA, NUNCA DESCARTA. Um descarte silencioso gastaria a
    // chamada e não deixaria nada para investigar.
    const alertas = verificarOTexto(texto, metricasBrutas.data, contextoBrutos.data);

    const { error: erroDeGravacao } = await supabase
      .from("feedback_reports")
      .update({
        texto_gerado: texto,
        // O TEXTO FINAL NASCE IGUAL AO GERADO, e não vazio: quem revisa edita
        // em cima, e um campo em branco obrigaria a copiar o de cima à mão
        // antes de mexer numa vírgula.
        texto_final: texto,
        modelo_usado: modelo,
        prompt_versao: PROMPT_VERSAO,
        alertas_json: alertas,
        status: "rascunho",
      })
      .eq("id", relatorio.id)
      .select("id");

    if (erroDeGravacao) return falha(erroDeGravacao.message);

    revalidatePath(ROTA);

    return sucesso(
      alertas.length === 0
        ? "Feedback gerado. Leia antes de enviar."
        : `Feedback gerado com ${alertas.length} alerta(s) da verificação automática. Leia com atenção antes de enviar.`,
      { id: relatorio.id, status: "rascunho" },
    );
  });
}

const esquemaDeTexto = z.object({
  id: z.string().uuid(),
  texto_final: z
    .string()
    .trim()
    .min(40, "O texto do feedback está curto demais para ser enviado."),
});

/**
 * Salva o texto editado.
 *
 * **A EDIÇÃO É O NORMAL, NÃO A EXCEÇÃO**, e é por isso que ela não pede
 * confirmação nem marca nada: quem revisa escreve por cima, e `texto_gerado`
 * continua guardando o que a IA escreveu.
 */
export async function salvarTextoDoFeedback(
  entrada: unknown,
): Promise<Resultado<null>> {
  return executarAcao("salvarTextoDoFeedback", async () => {
    await exigirGestorNaAcao();

    const dados = esquemaDeTexto.safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("salvarTextoDoFeedback", dados.error, entrada,
          "Confira o texto do feedback.", { texto_final: "texto do feedback" }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("feedback_reports")
      .update({ texto_final: dados.data.texto_final })
      .eq("id", dados.data.id)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O texto não foi salvo: o seu perfil não permite editar este relatório.");
    }

    revalidatePath(ROTA);
    return sucesso("Texto salvo.", null);
  });
}

/**
 * Aprova e envia.
 *
 * **ENVIAR É O QUE FAZ A PESSOA PASSAR A ENXERGAR**, porque a policy dela exige
 * `status = 'enviado'`. Não há um segundo comando: o carimbo e a visibilidade
 * são o mesmo fato, como `posts.enviado_em` é consequência da rodada desde a
 * 0032.
 *
 * E O SINO TOCA AQUI, e não por trigger, ao contrário de quase tudo no
 * produto. O motivo é que este aviso não tem outro caminho: não existe escrita
 * em `feedback_reports` que signifique "enviado" além desta, e um trigger em
 * `update of status` dispararia também no salvamento do texto se alguém
 * mudasse a lista de colunas. Aqui a ação é única e o aviso é dela.
 */
export async function enviarFeedback(
  entrada: unknown,
): Promise<Resultado<null>> {
  return executarAcao("enviarFeedback", async () => {
    const sessao = await exigirGestorNaAcao();

    const dados = z
      .object({ ids: z.array(z.string().uuid()).min(1, "Escolha ao menos um relatório.") })
      .safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("enviarFeedback", dados.error, entrada,
          "Escolha ao menos um relatório.", { ids: "relatórios" }),
      );
    }

    const supabase = await criarClienteServidor();
    const agora = new Date().toISOString();

    const { data, error } = await supabase
      .from("feedback_reports")
      .update({
        status: "enviado",
        revisado_por: sessao.usuarioId,
        revisado_em: agora,
        enviado_em: agora,
      })
      .in("id", dados.data.ids)
      // SÓ O QUE AINDA NÃO FOI ENVIADO. Sem este filtro, a ação em massa
      // reescreveria `revisado_por` e `enviado_em` de um relatório de três
      // meses atrás — e a tela da pessoa diria que ele chegou hoje.
      .in("status", ["rascunho", "revisado"])
      .select("id, user_id, periodo_inicio");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha(
        "Nada foi enviado: os relatórios escolhidos já estavam enviados, ou o seu perfil não permite.",
      );
    }

    for (const linha of data) {
      await supabase.rpc("notificar", {
        p_user_id: linha.user_id,
        p_tipo: "equipe",
        p_titulo: "Chegou o seu feedback de desenvolvimento",
        // A DATA VAI NO CORPO, NUNCA "deste mês": o sino é escrito uma vez e
        // lido quando a pessoa abrir, às vezes três dias depois. É a decisão do
        // aviso de nota fiscal na 0066.
        p_corpo: `Sobre o período que começa em ${linha.periodo_inicio}. Os números crus estão junto do texto.`,
        p_link: ROTA_HOME,
      });
    }

    revalidatePath(ROTA);
    revalidatePath(ROTA_HOME);

    return sucesso(
      data.length === 1
        ? "Feedback enviado. A pessoa já consegue ler."
        : `${data.length} feedbacks enviados.`,
      null,
    );
  });
}

/**
 * Descarta.
 *
 * `descartado` e não apagar: a gestão leu e decidiu não enviar, e isso é um
 * fato sobre o período. Apagar existe à parte, para o relatório gerado sobre o
 * período errado — que não é histórico, é lixo.
 */
export async function descartarFeedback(
  entrada: unknown,
): Promise<Resultado<null>> {
  return executarAcao("descartarFeedback", async () => {
    const sessao = await exigirGestorNaAcao();

    const dados = z.object({ id: z.string().uuid() }).safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("descartarFeedback", dados.error, entrada,
          "Escolha o relatório.", { id: "relatório" }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("feedback_reports")
      .update({
        status: "descartado",
        revisado_por: sessao.usuarioId,
        revisado_em: new Date().toISOString(),
      })
      .eq("id", dados.data.id)
      .neq("status", "enviado")
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha(
        "Não foi descartado: um feedback já enviado não volta atrás. Converse com a pessoa.",
      );
    }

    revalidatePath(ROTA);
    return sucesso("Descartado. Ele não chega à pessoa.", null);
  });
}

/** Apaga o relatório. Para o que foi gerado sobre o período errado. */
export async function apagarFeedback(
  entrada: unknown,
): Promise<Resultado<null>> {
  return executarAcao("apagarFeedback", async () => {
    await exigirGestorNaAcao();

    const dados = z.object({ id: z.string().uuid() }).safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("apagarFeedback", dados.error, entrada,
          "Escolha o relatório.", { id: "relatório" }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("feedback_reports")
      .delete()
      .eq("id", dados.data.id)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("Não foi apagado: o seu perfil não permite.");
    }

    revalidatePath(ROTA);
    return sucesso("Relatório apagado.", null);
  });
}

const esquemaDeResposta = z.object({
  report_id: z.string().uuid(),
  texto: z
    .string()
    .trim()
    .min(2, "Escreva a sua resposta.")
    .max(4000, "A resposta está longa demais."),
});

/**
 * Responder ao feedback.
 *
 * **NÃO É OPCIONAL: feedback sem direito de resposta é comunicado.** A ação é
 * de `is_staff()` e não da gestão, porque quem mais responde é a pessoa — e a
 * policy é que decide se ela alcança aquele relatório (só o dela, só enviado).
 *
 * O AVISO VAI PARA QUEM REVISOU quando quem escreve é a pessoa, e para a pessoa
 * quando quem escreve é a gestão. `notificar()` nunca avisa quem causou o
 * aviso, então as duas direções cabem numa chamada de cada.
 */
export async function responderAoFeedback(
  entrada: unknown,
): Promise<Resultado<null>> {
  return executarAcao("responderAoFeedback", async () => {
    const sessao = await exigirEquipeNaAcao();

    const dados = esquemaDeResposta.safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("responderAoFeedback", dados.error, entrada,
          "Escreva a sua resposta.", { texto: "resposta" }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("feedback_replies")
      .insert({
        report_id: dados.data.report_id,
        autor_id: sessao.usuarioId,
        texto: dados.data.texto,
      })
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("A resposta não foi gravada: este relatório não está disponível para você.");
    }

    const { data: relatorio } = await supabase
      .from("feedback_reports")
      .select("user_id, revisado_por, periodo_inicio")
      .eq("id", dados.data.report_id)
      .limit(1);

    const linha = relatorio?.[0];
    if (linha) {
      const paraQuem =
        sessao.usuarioId === linha.user_id ? linha.revisado_por : linha.user_id;
      await supabase.rpc("notificar", {
        p_user_id: paraQuem,
        p_tipo: "equipe",
        p_titulo: "Resposta no feedback de desenvolvimento",
        p_corpo: `Sobre o período que começa em ${linha.periodo_inicio}.`,
        p_link: sessao.usuarioId === linha.user_id ? ROTA : ROTA_HOME,
      });
    }

    revalidatePath(ROTA);
    revalidatePath(ROTA_HOME);
    return sucesso("Resposta enviada.", null);
  });
}

const esquemaDeConfig = z.object({
  periodicidade: z.enum(["mensal", "trimestral"]),
  revisor_id: z.string().uuid().nullable().optional(),
  exige_revisao: z.boolean(),
  minimo_subtarefas: z
    .number()
    .int()
    .min(1, "O mínimo de etapas precisa ser pelo menos 1.")
    .max(100, "Um mínimo acima de 100 etapas nunca seria alcançado."),
});

/**
 * A configuração, e ela é do SÓCIO.
 *
 * `exige_revisao` decide se um texto de máquina vai direto para uma pessoa, e
 * isso é decisão de quem responde pela agência — a razão da fila de notas. O
 * desenvolvedor é gestão para o resto do sistema e aqui não.
 */
export async function salvarConfigDoFeedback(
  entrada: unknown,
): Promise<Resultado<null>> {
  return executarAcao("salvarConfigDoFeedback", async () => {
    const sessao = await exigirSocioNaAcao();

    const dados = esquemaDeConfig.safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("salvarConfigDoFeedback", dados.error, entrada,
          "Confira a configuração.", {
            periodicidade: "periodicidade",
            revisor_id: "quem revisa",
            exige_revisao: "revisão humana",
            minimo_subtarefas: "mínimo de etapas",
          }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("feedback_config")
      .update({
        periodicidade: dados.data.periodicidade,
        revisor_id: dados.data.revisor_id ?? null,
        exige_revisao: dados.data.exige_revisao,
        minimo_subtarefas: dados.data.minimo_subtarefas,
        atualizado_por: sessao.usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq("unica", true)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("A configuração não foi salva: ela é do sócio.");
    }

    revalidatePath(ROTA);
    return sucesso("Configuração salva.", null);
  });
}

/** Marca o alerta de carga como resolvido. Não existe apagar. */
export async function resolverAlertaDeCarga(
  entrada: unknown,
): Promise<Resultado<null>> {
  return executarAcao("resolverAlertaDeCarga", async () => {
    await exigirGestorNaAcao();

    const dados = z.object({ id: z.string().uuid() }).safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("resolverAlertaDeCarga", dados.error, entrada,
          "Escolha o alerta.", { id: "alerta" }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("workload_alerts")
      .update({ resolvido: true })
      .eq("id", dados.data.id)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O alerta não foi marcado: o seu perfil não permite.");
    }

    revalidatePath(ROTA);
    revalidatePath(ROTA_HOME);
    return sucesso("Alerta marcado como resolvido.", null);
  });
}

/**
 * A escolha da pessoa: receber ou não.
 *
 * Passa pela função do banco e não por um `update` em `team_members`, porque
 * aquela tabela é `is_gestor()` no UPDATE desde o Sprint 2 — e abrir uma policy
 * ali daria junto a capacidade diária, o saldo de descanso e a função dela.
 * Policy não limita coluna.
 */
export async function escolherReceberFeedback(
  entrada: unknown,
): Promise<Resultado<{ recebe: boolean }>> {
  return executarAcao("escolherReceberFeedback", async () => {
    await exigirEquipeNaAcao();

    const dados = z.object({ receber: z.boolean() }).safeParse(entrada);
    if (!dados.success) {
      return falha(
        recusaDeValidacao("escolherReceberFeedback", dados.error, entrada,
          "Escolha receber ou não.", { receber: "escolha" }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("escolher_receber_feedback", {
      p_receber: dados.data.receber,
    });

    if (error) return falha(error.message);

    revalidatePath("/painel/meu-perfil");
    revalidatePath(ROTA_HOME);
    return sucesso(
      dados.data.receber
        ? "Pronto: você volta a receber o feedback de desenvolvimento."
        : "Pronto: você não vai mais receber o feedback de desenvolvimento. Dá para voltar quando quiser.",
      { recebe: data ?? dados.data.receber },
    );
  });
}

/** Guarda que a pessoa leu a explicação. Só na primeira vez. */
export async function marcarFeedbackExplicado(): Promise<Resultado<null>> {
  return executarAcao("marcarFeedbackExplicado", async () => {
    await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { error } = await supabase.rpc("marcar_feedback_explicado");
    if (error) return falha(error.message);

    revalidatePath(ROTA_HOME);
    return sucesso("Combinado.", null);
  });
}
