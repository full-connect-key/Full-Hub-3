import {
  agruparBusca,
  MINIMO_PARA_BUSCAR,
  POR_GRUPO,
  type GrupoDaBusca,
  type ResultadoDaBusca,
} from "@/lib/dominio/busca";

/**
 * A busca no protótipo.
 *
 * Ela existe porque a paleta abre de QUALQUER tela — o campo mora na topbar do
 * layout, então sem este stub a rodada inteira teria uma ação que chama o
 * Supabase, e o domínio `.invalid` do protótipo a deixaria pendurada.
 *
 * **Ela filtra de verdade, com as mesmas linhas de exemplo**, em vez de
 * devolver uma lista fixa: uma paleta que mostra as mesmas oito linhas para
 * qualquer termo é uma imagem que não prova nada — nem o realce do trecho que
 * casou, nem o grupo vazio que some, nem o corte que diz quantos sobraram. E
 * quem agrupa é `agruparBusca()`, a mesma função do produto, porque é ela que a
 * imagem existe para conferir.
 *
 * **O que ela NÃO prova é a RLS**, como todo stub daqui: `busca_global()` não é
 * `security definer` e é o Postgres quem decide o que cada perfil acha. Quem
 * mede isso é `supabase/testes/`, com material de duas empresas.
 */

const EXEMPLOS: Omit<ResultadoDaBusca, "posicao" | "total">[] = [
  // OITO DEMANDAS COM "OUTUBRO", e o numero e o ponto: o limite por grupo e
  // seis, entao a imagem mostra o corte e o "e mais 2" embaixo dele. Sem elas,
  // a unica coisa que nenhuma outra tela do produto desenha ficaria sem foto.
  ...[
    "Campanha de Outubro — Mundo Verde",
    "Vitrine de Outubro — Óptica Visão",
    "Newsletter de Outubro",
    "Pauta de Outubro — Mundo Verde",
    "Relatório de Outubro — Óptica Visão",
    "Institucional de Outubro",
    "Brindes de Outubro",
  ].map((titulo, i) => ({
    tipo: "demanda" as const,
    id: `11111111-1111-1111-1111-11111111111${i}`,
    titulo,
    // O CLIENTE SAI DO PROPRIO TITULO onde ele esta escrito: com um
    // `i % 2` alternado, "Pauta de Outubro — Mundo Verde" aparecia com
    // "Óptica Visão" embaixo. Dado de exemplo que se contradiz na mesma linha
    // e pior que dado nenhum, porque quem confere a imagem para de confiar
    // nela em vez de reparar no layout.
    contexto: titulo.includes("Óptica") ? "Óptica Visão" : "Mundo Verde",
    caminho: `/painel/gestao-tasks/11111111-1111-1111-1111-11111111111${i}`,
    selo: null,
  })),
  // O RASCUNHO, com o selo que diz que a equipe ainda nao o ve.
  {
    tipo: "demanda",
    id: "11111111-1111-1111-1111-11111111111a",
    titulo: "Relatório de mídia — Outubro",
    contexto: "Óptica Visão",
    caminho: "/painel/gestao-tasks/11111111-1111-1111-1111-11111111111a",
    selo: "Rascunho",
  },
  {
    tipo: "etapa",
    id: "22222222-2222-2222-2222-222222222221",
    titulo: "Layout do carrossel de Outubro",
    contexto: "Mundo Verde · Campanha de Outubro",
    caminho: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111110",
    selo: null,
  },
  {
    tipo: "cliente",
    id: "33333333-3333-3333-3333-333333333331",
    titulo: "Mundo Verde",
    contexto: "Joana Prado",
    caminho: "/painel/pessoas/clientes/33333333-3333-3333-3333-333333333331",
    selo: null,
  },
  {
    tipo: "cliente",
    id: "33333333-3333-3333-3333-333333333332",
    titulo: "Óptica Visão",
    contexto: "Caio Alves",
    caminho: "/painel/pessoas/clientes/33333333-3333-3333-3333-333333333332",
    selo: null,
  },
  {
    tipo: "pessoa",
    id: "44444444-4444-4444-4444-444444444441",
    titulo: "Marina Dias",
    contexto: "Social Media",
    caminho: "/painel/pessoas/equipe/44444444-4444-4444-4444-444444444441",
    selo: null,
  },
  {
    tipo: "pessoa",
    id: "44444444-4444-4444-4444-444444444442",
    titulo: "Letícia Moraes",
    contexto: "Redatora",
    caminho: "/painel/pessoas/equipe/44444444-4444-4444-4444-444444444442",
    selo: "Desligada",
  },
  {
    tipo: "campanha",
    id: "55555555-5555-5555-5555-555555555551",
    titulo: "Wave Outubro Rosa",
    contexto: "Mundo Verde",
    caminho: "/painel/aprovacoes/campanhas/55555555-5555-5555-5555-555555555551",
    selo: null,
  },
  {
    tipo: "post",
    id: "66666666-6666-6666-6666-666666666661",
    titulo: "Outubro Rosa: dica de consumo consciente",
    contexto: "Mundo Verde · 14/10/2026",
    caminho: "/painel/social-media?post=66666666-6666-6666-6666-666666666661",
    selo: null,
  },
  {
    tipo: "equipamento",
    id: "77777777-7777-7777-7777-777777777771",
    titulo: "Notebook Dell",
    contexto: "FCK-0002 · Dell Vostro 3520",
    caminho: "/painel/comodatos/77777777-7777-7777-7777-777777777771",
    selo: null,
  },
  {
    tipo: "pedido",
    id: "88888888-8888-8888-8888-888888888881",
    titulo: "Arte para a vitrine de Outubro",
    contexto: "Mundo Verde",
    caminho: "/painel/solicitacoes/88888888-8888-8888-8888-888888888881",
    selo: null,
  },
  {
    tipo: "trilha",
    id: "99999999-9999-9999-9999-999999999991",
    titulo: "Briefing que não volta com dúvida",
    contexto: "Atendimento",
    caminho: "/painel/academy/99999999-9999-9999-9999-999999999991",
    selo: null,
  },
];

/** O mesmo mapa de `sem_acento()` na 0073 e do realce na paleta. */
function dobrar(texto: string): string {
  const com = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
  const sem = "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN";
  let saida = "";
  for (const letra of texto) {
    const i = com.indexOf(letra);
    saida += i >= 0 ? sem[i] : letra;
  }
  return saida.toLowerCase();
}

export async function buscarNaPlataforma(termo: string): Promise<GrupoDaBusca[]> {
  const limpo = dobrar(termo.trim());
  if (limpo.length < MINIMO_PARA_BUSCAR) return [];

  // CASA NO NOME, e no segundo campo SO onde a 0073 tem um segundo campo:
  // cliente (o contato), pessoa (o e-mail) e equipamento (o codigo e o numero
  // de serie). A primeira versao casava no contexto de TODOS os tipos, e a
  // imagem do protótipo mostrou o estrago: buscar "verde" trazia a campanha, o
  // post e o pedido -- todos sem realce nenhum no titulo, porque o que casou
  // foi o nome do cliente embaixo. Uma paleta com cinco linhas que a busca de
  // verdade nao devolve nao confere o produto, confere o stub.
  const COM_SEGUNDO_CAMPO = new Set(["cliente", "pessoa", "equipamento"]);
  const casaram = EXEMPLOS.filter(
    (e) =>
      dobrar(e.titulo).includes(limpo) ||
      (COM_SEGUNDO_CAMPO.has(e.tipo) && dobrar(e.contexto ?? "").includes(limpo)),
  );

  // O `total` sai da contagem POR TIPO, como o `count` de janela da 0073 —
  // senão o "e mais N" do rodapé de cada grupo nunca apareceria na imagem.
  const porTipo = new Map<string, number>();
  for (const e of casaram) porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + 1);

  // O CORTE POR GRUPO ACONTECE AQUI, e a primeira versao esquecia dele: o
  // limite mora no `limit v_limite` de cada ramo da 0073, e o stub devolvia
  // tudo. A imagem saiu com OITO demandas, num produto que mostra seis -- e
  // sem o "e mais 2" embaixo, que e justamente a linha que nenhuma outra tela
  // do produto desenha. Foi a imagem que mostrou.
  const cortados: ResultadoDaBusca[] = [];
  const quantosJa = new Map<string, number>();
  for (const e of casaram) {
    const ja = quantosJa.get(e.tipo) ?? 0;
    if (ja >= POR_GRUPO) continue;
    quantosJa.set(e.tipo, ja + 1);
    cortados.push({
      ...e,
      posicao: dobrar(e.titulo).indexOf(limpo) + 1,
      // O `total` continua sendo a contagem INTEIRA, e nao a cortada: e ele
      // que vira o "e mais N". Contar depois do corte diria sempre seis.
      total: porTipo.get(e.tipo) ?? 1,
    });
  }

  return agruparBusca(cortados);
}
