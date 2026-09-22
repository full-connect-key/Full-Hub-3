import type { Metadata } from "next";
import { Suspense } from "react";
import { format } from "date-fns";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import {
  contratosSemLancamento,
  lancamentosDaCompetencia,
  listarCategorias,
  listarContratos,
  relatorioDoPeriodo,
  visaoGeralDoMes,
} from "@/lib/dados/financeiro";
import { competenciaDaChave, competenciaDe, deslocarCompetencia } from "@/lib/dominio/financeiro";

import { AbasDoFinanceiro } from "./abas";
import { Contratos } from "./contratos";
import { Lancamentos } from "./lancamentos";
import { Relatorios } from "./relatorios";
import { VisaoGeralDoFinanceiro } from "./visao-geral";
import { lerAba } from "./vocabulario";

export const metadata: Metadata = { title: "Financeiro" };

/**
 * O financeiro da agência.
 *
 * SOMENTE SÓCIO, e a guarda são três camadas independentes:
 *
 *   1. o item não aparece no menu de quem não é sócio (`roles: SOCIO` em
 *      permissions.ts) — o que NÃO é proteção, só arrumação;
 *   2. `exigirAcessoARota` devolve HTTP 403 para quem digitar o endereço;
 *   3. a RLS de `contracts`, `finance_categories` e `finance_entries` recusa
 *      quem não é sócio mesmo chamando a API do Supabase direto. Esta é a que
 *      vale.
 *
 * O desenvolvedor é gestão para todo o resto do sistema e aqui não. Está
 * escrito por extenso na migration 0013, junto com a razão.
 */
export default async function PaginaDoFinanceiro({
  searchParams,
}: PageProps<"/painel/financeiro">) {
  await exigirAcessoARota("/painel/financeiro");
  const parametros = await searchParams;

  const aba = lerAba(parametros.aba);

  // Hoje e a competência saem daqui e descem prontos. Se cada tela lesse o
  // próprio relógio, o navegador em outro fuso classificaria um vencimento
  // como atrasado enquanto o contador do cartão ainda o daria em dia.
  const hojeISO = format(new Date(), "yyyy-MM-dd");
  const mes = typeof parametros.mes === "string" ? parametros.mes : undefined;
  const competencia = competenciaDaChave(mes, hojeISO);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Contratos, receitas, despesas e a rentabilidade de cada conta. Só o sócio alcança este módulo."
      />

      <AbasDoFinanceiro atual={aba} />

      <Suspense
        key={`${aba}-${competencia}-${parametros.de ?? ""}-${parametros.ate ?? ""}`}
        fallback={<LoadingSkeleton variant="table" rows={6} />}
      >
        {aba === "visao-geral" ? (
          <ConteudoDaVisaoGeral competencia={competencia} hojeISO={hojeISO} />
        ) : aba === "lancamentos" ? (
          <ConteudoDosLancamentos competencia={competencia} hojeISO={hojeISO} />
        ) : aba === "contratos" ? (
          <ConteudoDosContratos competencia={competencia} />
        ) : (
          <ConteudoDosRelatorios
            de={lerCompetencia(parametros.de, deslocarCompetencia(competencia, -5))}
            ate={lerCompetencia(parametros.ate, competencia)}
          />
        )}
      </Suspense>
    </div>
  );
}

function lerCompetencia(valor: string | string[] | undefined, padrao: string): string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}/.test(valor)) return padrao;
  return competenciaDe(`${valor.slice(0, 7)}-01`);
}

async function ConteudoDaVisaoGeral({
  competencia,
  hojeISO,
}: {
  competencia: string;
  hojeISO: string;
}) {
  const dados = await visaoGeralDoMes(competencia, hojeISO);
  return <VisaoGeralDoFinanceiro dados={dados} hojeISO={hojeISO} />;
}

async function ConteudoDosLancamentos({
  competencia,
  hojeISO,
}: {
  competencia: string;
  hojeISO: string;
}) {
  const [lancamentos, clientes, categorias] = await Promise.all([
    lancamentosDaCompetencia(competencia, hojeISO),
    listarClientes(),
    listarCategorias(),
  ]);

  return (
    <Lancamentos
      lancamentos={lancamentos}
      // Cliente desativado continua na lista de filtro: o histórico dele
      // existe, e escondê-lo faria a receita antiga sumir do filtro sem
      // sumir do total.
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      categorias={categorias}
      competencia={competencia}
      hojeISO={hojeISO}
    />
  );
}

async function ConteudoDosContratos({ competencia }: { competencia: string }) {
  const [contratos, clientes, pendentes] = await Promise.all([
    listarContratos(),
    listarClientes(),
    contratosSemLancamento(competencia),
  ]);

  return (
    <Contratos
      contratos={contratos}
      // Aqui só os ativos: um contrato novo não se assina com empresa
      // desligada, e oferecê-la convidaria ao engano.
      clientes={clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      competencia={competencia}
      quantosPendentes={pendentes.length}
    />
  );
}

async function ConteudoDosRelatorios({ de, ate }: { de: string; ate: string }) {
  // Período invertido não é erro de quem digitou, é ordem trocada: o
  // relatório mostra o intervalo, e não uma mensagem de erro.
  const [inicio, fim] = de <= ate ? [de, ate] : [ate, de];
  const { dre, rentabilidade } = await relatorioDoPeriodo(inicio, fim);
  return <Relatorios dre={dre} rentabilidade={rentabilidade} de={inicio} ate={fim} />;
}
