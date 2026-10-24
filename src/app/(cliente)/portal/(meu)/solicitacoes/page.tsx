import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente } from "@/lib/auth/dal";
import { campanhasParaEscolher } from "@/lib/dados/campanhas";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import {
  contaAceitaPedidos,
  meusPedidos,
  tiposDePedido,
} from "@/lib/dados/solicitacoes";
import { ehFaseDoPedido, type FaseDoPedido } from "@/lib/dominio/solicitacoes";

import { ListaDePedidos } from "./lista";
import { PainelDeNovaSolicitacao } from "./painel-de-nova-solicitacao";

export const metadata: Metadata = { title: "Solicitações" };

/**
 * Os pedidos da empresa — a única seção do Portal em que o cliente ESCREVE.
 *
 * A consulta não filtra por empresa: quem separa é `client_requests_select` no
 * banco. Repetir o filtro aqui criaria um segundo lugar onde a regra pode
 * divergir, e o lado que esquecesse seria o que mostra o pedido de um cliente
 * para outro.
 */
async function Conteudo({ fase }: { fase: FaseDoPedido | null }) {
  const [pedidos, empresas, tipos, campanhas] = await Promise.all([
    meusPedidos(),
    obterMinhasEmpresas(),
    tiposDePedido(),
    // SEM `clienteId`: o RLS já recorta por empresa, e quem responde por duas
    // contas precisa das duas listas — o formulário filtra pela empresa que
    // estiver escolhida no momento.
    campanhasParaEscolher(),
  ]);

  // COM MAIS DE UMA EMPRESA, o botão aparece se QUALQUER uma aceitar — e a
  // escolha de qual acontece no formulário, que é onde ela decide alguma
  // coisa. Perguntar aqui poria um seletor de empresa acima de uma lista que
  // já mostra as duas.
  const aceitam = await Promise.all(
    empresas.map((e) => contaAceitaPedidos(e.id)),
  );

  // SÓ AS EMPRESAS QUE ACEITAM entram no painel: o formulário pergunta para
  // qual delas é o pedido, e oferecer a desligada seria oferecer um caminho
  // que o `with check` da policy recusa no clique de enviar.
  const podeAbrir = empresas.filter((_, i) => aceitam[i]);

  return (
    <>
      <ListaDePedidos
        pedidos={pedidos}
        base="/portal"
        podeAbrir={podeAbrir.length > 0}
        fase={fase}
      />

      {/* O PAINEL É MONTADO SEMPRE E SÓ ABRE COM `?novo=1`. Montá-lo no clique
          custaria uma ida ao servidor para buscar os tipos de trabalho no
          instante em que a pessoa já quer escrever — e o roteiro de briefing
          muda com o tipo, então ele precisa deles para desenhar o primeiro
          campo. */}
      {podeAbrir.length > 0 ? (
        <PainelDeNovaSolicitacao
          empresas={podeAbrir}
          tipos={tipos.filter((t) => t.ativo)}
          campanhas={campanhas}
          base="/portal"
        />
      ) : null}
    </>
  );
}

export default async function Pagina({
  searchParams,
}: PageProps<"/portal/solicitacoes">) {
  await exigirCliente();
  const parametros = await searchParams;

  // A ABA MORA NA URL, como todo filtro de listagem: "olha os que estão em
  // ajustes" precisa ser um link. Valor torto cai no padrão — "Todos" —, que é
  // a convenção de `ehVisao()` e de `lerMes()`.
  const pedida =
    typeof parametros.fase === "string" ? parametros.fase : undefined;
  const fase = ehFaseDoPedido(pedida) ? pedida : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Solicitações" />

      <Suspense
        key={fase ?? "todos"}
        fallback={<LoadingSkeleton variant="table" rows={4} />}
      >
        <Conteudo fase={fase} />
      </Suspense>
    </div>
  );
}
