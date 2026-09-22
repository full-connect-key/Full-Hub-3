import { redirect } from "next/navigation";

import { obterSessao } from "@/lib/auth/dal";
import { rotaInicialDoRole } from "@/lib/auth/roles";

/**
 * A raiz nao tem conteudo proprio: ela so encaminha.
 *   sem sessao        -> /login
 *   cliente           -> /portal
 *   equipe da agencia -> /painel
 */
export default async function Raiz() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  redirect(rotaInicialDoRole(sessao.profile.role));
}
