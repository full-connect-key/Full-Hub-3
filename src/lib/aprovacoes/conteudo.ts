import type { TipoDeConteudo } from "@/lib/supabase/database.types";

/**
 * O endereço de um conteúdo que passa por aprovação.
 *
 * **Por que um par, e não um id solto.** Até a migration 0030 a rodada
 * apontava para `subtask_id` e pronto. Posts e entregáveis de campanha passam
 * pela mesma decisão — alguém envia, a gestão valida, a gestão manda ao
 * cliente, o cliente aprova ou pede ajuste —, e a alternativa era um segundo
 * fluxo de aprovação ao lado deste. É a duplicação que o produto já desfez uma
 * vez: duas implementações da mesma pergunta divergem, e a que diverge em
 * silêncio é a que decide se o material foi ao cliente.
 *
 * **Hoje só `subtask` existe.** O banco RECUSA rodada de post e de entregável
 * (`validar_nova_rodada`, 0030) em vez de aceitar uma aprovação que nenhuma
 * trava sabe conferir. Quem acrescentar o tipo acrescenta a regra junto.
 *
 * Módulo sem diretiva: o tipo atravessa servidor e navegador.
 */
export type Conteudo = { tipo: TipoDeConteudo; id: string };

export const daSubtarefa = (id: string): Conteudo => ({ tipo: "subtask", id });

/**
 * O par, pronto para `insert`. Existe para o nome da coluna aparecer em um
 * lugar só — trocá-lo é um `grep` que termina aqui.
 */
export function colunasDoConteudo(conteudo: Conteudo): {
  content_type: TipoDeConteudo;
  content_id: string;
} {
  return { content_type: conteudo.tipo, content_id: conteudo.id };
}

/**
 * A frase que toda ação diz quando o tipo ainda não tem regra.
 *
 * Uma só, e não uma por ação: quem ler "ainda não" quer saber de quando, e a
 * resposta é a mesma nas cinco.
 */
export function aindaNaoTratado(conteudo: Conteudo): string {
  return `Aprovação de ${conteudo.tipo} chega com o módulo dela — hoje só etapa de demanda passa por aqui.`;
}
