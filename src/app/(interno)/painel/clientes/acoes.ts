"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao, exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { vinculosDoCliente } from "@/lib/dados/clientes";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Ações do módulo Clientes.
 *
 * A gravação passa pelo cliente Supabase do usuário, não pela service role: o
 * RLS é quem decide se a pessoa pode escrever. A checagem de perfil aqui é a
 * primeira barreira, não a última.
 *
 * Nada aqui lança exceção para a tela: toda saída é `{ ok }` ou
 * `{ ok: false, error }` com a mensagem real do Postgres.
 */

const esquemaDeCliente = z.object({
  id: z.string().uuid().optional(),
  nome_empresa: z.string().min(2, "Informe o nome da empresa.").max(160),
  nome_contato: z.string().max(120).optional().nullable(),
  email_contato: z
    .union([z.string().email("E-mail de contato inválido."), z.literal("")])
    .optional(),
  telefone: z.string().max(40).optional().nullable(),
  segmento: z.string().max(120).optional().nullable(),
  responsavel_atendimento_id: z.string().uuid().nullable().optional(),
  drive_folder_id: z.string().max(200).optional().nullable(),
  observacoes: z.string().max(4000).optional().nullable(),
});

function vazioParaNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

export async function salvarCliente(dados: unknown): Promise<Resultado<{ id: string }>> {
  return executarAcao("salvarCliente", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeCliente.safeParse(dados);
    if (!validacao.success) {
      throw new ErroDeAcao(validacao.error.issues[0]?.message ?? "Confira os dados informados.");
    }
    const { id, ...campos } = validacao.data;

    const registro = {
      nome_empresa: campos.nome_empresa.trim(),
      nome_contato: vazioParaNulo(campos.nome_contato),
      email_contato: vazioParaNulo(campos.email_contato),
      telefone: vazioParaNulo(campos.telefone),
      segmento: vazioParaNulo(campos.segmento),
      responsavel_atendimento_id: campos.responsavel_atendimento_id || null,
      drive_folder_id: vazioParaNulo(campos.drive_folder_id),
      observacoes: vazioParaNulo(campos.observacoes),
    };

    const supabase = await criarClienteServidor();

    // `select()` no fim não é enfeite: sem ele, um UPDATE barrado pelo RLS
    // volta sem erro e sem linha nenhuma, e a tela diria "salvo" à toa.
    const { data, error } = id
      ? await supabase.from("clients").update(registro).eq("id", id).select("id").maybeSingle()
      : await supabase.from("clients").insert(registro).select("id").maybeSingle();

    if (error) throw new ErroDeAcao(`Não foi possível salvar: ${error.message}`);
    if (!data) {
      throw new ErroDeAcao(
        "O banco recusou a gravação e não disse por quê. Normalmente é o RLS: confira se seu perfil é desenvolvedor ou sócio.",
      );
    }

    revalidatePath("/painel/clientes");
    if (id) revalidatePath(`/painel/clientes/${id}`);

    return sucesso(id ? "Cliente atualizado." : "Cliente cadastrado.", { id: data.id });
  });
}

/**
 * Desativar em vez de excluir. O histórico da conta precisa sobreviver, e
 * reativar é um clique quando o cliente volta.
 */
export async function alternarAtivoDoCliente(dados: unknown): Promise<Resultado> {
  return executarAcao("alternarAtivoDoCliente", async () => {
    await exigirGestorNaAcao();

    const validacao = z.object({ id: z.string().uuid(), ativo: z.boolean() }).safeParse(dados);
    if (!validacao.success) throw new ErroDeAcao("Dados inválidos.");
    const { id, ativo } = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("clients")
      .update({ ativo })
      .eq("id", id)
      .select("id, nome_empresa")
      .maybeSingle();

    if (error) throw new ErroDeAcao(`Não foi possível alterar: ${error.message}`);
    if (!data) throw new ErroDeAcao("O banco recusou a alteração. Confira seu perfil de acesso.");

    revalidatePath("/painel/clientes");
    revalidatePath(`/painel/clientes/${id}`);

    return sucesso(
      ativo
        ? `${data.nome_empresa} voltou para as listas ativas.`
        : `${data.nome_empresa} foi desativada. Ela sai das listas e dos seletores, e nada foi apagado.`,
    );
  });
}

/**
 * Exclusão de verdade. Só sócio, só com o nome digitado e só quando não há
 * absolutamente nada preso à empresa.
 */
export async function excluirCliente(dados: unknown): Promise<Resultado> {
  return executarAcao("excluirCliente", async () => {
    await exigirSocioNaAcao();

    const validacao = z
      .object({ id: z.string().uuid(), nome_digitado: z.string() })
      .safeParse(dados);
    if (!validacao.success) throw new ErroDeAcao("Dados inválidos.");
    const { id, nome_digitado: nomeDigitado } = validacao.data;

    const supabase = await criarClienteServidor();
    const { data: cliente } = await supabase
      .from("clients")
      .select("id, nome_empresa")
      .eq("id", id)
      .maybeSingle();

    if (!cliente) throw new ErroDeAcao("Cliente não encontrado.");

    if (nomeDigitado.trim() !== cliente.nome_empresa.trim()) {
      throw new ErroDeAcao("O nome digitado não confere com o da empresa.");
    }

    const vinculos = await vinculosDoCliente(id);
    if (vinculos.impedeExclusao) {
      const partes = [
        vinculos.usuarios ? `${vinculos.usuarios} acesso(s) ao portal` : null,
        vinculos.tasks ? `${vinculos.tasks} task(s)` : null,
        vinculos.campanhas ? `${vinculos.campanhas} campanha(s)` : null,
        vinculos.posts ? `${vinculos.posts} post(s)` : null,
        vinculos.lancamentos ? `${vinculos.lancamentos} lançamento(s)` : null,
      ].filter(Boolean);

      throw new ErroDeAcao(
        `${cliente.nome_empresa} tem ${partes.join(", ")}. Excluir apagaria esse histórico — desative a empresa em vez de excluir.`,
      );
    }

    const { data, error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw new ErroDeAcao(`Não foi possível excluir: ${error.message}`);
    if (!data) throw new ErroDeAcao("O banco recusou a exclusão. Apenas sócios podem excluir.");

    revalidatePath("/painel/clientes");
    return sucesso(`${cliente.nome_empresa} foi excluída.`);
  });
}
