import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { acompanhamentoDaEquipe, listarAcervo } from "@/lib/dados/academy";
import { acompanhamentoDosTours } from "@/lib/dados/tour";
import { lerFiltro } from "@/lib/dominio/academy";

import { Acervo } from "./acervo";
import { BarraDaAcademy } from "./barra";
import { PainelDaGestao } from "./painel-da-gestao";
import { AcompanhamentoDosTours } from "./acompanhamento-dos-tours";

export const metadata: Metadata = { title: "Full Academy" };

/**
 * O Full Academy.
 *
 * Todo perfil interno entra; o que muda é o que cada um faz. A equipe consulta
 * e marca o próprio andamento; a gestão monta o acervo e acompanha quem fez os
 * obrigatórios.
 *
 * A DIFERENÇA NÃO É "ESCONDER O BOTÃO": item em rascunho não volta do banco
 * para quem não é autor nem gestão, `academy_acompanhamento()` recusa quem não
 * é gestão com uma exceção, e a policy de escrita recusa quem não pode montar.
 * O que a tela faz é não oferecer o que seria recusado.
 *
 * **O CLIENTE NÃO ALCANÇA NADA DISTO**, e são as três camadas de sempre: a
 * rota mora em `(interno)`, nenhuma entrada do `MENU` aceita `cliente`, e a
 * RLS recusa o perfil nas dez tabelas. A terceira é a que vale.
 */
export default async function PaginaDaAcademy({
  searchParams,
}: PageProps<"/painel/academy">) {
  const sessao = await exigirAcessoARota("/painel/academy");
  const parametros = await searchParams;

  const gestor = ehGestor(sessao.profile.role);
  const aba = parametros.aba === "gestao" && gestor ? "gestao" : "acervo";

  const busca = typeof parametros.q === "string" ? parametros.q : "";
  const filtro = lerFiltro(parametros.filtro);

  return (
    <div className="space-y-6">
      <BarraDaAcademy atual={aba} gestor={gestor} />

      <Suspense key={`${aba}-${filtro}-${busca}`} fallback={<LoadingSkeleton variant="card" rows={6} />}>
        {aba === "gestao" ? (
          <Gestao />
        ) : (
          <Conteudo usuarioId={sessao.usuarioId} filtro={filtro} busca={busca} gestor={gestor} />
        )}
      </Suspense>
    </div>
  );
}

async function Conteudo({
  usuarioId,
  filtro,
  busca,
  gestor,
}: {
  usuarioId: string;
  filtro: ReturnType<typeof lerFiltro>;
  busca: string;
  gestor: boolean;
}) {
  const acervo = await listarAcervo(usuarioId);

  // As categorias saem do que EXISTE, e não de uma lista fixa: categoria aqui
  // é organização de conteúdo, e um enum obrigaria uma migration para criar
  // uma seção de "Processos da casa". É a decisão que a 0017 já tinha tomado
  // para `area`, e a 0096 manteve.
  const categorias = [
    ...new Set(acervo.map((i) => i.categoria).filter((c): c is string => !!c)),
  ].sort();

  return (
    <Acervo
      itens={acervo}
      categorias={categorias}
      filtro={filtro}
      busca={busca}
      gestor={gestor}
    />
  );
}

async function Gestao() {
  // AS DUAS LEITURAS JUNTAS, e as duas recusam para quem não é gestão — a
  // primeira pela view `academy_progresso_da_equipe`, a segunda por
  // `is_gestor()` na primeira linha de `tour_acompanhamento()`. Chegar aqui
  // sem ser gestão já foi recusado pela aba.
  const [linhas, tours] = await Promise.all([
    acompanhamentoDaEquipe(),
    acompanhamentoDosTours(),
  ]);

  return (
    <div className="space-y-8">
      <PainelDaGestao linhas={linhas} />
      <AcompanhamentoDosTours linhas={tours} />
    </div>
  );
}
