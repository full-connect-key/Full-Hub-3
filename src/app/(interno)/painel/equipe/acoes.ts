"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok?: string; erro?: string };

const esquema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2, "Informe o nome completo.").max(120),
  role: z.enum(["colaborador", "desenvolvedor", "socio"]),
  cargo: z.string().max(120).optional().nullable(),
  area: z.string().max(120).optional().nullable(),
  funcao: z
    .enum([
      "Atendimento",
      "Social Media",
      "Redator",
      "Design",
      "Audiovisual",
      "Trafego",
      "Desenvolvimento",
      "Gestao",
      "Outro",
    ])
    .optional()
    .nullable(),
  data_admissao: z.string().optional().nullable(),
  dias_ferias_ano: z.coerce.number().int().min(0).max(365),
});

function vazioParaNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/**
 * Salva a ficha de alguém da equipe.
 *
 * O perfil de acesso (role) é tratado à parte: gestão edita a ficha, mas só
 * sócio muda quem alcança o quê. O banco reforça isso com o trigger
 * protect_profile_role -- aqui evitamos o pedido chegar errado.
 */
export async function salvarColaborador(dados: unknown): Promise<Resultado> {
  const sessao = await exigirAcessoARota("/painel/equipe");

  const validacao = esquema.safeParse(dados);
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira os dados informados." };
  }
  const { id, nome, role, ...ficha } = validacao.data;

  const supabase = await criarClienteServidor();

  const { data: atual } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();

  if (!atual) return { erro: "Pessoa não encontrada." };

  const mudouORole = atual.role !== role;
  if (mudouORole && !ehSocio(sessao.profile.role)) {
    return { erro: "Apenas sócios alteram o perfil de acesso." };
  }

  const { error: erroDoPerfil } = await supabase
    .from("profiles")
    .update(mudouORole ? { nome: nome.trim(), role } : { nome: nome.trim() })
    .eq("id", id);

  if (erroDoPerfil) return { erro: `Não foi possível salvar: ${erroDoPerfil.message}` };

  const { error: erroDaFicha } = await supabase.from("team_members").upsert(
    {
      user_id: id,
      cargo: vazioParaNulo(ficha.cargo),
      area: vazioParaNulo(ficha.area),
      funcao: ficha.funcao || null,
      data_admissao: vazioParaNulo(ficha.data_admissao),
      dias_ferias_ano: ficha.dias_ferias_ano,
    },
    { onConflict: "user_id" },
  );

  if (erroDaFicha) return { erro: `Não foi possível salvar a ficha: ${erroDaFicha.message}` };

  revalidatePath("/painel/equipe");
  revalidatePath(`/painel/equipe/${id}`);
  return { ok: "Dados salvos." };
}
