"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao, exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
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
      throw new ErroDeAcao(recusaDeValidacao("salvarCliente", validacao.error, dados, "Confira os dados informados."));
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

    revalidatePath("/painel/pessoas");
    if (id) revalidatePath(`/painel/pessoas/clientes/${id}`);

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

    revalidatePath("/painel/pessoas");
    revalidatePath(`/painel/pessoas/clientes/${id}`);

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

    revalidatePath("/painel/pessoas");
    return sucesso(`${cliente.nome_empresa} foi excluída.`);
  });
}

/**
 * A capa e a foto de perfil do portal daquele cliente (0063).
 *
 * ---------------------------------------------------------------------------
 * **UMA AÇÃO PARA AS DUAS, e o campo é parâmetro.**
 *
 * São a mesma decisão — trocar uma imagem de identidade do portal — e as duas
 * gravam uma coluna de `clients` pela mesma policy. Duas actions gêmeas
 * divergiriam na primeira mudança, e a divergência apareceria no lugar em que
 * ninguém olha: a capa aceitando um caminho que a foto recusa.
 *
 * O `z.enum` é o que impede o parâmetro de virar buraco: sem ele, `campo`
 * seria o nome de qualquer coluna de `clients` vindo do navegador.
 * ---------------------------------------------------------------------------
 *
 * **`null` TIRA A IMAGEM E NÃO APAGA O ARQUIVO**, como a capa da campanha
 * (0050): o objeto continua no bucket. Apagar não é desfazer — quem tirou a
 * capa errada não tem como pô-la de volta, e o custo de um arquivo parado é
 * menor que o de uma imagem perdida.
 */
const esquemaDaIdentidade = z.object({
  id: z.string().uuid(),
  campo: z.enum(["capa_url", "logo_url"]),
  caminho: z.string().max(400).nullable(),
});

const NOME_DO_CAMPO: Record<"capa_url" | "logo_url", string> = {
  capa_url: "capa",
  logo_url: "foto de perfil",
};

export async function trocarIdentidadeDoPortal(dados: unknown): Promise<Resultado> {
  return executarAcao("trocarIdentidadeDoPortal", async () => {
    await exigirGestorNaAcao();

    const lido = esquemaDaIdentidade.safeParse(dados);
    if (!lido.success) {
      throw new ErroDeAcao(
        recusaDeValidacao(
          "trocarIdentidadeDoPortal",
          lido.error,
          dados,
          "Confira a imagem.",
          { id: "cliente", campo: "imagem", caminho: "arquivo" },
        ),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("clients")
      // O OBJETO É MONTADO EXPLICITAMENTE, e não por chave computada: com
      // `{ [campo]: valor }` o TypeScript perde o nome da coluna e o `Update`
      // de `clients` deixa de conferir nada — o `z.enum` acima passaria a ser
      // a única coisa entre o navegador e um `update` de coluna arbitrária.
      .update(
        lido.data.campo === "capa_url"
          ? { capa_url: lido.data.caminho }
          : { logo_url: lido.data.caminho },
      )
      .eq("id", lido.data.id)
      .select("id");

    if (error) throw new ErroDeAcao(error.message);
    // `.select()` porque uma escrita barrada pelo RLS volta sem erro e sem
    // linha: sem isto a tela diria "capa trocada" e a imagem continuaria a
    // mesma depois do refresh.
    if (!data || data.length === 0) {
      throw new ErroDeAcao(
        "O banco recusou. Trocar a identidade do portal é do desenvolvedor ou do sócio.",
      );
    }

    revalidatePath(`/painel/pessoas/clientes/${lido.data.id}`);
    revalidatePath("/portal");
    return sucesso(
      lido.data.caminho
        ? `A ${NOME_DO_CAMPO[lido.data.campo]} do portal foi trocada.`
        : `A ${NOME_DO_CAMPO[lido.data.campo]} foi tirada do portal.`,
    );
  });
}
