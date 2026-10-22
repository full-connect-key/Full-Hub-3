import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { caixaDeEntrada } from "@/lib/dados/solicitacoes";
import { ehStatusDeSolicitacao } from "@/lib/dominio/solicitacoes";

import { CaixaDeEntrada } from "./caixa-de-entrada";

export const metadata: Metadata = { title: "Solicitações" };

/**
 * A caixa de entrada dos pedidos do cliente (0068).
 *
 * ---------------------------------------------------------------------------
 * **A TELA É DE `is_atendimento()`, e não de `is_gestor()`.**
 *
 * É a mesma função que `tasks_insert` usa desde a 0006, e a razão é direta:
 * converter um pedido em demanda É criar a demanda. Uma segunda pergunta aqui
 * — "e também precisa ser gestão" — não barraria ninguém que a policy já não
 * barre, e barraria a pessoa do Atendimento que o produto diz que é a dona
 * desta fila. É a lição da 0060, e a da 0059 com `abrirMesDeSocial`.
 *
 * Quem decide de verdade é o banco: `client_requests_select` para ler e
 * `client_requests_update` para triar, as duas `is_atendimento()` desde a
 * 0110.
 *
 * ---------------------------------------------------------------------------
 * **E A LEITURA PASSOU A SER DO ATENDIMENTO TAMBÉM** (migration 0110), por
 * decisão do usuário: *"as solicitações devem ser visualizadas apenas pelo
 * atendimento, por desenvolvedores, ou sócios"*.
 *
 * Por isso o `forbidden()` aqui, e ele NÃO é a proteção — a policy é. Sem
 * ele, o colaborador fora do Atendimento abriria esta tela e leria *"Nenhum
 * pedido esperando"*: uma afirmação FALSA com toda a confiança, que é
 * exatamente o modo de falha que a aba do sócio nas Notas Fiscais existe para
 * não cometer. Lista vazia é indistinguível da verdade.
 *
 * **`exigirAcessoARota` não alcança isto**, e é por desenho: ela pergunta pelo
 * PERFIL, e o colaborador do Atendimento tem o mesmo perfil que o do Design.
 * Quem distingue os dois é a função na agência, e ela mora no banco.
 *
 * *A tela de DETALHE não precisa deste 403*, e a ausência é decisão: ela já
 * responde 404 para quem a RLS não devolve a linha — que é a resposta certa
 * ali, a mesma do post no portal: para quem não pode ver, o pedido não
 * existe. Um 403 confirmaria que existe um pedido com aquele id.
 * ---------------------------------------------------------------------------
 */
async function Conteudo({ status }: { status: string | undefined }) {
  const pedidos = await caixaDeEntrada({
    status: ehStatusDeSolicitacao(status) ? status : null,
  });

  // HOJE SAI DO SERVIDOR e desce pronto: se a idade de cada pedido fosse
  // calculada no navegador, quem estivesse num fuso à frente veria um destaque
  // diferente do colega ao lado — e é a idade que decide o destaque.
  const hojeISO = new Date().toISOString();

  return <CaixaDeEntrada pedidos={pedidos} hojeISO={hojeISO} statusAtivo={status ?? null} />;
}

export default async function Pagina({ searchParams }: PageProps<"/painel/solicitacoes">) {
  await exigirAcessoARota("/painel/solicitacoes");
  if (!(await souDoAtendimento())) forbidden();

  const parametros = await searchParams;
  const status = typeof parametros.status === "string" ? parametros.status : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Solicitações" />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo status={status} />
      </Suspense>
    </div>
  );
}
