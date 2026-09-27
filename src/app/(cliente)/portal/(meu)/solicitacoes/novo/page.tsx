import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente } from "@/lib/auth/dal";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import { contaAceitaPedidos, tiposDePedido } from "@/lib/dados/solicitacoes";

import { FormularioDePedido } from "./formulario";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function Pagina() {
  await exigirCliente();

  const [empresas, tipos] = await Promise.all([obterMinhasEmpresas(), tiposDePedido()]);
  const aceitam = await Promise.all(empresas.map((e) => contaAceitaPedidos(e.id)));

  // A GUARDA EXISTE ALÉM DO `with check`, e por uma razão específica: sem ela,
  // quem digitasse o endereço numa conta desligada preencheria o formulário
  // inteiro para levar a recusa no clique de enviar. O banco é quem recusa; a
  // tela existe para não oferecer um caminho sem saída.
  const podeAbrir = empresas.filter((_, i) => aceitam[i]);
  if (podeAbrir.length === 0) forbidden();

  return (
    <div className="space-y-6">
      <PageHeader title="O que você precisa?" />
      <FormularioDePedido empresas={podeAbrir} tipos={tipos.filter((t) => t.ativo)} />
    </div>
  );
}
