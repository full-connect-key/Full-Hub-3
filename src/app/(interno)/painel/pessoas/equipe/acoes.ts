"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { ehSocio } from "@/lib/auth/roles";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Edição da ficha de quem já está na equipe.
 *
 * Criar conta, desativar e desligar moram em `_actions/usuarios.ts`, porque
 * mexem no Supabase Auth e precisam da service role. Aqui é só o cadastro, que
 * passa pelo RLS como qualquer outra escrita.
 */

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

const esquema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2, "Informe o nome completo.").max(120),
  role: z.enum(["colaborador", "desenvolvedor", "socio"]),
  cargo: z.string().max(120).optional().nullable(),
  area: z.string().max(120).optional().nullable(),
  funcao: z.enum(FUNCOES_VALIDAS, { message: "Escolha a função da pessoa na agência." }),
  data_admissao: z.string().optional().nullable(),
  dias_ferias_ano: z.number().int().min(0).max(365),
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
 * protect_profile_role — aqui evitamos o pedido chegar errado.
 */
export async function salvarColaborador(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarColaborador", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      throw new ErroDeAcao(recusaDeValidacao("salvarColaborador", validacao.error, dados, "Confira os dados informados."));
    }
    const { id, nome, role, ...ficha } = validacao.data;

    const supabase = await criarClienteServidor();

    const { data: atual } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();

    if (!atual) throw new ErroDeAcao("Pessoa não encontrada.");

    const mudouORole = atual.role !== role;
    if (mudouORole && !ehSocio(sessao.profile.role)) {
      throw new ErroDeAcao("Apenas sócios alteram o perfil de acesso.");
    }

    const { data: perfilSalvo, error: erroDoPerfil } = await supabase
      .from("profiles")
      .update(mudouORole ? { nome: nome.trim(), role } : { nome: nome.trim() })
      .eq("id", id)
      .select("id, role")
      .maybeSingle();

    if (erroDoPerfil) throw new ErroDeAcao(`Não foi possível salvar: ${erroDoPerfil.message}`);
    if (!perfilSalvo) {
      throw new ErroDeAcao(
        "O banco recusou a gravação do perfil. Normalmente é o RLS: confira se seu perfil é desenvolvedor ou sócio.",
      );
    }

    // O trigger devolve o role antigo em silêncio quando quem edita não é
    // sócio. Comparar o que voltou é a única forma de a tela não mentir.
    if (mudouORole && perfilSalvo.role !== role) {
      throw new ErroDeAcao(
        "O banco não aceitou a troca do perfil de acesso. Apenas sócios podem fazer isso.",
      );
    }

    const { data: fichaSalva, error: erroDaFicha } = await supabase
      .from("team_members")
      .upsert(
        {
          user_id: id,
          cargo: vazioParaNulo(ficha.cargo),
          area: vazioParaNulo(ficha.area),
          funcao: ficha.funcao,
          data_admissao: vazioParaNulo(ficha.data_admissao),
          dias_ferias_ano: ficha.dias_ferias_ano,
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .maybeSingle();

    if (erroDaFicha) throw new ErroDeAcao(`Não foi possível salvar a ficha: ${erroDaFicha.message}`);
    if (!fichaSalva) throw new ErroDeAcao("O banco recusou a gravação da ficha de RH.");

    revalidatePath("/painel/pessoas");
    revalidatePath(`/painel/pessoas/equipe/${id}`);
    return sucesso("Dados salvos.");
  });
}
