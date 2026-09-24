"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import {
  executarAcao,
  falha,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { colunasDoConteudo, doEntregavel } from "@/lib/aprovacoes/conteudo";
import { entregaveisDoTemplate } from "@/lib/dominio/campanhas";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstruturaDeTemplate } from "@/lib/supabase/database.types";

/**
 * Criar a campanha, enviar o entregável, registrar a versão.
 *
 * Tudo passa pelo cliente Supabase da própria pessoa: quem pode criar e editar
 * é o RLS que decide (`campaigns_insert` e `deliverables_insert` exigem
 * `is_staff()`). A checagem de rota aqui é a primeira barreira, não a única.
 *
 * **Enviar ao cliente não tem ação própria, e é de propósito.** Enviar É abrir
 * a rodada de escopo cliente: o carimbo em `deliverables.enviado_em` sai do
 * trigger `approval_rounds_marca_conteudo`. Uma ação que escrevesse a coluna
 * daria material carimbado sem rodada nenhuma — o cliente vendo a peça sem ter
 * onde decidir.
 */

const ROTA = "/painel/aprovacoes";

const CAMPOS = {
  nome: "nome da campanha",
  clienteId: "cliente",
  dataInicio: "data de início",
  dataFim: "data de encerramento",
};

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data.");

const esquemaDaCampanha = z
  .object({
    nome: z.string().trim().min(2, "Dê um nome à campanha."),
    clienteId: z.string().uuid("Escolha o cliente."),
    descricao: z.string().trim().optional(),
    dataInicio: data,
    dataFim: data,
    templateId: z.string().uuid().nullable().optional(),
    /**
     * Quantos itens gerar num grupo que o template deixou em aberto — o caso
     * do Feed/Storys, que muda a cada mês. Chave é o nome do grupo.
     */
    quantidades: z
      .record(z.string(), z.number().int().min(0).max(200))
      .optional(),
  })
  .refine((v) => v.dataFim >= v.dataInicio, {
    path: ["dataFim"],
    message: "O encerramento não pode ser antes do início.",
  });

export type NovaCampanha = z.input<typeof esquemaDaCampanha>;

/**
 * Cria a campanha e, quando há template, a árvore inteira de entregáveis.
 *
 * **Os entregáveis nascem em `aguardando_informacoes` e SEM `enviado_em`.** A
 * estrutura existe para a equipe se organizar; o cliente só passa a enxergar
 * cada peça quando ela for enviada, uma a uma. Criar a campanha já visível
 * com quarenta linhas vazias faria a tela dele prometer material que ninguém
 * começou.
 *
 * Os filhos entram depois dos pais, e não juntos: `parent_id` aponta para uma
 * linha que precisa existir. Dois `insert` em vez de um só — e é o mínimo,
 * porque a árvore tem dois níveis e nunca três.
 */
export async function criarCampanha(entrada: NovaCampanha): Promise<Resultado> {
  return executarAcao("criarCampanha", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validado = esquemaDaCampanha.safeParse(entrada);
    if (!validado.success) {
      return falha(recusaDeValidacao("criarCampanha", validado.error, entrada, "Confira os dados da campanha.", CAMPOS));
    }
    const dados = validado.data;

    const supabase = await criarClienteServidor();

    const { data: criada, error } = await supabase
      .from("campaigns")
      .insert({
        client_id: dados.clienteId,
        nome: dados.nome,
        descricao: dados.descricao || null,
        data_inicio: dados.dataInicio,
        data_fim: dados.dataFim,
        template_id: dados.templateId ?? null,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error) return falha(error.message);
    if (!criada) {
      return falha(
        "O banco recusou a criação. Normalmente é o RLS: abrir campanha é da equipe interna.",
      );
    }

    if (dados.templateId) {
      const erro = await materializar(
        criada.id,
        dados.templateId,
        dados.quantidades ?? {},
      );
      if (erro) return falha(erro);
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso("Campanha criada.");
  });
}

/**
 * Transforma a árvore do template em linhas de `deliverables`.
 *
 * A campanha JÁ EXISTE quando isto roda, e se a estrutura falhar no meio ela
 * fica lá com o que deu certo. É diferente da criação de usuário, que tem
 * rollback: lá o cadastro pela metade ocupa um e-mail e ninguém entende por
 * quê; aqui a campanha é uma linha visível, com nome e período, e a equipe
 * acrescenta o que faltar pela própria tela. Apagá-la perderia mais.
 */
async function materializar(
  campanhaId: string,
  templateId: string,
  quantidades: Record<string, number>,
): Promise<string | null> {
  const supabase = await criarClienteServidor();

  const { data: template } = await supabase
    .from("campaign_templates")
    .select("estrutura_json")
    .eq("id", templateId)
    .maybeSingle();

  if (!template) return "O modelo escolhido não foi encontrado.";

  const estrutura = template.estrutura_json as EstruturaDeTemplate;

  // A quantidade que a pessoa digitou ganha da sugestão do modelo: o número do
  // Feed/Storys muda todo mês, e é por isso que o modelo o deixa em aberto.
  const comQuantidade: EstruturaDeTemplate = estrutura.map((no) =>
    no.nome in quantidades ? { ...no, quantidade: quantidades[no.nome] } : no,
  );

  const topo = entregaveisDoTemplate(comQuantidade);

  const { data: criados, error } = await supabase
    .from("deliverables")
    .insert(
      topo.map((no, i) => ({
        campaign_id: campanhaId,
        nome: no.nome,
        ordem: i,
      })),
    )
    .select("id, nome");

  if (error) return error.message;
  if (!criados) return "O banco recusou a estrutura da campanha.";

  const porNome = new Map(criados.map((d) => [d.nome, d.id]));

  const filhos = topo.flatMap((no) =>
    no.filhos.map((nome, i) => ({
      campaign_id: campanhaId,
      parent_id: porNome.get(no.nome)!,
      nome,
      ordem: i,
    })),
  );

  if (filhos.length === 0) return null;

  const { error: erroDosFilhos } = await supabase
    .from("deliverables")
    .insert(filhos)
    .select("id");

  return erroDosFilhos ? erroDosFilhos.message : null;
}

/**
 * Manda o entregável ao cliente — abrindo a rodada de escopo cliente.
 *
 * Uma escrita só, e é a rodada. O `enviado_em` e o `status` do entregável saem
 * do trigger, na mesma transação: separá-los daria rodada de cliente num
 * material que ele não enxerga (a fila mostraria uma decisão impossível) e
 * material carimbado sem rodada nenhuma.
 *
 * Quem recusa o resto é `validar_nova_rodada`: aval interno antes do envio,
 * e *"ninguém envia ao cliente a própria entrega"*.
 */
export async function enviarEntregavelAoCliente(
  entregavelId: string,
): Promise<Resultado> {
  return executarAcao("enviarEntregavelAoCliente", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const conteudo = doEntregavel(entregavelId);

    // A numeração continua de onde a anterior parou. Rodada fechada nunca é
    // reescrita nem apagada — cada ciclo de ajuste cria uma nova, com número
    // maior, e as anteriores ficam com o que foi pedido e decidido.
    const { data: anteriores } = await supabase
      .from("approval_rounds")
      .select("numero_rodada")
      .eq("content_type", conteudo.tipo)
      .eq("content_id", conteudo.id)
      .order("numero_rodada", { ascending: false })
      .limit(1);

    const numero = (anteriores?.[0]?.numero_rodada ?? 0) + 1;

    const { data, error } = await supabase
      .from("approval_rounds")
      .insert({
        ...colunasDoConteudo(conteudo),
        numero_rodada: numero,
        escopo: "cliente",
        solicitado_por: sessao.usuarioId,
      })
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O banco recusou o envio deste material.");
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso("Enviado ao cliente.");
  });
}
