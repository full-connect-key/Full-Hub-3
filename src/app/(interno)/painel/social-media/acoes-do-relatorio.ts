"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao } from "@/lib/acoes/guardas";
import {
  executarAcao,
  falha,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import {
  METRICAS_DO_SOCIAL,
  type MetricaSocial,
} from "@/lib/dominio/relatorio-do-social";
import { PLATAFORMAS } from "@/lib/dominio/posts";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O relatório de desempenho do social (migration 0150).
 *
 * Decisão do usuário, item 18: *"podemos passar essa parte de social, para uma
 * aba a parte de relatórios, para permitir que os dados sejam editados pela
 * social"*.
 *
 * ---------------------------------------------------------------------------
 * **QUEM PODE: `is_staff()`, e a escolha é a frase dele.** *"Editados pela
 * social"* nomeia quem edita, e a social media é `colaborador` — `is_gestor()`
 * esconderia o relatório de exatamente quem ele é para, que é o argumento que
 * trouxe o módulo inteiro para `EQUIPE` na 0042 e a leitura das solicitações
 * para o Atendimento na 0110.
 *
 * A guarda daqui não acrescenta trava nenhuma: as quatro policies de escrita
 * da 0150 são `is_staff()`, e a rota é `is_staff()` desde a 0042. Ela existe
 * para a recusa chegar em português antes de a pessoa ler "nenhuma linha
 * voltou" — a dupla de sempre.
 *
 * ---------------------------------------------------------------------------
 * **PUBLICAR É UMA AÇÃO À PARTE, e não um campo do formulário.** Enquanto
 * `publicado_em` é nulo o cliente não enxerga nada — `social_reports_select`
 * pede o carimbo —, então digitar e publicar são duas decisões: a primeira é
 * o trabalho, a segunda é dizer que ele está pronto para sair. É *aprovar não
 * envia* aplicado a um relatório, e é o que permite a social media preencher o
 * mês aos poucos sem o cliente ver um relatório pela metade.
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/social-media";

/**
 * A MÉTRICA É VALIDADA CONTRA `METRICAS_DO_SOCIAL`, e não contra uma tupla de
 * chaves ao lado dela.
 *
 * `z.enum` pediria a tupla, e uma tupla de dez chaves ao lado da lista de dez
 * objetos é a SEGUNDA cópia da mesma lista — a drift que a 0109 pagou com o
 * oitavo tipo de evento. Aquela lista é de objetos porque a ORDEM dela é o
 * funil que a tela desenha (alcance → impressões → … → seguidores), e não dá
 * para derivar uma tupla de um `.map()`.
 *
 * O `z.custom` narra o tipo do mesmo jeito, e a lista continua sendo uma só.
 */
const CHAVES_DE_METRICA: readonly string[] = METRICAS_DO_SOCIAL.map(
  (m) => m.chave,
);

const metricaConhecida = z.custom<MetricaSocial>(
  (v) => typeof v === "string" && CHAVES_DE_METRICA.includes(v),
  "Esta métrica não existe no relatório.",
);

/**
 * O MÊS É `YYYY-MM-01`, e o gatilho da 0150 carimba o dia 1 de qualquer forma.
 *
 * A validação daqui é sobre a FORMA e não sobre o dia: quem monta a chamada à
 * mão com `2026-10-17` recebe uma competência de outubro, porque a competência
 * é o mês e não a data em que alguém digitou — a decisão de
 * `finance_entries.competencia` (0013).
 */
const competencia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "A competência é um mês.");

/**
 * O TETO É DOIS BILHÕES, e ele é o `check` do banco repetido deste lado.
 *
 * O Postgres recusaria com *"violates check constraint"*, que não diz nada a
 * quem digitou; e o número existe porque a coluna é `bigint` e o que ela
 * guarda é alcance de rede social — dois bilhões é mais do que qualquer conta
 * da agência alcança, e um valor acima disso é um zero a mais.
 */
const valorDaMetrica = z.coerce
  .number()
  .int("O número é inteiro.")
  .min(0, "Um número negativo não é um alcance.")
  .max(2000000000, "Confira o número: ele parece um zero a mais.");

const esquemaDoRelatorio = z.object({
  client_id: z.string().uuid(),
  competencia,
  comentario: z
    .string()
    .trim()
    .max(
      2000,
      "O comentário é a leitura do mês, não o relatório inteiro — guarde-o em algumas frases.",
    )
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  numeros: z
    .array(
      z.object({
        plataforma: z.enum(PLATAFORMAS),
        metrica: metricaConhecida,
        valor: valorDaMetrica,
      }),
    )
    .max(
      200,
      "São mais números do que o relatório de um mês tem — confira a chamada.",
    ),
});

/**
 * Grava o mês inteiro de uma vez.
 *
 * ---------------------------------------------------------------------------
 * **É O MÊS E NÃO O CAMPO, ao contrário do consumo do escopo (0149).** Lá cada
 * linha é um item do contrato, independente dos outros, e salvar uma não diz
 * nada sobre as demais. Aqui o relatório é UMA leitura do mês: alcance,
 * impressões e curtidas do Instagram se conferem juntos, e um salvamento por
 * campo deixaria o relatório num estado em que metade dos números é de hoje e
 * metade da semana passada — invisível para o cliente enquanto é rascunho, e
 * exatamente o que ele publicaria sem notar.
 *
 * **O CAMPO VAZIO APAGA A LINHA**, e é a decisão que faz o formulário dizer a
 * verdade: uma métrica que a rede não dá — salvamentos no LinkedIn, visitas ao
 * perfil no YouTube — fica em branco, e o portal não desenha o que não existe.
 * Guardar zero no lugar afirmaria que a conta teve zero salvamentos, que é um
 * número e não uma ausência. Por isso a gravação é *apaga o que não veio*: o
 * que a tela mandou é o relatório daquele mês, inteiro.
 *
 * **SÃO TRÊS ESCRITAS E NÃO UMA TRANSAÇÃO**, e a ordem é o que torna isso
 * seguro: o relatório primeiro (o `upsert` devolve o id), os números depois, e
 * a limpeza no fim. Uma falha no meio deixa números a mais — nunca um
 * relatório sem o número que a pessoa digitou —, e o rascunho não é lido por
 * ninguém até alguém publicar. É a decisão da 0052 e a das sete colunas da
 * 0125: quando a segunda escrita não desfaz a primeira, o que ela faz é dizer.
 * ---------------------------------------------------------------------------
 */
export async function salvarRelatorioDoSocial(
  dados: unknown,
): Promise<Resultado> {
  return executarAcao("salvarRelatorioDoSocial", async () => {
    await exigirEquipeNaAcao();

    const validacao = esquemaDoRelatorio.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "salvarRelatorioDoSocial",
          validacao.error,
          dados,
          "Confira os números.",
          ROTULOS,
        ),
      );

    const { client_id, competencia: mes, comentario, numeros } = validacao.data;
    const supabase = await criarClienteServidor();

    // O `upsert` É A TRAVA, e não um `select` antes: o índice único
    // `(client_id, competencia)` é o que impede dois relatórios do mesmo mês, e
    // duas abas abertas passariam pelas duas consultas antes de qualquer uma
    // gravar — a idempotência da recorrência (0040).
    const { data: relatorio, error: erroDoRelatorio } = await supabase
      .from("social_reports")
      .upsert(
        { client_id, competencia: mes, comentario },
        { onConflict: "client_id,competencia" },
      )
      .select("id")
      .limit(1);

    if (erroDoRelatorio)
      return falha(`Não foi possível salvar: ${erroDoRelatorio.message}`);

    const reportId = relatorio?.[0]?.id;
    if (!reportId) {
      return falha("Quem edita o relatório do social é a equipe da agência.");
    }

    if (numeros.length > 0) {
      const { error } = await supabase.from("social_report_metrics").upsert(
        numeros.map((n) => ({
          report_id: reportId,
          plataforma: n.plataforma,
          metrica: n.metrica,
          valor: n.valor,
          // A FONTE É `manual` porque quem gravou foi uma pessoa. A coluna
          // existe desde o primeiro dia para a integração com as redes não
          // precisar de migration — e para a tela poder dizer de onde veio
          // cada número no dia em que as duas conviverem.
          fonte: "manual" as const,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "report_id,plataforma,metrica" },
      );
      if (error) return falha(`Não foi possível salvar: ${error.message}`);
    }

    // A LIMPEZA É POR CHAVE COMPOSTA, e o `not.in` do PostgREST não sabe
    // comparar duas colunas de uma vez — então ela é feita em TypeScript sobre
    // o que o banco tem, que é uma lista de dezenas de linhas e não de
    // milhares.
    const { data: existentes, error: erroDaLeitura } = await supabase
      .from("social_report_metrics")
      .select("id, plataforma, metrica")
      .eq("report_id", reportId);

    if (erroDaLeitura)
      return falha(`Não foi possível salvar: ${erroDaLeitura.message}`);

    const enviados = new Set(numeros.map((n) => `${n.plataforma}|${n.metrica}`));
    const sobrando = (existentes ?? [])
      .filter((e) => !enviados.has(`${e.plataforma}|${e.metrica}`))
      .map((e) => e.id);

    if (sobrando.length > 0) {
      const { error } = await supabase
        .from("social_report_metrics")
        .delete()
        .in("id", sobrando);
      if (error)
        return falha(
          `Os números foram salvos, mas ${sobrando.length} que você apagou continuaram lá: ${error.message}`,
        );
    }

    revalidatePath(ROTA);
    return sucesso("Relatório salvo.");
  });
}

const esquemaDaPublicacao = z.object({
  client_id: z.string().uuid(),
  competencia,
  publicar: z.boolean(),
});

/**
 * Publica — ou tira do ar — o relatório de um mês.
 *
 * ---------------------------------------------------------------------------
 * **QUEM CARIMBA É O GATILHO, nunca esta ação.** `carimbar_relatorio_de_social`
 * escreve `publicado_em` e `publicado_por` a partir de `auth.uid()`, e
 * descarta o que vier no pedido — **policy não limita coluna**, que é a razão
 * de `posts_protege_colunas` e de `comments_normaliza`. Daqui vai um booleano,
 * e é o banco que diz quem publicou e quando.
 *
 * **DESPUBLICAR EXISTE, e não é o mesmo que apagar.** O mês sai do portal e os
 * números ficam: é o caminho de quem publicou com um número errado. Apagar
 * levaria a leitura do mês junto, e o relatório de um mês fechado é o que o
 * cliente abre meses depois para comparar — a razão pela qual o selo de ganho
 * do mês seguinte depende de o anterior continuar publicado.
 * ---------------------------------------------------------------------------
 */
export async function publicarRelatorioDoSocial(
  dados: unknown,
): Promise<Resultado> {
  return executarAcao("publicarRelatorioDoSocial", async () => {
    await exigirEquipeNaAcao();

    const validacao = esquemaDaPublicacao.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "publicarRelatorioDoSocial",
          validacao.error,
          dados,
          "Confira o mês.",
          ROTULOS,
        ),
      );

    const { client_id, competencia: mes, publicar } = validacao.data;
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("social_reports")
      .update({
        // O INSTANTE VEM DAQUI E O GATILHO O SOBRESCREVE com `now()` do
        // servidor; o que esta linha decide é só se ele existe ou não.
        publicado_em: publicar ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", client_id)
      .eq("competencia", mes)
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      // SEM LINHA SÃO DUAS COISAS, e a frase diz as duas: o relatório daquele
      // mês não existe (ninguém digitou nada ainda), ou a RLS recusou. A
      // primeira é o caso comum, e é a que a pessoa tem como resolver.
      return falha(
        "Este mês ainda não tem relatório. Preencha os números e salve antes de publicar.",
      );
    }

    revalidatePath(ROTA);
    return sucesso(
      publicar
        ? "Relatório publicado. O cliente já o vê no portal."
        : "Relatório tirado do ar. Os números ficaram salvos.",
    );
  });
}

/** O rótulo de cada campo, para a recusa de validação falar português. */
const ROTULOS: Record<string, string> = {
  client_id: "conta",
  competencia: "mês",
  comentario: "leitura do mês",
  numeros: "números",
  plataforma: "rede",
  metrica: "métrica",
  valor: "número",
  publicar: "situação",
};
