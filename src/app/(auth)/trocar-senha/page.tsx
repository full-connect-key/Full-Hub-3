import type { Metadata } from "next";

import { exigirSessaoParaTrocarSenha } from "@/lib/auth/dal";
import { rotaInicialDoRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

import { FormularioDeTroca } from "./formulario";

export const metadata: Metadata = { title: "Primeiro acesso" };

/**
 * A troca obrigatória do primeiro acesso.
 *
 * Mora em `(auth)` e não em `(interno)`: o layout do painel chama
 * `exigirEquipe()`, que passa por `exigirSessao()` — e é justamente ele que
 * manda para cá. A tela viveria se redirecionando para si mesma.
 *
 * Quem chega aqui sem a bandeira levantada é devolvido para a própria área.
 * Sem isso a rota seria uma porta lateral para trocar a senha sem passar pelo
 * "Meu perfil", com um formulário que não avisa nada do que está acontecendo.
 */
export default async function PaginaDeTrocaDeSenha() {
  const sessao = await exigirSessaoParaTrocarSenha();

  if (!sessao.profile.deve_trocar_senha) {
    redirect(rotaInicialDoRole(sessao.profile.role));
  }

  return <FormularioDeTroca nome={sessao.profile.nome} />;
}
