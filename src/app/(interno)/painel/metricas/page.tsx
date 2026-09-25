import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import {
  desvioDeEstimativa,
  producaoDoPeriodo,
  qualidadeDaEntrega,
  rentabilidadeDoPeriodo,
  tempoDeAprovacao,
  tempoPorStatus,
} from "@/lib/dados/metricas";
import {
  ABAS_DE_METRICA,
  datasDoPeriodo,
  ehAbaDeMetrica,
  ehPeriodo,
  type AbaDeMetrica,
  type Periodo,
} from "@/lib/dominio/metricas";
import type { UserRole } from "@/lib/supabase/database.types";

import { AbasDeMetrica } from "./abas";
import { BarraDePeriodo } from "./barra-de-periodo";
import {
  PainelDaEquipe,
  PainelDeProducao,
  PainelDeQualidade,
  PainelDeRentabilidade,
  PainelDeTempo,
} from "./paineis";

export const metadata: Metadata = { title: "Métricas" };

/**
 * Quem enxerga cada aba.
 *
 * **Sai daqui e de mais nenhum lugar**, como em Full Days: a lista de abas
 * visíveis e a guarda da rota leem a mesma constante, então não existe o caso
 * de a aba aparecer e a página recusar.
 *
 * **E ela ESPELHA a primeira linha de cada função da 0035** — quatro exigem
 * `is_gestor()`, a rentabilidade exige `is_socio()`. Esconder a aba não é a
 * proteção: quem digitar `?aba=rentabilidade` leva 403 aqui, e quem chamar a
 * RPC direto leva a recusa do Postgres. São as três camadas de sempre.
 */
const QUEM_VE: Record<AbaDeMetrica, (role: UserRole) => boolean> = {
  producao: () => true,
  tempo: () => true,
  equipe: () => true,
  qualidade: () => true,
  // O desenvolvedor é gestão para todo o resto do sistema e aqui não.
  // Faturamento por cliente é a informação mais sensível da casa, e "só
  // leitura para o gestor" não existe neste produto — nem agregado.
  rentabilidade: (role) => ehSocio(role),
};

const PADRAO: AbaDeMetrica = "producao";

const texto = (valor: string | string[] | undefined) =>
  typeof valor === "string" && valor !== "" ? valor : undefined;

export default async function PaginaDeMetricas({ searchParams }: PageProps<"/painel/metricas">) {
  const sessao = await exigirAcessoARota("/painel/metricas");
  const parametros = await searchParams;

  const pedida = texto(parametros.aba);
  const aba: AbaDeMetrica = ehAbaDeMetrica(pedida) ? pedida : PADRAO;
  if (!QUEM_VE[aba](sessao.profile.role)) forbidden();

  const visiveis = ABAS_DE_METRICA.filter((chave) => QUEM_VE[chave](sessao.profile.role));

  const pedido = texto(parametros.periodo);
  const periodo: Periodo = ehPeriodo(pedido) ? pedido : "30d";

  // O PERÍODO É RESOLVIDO AQUI, e desce pronto para as abas. Se cada uma
  // lesse o próprio relógio, o navegador num fuso à frente classificaria
  // "últimos 30 dias" num recorte diferente do que a consulta usou — e a
  // tabela mostraria um total que o título não explica.
  const { de, ate } = datasDoPeriodo(periodo, new Date(), {
    de: texto(parametros.de),
    ate: texto(parametros.ate),
  });

  const clienteId = aba === "producao" ? (texto(parametros.cliente) ?? null) : null;

  // SÓ A CONSULTA DA ABA ABERTA. Buscar as cinco a cada visita faria seis
  // idas ao banco para desenhar uma tabela — e a rentabilidade, que só o
  // sócio alcança, levaria recusa na tela de todo desenvolvedor.
  const [clientes, dados] = await Promise.all([
    aba === "producao" ? listarClientes() : Promise.resolve([]),
    carregar(aba, de, ate, clienteId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Métricas" />

      <AbasDeMetrica atual={aba} visiveis={visiveis} />

      <BarraDePeriodo
        periodo={periodo}
        de={de}
        ate={ate}
        clienteId={clienteId}
        clientes={
          aba === "producao"
            ? clientes
                .filter((cliente) => cliente.ativo)
                .map((cliente) => ({ id: cliente.id, nome_empresa: cliente.nome_empresa }))
            : undefined
        }
      />

      {dados.tipo === "producao" ? (
        <PainelDeProducao dados={dados.producao} de={de} ate={ate} />
      ) : null}
      {dados.tipo === "tempo" ? (
        <PainelDeTempo
          porStatus={dados.porStatus}
          aprovacoes={dados.aprovacoes}
          de={de}
          ate={ate}
        />
      ) : null}
      {dados.tipo === "equipe" ? <PainelDaEquipe linhas={dados.linhas} de={de} ate={ate} /> : null}
      {dados.tipo === "qualidade" ? (
        <PainelDeQualidade linhas={dados.linhas} de={de} ate={ate} />
      ) : null}
      {dados.tipo === "rentabilidade" ? (
        <PainelDeRentabilidade linhas={dados.linhas} de={de} ate={ate} />
      ) : null}
    </div>
  );
}

/** A consulta de cada aba, uma por vez. O `tipo` é o que estreita na tela. */
async function carregar(aba: AbaDeMetrica, de: string, ate: string, clienteId: string | null) {
  if (aba === "tempo") {
    const [porStatus, aprovacoes] = await Promise.all([
      tempoPorStatus(de, ate),
      tempoDeAprovacao(de, ate),
    ]);
    return { tipo: "tempo" as const, porStatus, aprovacoes };
  }
  if (aba === "equipe") {
    return { tipo: "equipe" as const, linhas: await desvioDeEstimativa(de, ate) };
  }
  if (aba === "qualidade") {
    return { tipo: "qualidade" as const, linhas: await qualidadeDaEntrega(de, ate) };
  }
  if (aba === "rentabilidade") {
    return { tipo: "rentabilidade" as const, linhas: await rentabilidadeDoPeriodo(de, ate) };
  }
  return { tipo: "producao" as const, producao: await producaoDoPeriodo(de, ate, clienteId) };
}
