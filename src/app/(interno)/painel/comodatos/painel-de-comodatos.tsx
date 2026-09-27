"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { IndicadoresDoInventario, ItemDoInventario, PessoaComEquipamento } from "@/lib/dados/comodatos";

import { VisaoGeral } from "./visao-geral";
import { lerVisao, type VisaoDaGestao } from "./vocabulario";

/**
 * A casca que põe a visão da gestão na URL.
 *
 * Como em toda listagem do produto: "olha o que está com a Marina" precisa ser
 * um link, e trocar de visão não pode ser um estado que some ao recarregar.
 */
export function PainelDeComodatos(props: {
  itens: ItemDoInventario[];
  indicadores: IndicadoresDoInventario;
  pessoas: PessoaComEquipamento[];
  equipe: { id: string; nome: string; funcao: string | null }[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const visao = lerVisao(parametros.get("visao") ?? undefined);

  function trocar(nova: VisaoDaGestao) {
    const busca = new URLSearchParams(parametros.toString());
    if (nova === "equipamento") busca.delete("visao");
    else busca.set("visao", nova);
    // `replace` e não `push`: trocar de visão não é navegar, senão o botão
    // voltar do navegador desfaz visão por visão em vez de sair da tela.
    router.replace(`${caminho}?${busca}`, { scroll: false });
  }

  return <VisaoGeral {...props} visao={visao} aoTrocarVisao={trocar} />;
}
