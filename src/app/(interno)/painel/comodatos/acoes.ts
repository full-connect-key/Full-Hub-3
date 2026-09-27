"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao, exigirGestorNaAcao, exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { ESTADOS, TIPOS_DE_ASSET } from "@/lib/dominio/comodatos";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O que se faz com um comodato.
 *
 * ---------------------------------------------------------------------------
 * **A GESTÃO EMPRESTA E DEVOLVE; O COLABORADOR CONFIRMA E RELATA.**
 *
 * As duas ações dele passam por função do Postgres e não por um `update`
 * daqui, e é o que torna a policy simples: sem UPDATE para ele em
 * `asset_loans`, não existe coluna a proteger por trigger. Uma porta estreita
 * dispensa o porteiro.
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma destas escreve o status do equipamento.** Quem o escreve é o
 * trigger do empréstimo (0069) — duas mãos na mesma verdade divergem no
 * primeiro caminho que esquecer uma delas.
 */

const ROTA = "/painel/comodatos";

const ROTULOS = {
  tipo: "tipo",
  nome: "nome do equipamento",
  asset_id: "equipamento",
  user_id: "pessoa",
  data_entrega: "data de entrega",
  data_devolucao: "data de devolução",
  estado_devolucao: "estado na devolução",
  motivo: "motivo",
  corpo: "texto do termo",
  texto: "o que aconteceu",
};

const esquemaDoEquipamento = z.object({
  id: z.string().uuid().nullable().optional(),
  tipo: z.enum(TIPOS_DE_ASSET),
  nome: z.string().trim().min(2, "Informe o nome do equipamento."),
  codigo: z.string().trim().optional(),
  marca: z.string().trim().optional(),
  modelo: z.string().trim().optional(),
  numero_serie: z.string().trim().optional(),
  estado: z.enum(ESTADOS),
  data_aquisicao: z.string().trim().optional(),
  valor_aquisicao: z.number().nonnegative().nullable().optional(),
  nota_fiscal_url: z.string().trim().optional(),
  foto_url: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
  // A FICHA TÉCNICA (0070). Todos opcionais: ela é a exceção e não a regra —
  // a maior parte do inventário é tripé, lente e cabo.
  memoria_ram: z.string().trim().optional(),
  processador: z.string().trim().optional(),
  placa_de_video: z.string().trim().optional(),
  armazenamento: z.string().trim().optional(),
});

/** Em branco vira null, e não string vazia: `''` num campo opcional é um valor
 *  que a tela mostra como preenchido e a busca nunca acha. */
const ouNulo = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

export async function salvarEquipamento(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarEquipamento", async () => {
    const sessao = await exigirGestorNaAcao();

    const v = esquemaDoEquipamento.safeParse(dados);
    if (!v.success) return falha(recusaDeValidacao("salvarEquipamento", v.error, dados, "Confira os campos.", ROTULOS));

    const { id, ...campos } = v.data;
    const supabase = await criarClienteServidor();

    const linha = {
      tipo: campos.tipo,
      nome: campos.nome,
      // O CÓDIGO EM BRANCO VIRA NULL e o trigger gera o FCK-0000. Mandar `''`
      // gravaria um código vazio que passa no `unique` uma vez só — e o
      // segundo equipamento sem código seria recusado por uma trava que não
      // tem nada a ver com o que a pessoa fez.
      codigo: ouNulo(campos.codigo),
      marca: ouNulo(campos.marca),
      modelo: ouNulo(campos.modelo),
      numero_serie: ouNulo(campos.numero_serie),
      estado: campos.estado,
      data_aquisicao: ouNulo(campos.data_aquisicao),
      valor_aquisicao: campos.valor_aquisicao ?? null,
      nota_fiscal_url: ouNulo(campos.nota_fiscal_url),
      foto_url: ouNulo(campos.foto_url),
      observacoes: ouNulo(campos.observacoes),
      memoria_ram: ouNulo(campos.memoria_ram),
      processador: ouNulo(campos.processador),
      placa_de_video: ouNulo(campos.placa_de_video),
      armazenamento: ouNulo(campos.armazenamento),
    };

    const resposta = id
      ? await supabase.from("assets").update(linha).eq("id", id).select("id")
      : await supabase
          .from("assets")
          .insert({ ...linha, criado_por: sessao.usuarioId })
          .select("id");

    if (resposta.error) return falha(`Não foi possível salvar: ${resposta.error.message}`);
    // ESCRITA QUE O RLS PODE BARRAR TERMINA COM `.select()`: sem linha de
    // volta é recusa, e sem esta checagem a tela diria "salvo" à toa.
    if (!resposta.data || resposta.data.length === 0) {
      return falha("O banco não aceitou a escrita. Seu perfil permite isto?");
    }

    revalidatePath(ROTA);
    return sucesso(id ? "Equipamento atualizado." : "Equipamento cadastrado.");
  });
}

const esquemaDaBaixa = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(3, "Diga por que ele saiu do inventário."),
});

/**
 * Dar baixa, e não apagar.
 *
 * Apagar levaria a folha corrida do equipamento junto, e ela é o que responde
 * "onde foi parar" — que é a pergunta que se faz justamente sobre o que sumiu.
 * O banco recusa o DELETE: não existe policy para ele.
 */
export async function darBaixa(dados: unknown): Promise<Resultado> {
  return executarAcao("darBaixa", async () => {
    await exigirGestorNaAcao();

    const v = esquemaDaBaixa.safeParse(dados);
    if (!v.success) return falha(recusaDeValidacao("darBaixa", v.error, dados, "Confira os campos.", ROTULOS));

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("assets")
      .update({ status: "baixado", motivo_baixa: v.data.motivo })
      .eq("id", v.data.id)
      .select("id");

    if (error) return falha(`Não foi possível: ${error.message}`);
    if (!data || data.length === 0) return falha("O banco não aceitou a baixa.");

    revalidatePath(ROTA);
    return sucesso("Equipamento baixado.");
  });
}

const esquemaDoDestino = z.object({
  id: z.string().uuid(),
  status: z.enum(["manutencao", "disponivel"]),
  observacoes: z.string().trim().optional(),
});

/** Mandar para manutenção, e trazer de volta quando consertar. */
export async function mudarSituacao(dados: unknown): Promise<Resultado> {
  return executarAcao("mudarSituacao", async () => {
    await exigirGestorNaAcao();

    const v = esquemaDoDestino.safeParse(dados);
    if (!v.success) return falha(recusaDeValidacao("mudarSituacao", v.error, dados, "Confira os campos.", ROTULOS));

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("assets")
      .update({ status: v.data.status, observacoes: ouNulo(v.data.observacoes) })
      .eq("id", v.data.id)
      // EMPRESTADO NÃO SE MEXE POR AQUI: o equipamento está com alguém, e
      // mandá-lo para manutenção sem devolver deixaria a folha dizendo que ele
      // está em duas situações ao mesmo tempo.
      .in("status", ["disponivel", "manutencao"])
      .select("id");

    if (error) return falha(`Não foi possível: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Este equipamento está emprestado — registre a devolução antes.");
    }

    revalidatePath(ROTA);
    return sucesso(
      v.data.status === "manutencao" ? "Foi para manutenção." : "Voltou para o inventário.",
    );
  });
}

const esquemaDoEmprestimo = z.object({
  asset_id: z.string().uuid(),
  user_id: z.string().uuid(),
  data_entrega: z.string().min(10, "Informe a data de entrega."),
  data_prevista_devolucao: z.string().trim().optional(),
  estado_entrega: z.enum(ESTADOS),
  acessorios: z.string().trim().optional(),
  observacoes_entrega: z.string().trim().optional(),
});

/**
 * Emprestar.
 *
 * **A recusa de "já está com outra pessoa" vem do BANCO**, pelo índice único
 * parcial — e a mensagem aqui traduz o erro dele em vez de repetir a checagem:
 * uma consulta antes do insert passaria pelas duas abas antes de qualquer uma
 * gravar, que é a decisão da 0040.
 */
export async function emprestarEquipamento(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("emprestarEquipamento", async () => {
    const sessao = await exigirGestorNaAcao();

    const v = esquemaDoEmprestimo.safeParse(dados);
    if (!v.success) {
      return falha(recusaDeValidacao("emprestarEquipamento", v.error, dados, "Confira os campos.", ROTULOS));
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("asset_loans")
      .insert({
        asset_id: v.data.asset_id,
        user_id: v.data.user_id,
        data_entrega: v.data.data_entrega,
        data_prevista_devolucao: ouNulo(v.data.data_prevista_devolucao),
        estado_entrega: v.data.estado_entrega,
        acessorios: ouNulo(v.data.acessorios),
        observacoes_entrega: ouNulo(v.data.observacoes_entrega),
        entregue_por: sessao.usuarioId,
      })
      .select("id");

    if (error) {
      if (error.code === "23505") {
        return falha("Este equipamento já está com outra pessoa. Registre a devolução antes.");
      }
      return falha(`Não foi possível emprestar: ${error.message}`);
    }
    if (!data || data.length === 0) return falha("O banco não aceitou o empréstimo.");

    revalidatePath(ROTA);
    revalidatePath("/painel");
    return sucesso("Entregue. A pessoa foi avisada para confirmar o recebimento.", data[0].id);
  });
}

const esquemaDaDevolucao = z.object({
  loan_id: z.string().uuid(),
  data_devolucao: z.string().min(10, "Informe a data de devolução."),
  estado_devolucao: z.enum(ESTADOS),
  observacoes_devolucao: z.string().trim().optional(),
});

export async function devolverEquipamento(dados: unknown): Promise<Resultado> {
  return executarAcao("devolverEquipamento", async () => {
    const sessao = await exigirGestorNaAcao();

    const v = esquemaDaDevolucao.safeParse(dados);
    if (!v.success) {
      return falha(recusaDeValidacao("devolverEquipamento", v.error, dados, "Confira os campos.", ROTULOS));
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("asset_loans")
      .update({
        data_devolucao: v.data.data_devolucao,
        estado_devolucao: v.data.estado_devolucao,
        observacoes_devolucao: ouNulo(v.data.observacoes_devolucao),
        recebido_por: sessao.usuarioId,
      })
      .eq("loan_id" in v.data ? "id" : "id", v.data.loan_id)
      .is("data_devolucao", null)
      .select("id");

    if (error) return falha(`Não foi possível: ${error.message}`);
    if (!data || data.length === 0) return falha("Este comodato já tinha sido devolvido.");

    revalidatePath(ROTA);
    revalidatePath("/painel");
    return sucesso(
      v.data.estado_devolucao === "ruim"
        ? "Devolvido. Como voltou ruim, o equipamento foi para manutenção."
        : "Devolvido, e o equipamento voltou para o inventário.",
    );
  });
}

/** A foto do estado — a prova dos dois lados na hora da discussão. */
export async function registrarFoto(
  loanId: string,
  momento: "entrega" | "devolucao",
  url: string,
): Promise<Resultado> {
  return executarAcao("registrarFoto", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("asset_photos")
      .insert({ loan_id: loanId, momento, url })
      .select("id");

    if (error) return falha(`Não foi possível registrar a foto: ${error.message}`);
    if (!data || data.length === 0) return falha("O banco não aceitou a foto.");

    revalidatePath(ROTA);
    return sucesso("Foto registrada.");
  });
}

// ---------------------------------------------------------------------------
// AS DUAS AÇÕES DE QUEM ESTÁ COM O EQUIPAMENTO
// ---------------------------------------------------------------------------

/**
 * "Recebi."
 *
 * **A guarda daqui é `exigirEquipeNaAcao`, e a de dono é do BANCO.** Repetir
 * aqui a pergunta "este comodato é seu?" criaria a segunda verdade que a 0029
 * ensinou a não criar: quando a regra mora nos dois lados, desfazer um lado
 * não desfaz nada — e quem confere é a função, que roda mesmo para quem montar
 * a chamada à mão.
 */
export async function confirmarRecebimento(loanId: string): Promise<Resultado> {
  return executarAcao("confirmarRecebimento", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { error } = await supabase.rpc("confirmar_recebimento", { p_loan_id: loanId });
    if (error) return falha(error.message);

    revalidatePath(ROTA);
    revalidatePath("/painel");
    return sucesso("Recebimento confirmado.");
  });
}

export async function reportarProblema(loanId: string, texto: string): Promise<Resultado> {
  return executarAcao("reportarProblema", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { error } = await supabase.rpc("reportar_problema_do_comodato", {
      p_loan_id: loanId,
      p_texto: texto,
    });
    if (error) return falha(error.message);

    revalidatePath(ROTA);
    return sucesso("A gestão foi avisada, e o relato ficou no histórico do equipamento.");
  });
}

// ---------------------------------------------------------------------------
// O MODELO DO TERMO
// ---------------------------------------------------------------------------

const esquemaDoModelo = z.object({
  corpo: z.string().trim().min(40, "O termo não pode ser um parágrafo solto."),
});

/**
 * Só o sócio, e a razão é a mesma da fila de notas: este texto é o que a
 * agência afirma por escrito para cada pessoa da equipe.
 *
 * **E mexer nele não muda termo nenhum já entregue** — cada comodato guarda o
 * texto do dia da entrega (`termo_corpo`, 0069), pela decisão de
 * `workflow_snapshot`.
 */
export async function salvarModeloDoTermo(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarModeloDoTermo", async () => {
    const sessao = await exigirSocioNaAcao();

    const v = esquemaDoModelo.safeParse(dados);
    if (!v.success) {
      return falha(recusaDeValidacao("salvarModeloDoTermo", v.error, dados, "Confira o texto.", ROTULOS));
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("asset_term_template")
      .update({
        corpo: v.data.corpo,
        atualizado_por: sessao.usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq("unica", true)
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) return falha("O banco não aceitou a escrita.");

    revalidatePath(`${ROTA}/modelo-termo`);
    return sucesso("Modelo salvo. Os comodatos já entregues continuam com o texto deles.");
  });
}
