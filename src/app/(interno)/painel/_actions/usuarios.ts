"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminOuErro, criarConta, desfazerConta } from "@/lib/acoes/contas";
import { exigirGestorNaAcao, exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { podeConcederRole } from "@/lib/dominio/equipe";
import { SUBTAREFAS_EM_ABERTO } from "@/lib/dominio/tasks";

/**
 * Criação e remoção de acessos.
 *
 * Tudo aqui roda no servidor e usa a service role. Nenhum componente de
 * navegador importa este arquivo: as telas chamam estas funções como Server
 * Actions, e só as mensagens voltam.
 *
 * Toda operação que cria conta tem rollback: se um passo depois da criação
 * falhar, a conta recém-criada é apagada. Cadastro pela metade é pior do que
 * cadastro nenhum, porque o e-mail fica ocupado e ninguém entende por quê.
 */

/**
 * O que a tela recebe depois de criar uma conta.
 *
 * A senha provisória vem aqui e é mostrada UMA VEZ, para quem cadastrou
 * passar adiante. Ela não fica guardada em lugar nenhum além do hash do Auth:
 * se a tela for fechada sem copiar, o caminho é "Esqueci minha senha".
 *
 * Antes deste campo, a porta era um link de recuperação por e-mail. O e-mail
 * deixou de ser enviado na criação de propósito — com os dois caminhos vivos
 * ao mesmo tempo, quem clicasse no link definiria uma senha e ainda assim
 * cairia na tela de troca obrigatória no primeiro acesso, sem entender por quê.
 */
export type ResultadoDeConvite = {
  senhaProvisoria: string | null;
};

const FUNCOES_VALIDAS = [
  "Atendimento",
  "Social Media",
  "Redator",
  "Design",
  "Audiovisual",
  "Trafego",
  "Desenvolvimento",
  "Gestao",
  "Outro",
] as const;

const esquemaDeColaborador = z.object({
  nome: z.string().min(2, "Informe o nome completo.").max(120),
  email: z.string().email("Esse e-mail não parece válido."),
  role: z.enum(["colaborador", "desenvolvedor", "socio"]),
  cargo: z.string().max(120).optional().nullable(),
  area: z.string().max(120).optional().nullable(),
  // Obrigatória: é a função que libera a criação de tasks para o Atendimento.
  funcao: z.enum(FUNCOES_VALIDAS, { message: "Escolha a função da pessoa na agência." }),
  data_admissao: z.string().optional().nullable(),
  dias_ferias_ano: z.number().int().min(0).max(365).default(30),
});

function textoOuNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

export async function criarColaborador(dados: unknown): Promise<Resultado<ResultadoDeConvite>> {
  return executarAcao("criarColaborador", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDeColaborador.safeParse(dados);
    if (!validacao.success) {
      throw new ErroDeAcao(validacao.error.issues[0]?.message ?? "Confira os dados informados.");
    }
    const pedido = validacao.data;

    if (!podeConcederRole(sessao.profile.role, pedido.role)) {
      throw new ErroDeAcao("Apenas sócios podem conceder o perfil de sócio.");
    }

    const admin = adminOuErro();

    const { usuarioId, jaExistia, senhaProvisoria } = await criarConta(admin, {
      email: pedido.email,
      nome: pedido.nome,
      role: pedido.role,
    });

    if (jaExistia) {
      throw new ErroDeAcao("Já existe uma conta com esse e-mail no Full Hub.");
    }

    const { error: erroDaFicha } = await admin.from("team_members").upsert(
      {
        user_id: usuarioId,
        cargo: textoOuNulo(pedido.cargo),
        area: textoOuNulo(pedido.area),
        funcao: pedido.funcao,
        data_admissao: textoOuNulo(pedido.data_admissao),
        dias_ferias_ano: pedido.dias_ferias_ano,
        ativo: true,
      },
      { onConflict: "user_id" },
    );

    if (erroDaFicha) {
      await desfazerConta(admin, usuarioId);
      throw new ErroDeAcao(
        `A ficha de RH falhou (${erroDaFicha.message}). A conta foi desfeita — nada ficou pela metade.`,
      );
    }

    revalidatePath("/painel/equipe");

    return sucesso(
      jaExistia
        ? `${pedido.nome} já tinha conta, e ela foi mantida com a senha que já usava.`
        : `${pedido.nome} foi criada. Passe a senha provisória abaixo — ela troca no primeiro acesso.`,
      { senhaProvisoria },
    );
  });
}

const esquemaDeUsuarioCliente = z.object({
  client_id: z.string().uuid(),
  nome: z.string().min(2, "Informe o nome de quem vai acessar.").max(120),
  email: z.string().email("Esse e-mail não parece válido."),
});

export async function convidarUsuarioCliente(
  dados: unknown,
): Promise<Resultado<ResultadoDeConvite>> {
  return executarAcao("convidarUsuarioCliente", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeUsuarioCliente.safeParse(dados);
    if (!validacao.success) {
      throw new ErroDeAcao(validacao.error.issues[0]?.message ?? "Confira os dados informados.");
    }
    const pedido = validacao.data;

    const admin = adminOuErro();

    const { data: empresa } = await admin
      .from("clients")
      .select("id, nome_empresa")
      .eq("id", pedido.client_id)
      .maybeSingle();

    if (!empresa) throw new ErroDeAcao("Empresa não encontrada.");

    // Se a pessoa já tem conta, reaproveitamos em vez de recusar: é comum o
    // mesmo contato responder por mais de uma empresa do grupo.
    const { data: existente } = await admin
      .from("profiles")
      .select("id, role, nome")
      .eq("email", pedido.email.trim().toLowerCase())
      .maybeSingle();

    if (existente && existente.role !== "cliente") {
      throw new ErroDeAcao(
        "Esse e-mail já pertence a alguém da equipe interna. Use outro endereço para o acesso do cliente.",
      );
    }

    const { usuarioId, jaExistia, senhaProvisoria } = await criarConta(admin, {
      email: pedido.email,
      nome: pedido.nome,
      role: "cliente",
    });

    const { error: erroDoVinculo } = await admin
      .from("client_users")
      .upsert({ client_id: pedido.client_id, user_id: usuarioId }, { onConflict: "client_id,user_id" });

    if (erroDoVinculo) {
      if (!jaExistia) await desfazerConta(admin, usuarioId);
      throw new ErroDeAcao(
        `Não foi possível vincular à empresa (${erroDoVinculo.message}).` +
          (jaExistia ? "" : " A conta foi desfeita — nada ficou pela metade."),
      );
    }

    revalidatePath(`/painel/clientes/${pedido.client_id}`);

    if (jaExistia) {
      return sucesso(
        `${existente?.nome ?? pedido.nome} já tinha conta no Full Hub e agora enxerga ${empresa.nome_empresa}. Nenhuma conta nova foi criada.`,
        { senhaProvisoria: null },
      );
    }

    return sucesso(
      `${pedido.nome} foi criada. Passe a senha provisória abaixo — ela troca no primeiro acesso.`,
      { senhaProvisoria },
    );
  });
}

/** Tira o acesso de alguém ao portal de uma empresa. A conta continua existindo. */
export async function removerUsuarioCliente(dados: unknown): Promise<Resultado> {
  return executarAcao("removerUsuarioCliente", async () => {
    await exigirGestorNaAcao();

    const validacao = z
      .object({ client_user_id: z.string().uuid(), client_id: z.string().uuid() })
      .safeParse(dados);
    if (!validacao.success) throw new ErroDeAcao("Vínculo inválido.");

    const admin = adminOuErro();
    const { error, count } = await admin
      .from("client_users")
      .delete({ count: "exact" })
      .eq("id", validacao.data.client_user_id);

    if (error) throw new ErroDeAcao(`Não foi possível remover o acesso: ${error.message}`);
    if (!count) throw new ErroDeAcao("Esse acesso já tinha sido removido.");

    revalidatePath(`/painel/clientes/${validacao.data.client_id}`);
    return sucesso("Acesso removido. A conta continua existindo.");
  });
}

const CEM_ANOS_EM_HORAS = "876000h";

/**
 * Liga e desliga o acesso de alguém da equipe.
 *
 * Desativar revoga o acesso no Auth (bloqueio longo, que é como o Supabase
 * tira alguém sem apagar a conta) e tira a pessoa das listas e dos seletores.
 * O histórico — tasks, comentários, autoria — fica intacto.
 */
export async function alternarAtivoDoColaborador(dados: unknown): Promise<Resultado> {
  return executarAcao("alternarAtivoDoColaborador", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = z
      .object({ user_id: z.string().uuid(), ativo: z.boolean() })
      .safeParse(dados);
    if (!validacao.success) throw new ErroDeAcao("Dados inválidos.");
    const { user_id: userId, ativo } = validacao.data;

    if (userId === sessao.usuarioId && !ativo) {
      throw new ErroDeAcao("Você não pode desativar o próprio acesso.");
    }

    const admin = adminOuErro();

    const { data: pessoa } = await admin
      .from("profiles")
      .select("id, nome, role")
      .eq("id", userId)
      .maybeSingle();

    if (!pessoa) throw new ErroDeAcao("Pessoa não encontrada.");
    if (pessoa.role === "cliente") throw new ErroDeAcao("Essa conta não é da equipe interna.");

    const { error: erroDoPerfil } = await admin
      .from("profiles")
      .update({ ativo })
      .eq("id", userId);

    if (erroDoPerfil) throw new ErroDeAcao(`Não foi possível alterar o acesso: ${erroDoPerfil.message}`);

    const { error: erroDaFicha } = await admin
      .from("team_members")
      .update(ativo ? { ativo: true, desligado_em: null } : { ativo: false })
      .eq("user_id", userId);

    if (erroDaFicha) throw new ErroDeAcao(`Não foi possível alterar a ficha: ${erroDaFicha.message}`);

    const { error: erroDoAuth } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: ativo ? "none" : CEM_ANOS_EM_HORAS,
    });

    revalidatePath("/painel/equipe");
    revalidatePath(`/painel/equipe/${userId}`);

    if (erroDoAuth) {
      return sucesso(
        `${pessoa.nome} foi ${ativo ? "reativada" : "desativada"} no Full Hub, mas o acesso não pôde ser ` +
          `${ativo ? "liberado" : "revogado"} no Auth (${erroDoAuth.message}). Ajuste em Authentication > Users.`,
      );
    }

    return sucesso(
      ativo
        ? `${pessoa.nome} voltou a ter acesso.`
        : `${pessoa.nome} foi desativada e não consegue mais entrar. O histórico dela continua.`,
    );
  });
}

const esquemaDeDesligamento = z.object({
  user_id: z.string().uuid(),
  nome_digitado: z.string(),
  /** Para quem vão as tasks em aberto e os clientes sob responsabilidade. */
  transferir_para: z.string().uuid().nullable().optional(),
});

/**
 * Desliga alguém da equipe.
 *
 * NÃO apaga a pessoa. Apagar apagaria a autoria de tudo que ela fez, e é
 * justamente esse histórico que a agência precisa manter. Desligar é:
 *   - tasks em aberto transferidas para quem for escolhido (obrigatório);
 *   - clientes sob responsabilidade repassados;
 *   - ficha marcada com desligado_em;
 *   - perfil desativado e acesso revogado no Auth.
 *
 * Só sócio faz isso, em duas etapas, digitando o nome completo.
 */
export async function desligarColaborador(dados: unknown): Promise<Resultado> {
  return executarAcao("desligarColaborador", async () => {
    const sessao = await exigirSocioNaAcao();

    const validacao = esquemaDeDesligamento.safeParse(dados);
    if (!validacao.success) throw new ErroDeAcao("Dados inválidos.");
    const { user_id: userId, nome_digitado: nomeDigitado, transferir_para: transferirPara } =
      validacao.data;

    if (userId === sessao.usuarioId) throw new ErroDeAcao("Você não pode desligar a si mesma.");

    const admin = adminOuErro();

    const { data: pessoa } = await admin
      .from("profiles")
      .select("id, nome, role")
      .eq("id", userId)
      .maybeSingle();

    if (!pessoa) throw new ErroDeAcao("Pessoa não encontrada.");
    if (pessoa.role === "cliente") throw new ErroDeAcao("Essa conta não é da equipe interna.");

    if (nomeDigitado.trim().toLowerCase() !== pessoa.nome.trim().toLowerCase()) {
      throw new ErroDeAcao("O nome digitado não confere com o cadastro.");
    }

    // O que fica sem dono e a SUBTAREFA: e ela que tem responsavel desde o
    // Sprint 3B. A task nao precisa ser transferida -- ela continua sendo o
    // agrupador da demanda, com as etapas agora no nome de outra pessoa.
    const { count: subtarefasAbertas } = await admin
      .from("subtasks")
      .select("id", { count: "exact", head: true })
      .eq("responsavel_id", userId)
      .in("status", SUBTAREFAS_EM_ABERTO);

    if ((subtarefasAbertas ?? 0) > 0 && !transferirPara) {
      throw new ErroDeAcao(
        `${pessoa.nome} tem ${subtarefasAbertas} subtarefa(s) em aberto. Escolha quem vai assumir antes de concluir.`,
      );
    }

    if (transferirPara) {
      if (transferirPara === userId) {
        throw new ErroDeAcao("Escolha outra pessoa para receber as tasks.");
      }
      const { data: destino } = await admin
        .from("profiles")
        .select("id, ativo, role")
        .eq("id", transferirPara)
        .maybeSingle();

      if (!destino || !destino.ativo || destino.role === "cliente") {
        throw new ErroDeAcao("Escolha alguém da equipe que esteja ativo para receber a transferência.");
      }

      const { error: erroDasTasks } = await admin
        .from("subtasks")
        .update({ responsavel_id: transferirPara })
        .eq("responsavel_id", userId)
        .in("status", SUBTAREFAS_EM_ABERTO);

      if (erroDasTasks) {
        throw new ErroDeAcao(`Não foi possível transferir as subtarefas: ${erroDasTasks.message}`);
      }
    }

    // Clientes sob responsabilidade não podem apontar para quem saiu: ou vão
    // para quem recebeu a transferência, ou ficam sem responsável — e sem
    // responsável aparece na lista, o que é melhor do que sumir.
    const { error: erroDosClientes } = await admin
      .from("clients")
      .update({ responsavel_atendimento_id: transferirPara ?? null })
      .eq("responsavel_atendimento_id", userId);

    if (erroDosClientes) {
      throw new ErroDeAcao(`Não foi possível transferir os clientes: ${erroDosClientes.message}`);
    }

    const hoje = new Date().toISOString().slice(0, 10);

    const { error: erroDaFicha } = await admin
      .from("team_members")
      .update({ ativo: false, desligado_em: hoje })
      .eq("user_id", userId);

    if (erroDaFicha) throw new ErroDeAcao(`Não foi possível atualizar a ficha: ${erroDaFicha.message}`);

    const { error: erroDoPerfil } = await admin
      .from("profiles")
      .update({ ativo: false })
      .eq("id", userId);

    if (erroDoPerfil) throw new ErroDeAcao(`Não foi possível desativar o perfil: ${erroDoPerfil.message}`);

    const { error: erroDoAuth } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: CEM_ANOS_EM_HORAS,
    });

    revalidatePath("/painel/equipe");
    revalidatePath(`/painel/equipe/${userId}`);
    revalidatePath("/painel/clientes");
    revalidatePath("/painel/gestao-tasks");

    if (erroDoAuth) {
      return sucesso(
        `${pessoa.nome} foi desligada, mas o acesso não pôde ser revogado no Auth (${erroDoAuth.message}). ` +
          "Revogue manualmente em Authentication > Users.",
      );
    }

    return sucesso(`${pessoa.nome} foi desligada. O histórico continua com o nome dela.`);
  });
}
