import type { Metadata } from "next";
import { Suspense } from "react";
import { addDays, format } from "date-fns";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { entregasDaSemana, subtarefasConcluidasNaSemana } from "@/lib/dados/resumo-semanal";
import { chaveDaSemana, semanaDaChave } from "@/lib/dominio/semanas";

import { SemanaDeEntregas } from "./semana";

export const metadata: Metadata = { title: "Resumo Semanal" };

async function Conteudo({
  usuarioId,
  inicio,
  hoje,
  abrirNova,
}: {
  usuarioId: string;
  inicio: Date;
  hoje: Date;
  abrirNova: boolean;
}) {
  const fim = addDays(inicio, 6);

  const [entregas, clientes, subtarefas] = await Promise.all([
    entregasDaSemana(inicio, fim),
    listarClientes(),
    subtarefasConcluidasNaSemana(usuarioId, inicio, fim),
  ]);

  return (
    <SemanaDeEntregas
      entregas={entregas}
      clientes={clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      subtarefas={subtarefas}
      inicioISO={chaveDaSemana(inicio)}
      hojeISO={format(hoje, "yyyy-MM-dd")}
      abrirNova={abrirNova}
    />
  );
}

/**
 * O Resumo Semanal.
 *
 * Era "Diário" e não funcionava como diário: ninguém abre o sistema todo dia
 * para escrever uma linha. Por semana o hábito cabe — na sexta, ou na segunda
 * olhando para trás —, e o texto sai mais útil, porque uma semana tem forma e
 * um dia solto não tem.
 *
 * HOJE É CALCULADO AQUI, no servidor, e desce pronto para a tela. Se o
 * navegador lesse o próprio relógio, alguém em outro fuso veria a entrega de
 * segunda-feira cair na semana anterior.
 */
export default async function PaginaDoResumoSemanal({
  searchParams,
}: PageProps<"/painel/resumo-semanal">) {
  const sessao = await exigirAcessoARota("/painel/resumo-semanal");
  const parametros = await searchParams;

  const hoje = new Date();
  const semana = typeof parametros.semana === "string" ? parametros.semana : undefined;
  const inicio = semanaDaChave(semana, hoje);
  const abrirNova = parametros.nova === "1";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumo Semanal"
        description="O que você entregou, semana a semana. É o seu registro: ninguém mais lê, nem a gestão — e é ele que vira a base da sua conversa de desenvolvimento."
      />

      <Suspense key={chaveDaSemana(inicio)} fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <Conteudo
          usuarioId={sessao.usuarioId}
          inicio={inicio}
          hoje={hoje}
          abrirNova={abrirNova}
        />
      </Suspense>
    </div>
  );
}
