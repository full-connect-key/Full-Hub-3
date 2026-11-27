import type { Metadata } from "next";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { FormularioDoItem } from "./formulario";
import { Voltar } from "@/components/shared/voltar";

export const metadata: Metadata = { title: "Novo item · Acervo" };

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
      <Voltar para="/painel/academy" rotulo="Acervo" />

      {/* O `PageHeader` É O CABEÇALHO DESTA TELA, e ele faltava.

          A rota não tem barra de contexto — o Acervo tem a dele, e esta é uma
          tela de dentro —, então não havia quem escrevesse o `h1`: o
          formulário começava na primeira seção numerada, e a página não tinha
          nome. É a regra escrita do `PageHeader` e da `BarraDeContexto`: quem
          usa leitor de tela navega por cabeçalho, e **uma tela sem `h1` é uma
          tela sem nome**.

          O rótulo é "Novo item" e não "Novo item no Acervo", que é a decisão
          de "Nova campanha" ao lado: a seta logo acima já diz de onde se veio,
          e repetir o módulo gasta a linha para dizer duas vezes a mesma
          coisa. */}
      <PageHeader title="Novo item" />

      <FormularioDoItem />
    </div>
  );
}
