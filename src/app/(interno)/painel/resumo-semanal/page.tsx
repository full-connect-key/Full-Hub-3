import type { Metadata } from "next";
import { Suspense } from "react";
import { addDays, format } from "date-fns";
import type { JSONContent } from "@tiptap/react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import {
  buscarNoHistorico,
  entregasDaSemana,
  notaDaSemana,
  subtarefasAindaNaoRegistradas,
  subtarefasConcluidasNaSemana,
} from "@/lib/dados/resumo-semanal";
import type { Humor } from "@/lib/dominio/skills";
import { chaveDaSemana, semanaDaChave } from "@/lib/dominio/semanas";

import { BuscaNoHistorico } from "./busca-no-historico";
import { ResultadosDaBusca } from "./resultados-da-busca";
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

  const [entregas, clientes, subtarefas, nota, pendentes] = await Promise.all([
    entregasDaSemana(inicio, fim),
    listarClientes(),
    subtarefasConcluidasNaSemana(usuarioId, inicio, fim),
    notaDaSemana(chaveDaSemana(inicio)),
    subtarefasAindaNaoRegistradas(usuarioId, inicio, fim),
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
      notaInicial={(nota?.conteudo_rico as JSONContent | null) ?? null}
      humorInicial={(nota?.humor as Humor | null) ?? null}
      temEntregasParaPuxar={pendentes.length > 0}
    />
  );
}

async function Busca({ termo }: { termo: string }) {
  const achados = await buscarNoHistorico(termo);
  return <ResultadosDaBusca termo={termo} achados={achados} />;
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
 *
 * Buscando, a semana some da tela em vez de dividir espaço com os resultados:
 * quem procura "campanha de outubro" está atrás daquilo, e a semana de hoje ao
 * lado só competiria por atenção. O termo fica na URL, então fechar a busca
 * devolve exatamente a semana de onde a pessoa saiu.
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
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : "";
  const buscando = busca.length >= 2;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumo Semanal"
      />

      <BuscaNoHistorico termoInicial={busca} />

      {buscando ? (
        <Suspense key={busca} fallback={<LoadingSkeleton variant="table" rows={3} />}>
          <Busca termo={busca} />
        </Suspense>
      ) : (
        <Suspense
          key={chaveDaSemana(inicio)}
          fallback={<LoadingSkeleton variant="table" rows={4} />}
        >
          <Conteudo
            usuarioId={sessao.usuarioId}
            inicio={inicio}
            hoje={hoje}
            abrirNova={abrirNova}
          />
        </Suspense>
      )}
    </div>
  );
}
