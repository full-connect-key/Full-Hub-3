import "server-only";

import { obterSessao } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeNaAgencia } from "@/lib/dominio/datas";
import { TOUR_DO_PAINEL } from "@/lib/tour/passos";

/**
 * PRIMEIROS PASSOS: a lista de quem acabou de entrar.
 *
 * ---------------------------------------------------------------------------
 * **CADA ITEM É DERIVADO DO ESTADO REAL**, e é o pedido explícito do sprint:
 * *"derivar evita o bug clássico — a pessoa faz a coisa por outro caminho e a
 * lista continua dizendo que falta"*. Nenhuma coluna de checklist, nenhum
 * `marcar_como_feito`: quem subiu a foto pelo Meu Perfil, quem concluiu a
 * primeira etapa pelo board, quem leu o playbook pelo Academy já riscou o
 * item sem passar por aqui.
 *
 * É a decisão de "atraso não é coluna" aplicada a uma lista de boas-vindas.
 * ---------------------------------------------------------------------------
 *
 * **SÃO CINCO ITENS E NÃO SEIS**, e o que falta é o da autoavaliação de
 * skills. O módulo que a abrigava SAIU do produto na 0043, com as duas tabelas
 * dele — e o nome dele está na lista de nomes mortos que o `check:cores`
 * varre, que é por que esta frase não o escreve: **a explicação não pode
 * carregar o que ela proíbe**, e a varredura pegou esta mesma frase na
 * primeira rodada. Um item apontando para uma tela que não existe é o pior
 * tipo de pendência: ela não tem como ser resolvida, e a lista nunca fecha. Se
 * a autoavaliação voltar, o item volta com ela.
 *
 * **E O PLAYBOOK NÃO É UM TÍTULO ESCRITO AQUI.** O sprint nomeia *"Primeiros
 * 30 dias na Full"*; uma constante com esse texto teria de casar com uma linha
 * do banco, e no dia em que alguém renomeasse o playbook a pendência ficaria
 * para sempre em aberto — sem erro em lugar nenhum. Quem responde é
 * `academy_obrigatorios_de()`, que já é a fonte da obrigatoriedade por função
 * desde a 0096: o item fecha quando o que é obrigatório PARA ESTA PESSOA está
 * lido.
 */

export type PrimeiroPasso = {
  chave: string;
  titulo: string;
  /** Para onde o item leva. `null` quando ele se resolve no próprio tour. */
  href: string | null;
  feito: boolean;
};

export type PrimeirosPassos = {
  itens: PrimeiroPasso[];
  pendentes: number;
  /** Dentro dos primeiros 14 dias de casa. */
  recemChegada: boolean;
};

const JANELA_EM_DIAS = 14;

export async function meusPrimeirosPassos(): Promise<PrimeirosPassos | null> {
  const sessao = await obterSessao();
  if (!sessao) return null;

  const supabase = await criarClienteServidor();
  const eu = sessao.usuarioId;

  const [tour, ficha, obrigatorios, etapas, periodos] = await Promise.all([
    supabase
      .from("tour_progresso")
      .select("status")
      .eq("user_id", eu)
      .eq("tour_id", TOUR_DO_PAINEL)
      .limit(1),
    supabase.from("team_members").select("data_admissao").eq("user_id", eu).limit(1),
    supabase.rpc("academy_obrigatorios_de", { p_user: eu }),
    // `head: true` COM `count`: a pergunta é "existe alguma?", e trazer as
    // linhas para contar no TypeScript seria carregar o histórico inteiro de
    // alguém para decidir um `true`.
    supabase
      .from("subtasks")
      .select("id", { count: "exact", head: true })
      .eq("responsavel_id", eu)
      .eq("status", "concluida"),
    supabase
      .from("hr_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", eu),
  ]);

  // NENHUMA DAS CINCO USA `ouFalha()`, e é a decisão de `rotinasAgendadas()`:
  // esta lista é um bloco de boas-vindas, e derrubar a tela Início por causa
  // dela seria trocar uma ausência por uma falha total. O lado seguro do erro
  // é "ainda falta": no pior caso a pessoa vê um item que ela já fez, o que se
  // resolve clicando — o contrário esconderia a pendência de quem precisa dela.
  for (const r of [tour, ficha, obrigatorios, etapas, periodos]) {
    if (r.error) console.error("[consulta:primeiros passos]", r.error);
  }

  const tourFeito = (tour.data ?? []).some((l) => l.status === "concluido");
  const admissao = ficha.data?.[0]?.data_admissao ?? sessao.profile.created_at;

  const pendentesDoAcervo = (obrigatorios.data ?? []).filter(
    (i) => i.estado !== "concluido",
  ).length;

  const itens: PrimeiroPasso[] = [
    {
      chave: "tour",
      titulo: "Fazer o tour do painel",
      // SEM `href`, e é o único: o caminho de volta para o tour é o `?` da
      // topbar, e um link que levasse a uma rota qualquer não começaria tour
      // nenhum. Quem o desenha escreve o botão.
      href: null,
      feito: tourFeito,
    },
    {
      chave: "foto",
      titulo: "Colocar sua foto de perfil",
      href: "/painel/perfil",
      feito: Boolean(sessao.profile.avatar_url),
    },
    {
      chave: "playbooks",
      titulo: "Ler os playbooks obrigatórios da sua função",
      href: "/painel/academy",
      // ZERO OBRIGATÓRIOS CONTA COMO FEITO, e não como pendência eterna: a
      // função pode não ter nenhum, e um item que não tem como fechar é o
      // mesmo problema do módulo que saiu do produto.
      feito: pendentesDoAcervo === 0,
    },
    {
      chave: "etapa",
      titulo: "Concluir sua primeira etapa",
      href: "/painel/minhas-tasks",
      feito: (etapas.count ?? 0) > 0,
    },
    {
      chave: "full-day",
      titulo: "Propor seu primeiro período no Full Days",
      href: "/painel/full-days?aba=solicitar",
      feito: (periodos.count ?? 0) > 0,
    },
  ];

  return {
    itens,
    pendentes: itens.filter((i) => !i.feito).length,
    recemChegada: diasDesde(admissao, hojeNaAgencia()) <= JANELA_EM_DIAS,
  };
}

function diasDesde(de: string, ate: string): number {
  const a = Date.parse(`${de.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${ate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}
