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
 * primeira etapa pelo board, quem leu o playbook pelo Acervo já riscou o
 * item sem passar por aqui.
 *
 * É a decisão de "atraso não é coluna" aplicada a uma lista de boas-vindas.
 *
 * **E DESDE A 0131 A DERIVAÇÃO DEIXOU DE SER A ÚNICA PORTA.** Decisão do
 * usuário: *"quero que o tutorial seja possível ticar os itens, caso a pessoa
 * já saiba como fazer, sem precisar fazer o tutorial necessariamente"*. O
 * parágrafo acima continua inteiro — o que ele não previu é a consequência:
 * sendo a derivação o único caminho, o único jeito de fechar um item é FAZER a
 * coisa, e quem já conhece a plataforma fica com o bloco aberto para sempre.
 * O bloco só se esconde com `pendentes === 0`, e o item que ela não vai fazer
 * nunca chega lá.
 *
 * **A conta passa a ser `derivado OR dispensado`**, e é esta forma que mantém
 * a derivação de pé: **ticar só FECHA um item, nunca reabre o que o estado já
 * fechou.** Quem já subiu a foto tem o item fechado pelo FATO, e destique
 * nenhum faz a foto desaparecer — então `derivado` viaja ao lado de `feito`,
 * e é ele que diz se existe caixa para marcar.
 *
 * É a assimetria de `status_manual` (0025) vista de outro ângulo: lá o manual
 * TRAVA o recálculo inteiro, porque o status de uma demanda é uma escolha que
 * o cálculo não adivinha. Aqui não há o que travar — os dois lados dizem
 * "feito" —, e `OR` é a forma mais fraca e mais honesta: ela não tem como
 * mentir sobre um fato.
 *
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
  /**
   * O ESTADO REAL diz que aconteceu. Aqui não há caixa nenhuma: o fato não se
   * destica, e oferecer uma caixa que não pode ser desmarcada é um controle
   * que não responde ao clique.
   */
  derivado: boolean;
  /** Fechado — pelo fato OU pela dispensa. É ele que o cabeçalho conta. */
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

  const [tour, ficha, obrigatorios, etapas, periodos, dispensas] = await Promise.all([
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
    // AS DISPENSAS (0131): os itens que a pessoa marcou como "já sei fazer".
    // Sem `eq("user_id", eu)`, e a ausência é deliberada: a policy de SELECT
    // fecha em `auth.uid()` nas quatro operações, e repetir o filtro criaria
    // um segundo lugar onde a regra pode divergir — é a decisão escrita do
    // Portal, onde a consulta não repete o recorte por empresa.
    supabase.from("primeiros_passos_dispensados").select("chave"),
  ]);

  // NENHUMA DAS CINCO USA `ouFalha()`, e é a decisão de `rotinasAgendadas()`:
  // esta lista é um bloco de boas-vindas, e derrubar a tela Início por causa
  // dela seria trocar uma ausência por uma falha total. O lado seguro do erro
  // é "ainda falta": no pior caso a pessoa vê um item que ela já fez, o que se
  // resolve clicando — o contrário esconderia a pendência de quem precisa dela.
  for (const r of [tour, ficha, obrigatorios, etapas, periodos, dispensas]) {
    if (r.error) console.error("[consulta:primeiros passos]", r.error);
  }

  const tourFeito = (tour.data ?? []).some((l) => l.status === "concluido");
  const admissao = ficha.data?.[0]?.data_admissao ?? sessao.profile.created_at;

  const pendentesDoAcervo = (obrigatorios.data ?? []).filter(
    (i) => i.estado !== "concluido",
  ).length;

  // O LADO SEGURO DO ERRO AQUI É "ainda falta", como nas outras cinco: uma
  // leitura de dispensas que falhou devolve o conjunto vazio, e no pior caso a
  // pessoa vê um item que ela já dispensou — que se resolve com um clique. O
  // contrário fecharia um item que ninguém fechou.
  const dispensado = new Set((dispensas.data ?? []).map((d) => d.chave));

  // `derivado OR dispensado` NUM LUGAR SÓ: escrever o `||` em cada item
  // seriam cinco lugares para alguém esquecer o segundo lado, e o item
  // esquecido continuaria sem como ser ticado — sem erro em lugar nenhum.
  const passo = (
    p: Omit<PrimeiroPasso, "feito"> & { derivado: boolean },
  ): PrimeiroPasso => ({ ...p, feito: p.derivado || dispensado.has(p.chave) });

  const itens: PrimeiroPasso[] = [
    passo({
      chave: "tour",
      titulo: "Fazer o tour do painel",
      // SEM `href`, e é o único: o caminho de volta para o tour é o `?` da
      // topbar, e um link que levasse a uma rota qualquer não começaria tour
      // nenhum. Quem o desenha escreve o botão.
      href: null,
      // DISPENSAR ESTE ITEM NÃO ESCREVE EM `tour_progresso`, e é a linha de
      // segurança da 0131: `pulado` quer dizer "abriu o tour e saiu", e um
      // tique numa lista de boas-vindas não é isso. O acompanhamento da
      // gestão continua medindo o tour — quem concluiu, em que passo
      // desistiu —, e escrever daqui poria lá linhas de gente que nunca
      // abriu o tour.
      derivado: tourFeito,
    }),
    passo({
      chave: "foto",
      titulo: "Colocar sua foto de perfil",
      href: "/painel/perfil",
      derivado: Boolean(sessao.profile.avatar_url),
    }),
    passo({
      chave: "playbooks",
      titulo: "Ler os playbooks obrigatórios da sua função",
      href: "/painel/academy",
      // ZERO OBRIGATÓRIOS CONTA COMO FEITO, e não como pendência eterna: a
      // função pode não ter nenhum, e um item que não tem como fechar é o
      // mesmo problema do módulo que saiu do produto.
      //
      // E DISPENSAR ESTE NÃO MARCA NADA COMO LIDO: `academy_progresso` fica
      // como está, `academy_obrigatorios_de()` continua respondendo que
      // falta, e o acompanhamento do Acervo continua dizendo a verdade. O que
      // o tique tira é a linha de uma lista de boas-vindas; a obrigação mora
      // onde sempre morou. *É o item dos cinco em que isso mais pesa, e fica
      // dito em vez de escondido:* se a agência preferir que o playbook
      // obrigatório não seja dispensável, é tirar `"playbooks"` do conjunto
      // de `dispensado` acima — uma linha.
      derivado: pendentesDoAcervo === 0,
    }),
    passo({
      chave: "etapa",
      titulo: "Concluir sua primeira etapa",
      href: "/painel/minhas-tasks",
      derivado: (etapas.count ?? 0) > 0,
    }),
    passo({
      chave: "full-day",
      titulo: "Propor seu primeiro período no Day Off",
      href: "/painel/full-days?aba=solicitar",
      derivado: (periodos.count ?? 0) > 0,
    }),
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
