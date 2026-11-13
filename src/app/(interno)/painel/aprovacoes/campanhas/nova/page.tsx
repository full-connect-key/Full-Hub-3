import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { forbidden } from "next/navigation";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { templatesDeCampanha } from "@/lib/dados/campanhas";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { listarWorkflows } from "@/lib/dados/workflows";
import { vertentesDasContas } from "@/lib/dados/vertentes";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { pedido } from "@/lib/dados/solicitacoes";
import { composicaoDoPedido } from "@/lib/dominio/campanhas";
import { briefingDoPedido, camposDoRoteiro } from "@/lib/dominio/solicitacoes";

import { FormularioDeCampanha } from "./formulario";

export const metadata: Metadata = { title: "Nova campanha" };

/**
 * A abertura de campanha, na versão mínima.
 *
 * A gestão completa — editar campanha existente, enviar entregável, subir
 * arquivo — é de outro momento. O que existe aqui é o suficiente para uma
 * campanha nascer com a árvore certa e chegar ao Portal.
 *
 * A guarda é de SERVIDOR, e não do menu: esconder o link não é segurança. E
 * ela é a primeira barreira, não a única — `campaigns_insert` exige
 * `is_staff()` no banco, e é essa que vale para quem chamar a API direto.
 */
export default async function PaginaDeNovaCampanha({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  await exigirAcessoARota("/painel/aprovacoes");

  // A GUARDA DA ROTA NÃO BASTA MAIS AQUI. Desde a 0054 o módulo é de
  // `EQUIPE` — o colaborador entra para subir a arte da peça dele —, e abrir
  // campanha continua sendo de quem abre demanda. Sem este 403, ele chegaria
  // ao formulário inteiro e levaria a recusa no clique de salvar, depois de
  // ter datilografado a árvore.
  //
  // E não é a proteção: `campaigns_insert` e `tasks_insert` exigem
  // `is_atendimento()` no banco, e é essa que vale para quem chamar a API
  // direto.
  if (!(await souDoAtendimento())) forbidden();

  const [clientes, templates, workflows, pessoas] = await Promise.all([
    listarClientes(),
    templatesDeCampanha(),
    // OS WORKFLOWS ENTRAM NO SELETOR (migration 0108), e o que vem daqui é a
    // LISTA e não a árvore: a árvore depende da conta escolhida nesta tela, e
    // quem a monta é `arvoreDoWorkflowParaCampanha` no clique.
    //
    // SEM `clienteId`: os globais mais os de TODA conta, porque o cliente da
    // campanha ainda não existe quando a tela carrega. Um workflow de outra
    // empresa aplicado aqui é a árvore dela — e `listarWorkflows` diz de quem
    // é cada um, que é a informação que falta para isso ser erro de quem lê.
    listarWorkflows(),
    listarEquipeAtiva(),
  ]);

  // AS VERTENTES DE TODAS AS CONTAS DE UMA VEZ, e não uma ida ao banco a cada
  // troca de cliente no seletor.
  //
  // `vertentesDasContas` existe desde a 0118 exatamente para isto — o board e
  // o calendário já precisavam do nome da frente de demandas de contas
  // diferentes. A alternativa seria uma Server Action chamada no `onChange`
  // do cliente, e ela custaria uma volta ao servidor no meio do preenchimento
  // para responder uma lista que a página já poderia ter trazido.
  const vertentesPorConta = await vertentesDasContas(
    clientes.filter((c) => c.ativo).map((c) => c.id),
  );

  // ----------------------------------------------- o pedido que o cliente fez
  //
  // `?pedido=` É A METADE "para editarmos" DO ITEM 9 (0138), e a leitura é a
  // MESMA que a tela do pedido usa: `pedido()` em `lib/dados/solicitacoes.ts`,
  // com a RLS recortando. Uma consulta nova aqui seria um segundo lugar
  // decidindo o que a equipe lê de um pedido.
  //
  // **O PARÂMETRO TORTO NÃO DERRUBA A TELA**: ele cai em `undefined`, e o
  // formulário abre em branco — que é o que um endereço antigo tem de fazer.
  // E o PEDIDO QUE JÁ VIROU DEMANDA também entra, de propósito: o `criarCampanha`
  // é quem recusa, com a frase; esconder o pré-preenchimento aqui faria a
  // tela abrir vazia sem dizer por quê.
  const { pedido: pedidoId } = await searchParams;
  const oPedido = pedidoId ? await pedido(pedidoId) : null;

  const prefill = oPedido
    ? {
        id: oPedido.id,
        clienteId: oPedido.client_id,
        nome: oPedido.titulo,
        vertenteId: oPedido.vertente_id,
        inicio: oPedido.campanha_inicio,
        fim: oPedido.campanha_fim,
        // O BRIEFING SAI DA MESMA FUNÇÃO QUE `converterEmDemanda` USA, e é por
        // isso que ela mora em `lib/dominio/`: as duas rotas de conversão
        // dizem a mesma coisa sobre o mesmo pedido, e a que divergiria seria
        // esta, que se abre menos.
        briefingTexto: briefingDoPedido(
          { ...oPedido, empresa: oPedido.empresa },
          camposDoRoteiro(oPedido.roteiro?.campos_json),
        ),
        composicao: composicaoDoPedido(oPedido.composicao),
      }
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Nova campanha" />
        <p className="text-text-muted mt-1">
          A campanha nasce com uma <strong>demanda</strong> junto, e cada
          entregável vira uma <strong>etapa</strong> dela — com responsável e
          prazo. É por isso que esta tela pede briefing e pasta de entrega: são
          os campos da demanda.
        </p>
      </div>

      {/* A FAIXA DIZ DE ONDE OS CAMPOS VIERAM, e ela é obrigatória (0138).

          Sem ela o Atendimento abre um formulário com nome, período, briefing
          e materiais já preenchidos e não tem como saber de onde aquilo saiu —
          nem que salvar vai mover o pedido do cliente para "em produção". O
          link volta ao pedido, porque é lá que os anexos e a conversa estão.

          **E ela diz que é para EDITAR**, que é a palavra do pedido: o que o
          cliente escreveu é ponto de partida, como o modelo de campanha é
          (0033). */}
      {oPedido ? (
        <p className="bg-accent text-accent-foreground flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm">
          <Megaphone aria-hidden className="size-4 shrink-0" />
          <span>
            Os campos vieram do pedido de <strong>{oPedido.empresa}</strong>.
            Edite o que precisar — ao criar a campanha, o pedido passa a
            aparecer como em produção para o cliente.
          </span>
          <Link
            href={`/painel/solicitacoes/${oPedido.id}`}
            className="font-medium underline underline-offset-2"
          >
            Ver o pedido
          </Link>
        </p>
      ) : null}

      <FormularioDeCampanha
        clientes={clientes
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, nome: c.nome_empresa }))}
        templates={templates}
        workflows={workflows
          .filter((w) => w.ativo && w.workflow !== null)
          .map((w) => ({
            // O ID É O DO WORKFLOW E NUNCA O DA CADEIA DELE, e esta linha é
            // um conserto: ela era `w.workflow!.id`.
            //
            // São duas tabelas — `task_types` guarda o nome e o alcance,
            // `workflow_templates` guarda a cadeia —, e a tela nunca mostra a
            // divisão. Quem recebe este id é `fluxoDoWorkflow()`, que procura
            // em `task_types`: um id de `workflow_templates` não casa com
            // linha nenhuma lá, então ela devolvia `null` e a tela dizia
            // *"Este workflow não foi encontrado, ou não tem cadeia de
            // etapas"* — **para todo workflow, inclusive os que têm etapas**.
            // A metade de tela da 0108 nunca funcionou.
            //
            // E o id tem de ser este também porque é o que o seletor da TELA
            // DE TASK carrega (`task.task_type_id`): a mesma escolha
            // significando duas coisas em duas telas é onde a troca se
            // esconde de novo.
            id: w.id,
            // O NOME DIZ DE QUEM É quando o workflow é de uma conta: no
            // seletor de uma campanha da Mundo Verde, "Campanha" da Óptica
            // Visão e "Campanha" da casa seriam duas linhas iguais.
            nome: w.cliente ? `${w.nome} · ${w.cliente.nome_empresa}` : w.nome,
            descricao: w.descricao,
            etapas: w.workflow!.etapas,
          }))}
        pessoas={pessoas.map((p) => ({
          id: p.id,
          nome: p.nome,
          funcao: p.funcao,
        }))}
        pedido={prefill}
        vertentes={Object.fromEntries(
          [...vertentesPorConta].map(([conta, lista]) => [
            conta,
            // SÓ AS ATIVAS, e aqui não há a exceção da "já escolhida" que
            // `vertentesParaEscolher()` faz: uma campanha que está nascendo
            // não aponta para frente nenhuma ainda.
            lista
              .filter((v) => v.ativa)
              .map((v) => ({ id: v.id, nome: v.nome })),
          ]),
        )}
      />
    </div>
  );
}
