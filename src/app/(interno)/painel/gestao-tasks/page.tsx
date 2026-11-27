import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileCheck2, Images } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { filaDeAprovacoes, type FilaDeAprovacoes } from "@/lib/dados/aprovacoes";
import { listarClientes, logosDasContas } from "@/lib/dados/clientes";
import { vertentesDoCliente } from "@/lib/dados/vertentes";
import { pastasPadraoDasContas } from "@/lib/dados/fluxo-do-cliente";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { prazosDeHoje, souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { rotinasAgendadas } from "@/lib/dados/rotinas";
import {
  buscarRecorrencia,
  feriadosParaAPrevia,
  listarRecorrencias,
  modeloDeUmaTask,
} from "@/lib/dados/recorrencias";
import {
  demandasDaAba,
  itensDoCalendario,
  meusRascunhos,
  type FiltrosDeTask,
} from "@/lib/dados/tasks";
import { listarTiposComFluxo } from "@/lib/dados/workflows";
import type { TaskPrioridade, TaskStatus } from "@/lib/supabase/database.types";

import { AbasDeGestaoDeTasks } from "./abas";
import { Fila } from "./aprovacoes-internas/fila";
import { ContadoresDeDemandas } from "./contadores";
import { PainelDeTasks } from "./painel-de-tasks";
import { lerAba, type Aba } from "./vocabulario";
import { EditorDeRecorrencia } from "./workflows/recorrencias/editor";
import { ListaDeRecorrencias } from "./workflows/recorrencias/lista";
import { Workflows } from "./workflows/workflows";
import { hojeNaAgencia } from "@/lib/dominio/datas";

export const metadata: Metadata = { title: "Gestão de Tasks" };

/**
 * O trabalho da agência, numa rota só (decisão do usuário).
 *
 * ---------------------------------------------------------------------------
 * **TRÊS ITENS DO MENU VIRARAM UM, e a razão é a mesma da Gestão de Pessoas.**
 * Demandas, Workflows e Aprovações Internas respondiam à mesma pergunta em
 * três endereços — *o trabalho da agência* —, e quem monta a cadeia é quem
 * distribui a demanda, e quem distribui é quem aprova. A explicação inteira
 * mora em `abas.tsx`, ao lado da barra que ela desenha.
 * ---------------------------------------------------------------------------
 *
 * **E as três rotas antigas continuam funcionando**, por 308 em
 * `ROTAS_RENOMEADAS`. Não é gentileza com quem tem link salvo: as
 * notificações do sino gravam o endereço DENTRO da linha, e as que o Postgres
 * escreveu em `/painel/aprovacoes-internas` estão no banco de produção desde a
 * 0064. Reescrever o corpo daquelas funções seria uma migration cujo único
 * efeito é trocar um texto que o redirect já resolve — a mesma decisão dos
 * comentários datados da 0028 e da 0031.
 */
/** Traduz os parâmetros da URL nos filtros que a consulta entende. */
function filtrosDaUrl(params: Record<string, string | string[] | undefined>): FiltrosDeTask {
  const texto = (chave: string) => {
    const valor = params[chave];
    return typeof valor === "string" && valor.length > 0 ? valor : undefined;
  };

  return {
    cliente: texto("cliente"),
    vertente: texto("vertente"),
    tipo: texto("tipo"),
    responsavel: texto("responsavel"),
    prioridade: texto("prioridade") as TaskPrioridade | undefined,
    status: texto("status") as TaskStatus | undefined,
    de: texto("de"),
    ate: texto("ate"),
    soAtrasadas: params.atrasadas === "1",
  };
}

async function clientesAtivos() {
  const clientes = await listarClientes();
  return clientes
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa, slug: c.slug }));
}

/**
 * AS CONTAS COM O LOGO DE CADA UMA — o seletor de cliente da barra de filtros.
 *
 * Decisão do usuário: *"no filtro de clientes apareça a foto deles"*. É o
 * mesmo pedido que pôs o rosto no seletor de Responsável, um filtro ao lado —
 * e a resposta é a mesma peça: `FilterBar` já desenha `avatar` por opção.
 *
 * **A ASSINATURA SAIU DAQUI e virou `logosDasContas()`**, em
 * `lib/dados/clientes.ts`: ela nasceu aqui para uma tela e hoje são quatro —
 * a lista de Clientes, o índice do Social e a grade de Portais fazem a mesma
 * pergunta —, e a terceira cópia é onde elas divergem. O que fica aqui é o
 * casamento com `clientesAtivos()`, que é desta tela.
 */
async function contasComFoto() {
  const [clientes, logos] = await Promise.all([
    clientesAtivos(),
    logosDasContas(),
  ]);
  return clientes.map((c) => ({
    id: c.id,
    nome_empresa: c.nome_empresa,
    fotoAssinada: logos.get(c.id) ?? null,
  }));
}

/**
 * As contas com a pasta padrão de cada uma — só o editor de recorrência pede.
 *
 * Ela é SEPARADA de `clientesAtivos()` de propósito: aquela serve três abas
 * desta tela, e a pasta padrão é uma segunda ida ao banco que nenhuma delas
 * precisa. Somá-la ali custaria a consulta em toda abertura de Gestão de
 * Tasks para alimentar uma tela que quase ninguém abre.
 */
async function clientesComPasta() {
  const [clientes, pastas] = await Promise.all([
    clientesAtivos(),
    pastasPadraoDasContas(),
  ]);
  return clientes.map((c) => ({ ...c, pastaPadrao: pastas.get(c.id) ?? null }));
}

async function AbaDeDemandas({ filtros }: { filtros: FiltrosDeTask }) {
  // Os workflows saíram daqui junto com o diálogo de criação: quem escolhe o
  // workflow agora é a tela de detalhe, e é ela que os carrega.
  // A LISTA E OS TRÊS NÚMEROS SAEM DA MESMA CHAMADA, e é o que impede o
  // contador de atrasadas de dizer um número que o board não mostra — duas
  // vezes o mesmo bug, e as duas vezes foi o usuário quem encontrou. A conta
  // mora em `demandasDaAba()`; aqui não se conta nada.
  const [{ tasks, contadores }, itens, clientes, equipe, rascunhos, ehDoAtendimento, vertentes] =
    await Promise.all([
      demandasDaAba(filtros),
      itensDoCalendario(filtros),
      contasComFoto(),
      listarEquipeAtiva(),
      meusRascunhos(),
      // A MESMA PERGUNTA QUE A POLICY FAZ, por RPC — nunca um `if (role ===`
      // na tela. É o que faz "Nova recorrente" e `tasks_insert` não
      // divergirem, como já acontece com "Nova task".
      souDoAtendimento(),
      // AS VERTENTES SÃO DA CONTA ESCOLHIDA NO FILTRO, e a leitura devolve
      // lista vazia em "Todos os clientes" — que é o padrão da tela e o caso
      // em que o seletor de vertente não tem o que oferecer.
      vertentesDoCliente(filtros.cliente ?? null),
    ]);

  return (
    <div className="space-y-6">
      {/* OS CONTADORES DESCERAM DO CABEÇALHO PARA DENTRO DESTA ABA, e é o que
          a barra de abas cobrou: "3 abertas · 1 atrasada" descreve as
          DEMANDAS, e lido no topo da aba de Workflows seria um número sobre
          outra coisa — a tela afirmando com confiança algo que ela não está
          mostrando. */}
      <ContadoresDeDemandas
        abertas={contadores.abertas}
        atrasadas={contadores.atrasadas}
        concluidasNoMes={contadores.concluidasNoMes}
      />

      <PainelDeTasks
        tasks={tasks}
        rascunhos={rascunhos}
        itensDeCalendario={itens}
        clientes={clientes}
        vertentes={vertentes.map((v) => ({ id: v.id, nome: v.nome, ativa: v.ativa }))}
        equipe={equipe}
        prazos={prazosDeHoje()}
        podeConfigurarRecorrencia={ehDoAtendimento}
      />
    </div>
  );
}

async function AbaDeWorkflows() {
  const [tipos, clientes, equipe] = await Promise.all([
    listarTiposComFluxo(),
    clientesAtivos(),
    listarEquipeAtiva(),
  ]);

  return (
    <Workflows
      tipos={tipos}
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
    />
  );
}

async function AbaDeRecorrencias({
  regra,
  deTask,
}: {
  regra: string | undefined;
  /** "Transformar em recorrente": o id da task que preenche o editor. */
  deTask: string | undefined;
}) {
  // O EDITOR E A LISTA NÃO SÃO DUAS ROTAS, e sim um parâmetro: `?regra=nova`
  // ou `?regra={id}`. É a mesma decisão do painel lateral de Minhas Tasks —
  // quem fecha o editor volta para a lista com os filtros que tinha, e não
  // para uma lista recarregada do zero.
  if (regra) {
    const [clientes, equipe, tipos, feriados, atual, daTask] = await Promise.all([
      clientesComPasta(),
      listarEquipeAtiva(),
      listarTiposComFluxo(),
      feriadosParaAPrevia(),
      regra === "nova" ? Promise.resolve(null) : buscarRecorrencia(regra),
      regra === "nova" && deTask ? modeloDeUmaTask(deTask) : Promise.resolve(null),
    ]);

    return (
      <EditorDeRecorrencia
        regra={atual}
        clientes={clientes}
        equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
        workflows={tipos.map((t) => ({
          id: t.id,
          nome: t.nome,
          etapas: t.etapas?.length ?? 0,
        }))}
        partirDe={daTask}
        feriados={feriados}
        hojeISO={hojeNaAgencia()}
      />
    );
  }

  const [regras, clientes, atendimento, agendadas] = await Promise.all([
    listarRecorrencias(),
    clientesAtivos(),
    souDoAtendimento(),
    // A FAIXA PERGUNTA AO BANCO em vez de a tela afirmar: qual das duas frases
    // verdadeiras aparece depende de o agendamento estar ligado, e isso é
    // decisão de operação — ninguém edita código para agendar.
    rotinasAgendadas(),
  ]);

  return (
    <ListaDeRecorrencias
      regras={regras}
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      podeConfigurar={atendimento}
      agendadas={agendadas}
    />
  );
}


/** O que cada aba mostra abaixo do cabeçalho. */
function Conteudo({
  aba,
  filtros,
  regra,
  deTask,
  fila,
}: {
  aba: Aba;
  filtros: FiltrosDeTask;
  regra: string | undefined;
  deTask: string | undefined;
  fila: FilaDeAprovacoes;
}) {
  if (aba === "workflows") return <AbaDeWorkflows />;
  if (aba === "recorrencias") return <AbaDeRecorrencias regra={regra} deTask={deTask} />;
  // A FILA DESCE JÁ BUSCADA, e não é buscada de novo aqui: o selo da barra
  // precisa dela em TODA aba, então a consulta acontece uma vez acima. Uma
  // segunda chamada nesta aba daria duas idas ao banco para desenhar o mesmo
  // número duas vezes na mesma tela.
  if (aba === "aprovacoes-internas") return <Fila fila={fila} />;
  return <AbaDeDemandas filtros={filtros} />;
}

export default async function PaginaDeGestaoDeTasks({
  searchParams,
}: PageProps<"/painel/gestao-tasks">) {
  await exigirAcessoARota("/painel/gestao-tasks");

  const params = await searchParams;
  const aba = lerAba(params.aba);
  const filtros = filtrosDaUrl(params);
  const regra = typeof params.regra === "string" ? params.regra : undefined;
  const deTask = typeof params.deTask === "string" ? params.deTask : undefined;

  // A CONTAGEM DA FILA SAI AQUI E NÃO DENTRO DA ABA, porque o selo mora na
  // barra — ele precisa existir enquanto a pessoa está nas Demandas, que é
  // exatamente quando ninguém olharia a fila. É a consulta que o item de menu
  // não fazia, e é o que a fusão devolve em troca do item que sumiu.
  //
  // E o número é `esperando`, nunca o total: "prontas para o cliente" já
  // passaram pelo aval e esperam um envio, não uma decisão. Somar as duas
  // faria o selo cobrar uma ação que metade da fila não pede.
  const fila = await filaDeAprovacoes();

  return (
    <div className="space-y-6">
      {/* O CABEÇALHO DA PÁGINA É O DA BARRA DE CONTEXTO, e ele é VISÍVEL.

          `AbasDeGestaoDeTasks` passa `titulo="Gestão de Tasks"`, e a
          `BarraDeContexto` desenha o `PageHeader` com ele, fora da faixa
          grudada. Não há `PageHeader` aqui porque ele seria o SEGUNDO: o
          título é do MÓDULO, desenhado uma vez acima do seletor de abas.

          *(Este comentário dizia que a topbar já diz o nome do módulo e que o
          `h1` mora na barra "invisível, como o da porta". As duas coisas
          deixaram de ser verdade: a topbar da interface aprovada é só a busca,
          o sino e o avatar, e foi por isso que o título desceu para a barra —
          visível, na escala grande do desenho.)* */}
      {/* A PORTA PARA SOCIAL MEDIA E CAMPANHAS — decisão do usuário: *"quero
          que o espaço para montar campanhas, e montar o social do cliente,
          apareça em gestão de tasks"*.

          **OS DOIS MÓDULOS NÃO VOLTARAM PARA A BARRA LATERAL**, e não é isso
          que ele pediu: eles saíram dela no Sprint 3J (`hiddenFromMenu`) por
          decisão dele, *"para diminuir a quantidade de itens na aba lateral"*,
          e a porta que ficou foi a faixa de áreas de Minhas Tasks. O que
          faltava era uma porta aqui, onde a gestão abre o trabalho da agência.

          **E ELA É UMA PORTA E NÃO DUAS SEÇÕES, e a razão é medida:**
          `social-media/page.tsx` lê `?aba=` — a MESMA chave que esta barra
          usa —, então uma pílula "Social" aqui e as seções de lá colidiriam
          na URL. Renomear a chave do Social está fora de questão: as
          notificações que `notificar()` grava de dentro de trigger carregam
          `/painel/social-media?post=` escrito no corpo da função, e essas
          linhas já estão no banco de produção. E um `href` na
          `SecaoDoModulo` daria uma pílula que sai do módulo e nunca aparece
          ativa.

          **ELAS APONTAM PARA OS ÍNDICES e não para as telas de montar**, que
          seria a leitura literal: cada índice JÁ carrega o botão de montar
          — "Abrir o mês" em `indice-do-social.tsx` e "Nova campanha" em
          `aprovacoes/page.tsx` — e é também onde o mês e a campanha que já
          existem são acompanhados. Apontando para `/abrir` e `/nova`, a porta
          daria o montar e tiraria o acompanhar.

          **NÃO HÁ `QUEM_VE` AQUI, que é a lição da 0060:** esta rota é
          `GESTAO`, e as duas telas de montar exigem `is_atendimento()` — que
          a gestão satisfaz. Uma segunda pergunta embaixo de uma primeira que
          já barra todo mundo não barra ninguém.

          *O que ela NÃO alcança, e é dito em vez de escondido:* o colaborador
          do Atendimento não chega a esta tela — ela é `GESTAO` —, então a
          porta dele continua sendo a faixa de áreas de Minhas Tasks.

          **E os ícones são os do `MENU`** (`Images`, `FileCheck2`), para a
          porta e a barra lateral não desenharem o mesmo módulo de dois jeitos
          — a história de `ICONE_DA_AREA`, que tinha três cópias e duas já
          divergidas. */}
      <AbasDeGestaoDeTasks
        atual={aba}
        aguardando={fila.esperando.length}
        acoes={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/painel/social-media">
                <Images aria-hidden className="size-4" />
                Social Media
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/painel/aprovacoes">
                <FileCheck2 aria-hidden className="size-4" />
                Campanhas
              </Link>
            </Button>
          </>
        }
      />

      <Suspense
        key={`${aba}:${regra ?? ""}:${deTask ?? ""}`}
        fallback={<LoadingSkeleton variant="table" rows={6} />}
      >
        <Conteudo aba={aba} filtros={filtros} regra={regra} deTask={deTask} fila={fila} />
      </Suspense>
    </div>
  );
}
