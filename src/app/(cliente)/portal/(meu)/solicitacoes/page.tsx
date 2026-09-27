import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente } from "@/lib/auth/dal";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import { contaAceitaPedidos, meusPedidos } from "@/lib/dados/solicitacoes";

import { ListaDePedidos } from "./lista";

export const metadata: Metadata = { title: "Pedidos" };

/**
 * Os pedidos da empresa — a única seção do Portal em que o cliente ESCREVE.
 *
 * A consulta não filtra por empresa: quem separa é `client_requests_select` no
 * banco. Repetir o filtro aqui criaria um segundo lugar onde a regra pode
 * divergir, e o lado que esquecesse seria o que mostra o pedido de um cliente
 * para outro.
 */
async function Conteudo() {
  const [pedidos, empresas] = await Promise.all([meusPedidos(), obterMinhasEmpresas()]);

  // COM MAIS DE UMA EMPRESA, o botão aparece se QUALQUER uma aceitar — e a
  // escolha de qual acontece no formulário, que é onde ela decide alguma
  // coisa. Perguntar aqui poria um seletor de empresa acima de uma lista que
  // já mostra as duas.
  const aceitam = await Promise.all(empresas.map((e) => contaAceitaPedidos(e.id)));

  return (
    <ListaDePedidos pedidos={pedidos} base="/portal" podeAbrir={aceitam.some(Boolean)} />
  );
}

export default async function Pagina() {
  await exigirCliente();

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
