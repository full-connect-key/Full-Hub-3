import "server-only";

// AS TRÊS LEITURAS VÊM PELO ALIAS e não por caminho relativo, e isso não é
// estilo: o gerador de protótipo troca `@/lib/dados/posts`, `.../campanhas` e
// `.../portal` por stubs através do `paths` do TypeScript, e um `./posts`
// escaparia da troca — esta tela chamaria o Supabase de verdade no meio de uma
// rodada que não tem banco nenhum.
import { campanhasDoCliente, entregaveisDaCampanha } from "@/lib/dados/campanhas";
import { itensDoPortal } from "@/lib/dados/portal";
import { postsDoMes } from "@/lib/dados/posts";
import { emArvore, folhas } from "@/lib/dominio/campanhas";
import type { ItemDoCronograma } from "@/lib/dominio/cronograma";
import { deslocarMes } from "@/lib/dominio/posts";

/**
 * TUDO O QUE TEM DATA NAQUELE MÊS, nas três frentes.
 *
 * ---------------------------------------------------------------------------
 * **Ela não lê nenhuma tabela por conta própria**, e é isso que a mantém
 * honesta: as três leituras já existem e já são as que as telas de origem
 * usam, então o cronograma nunca mostra um material que o Social, a campanha
 * ou a fila não mostrem. Uma consulta nova aqui seria um quarto lugar
 * decidindo o que o cliente enxerga — e o que vaza é sempre o quarto.
 *
 * **E quem recorta continua sendo a RLS.** `postsDoMes`, `campanhasDoCliente`
 * e `itensDoPortal` já respondem pelas empresas de quem pergunta;
 * `clienteId` existe para a visualização administrativa, onde quem olha é da
 * equipe e enxerga todas.
 * ---------------------------------------------------------------------------
 */
export async function cronogramaDoMes(
  mes: string,
  base: string,
  clienteId?: string,
): Promise<ItemDoCronograma[]> {
  const primeiro = `${mes}-01`;
  const depoisDoFim = `${deslocarMes(mes, 1)}-01`;
  const noMes = (dia: string | null): dia is string =>
    !!dia && dia >= primeiro && dia < depoisDoFim;

  const [posts, campanhas, materiais] = await Promise.all([
    postsDoMes(mes, clienteId),
    campanhasDoCliente(clienteId),
    itensDoPortal(clienteId),
  ]);

  const itens: ItemDoCronograma[] = [];

  /* ------------------------------------------------------------- social --
     O RECORTE É A DEMANDA DO MÊS e não `data_publicacao`, e isso é regra do
     produto: a peça pode ser aberta sem data (0044) e a data é de quem
     produz, então filtrar por ela deixaria de fora uma peça que pertence
     àquele mês — foi o conserto do Sprint 3K, e a varredura de nomes mortos
     tem uma entrada só para esse filtro não voltar.

     **O que fica dito, porque é consequência:** uma peça do mês de outubro
     marcada para o dia 2 de novembro não aparece na grade de outubro nem na
     de novembro — na primeira porque o dia não está lá, na segunda porque ela
     é de outro mês de social. É a borda, e ela é rara: o mês de social é
     produzido para sair dentro dele. Quem a vê de qualquer jeito é o
     calendário do próprio Social, que é onde o mês é aberto. */
  for (const post of posts) {
    if (!noMes(post.dataPublicacao)) continue;
    itens.push({
      id: `post-${post.id}`,
      frente: "social",
      titulo: post.tema,
      contexto: post.horario ? `às ${post.horario}` : null,
      dia: post.dataPublicacao,
      status: post.status,
      caminho: `${base}/social-media/${post.id}`,
    });
  }

  /* ---------------------------------------------------------- campanhas --
     SÓ AS FOLHAS, como toda conta deste módulo: o grupo é uma linha na tela e
     quinze entregas no trabalho, e contá-lo poria no dia uma peça que não
     existe. A árvore é montada aqui pela mesma `emArvore` da tela da campanha
     — e as duas idas por campanha são as mesmas que o Início já faz. */
  const porCampanha = await Promise.all(
    campanhas.map(async (campanha) => ({
      campanha,
      itens: folhas(emArvore(await entregaveisDaCampanha(campanha.id))),
    })),
  );

  for (const { campanha, itens: pecas } of porCampanha) {
    for (const peca of pecas) {
      if (!noMes(peca.prazo)) continue;
      itens.push({
        id: `entregavel-${peca.id}`,
        frente: "campanha",
        titulo: peca.nome,
        contexto: campanha.nome,
        dia: peca.prazo,
        status: peca.status,
        caminho: `${base}/campanhas/${campanha.id}/${peca.id}`,
      });
    }
  }

  /* ----------------------------------------------------------- demandas --
     **SÓ A FATIA `subtask` DE `itensDoPortal`, e sem ela a grade MOSTRA CADA
     POST DUAS VEZES.** Aquela função não é só dos materiais de demanda: ela
     já agrega as três frentes — `postsComoItens` e `entregaveisComoItens`
     entram no `return` dela —, porque a pergunta que ela responde é "o que
     está esperando por mim", e essa é uma pergunta só.

     **A fatia é tomada aqui porque a DATA dela quer dizer outra coisa.** Para
     o post, `itensDoPortal` devolve `prazo_aprovacao ?? data_publicacao`, que
     é o prazo de DECIDIR — o certo para uma fila por urgência, e o errado
     numa grade que responde quando a peça vai ao ar; e numa peça já aprovada
     ele é uma data no passado que não quer dizer mais nada. Por isso as duas
     outras frentes vêm das leituras que carregam a data que a grade precisa,
     e desta vem o que só ela tem.

     O CHIP LEVA À FILA e não a uma tela própria: `ItemDoPortal.caminho` é
     nulo para este tipo de propósito — o material de uma demanda se decide na
     fila de Aprovações, e um link para uma tela que não existe é pior que
     link nenhum. */
  for (const material of materiais) {
    if (material.tipo !== "subtask") continue;
    if (!noMes(material.prazo)) continue;
    itens.push({
      id: `material-${material.conteudoId}`,
      frente: "demanda",
      titulo: material.titulo,
      contexto: material.demanda || null,
      dia: material.prazo,
      status: material.status,
      caminho: material.caminho
        ? `${base}${material.caminho}`
        : `${base}/aprovacoes`,
    });
  }

  return itens;
}
