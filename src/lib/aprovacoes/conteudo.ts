import { z } from "zod";

import type {
  EscopoRodada,
  StatusRodada,
  TipoDeConteudo,
} from "@/lib/supabase/database.types";

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
 * **Os três existem, e cada um chegou com a trava dele.** A 0030 criou o par
 * e recusou `post` e `deliverable` de propósito, com a frase "quem
 * acrescentar o tipo acrescenta a regra na mesma migration"; a 0032 cumpriu
 * isso para o post e a 0033 para o entregável. A frase fica de pé assim
 * mesmo: ela é a regra para o quarto tipo, se um dia existir.
 *
 * Módulo sem diretiva: o tipo atravessa servidor e navegador.
 */
export type Conteudo = { tipo: TipoDeConteudo; id: string };

export const daSubtarefa = (id: string): Conteudo => ({ tipo: "subtask", id });

export const doPost = (id: string): Conteudo => ({ tipo: "post", id });

export const doEntregavel = (id: string): Conteudo => ({
  tipo: "deliverable",
  id,
});

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
  return `Aprovação de ${conteudo.tipo} chega com o módulo dela — hoje passam por aqui etapa de demanda, post e entregável de campanha.`;
}

/**
 * O QUE TODO ENVIO AO CLIENTE LEVA, desde a migration 0128.
 *
 * `aprovadorId` é quem RECEBE — a pessoa do lado do cliente que a agência
 * nomeia, e para quem o aviso vai. Ela é **separada do responsável de
 * produção**: `subtasks.responsavel_id`, `posts.responsavel_id` e
 * `deliverables.responsavel_id` dizem quem FAZ.
 *
 * `mensagem` é o recado opcional que viaja com o envio. Não é `comentario`,
 * que é o motivo da DECISÃO — e que a 0127 tornou obrigatório nos dois
 * desfechos negativos.
 *
 * **Mora aqui e não no modal** porque são os dois lados que o usam: as quatro
 * Server Actions de envio o recebem, e o diálogo o monta. Módulo sem diretiva,
 * como o resto deste arquivo.
 */
export type EnvioEscolhido = {
  /**
   * QUEM VAI APROVAR — uma pessoa ou várias, NA ORDEM em que foram escolhidas
   * (item 15, migration 0129).
   *
   * **A PRIMEIRA É A QUE VAI PARA `approval_rounds.aprovador_id`**, que é a
   * coluna que o produto lê como "quem recebeu" desde a 0128; as outras entram
   * em `approval_round_aprovadores` por `definir_aprovadores_da_rodada()`. Por
   * isso a ordem é a do clique e não a alfabética: reordenar faria a coluna
   * apontar para outra pessoa que a que a tela mostra em primeiro lugar.
   *
   * **Nunca vazia** — o banco recusa, pela trava da 0128.
   */
  aprovadorIds: string[];
  mensagem: string | null;
};

/**
 * O QUE AS QUATRO ACTIONS DE ENVIO VALIDAM, e um esquema só para as quatro.
 *
 * Quatro cópias dariam quatro recusas diferentes para o mesmo campo em branco,
 * e a que divergiria é a da fila de aprovações internas — a menos relida. Os
 * rótulos vão junto porque é deles que `recusaDeValidacao` monta a frase: sem
 * eles, quem esquecer de escolher lê *"Confira o campo: aprovadorId"*.
 */
export const esquemaDeEnvio = z.object({
  // A LISTA É VALIDADA AQUI E RECUSADA NO BANCO, que é a decisão de sempre: a
  // função confere a pertinência à conta e a lista vazia, e isto escreve a
  // frase que a pessoa lê antes de a requisição sair.
  aprovadorIds: z
    .array(z.string().uuid("Escolha quem vai aprovar."))
    .min(1, "Escolha quem vai aprovar."),
  mensagem: z
    .string()
    .trim()
    .max(2000, "A mensagem passou de 2000 caracteres.")
    .nullable()
    .optional()
    .transform((texto) => (texto && texto.length > 0 ? texto : null)),
});

export const ROTULOS_DO_ENVIO: Record<string, string> = {
  aprovadorIds: "quem vai aprovar",
  mensagem: "mensagem",
};

/**
 * UMA RODADA NO HISTÓRICO DE APROVAÇÕES (item 17).
 *
 * **Os nomes vêm resolvidos e os ids vêm junto**, e os dois são necessários: a
 * tela escreve o nome e o seletor de substituição manda o id. Resolver na tela
 * exigiria um segundo mapa de pessoas por chamador — três cópias, e a que
 * divergiria é a do editor de post, que é a que ninguém relê.
 */
export type RodadaDoHistorico = {
  id: string;
  numero_rodada: number;
  escopo: EscopoRodada;
  status: StatusRodada;
  solicitado_em: string;
  solicitante: string | null;
  decidido_em: string | null;
  decisor: string | null;
  /** O motivo da DECISÃO — obrigatório nos dois desfechos negativos (0127). */
  comentario: string | null;
  /** O que a agência disse ao MANDAR (0128). Outro fato, outra coluna. */
  mensagem: string | null;
  /**
   * QUEM RECEBEU, na ordem: a pessoa de `aprovador_id` primeiro, e as outras
   * de `approval_round_aprovadores` (0129) atrás dela.
   *
   * **A ORDEM É A DA COLUNA e não a do `created_at`**, e a diferença aparece
   * depois de uma substituição: `rodada_vincula_o_aprovador` apaga a linha de
   * quem saiu e insere a de quem entrou NO FIM, então pelo carimbo a primeira
   * pessoa do histórico deixaria de ser a que a coluna nomeia — e é a coluna
   * que todo o resto do produto lê como "quem recebeu" desde a 0128.
   *
   * Vazia na rodada interna por definição, e nas rodadas de cliente anteriores
   * à 0128: ali ninguém foi nomeado, e a tela diz isso em vez de inventar.
   */
  aprovadores: { id: string; nome: string }[];
};

/**
 * A MESMA FORMA, A PARTIR DAS RODADAS QUE A DEMANDA JÁ CARREGA.
 *
 * ---------------------------------------------------------------------------
 * **É UM ADAPTADOR E NÃO UMA SEGUNDA LEITURA**, e é o que permite o histórico
 * ser um componente só. `carregar()` em `lib/dados/tasks.ts` já traz as rodadas
 * da demanda inteira com as pessoas resolvidas no mapa que ela monta de
 * qualquer forma — chamar `historicoDeAprovacoes()` de lá seria uma ida ao
 * banco por etapa aberta para repetir o que já está em mãos. O post e a peça de
 * campanha, que não carregam rodada nenhuma, chamam a leitura.
 *
 * **O que ele descarta é o `avatar_url`**, que o histórico não desenha: ele é
 * texto, e um círculo por nome numa linha de registro seria a pilha de avatares
 * respondendo uma pergunta que ninguém fez ali.
 */
export function comoHistorico(
  rodadas: {
    id: string;
    numero_rodada: number;
    escopo: EscopoRodada;
    status: StatusRodada;
    solicitado_em: string;
    solicitante: { nome: string } | null;
    decidido_em: string | null;
    decisor: { nome: string } | null;
    comentario: string | null;
    mensagem: string | null;
    aprovadores: { id: string; nome: string }[];
  }[],
): RodadaDoHistorico[] {
  return rodadas.map((r) => ({
    id: r.id,
    numero_rodada: r.numero_rodada,
    escopo: r.escopo,
    status: r.status,
    solicitado_em: r.solicitado_em,
    solicitante: r.solicitante?.nome ?? null,
    decidido_em: r.decidido_em,
    decisor: r.decisor?.nome ?? null,
    comentario: r.comentario,
    mensagem: r.mensagem,
    aprovadores: r.aprovadores.map((p) => ({ id: p.id, nome: p.nome })),
  }));
}
