import { acompanhamentoDaEquipe, listarTrilhas } from "@/lib/dados/academy";
import { obterSessao } from "@/lib/auth/dal";

import { PainelDaGestao } from "./painel-da-gestao";

/**
 * A aba de gestão: montar trilhas e acompanhar quem fez as obrigatórias.
 *
 * Server Component, porque as duas consultas são de servidor. A interação fica
 * em `painel-da-gestao.tsx`.
 */
export async function GestaoDaAcademy() {
  const sessao = await obterSessao();
  if (!sessao) return null;

  const [trilhas, acompanhamento] = await Promise.all([
    listarTrilhas(sessao.usuarioId),
    acompanhamentoDaEquipe(),
  ]);

  return <PainelDaGestao trilhas={trilhas} acompanhamento={acompanhamento} />;
}
