import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { feriadosDeClientes } from "@/lib/dados/calendario";
import { feriadosComNome } from "@/lib/dados/full-days";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { fluxosDeSocial } from "@/lib/dados/social-flows";
import { driveConfigurado } from "@/lib/drive/config";
import { mapaDeFeriados } from "@/components/shared/aviso-de-feriado";
import { hojeNaAgencia } from "@/lib/dominio/datas";

import { AbrirOMes } from "../abrir-o-mes";

export const metadata: Metadata = { title: "Abrir o mês de social" };

/**
 * A TELA DE ABRIR O MÊS — e ela era um DIÁLOGO até aqui.
 *
 * Decisão do usuário: *"quando vou abrir uma task do social, gostaria que a
 * visualização de abertura seja igual a do rascunho de quando vou abrir uma
 * task comum, mas com todas as informações que ele já me pede para preencher
 * atualmente"*.
 *
 * **ELA NÃO É A TELA DE RASCUNHO, e a diferença é mecânica.** O rascunho de
 * demanda existe desde a 0028 porque subtarefa, referência e comentário
 * precisam de um `task_id` para serem gravados — a linha nasce no clique e tudo
 * salva sozinho. Aqui nada pode nascer antes: `abrir_mes_de_social()` é UMA
 * transação que cria a demanda, os N posts, as fases e as noventa caixinhas, e
 * um rascunho de mês seria uma demanda de social pela metade no board da
 * agência. O que esta tela copia do rascunho é a COMPOSIÇÃO — a página inteira,
 * o título grande, as seções numeradas —, e o botão do fim continua sendo o que
 * grava.
 *
 * **A ROTA NÃO TEM ENTRADA PRÓPRIA NO `MENU`, e não precisa:** `findMenuItem`
 * casa por prefixo, então `/painel/social-media/abrir` resolve pela entrada de
 * `/painel/social-media` — a mesma decisão das fichas de
 * `/painel/pessoas/clientes/[id]`.
 */
async function Conteudo() {
  await exigirAcessoARota("/painel/social-media");

  /**
   * QUEM ABRE O MÊS É O ATENDIMENTO, e a guarda da rota faz a MESMA pergunta
   * que a da action.
   *
   * `abrir_mes_de_social()` é de `is_atendimento()` desde a 0046 — "o
   * Atendimento abre o mês", decisão do usuário —, e `abrirMesDeSocial` passou
   * a `exigirAtendimentoNaAcao` quando a 0059 encontrou a divergência. Pedir
   * `ehGestor` aqui seria recriá-la um andar acima, e no pior lugar: a pessoa
   * do Atendimento leria 403 numa tela que o produto diz que é dela.
   *
   * **E ela pergunta ao BANCO, por `souDoAtendimento()`.** Perfil de acesso e
   * função na agência são coisas diferentes, e quem responde é `is_atendimento()`
   * — a mesma função que a policy usa. Repetir a consulta aqui seria o segundo
   * lugar onde a regra pode divergir.
   */
  if (!(await souDoAtendimento())) forbidden();

  // A JANELA DOS FERIADOS É LARGA, e é a mesma das outras telas que avisam: o
  // campo de data aceita qualquer coisa digitada, então um aviso que só
  // conhece o futuro fica calado justamente quando alguém erra o ano. E ela
  // precisa cobrir o PASSADO porque a corrente de um mês nasce ANTES dele —
  // o mês que vem se produz nos trinta dias que o antecedem (0089).
  const anoCorrente = Number(hojeNaAgencia().slice(0, 4));

  const inicioDaJanela = `${anoCorrente - 1}-01-01`;
  const fimDaJanela = `${anoCorrente + 3}-12-31`;

  const [clientes, equipe, fluxos, feriados, feriadosPorConta] = await Promise.all([
    listarClientes(),
    listarEquipeAtiva(),
    // SÓ OS ATIVOS: a tela oferece o que dá para aplicar, e um fluxo
    // desativado é um que a agência tirou do ar sem apagar — oferecê-lo
    // abriria um mês com a corrente que ela aposentou.
    fluxosDeSocial({ apenasAtivos: true }),
    feriadosComNome(inicioDaJanela, fimDaJanela),
    // O FERIADO DE CADA CONTA vem INTEIRO, e não recortado: a conta é
    // escolhida na tela, e uma leitura por troca de cliente seria uma volta ao
    // servidor no meio do preenchimento. Quem recorta é o componente.
    feriadosDeClientes(inicioDaJanela, fimDaJanela),
  ]);

  return (
    <AbrirOMes
      clientes={clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
      fluxos={fluxos}
      feriados={mapaDeFeriados(feriados)}
      feriadosPorConta={feriadosPorConta}
      driveLigado={driveConfigurado()}
    />
  );
}

export default function PaginaDeAbrirOMes() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Conteudo />
    </Suspense>
  );
}
