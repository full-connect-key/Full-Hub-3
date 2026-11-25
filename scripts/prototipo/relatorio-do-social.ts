/**
 * O relatório de desempenho do social de exemplo (migration 0150).
 *
 * ---------------------------------------------------------------------------
 * **A MUNDO VERDE TEM RELATÓRIO E A ÓPTICA VISÃO NÃO TEM**, de propósito: o
 * bloco do portal SOME quando a conta não tem número nenhum, e esse é o estado
 * de todo mês que a social media ainda não fechou. Com as duas preenchidas,
 * nenhuma imagem mostraria a ausência — a lição da Óptica Visão sem atendente
 * (0062) e da duplicata do Cronograma.
 *
 * **O MÊS É CALCULADO E NUNCA LITERAL**, que é a lição dos meses da nota
 * fiscal: o portal abre em `mesDe(hoje)` e o painel em `mesesParaRelatar()[0]`,
 * então uma competência fixa para de ser o mês corrente sozinha e as duas telas
 * sairiam vazias sem nada reclamar.
 *
 * ---------------------------------------------------------------------------
 * **SÃO OS QUATRO ESTADOS QUE O SELO DE GANHO DISTINGUE**, e é por isso que os
 * números do mês anterior não são todos menores:
 *
 *   subiu       — alcance e curtidas, o selo verde
 *   caiu        — impressões, SEM selo
 *   empatou     — visualizações, SEM selo
 *   sem anterior— salvamentos, SEM selo
 *
 * Com tudo subindo, a imagem provaria que o selo aparece e não que ele
 * **escolhe** — que é a razão do evento de cada par da legenda do calendário, e
 * é exatamente o item 18 do pedido: *"que os dados apareçam sempre quando forem
 * positivos"*.
 *
 * **E O MÊS ANTERIOR ESTÁ PUBLICADO**, porque a comparação só existe contra um
 * mês publicado: com ele em rascunho o selo não sairia em imagem nenhuma.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * **E `redesDoMes()` DEVOLVE DUAS, não as cinco que os posts do exemplo usam.**
 * A conta de exemplo espalha as peças por cinco redes de propósito — é assim
 * que o selo de cada uma sai em imagem —, e cinco blocos de dez campos seriam
 * CINQUENTA campos na foto do formulário: a imagem provaria que a tela rola, e
 * não que ela começa pelas redes que o mês tem. Duas é o que uma conta de
 * verdade posta, e é o que deixa o chip de acrescentar a terceira visível.
 * ---------------------------------------------------------------------------
 */
import {
  type NumeroDoRelatorio,
  type RelatorioDoSocial,
} from "@/lib/dominio/relatorio-do-social";
import type { PlataformaSocial } from "@/lib/supabase/database.types";

const MUNDO_VERDE = "c0000000-0000-0000-0000-00000000000a";

/** O mês corrente e o anterior, em `YYYY-MM`, calculados. */
function mesCorrente(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function anterior(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const CORRENTE = mesCorrente();
const ANTERIOR = anterior(CORRENTE);

const ID_CORRENTE = "f3000000-0000-0000-0000-000000000001";
const ID_ANTERIOR = "f3000000-0000-0000-0000-000000000002";

function relatorio(
  id: string,
  mes: string,
  publicado: boolean,
): RelatorioDoSocial {
  return {
    id,
    client_id: MUNDO_VERDE,
    competencia: `${mes}-01`,
    comentario: publicado
      ? "Mês puxado pelo carrossel de receitas: ele respondeu por quase metade do alcance."
      : null,
    publicado_em: publicado ? `${mes}-28T12:00:00.000Z` : null,
    publicado_por: publicado ? "a0000000-0000-0000-0000-000000000003" : null,
    criado_por: "a0000000-0000-0000-0000-000000000003",
    created_at: `${mes}-26T10:00:00.000Z`,
    updated_at: `${mes}-28T12:00:00.000Z`,
  };
}

type Linha = [PlataformaSocial, NumeroDoRelatorio["metrica"], number];

const DO_MES: Linha[] = [
  ["instagram", "alcance", 48200],
  ["instagram", "impressoes", 72500],
  ["instagram", "visualizacoes", 31400],
  ["instagram", "curtidas", 2840],
  ["instagram", "comentarios", 196],
  ["instagram", "salvamentos", 412],
  ["instagram", "seguidores", 18340],
  ["facebook", "alcance", 12400],
  ["facebook", "curtidas", 530],
  ["facebook", "seguidores", 4120],
];

const DO_ANTERIOR: Linha[] = [
  ["instagram", "alcance", 41000], // subiu
  ["instagram", "impressoes", 75200], // caiu
  ["instagram", "visualizacoes", 31400], // empatou
  ["instagram", "curtidas", 2110], // subiu
  ["instagram", "comentarios", 142], // subiu
  // "salvamentos" NÃO está aqui: é o quarto estado, sem anterior.
  ["instagram", "seguidores", 18000], // subiu
  ["facebook", "alcance", 9800], // subiu
  ["facebook", "curtidas", 610], // caiu
  ["facebook", "seguidores", 4098], // subiu
];

function numeros(reportId: string, linhas: Linha[]): NumeroDoRelatorio[] {
  return linhas.map(([plataforma, metrica, valor], i) => ({
    id: `f4${reportId.slice(2, 10)}-0000-0000-0000-${String(i).padStart(12, "0")}`,
    report_id: reportId,
    plataforma,
    metrica,
    valor,
    fonte: "manual" as const,
    created_at: "2026-01-10T10:00:00.000Z",
    updated_at: "2026-01-10T10:00:00.000Z",
  }));
}

export type RelatorioComNumeros = {
  relatorio: RelatorioDoSocial | null;
  numeros: NumeroDoRelatorio[];
  anteriores: NumeroDoRelatorio[];
};

const VAZIO: RelatorioComNumeros = {
  relatorio: null,
  numeros: [],
  anteriores: [],
};

function doMes(clienteId: string, mes: string): RelatorioComNumeros {
  if (clienteId !== MUNDO_VERDE) return VAZIO;

  if (mes === CORRENTE) {
    return {
      relatorio: relatorio(ID_CORRENTE, CORRENTE, true),
      numeros: numeros(ID_CORRENTE, DO_MES),
      anteriores: numeros(ID_ANTERIOR, DO_ANTERIOR),
    };
  }

  if (mes === ANTERIOR) {
    return {
      relatorio: relatorio(ID_ANTERIOR, ANTERIOR, true),
      numeros: numeros(ID_ANTERIOR, DO_ANTERIOR),
      anteriores: [],
    };
  }

  return VAZIO;
}

export async function relatoriosDoMes(
  clienteIds: string[],
  mes: string,
): Promise<Map<string, RelatorioComNumeros>> {
  const mapa = new Map<string, RelatorioComNumeros>();
  for (const id of [...new Set(clienteIds.filter(Boolean))]) {
    const linha = doMes(id, mes);
    if (linha.relatorio) mapa.set(id, linha);
  }
  return mapa;
}

export async function relatorioDoMes(
  clienteId: string,
  mes: string,
): Promise<RelatorioComNumeros> {
  return doMes(clienteId, mes);
}

export async function estadoDosRelatorios(
  clienteIds: string[],
): Promise<Map<string, RelatorioDoSocial>> {
  const mapa = new Map<string, RelatorioDoSocial>();
  if (!clienteIds.includes(MUNDO_VERDE)) return mapa;
  mapa.set(`${MUNDO_VERDE}|${CORRENTE}`, relatorio(ID_CORRENTE, CORRENTE, true));
  mapa.set(`${MUNDO_VERDE}|${ANTERIOR}`, relatorio(ID_ANTERIOR, ANTERIOR, true));
  return mapa;
}

export async function redesDoMes(
  clienteId: string,
  _mes: string,
): Promise<PlataformaSocial[]> {
  return clienteId === MUNDO_VERDE ? ["instagram", "facebook"] : [];
}
