import type { Metadata } from "next";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import {
  desvioDeEstimativa,
  producaoDoPeriodo,
  qualidadeDaEntrega,
  tempoDeAprovacao,
  tempoPorStatus,
} from "@/lib/dados/metricas";
import {
  datasDoPeriodo,
  ehAbaDeMetrica,
  ehPeriodo,
  type AbaDeMetrica,
  type Periodo,
} from "@/lib/dominio/metricas";

import { AbasDeMetrica } from "./abas";
import { BarraDePeriodo } from "./barra-de-periodo";
import {
  PainelDaEquipe,
  PainelDeProducao,
  PainelDeQualidade,
  PainelDeTempo,
} from "./paineis";

export const metadata: Metadata = { title: "Métricas" };

/**
 * NÃO EXISTE `QUEM_VE` AQUI, e a ausência é decisão (0095).
 *
 * Ele existia por causa de UMA aba: a Rentabilidade era `is_socio()` enquanto
 * as outras quatro são `is_gestor()`. A 0095 apagou
 * `rentabilidade_do_periodo()` com a receita, e as quatro que ficam respondem
 * todas à mesma pergunta de perfil — então um mapa de perfil por aba seria uma
 * segunda pergunta embaixo de uma primeira que já barra todo mundo, que é a
 * lição da 0060.
 *
 * Quem decide continua sendo `roles: GESTAO` da rota em `permissions.ts`, mais
 * o `is_gestor()` na primeira linha de cada função da 0035 — que é a camada
 * que vale, e que recusa quem chamar a RPC direto.
 */
const PADRAO: AbaDeMetrica = "producao";

const texto = (valor: string | string[] | undefined) =>
  typeof valor === "string" && valor !== "" ? valor : undefined;

export default async function PaginaDeMetricas({ searchParams }: PageProps<"/painel/metricas">) {
  const sessao = await exigirAcessoARota("/painel/metricas");
  const parametros = await searchParams;

  // `?aba=rentabilidade` de um link salvo cai na padrão em vez de quebrar:
  // `ehAbaDeMetrica()` recusa o que não existe mais na união. É o que um
  // endereço antigo tem de fazer — abrir.
  const pedida = texto(parametros.aba);
  const aba: AbaDeMetrica = ehAbaDeMetrica(pedida) ? pedida : PADRAO;

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

  // SÓ A CONSULTA DA ABA ABERTA. Buscar as quatro a cada visita faria cinco
  // idas ao banco para desenhar uma tabela.
  const [clientes, dados] = await Promise.all([
    aba === "producao" ? listarClientes() : Promise.resolve([]),
    carregar(aba, de, ate, clienteId),
  ]);

  return (
    <div className="space-y-6">
      {/* Sem `PageHeader`: a topbar já diz "Métricas". O `<h1>` mora na
          barra de contexto, invisível. */}
      <AbasDeMetrica atual={aba} />

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
  return { tipo: "producao" as const, producao: await producaoDoPeriodo(de, ate, clienteId) };
}
