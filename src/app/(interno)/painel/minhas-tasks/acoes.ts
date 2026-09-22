"use server";

import { exigirEquipeNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { listarTiposDeTarefa } from "@/lib/dados/workflows";
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
  equipe: { id: string; nome: string; avatar_url: string | null }[];
  tipos: { id: string; nome: string }[];
  urls: Record<string, string>;
  usuarioId: string;
  /** Atendimento ou gestão: mexe na demanda e nas etapas. */
  podeGerenciar: boolean;
  /** Desenvolvedor ou sócio: decide aprovação e exclui a demanda. */
  souGestor: boolean;
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

    const [clientes, equipe, tipos, ehDoAtendimento] = await Promise.all([
      listarClientes(),
      listarEquipeAtiva(),
      listarTiposDeTarefa(task.client_id),
      souDoAtendimento(),
    ]);

    const urls = await urlsDosArquivos(
      task.referencias.filter((r) => r.tipo === "arquivo").map((r) => r.url),
    );

    // Espelha o RLS, para a tela não oferecer controle que o banco vai negar.
    // Mexer na Task é do Atendimento e da gestão; trabalhar na subtarefa é de
    // quem é responsável por ela, e isso o componente de ações resolve linha a
    // linha. Ver é aberto para toda a equipe.
    const gestor = ehGestor(sessao.profile.role);

    return sucesso("Detalhe carregado.", {
      task,
      clientes: clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa })),
      equipe: equipe.map((p) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url })),
      tipos: tipos.map((t) => ({ id: t.id, nome: t.nome })),
      urls,
      usuarioId: sessao.usuarioId,
      podeGerenciar: ehDoAtendimento || gestor,
      souGestor: gestor,
    });
  });
}
