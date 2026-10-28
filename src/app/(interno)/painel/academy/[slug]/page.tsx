import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { abrirItem, minhaAnotacao } from "@/lib/dados/academy";

import { DetalheDoItem } from "./detalhe";
import { Voltar } from "@/components/shared/voltar";

export const metadata: Metadata = { title: "Acervo" };

/**
 * A tela de um item do acervo.
 *
 * **O ENDEREÇO É O SLUG e não o id**, e é ele que sobrevive a uma troca de
 * título: um link colado numa conversa continua abrindo depois de alguém
 * renomear o playbook. O id continua existindo e é o que as actions usam — o
 * slug é para gente.
 *
 * `notFound()` quando a consulta volta vazia, e isso cobre DOIS casos de
 * propósito: o item não existe, ou a RLS recusou porque ele é rascunho e quem
 * pediu não é autor nem gestão. Dizer "existe, mas você não pode ver"
 * entregaria que ele existe — que é justamente o que o rascunho não conta.
 */
export default async function PaginaDoItem({
  params,
}: PageProps<"/painel/academy/[slug]">) {
  const sessao = await exigirAcessoARota("/painel/academy");
  const { slug } = await params;

  const aberto = await abrirItem(slug, sessao.usuarioId);
  if (!aberto) notFound();

  const anotacao = await minhaAnotacao(aberto.item.id, null, sessao.usuarioId);

  return (
    <div className="space-y-6">
      <Voltar para="/painel/academy" rotulo="Acervo" />

      <DetalheDoItem
        aberto={aberto}
        anotacaoInicial={anotacao}
        podeEditar={ehGestor(sessao.profile.role)}
      />
    </div>
  );
}
