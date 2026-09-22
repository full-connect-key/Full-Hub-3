"use server";

import { exigirEquipeNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { obterTask, urlsDosArquivos, type TaskCompleta } from "@/lib/dados/tasks";

/**
 * O que o painel lateral precisa para desenhar o detalhe de uma task.
 *
 * Vem por Server Action, e não junto da lista, porque a lista pode ter
 * dezenas de tasks e o detalhe traz briefing, comentários e URLs assinadas de
 * arquivo. Carregar tudo de antemão deixaria a tela pesada para mostrar o que
 * quase nunca é aberto.
 */
export type DetalheParaOPainel = {
  task: TaskCompleta;
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
  urls: Record<string, string>;
  usuarioId: string;
  /** Status, prioridade, subtarefas, comentários, tempo real. */
  podeEditar: boolean;
  /** Cliente, responsável e prazo da task-mãe. */
  podeGerenciar: boolean;
  podeModerar: boolean;
};

export async function carregarDetalheDaTask(
  taskId: unknown,
): Promise<Resultado<DetalheParaOPainel>> {
  return executarAcao("carregarDetalheDaTask", async () => {
    const sessao = await exigirEquipeNaAcao();

    if (typeof taskId !== "string" || taskId.length === 0) {
      throw new ErroDeAcao("Task inválida.");
    }

    const task = await obterTask(taskId);
    if (!task) throw new ErroDeAcao("Task não encontrada, ou seu perfil não alcança ela.");

    const [clientes, equipe] = await Promise.all([listarClientes(), listarEquipeAtiva()]);

    const urls = await urlsDosArquivos(
      task.referencias.filter((r) => r.tipo === "arquivo").map((r) => r.url),
    );

    // Espelha o RLS, para a tela não oferecer controle que o banco vai negar.
    // Quem gerencia é a gestão; quem executa mexe no próprio andamento.
    const gestor = ehGestor(sessao.profile.role);
    const souResponsavel = task.responsavel_id === sessao.usuarioId;

    return sucesso("Detalhe carregado.", {
      task,
      clientes: clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa })),
      equipe,
      urls,
      usuarioId: sessao.usuarioId,
      podeEditar: gestor || souResponsavel,
      podeGerenciar: gestor,
      podeModerar: gestor,
    });
  });
}
