"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { ehCliente } from "@/lib/auth/roles";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O cliente mantendo os próprios dados de contato.
 *
 * Alcança três colunas e nada além: nome de contato, e-mail de contato e
 * telefone. Nome da empresa, situação (ativo) e pasta do Drive são da agência.
 *
 * A trava de verdade não está aqui: a policy clients_update_proprio limita as
 * LINHAS às empresas da pessoa, e o trigger clients_protect_columns devolve
 * qualquer outra COLUNA ao valor anterior. Esta action é a porta de entrada
 * normal; as duas camadas do banco valem mesmo se alguém chamar a API direto.
 *
 * A tela que usa isto é do Sprint 11 (aba Perfil do portal).
 */

const esquema = z.object({
  client_id: z.string().uuid(),
  nome_contato: z.string().max(120).optional().nullable(),
  email_contato: z
    .union([z.string().email("E-mail de contato inválido."), z.literal("")])
    .optional(),
  telefone: z.string().max(40).optional().nullable(),
});

function vazioParaNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

export async function salvarContatoDaMinhaEmpresa(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarContatoDaMinhaEmpresa", async () => {
    const sessao = await exigirSessaoNaAcao();
    if (!ehCliente(sessao.profile.role)) {
      throw new ErroDeAcao("Esta ação é do portal do cliente.");
    }

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      throw new ErroDeAcao(validacao.error.issues[0]?.message ?? "Confira os dados informados.");
    }
    const { client_id: clientId, ...contato } = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("clients")
      .update({
        nome_contato: vazioParaNulo(contato.nome_contato),
        email_contato: vazioParaNulo(contato.email_contato),
        telefone: vazioParaNulo(contato.telefone),
      })
      .eq("id", clientId)
      .select("id")
      .maybeSingle();

    if (error) throw new ErroDeAcao(`Não foi possível salvar: ${error.message}`);
    if (!data) throw new ErroDeAcao("Você não tem acesso a esta empresa.");

    revalidatePath("/portal/configuracoes");
    return sucesso("Dados de contato atualizados.");
  });
}
