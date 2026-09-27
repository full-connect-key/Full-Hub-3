import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { pedido } from "@/lib/dados/solicitacoes";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";

import { DetalheDoPedido } from "./detalhe-do-pedido";

export const metadata: Metadata = { title: "Solicitação" };

export default async function Pagina({ params }: PageProps<"/painel/solicitacoes/[id]">) {
  const sessao = await exigirAcessoARota("/painel/solicitacoes");
  const { id } = await params;

  const dados = await pedido(id);
  // Sem linha é a RLS dizendo "isto não é seu" — 404 é a resposta certa. O
  // erro do `select`, esse já estourou dentro de `pedido()`, com o nome do
  // lugar no log.
  if (!dados) notFound();

  // A TELA PERGUNTA AO BANCO quem é do Atendimento, com `souDoAtendimento()`,
  // e não deduz do perfil: função na agência e perfil de acesso são coisas
  // diferentes, e a policy que recusa é a mesma função. Dois jeitos de
  // perguntar dariam o botão que aparece e o clique que o banco recusa.
  const [souAtendimento] = await Promise.all([souDoAtendimento()]);

  return (
    <DetalheDoPedido
      pedido={dados}
      souAtendimento={souAtendimento}
      souGestor={ehGestor(sessao.profile.role)}
      usuarioId={sessao.usuarioId}
      agoraISO={new Date().toISOString()}
    />
  );
}
