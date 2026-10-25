import "server-only";

// PELO ALIAS, nunca por caminho relativo: o gerador de protótipo troca estes
// quatro módulos por stubs pelo `paths` do TypeScript, e um `./portal`
// escaparia da troca.
//
// **E ESTE ARQUIVO NÃO FALA COM O BANCO**, de propósito: as duas leituras que
// faltavam foram para os módulos que já leem aquelas tabelas. Com um
// `criarClienteServidor()` aqui, o protótipo precisaria de um stub DESTE
// arquivo — e aí a imagem passaria a conferir o stub em vez da agregação de
// verdade, que é exatamente onde o bug da duplicata do cronograma se
// escondeu.
import { arquivosDasPecas, urlsDosArquivos } from "@/lib/dados/campanhas";
import { assinarArquivos } from "@/lib/dados/conteudo";
import { entregasDasEtapas, itensDoPortal } from "@/lib/dados/portal";
import { urlsDasArtes } from "@/lib/dados/posts";
import type { ArquivoDaBiblioteca } from "@/lib/dominio/biblioteca";

/**
 * O QUE JÁ FOI APROVADO, com o arquivo quando existe um.
 *
 * ---------------------------------------------------------------------------
 * **Ela parte de `itensDoPortal`, que já agrega as três frentes** — e não de
 * três consultas novas: uma segunda leitura nomeando as mesmas colunas seria
 * o quarto lugar decidindo o que o cliente enxerga, e o que vaza é sempre o
 * quarto. Quem recorta continua sendo a RLS.
 *
 * **Aqui a função é lida INTEIRA, ao contrário do cronograma.** Lá a fatia
 * existe porque a data de cada frente quer dizer coisas diferentes; aqui não
 * há data decidindo nada — a pergunta é "o que ficou pronto", e ela é a mesma
 * para as três.
 * ---------------------------------------------------------------------------
 */
export async function arquivosDaBiblioteca(
  base: string,
  clienteId?: string,
): Promise<ArquivoDaBiblioteca[]> {
  const aprovados = (await itensDoPortal(clienteId)).filter(
    (item) => item.status === "aprovado",
  );
  if (aprovados.length === 0) return [];

  /* ------------------------------------------ os arquivos de cada frente --
     O POST NÃO TEM DOWNLOAD, e é decisão escrita do produto: quem publica é
     a agência, e o que o cliente leva é a peça no ar, não o arquivo. O que
     ele ganha aqui é o link para a peça, onde a arte abre grande e o
     carrossel inteiro está.

     A PEÇA DE CAMPANHA tem: ela é o PDF de impressão, o AI aberto, o JPG de
     conferência — o material que alguém vai procurar semanas depois. O nome
     do arquivo vem da própria peça.

     O MATERIAL DE DEMANDA entrega por `subtask_entregas`, e ali cada linha
     já é um endereço: às vezes um arquivo do bucket, às vezes um link do
     Drive. `assinarArquivos` deixa passar o que começa com `http`, então as
     duas formas atravessam o mesmo caminho. */
  const idsDeSubtarefas = aprovados
    .filter((item) => item.tipo === "subtask")
    .map((item) => item.conteudoId);

  const entregas = await entregasDasEtapas(idsDeSubtarefas);

  const idsDeEntregaveis = aprovados
    .filter((item) => item.tipo === "deliverable")
    .map((item) => item.conteudoId);

  const pecas = await arquivosDasPecas(idsDeEntregaveis);

  const porEntregavel = new Map(pecas.map((p) => [p.id, p]));

  // AS ASSINATURAS VÃO EM BLOCO, uma ida por BUCKET — e cada caminho vai no
  // bucket dele. Mandar todos para os três resolveria igual (o que não é do
  // bucket volta ausente) e pagaria três assinaturas por arquivo para
  // esconder de quem lê depois qual arquivo mora onde.
  const porFrente = (tipo: string) =>
    aprovados.filter((item) => item.tipo === tipo).map((item) => item.miniatura);

  const [dasArtes, dosArquivos, dasEntregas] = await Promise.all([
    urlsDasArtes(porFrente("post")),
    urlsDosArquivos([
      ...pecas.map((p) => p.arte_url),
      ...porFrente("deliverable"),
    ]),
    // `task-arquivos`, que é o bucket da demanda: o arquivo entregue segue a
    // convenção `entregas/<subtask_id>/<nome>` desde a 0007, e é por ela que
    // a policy do Storage decide, por etapa, se o cliente pode abri-lo. Hoje
    // a tela de produção só anexa LINK — e por isso quase tudo aqui passa
    // direto, sem assinatura —, mas a porta do arquivo existe no banco desde
    // então, e assinar o que vier dela é o que faz esta tela não precisar
    // mudar no dia em que ela for usada.
    assinarArquivos("task-arquivos", [
      ...entregas.map((e) => e.url),
      ...porFrente("subtask"),
    ]),
  ]);

  const endereco = (
    caminho: string | null,
    mapa: Record<string, string>,
  ): string | null => {
    if (!caminho) return null;
    // O ENDEREÇO JÁ PRONTO PASSA DIRETO, que é o caso do link do Drive: o
    // mapa de assinatura só tem o que veio de bucket.
    if (/^https?:\/\//i.test(caminho)) return caminho;
    return mapa[caminho] ?? null;
  };

  return aprovados.map((item): ArquivoDaBiblioteca => {
    const peca =
      item.tipo === "deliverable" ? porEntregavel.get(item.conteudoId) : null;
    const entrega =
      item.tipo === "subtask"
        ? entregas.find((e) => e.subtask_id === item.conteudoId)
        : null;

    const arquivo = peca
      ? (() => {
          const href = endereco(peca.arte_url, dosArquivos);
          return href
            ? { href, nome: peca.arquivo_nome ?? item.titulo }
            : null;
        })()
      : entrega
        ? (() => {
            const href = endereco(entrega.url, dasEntregas);
            return href ? { href, nome: entrega.nome ?? item.titulo } : null;
          })()
        : null;

    return {
      id: `${item.tipo}-${item.conteudoId}`,
      frente:
        item.tipo === "post"
          ? "social"
          : item.tipo === "deliverable"
            ? "campanha"
            : "demanda",
      titulo: item.titulo,
      contexto: item.demanda || null,
      enviadoEm: item.enviadoEm,
      miniatura: endereco(
        item.miniatura,
        item.tipo === "post"
          ? dasArtes
          : item.tipo === "deliverable"
            ? dosArquivos
            : dasEntregas,
      ),
      caminho: item.caminho ? `${base}${item.caminho}` : null,
      arquivo,
    };
  });
}
