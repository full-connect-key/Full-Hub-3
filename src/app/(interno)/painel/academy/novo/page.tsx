import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { forbidden } from "next/navigation";

import { FormularioDoItem } from "./formulario";

export const metadata: Metadata = { title: "Novo item · Full Academy" };

/**
 * A abertura de um item do acervo.
 *
 * **O FORMATO SE ESCOLHE AQUI E NÃO SE TROCA DEPOIS**, e é mecânico antes de
 * ser de desenho: o conteúdo de cada formato mora em tabela diferente, e
 * trocar o tipo de um playbook com três versões publicadas deixaria as três
 * sem tela que as mostre. É a decisão de `posts.midia` na 0042 — escolhe-se na
 * abertura porque trocar no meio é trocar a tela debaixo de quem trabalha.
 *
 * **O ITEM NASCE RASCUNHO**, e a tela diz isso antes do clique: só o autor e a
 * gestão o enxergam até alguém publicar. É a regra que a 0096 semeia dezoito
 * vezes — *não publicar item sem conteúdo apenas para preencher o acervo*.
 */
export default async function PaginaDeNovoItem() {
  const sessao = await exigirAcessoARota("/painel/academy");
  if (!ehGestor(sessao.profile.role)) forbidden();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link
        href="/painel/academy"
        className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Todo o acervo
      </Link>

      <FormularioDoItem />
    </div>
  );
}
