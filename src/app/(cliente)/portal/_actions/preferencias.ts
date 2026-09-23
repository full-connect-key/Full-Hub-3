"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import {
  ErroDeAcao,
  executarAcao,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { ehCliente } from "@/lib/auth/roles";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As preferências de aviso do cliente.
 *
 * **Grava por `upsert`, e não por insert-ou-update escritos à mão.** Quem
 * nunca mexeu não tem linha (é o padrão que a leitura devolve), e a primeira
 * mudança precisa criá-la. Duas consultas — "existe? então update, senão
 * insert" — abrem a janela em que duas abas criam duas linhas, e o `unique`
 * em `user_id` recusaria a segunda com um erro que a pessoa não entende.
 *
 * O DISPARO ainda não existe. Isto aqui guarda a escolha; ninguém ainda lê para
 * decidir se manda o e-mail.
 */

const esquema = z.object({
  novo_conteudo: z.boolean(),
  novo_comentario: z.boolean(),
  lembrete_pendencias: z.boolean(),
  frequencia: z.enum(["imediato", "diario", "nunca"]),
});

const ROTULOS = {
  novo_conteudo: "novo conteúdo",
  novo_comentario: "novo comentário",
  lembrete_pendencias: "lembretes",
  frequencia: "frequência",
};

export async function salvarPreferenciasDeAviso(
  dados: unknown,
): Promise<Resultado> {
  return executarAcao("salvarPreferenciasDeAviso", async () => {
    const sessao = await exigirSessaoNaAcao();
    if (!ehCliente(sessao.profile.role)) {
      throw new ErroDeAcao("Esta configuração é do portal do cliente.");
    }

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      throw new ErroDeAcao(
        recusaDeValidacao(
          "salvarPreferenciasDeAviso",
          validacao.error,
          dados,
          "Confira as opções escolhidas.",
          ROTULOS,
        ),
      );
    }

    const supabase = await criarClienteServidor();

    // `.select()` porque a policy pode barrar: sem ele, um update recusado
    // volta sem erro e sem linha, e a tela diria "salvo" à toa.
    const { data, error } = await supabase
      .from("client_notification_prefs")
      .upsert(
        { user_id: sessao.usuarioId, ...validacao.data },
        { onConflict: "user_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) throw new ErroDeAcao(error.message);
    if (!data) {
      throw new ErroDeAcao("O banco recusou a gravação das preferências.");
    }

    revalidatePath("/portal/configuracoes");
    return sucesso("Preferências salvas.");
  });
}
