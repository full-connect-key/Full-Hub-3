"use server";

import { exigirEquipeNaAcao } from "@/lib/acoes/guardas";
import { ErroDeAcao, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { ehGestor } from "@/lib/auth/roles";
import { mapaDeFeriados } from "@/components/shared/aviso-de-feriado";
import { driveConfigurado } from "@/lib/drive/config";
import { listarClientes } from "@/lib/dados/clientes";
import { vertentesDoCliente } from "@/lib/dados/vertentes";
import type { Vertente } from "@/lib/dominio/vertentes";
import type { EtapaQueMultiplica } from "@/lib/dominio/workflows";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { feriadosDeClientes } from "@/lib/dados/calendario";
import { feriadosComNome } from "@/lib/dados/full-days";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { listarWorkflows } from "@/lib/dados/workflows";
import { obterTask, urlsDosArquivos, type TaskCompleta } from "@/lib/dados/tasks";
import { hojeNaAgencia } from "@/lib/dominio/datas";

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
  /**
   * Os workflows da conta, com as etapas que entregam mais de uma peça
   * (migration 0140): é por `multiplicam` que o seletor sabe se tem o que
   * perguntar antes de aplicar.
   */
  tipos: { id: string; nome: string; multiplicam: EtapaQueMultiplica[] }[];
  /** As vertentes da conta desta demanda (0118) — todas, inclusive as inativas. */
  vertentes: Vertente[];
  /**
   * OS FERIADOS, para o modal da etapa avisar quando a data escolhida cai num.
   *
   * ELE VEM DAQUI E NÃO DA TELA porque este painel abre a DEMANDA inteira, e a
   * etapa de dentro dele abre o MESMO modal da tela de detalhe — é decisão
   * escrita: *"ela abre por cima, inclusive do painel de Minhas Tasks"*. Sem
   * isto, o aviso existiria num caminho e faltaria no outro, que é o pior dos
   * dois: quem datasse por aqui concluiria que o produto não avisa.
   */
  feriados: Record<string, string>;
  /**
   * O FERIADO DA CONTA DESTA DEMANDA, já recortado.
   *
   * Ele é outro fato que o de cima: o nacional fecha a agência, e este diz que
   * a CONTA não responde — a agência trabalha. São dois mapas e não um porque
   * a frase é diferente, e `AvisoDeFeriado` escreve a de cada um.
   *
   * O RECORTE ACONTECE AQUI e não no componente: esta action já sabe de que
   * conta é a demanda, e `feriadosDeClientes()` devolve por conta justamente
   * para a abertura do mês de social, que escolhe o cliente na tela.
   */
  feriadosDoCliente?: Record<string, string>;
  urls: Record<string, string>;
  usuarioId: string;
  /** Atendimento ou gestão: mexe na demanda e nas etapas. */
  podeGerenciar: boolean;
  /** Desenvolvedor ou sócio: decide aprovação e exclui a demanda. */
  souGestor: boolean;
  /**
   * A integração com o Drive está configurada?
   *
   * Vem daqui, e não de `lib/drive/config.ts` direto: aquele arquivo é
   * `server-only` — tem a chave privada dentro —, e o painel é um componente
   * de cliente. É a mesma fronteira de sempre.
   */
  driveLigado: boolean;
  /**
   * O instante do SERVIDOR, para o cronômetro das subtarefas começar de lá.
   * Não é o `Date.now()` do navegador de propósito: o relógio que mede é o do
   * Postgres, e um navegador adiantado mostraria a etapa com mais tempo do
   * que ela tem.
   */
  agora: number;
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

    // A JANELA É LARGA de propósito, e é a mesma da tela de detalhe: o campo
    // de data aceita qualquer coisa digitada, então um aviso que só conhece o
    // futuro fica calado justamente quando alguém erra o ano.
    const anoCorrente = Number(hojeNaAgencia().slice(0, 4));

    const inicioDaJanela = `${anoCorrente - 1}-01-01`;
    const fimDaJanela = `${anoCorrente + 3}-12-31`;

    const [clientes, equipe, tipos, ehDoAtendimento, vertentes, feriados, feriadosPorConta] =
      await Promise.all([
        listarClientes(),
        listarEquipeAtiva(),
        listarWorkflows(task.client_id),
        souDoAtendimento(),
        vertentesDoCliente(task.client_id),
        feriadosComNome(inicioDaJanela, fimDaJanela),
        // A MESMA JANELA dos nacionais, pela mesma razão: o campo aceita o que
        // for digitado, e um aviso que só conhece o futuro fica calado
        // justamente quando alguém erra o ano.
        feriadosDeClientes(inicioDaJanela, fimDaJanela),
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
      tipos: tipos.map((t) => ({
        id: t.id,
        nome: t.nome,
        multiplicam: t.workflow?.multiplicam ?? [],
      })),
      vertentes,
      feriados: mapaDeFeriados(feriados),
      feriadosDoCliente: task.client_id
        ? mapaDeFeriados(feriadosPorConta[task.client_id] ?? [])
        : undefined,
      urls,
      usuarioId: sessao.usuarioId,
      podeGerenciar: ehDoAtendimento || gestor,
      souGestor: gestor,
      driveLigado: driveConfigurado(),
      agora: Date.now(),
    });
  });
}
