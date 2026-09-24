import { notFound } from "next/navigation";

import {
  DetalheDoConteudo,
  dataLonga,
  type ModeloDoConteudo,
} from "@/components/portal/telas/detalhe-do-conteudo";
import { doEntregavel } from "@/lib/aprovacoes/conteudo";
import {
  entregaveisDaCampanha,
  obterCampanha,
  obterEntregavel,
  urlsDosArquivos,
  versoesDoEntregavel,
} from "@/lib/dados/campanhas";
import { comentariosDe, enderecoDaArte } from "@/lib/dados/conteudo";
import { emArvore, type EntregavelDoPortal } from "@/lib/dominio/campanhas";

/**
 * O entregável, montado para a MESMA tela de decisão do post.
 *
 * A casca é `DetalheDoConteudo`; este arquivo lê `deliverables` e traduz o
 * resultado para o modelo que ela desenha. O post faz o mesmo a partir de
 * `posts` — e é isso que garante que o botão de aprovar seja literalmente o
 * mesmo código nos dois módulos.
 *
 * O que é específico do entregável fica visível justamente por estar aqui: a
 * linhagem `Campanha › Grupo` na linha de contexto, o nome do arquivo no lugar
 * da legenda, e a vizinhança contada dentro da ÁRVORE — entre irmãos do mesmo
 * grupo quando ele tem um, entre os itens de topo quando não tem.
 */
export async function DetalheDoEntregavel({
  entregavelId,
  campanhaId,
  base,
  clienteId,
  comoEquipe,
  nomeDaEmpresa,
  agora,
}: {
  entregavelId: string;
  campanhaId: string;
  base: string;
  clienteId: string | null;
  comoEquipe: boolean;
  nomeDaEmpresa: string;
  agora: string;
}) {
  const [item, campanha] = await Promise.all([
    obterEntregavel(entregavelId),
    obterCampanha(campanhaId, clienteId ?? undefined),
  ]);

  // 404 E NÃO 403, como no post. E a checagem da campanha não é zelo a mais:
  // sem ela, o id de um entregável de OUTRA campanha do mesmo cliente abriria
  // por esta rota, com o cabeçalho dizendo uma campanha e o conteúdo sendo de
  // outra.
  if (!item || !campanha || item.campanhaId !== campanha.id) notFound();

  const [versoes, comentarios, irmaos] = await Promise.all([
    versoesDoEntregavel(item.id),
    comentariosDe(doEntregavel(item.id)),
    entregaveisDaCampanha(campanha.id),
  ]);

  const arquivos = await urlsDosArquivos([
    item.arteUrl,
    ...versoes.map((v) => v.arteUrl),
  ]);

  const arquivo = enderecoDaArte(item.arteUrl, arquivos);
  const arvore = emArvore(irmaos);
  const grupo = item.paiId
    ? (irmaos.find((i) => i.id === item.paiId) ?? null)
    : null;

  const { anterior, proximo } = vizinhosDe(
    item,
    grupo
      ? (arvore.find((no) => no.item.id === grupo.id)?.filhos ?? [])
      : arvore.map((no) => no.item),
  );

  const linkDo = (vizinho: EntregavelDoPortal | null) =>
    vizinho ? `${base}/${campanha.id}/${vizinho.id}` : null;

  const modelo: ModeloDoConteudo = {
    conteudo: doEntregavel(item.id),
    titulo: item.nome,
    // A LINHAGEM, e não a data: um entregável não tem data de publicação, e o
    // que situa a pessoa é de que campanha e de que frente ele veio.
    linhaDeContexto: grupo
      ? `${campanha.nome} › ${grupo.nome}`
      : campanha.nome,
    status: item.status,
    propriedades: [
      { rotulo: "Campanha", valor: campanha.nome },
      ...(grupo ? [{ rotulo: "Frente", valor: grupo.nome }] : []),
      { rotulo: "Arquivo", valor: item.arquivoNome ?? "—" },
      { rotulo: "Versão", valor: String(item.versaoAtual) },
      {
        rotulo: "Prazo",
        valor: item.prazo ? dataLonga(item.prazo) : "Sem prazo definido",
      },
    ],
    // "Descrição" e não "Legenda": um entregável de campanha não vai para uma
    // rede social. O rótulo também vira o do histórico de versões, onde o
    // texto comparado é o nome do arquivo.
    texto: { titulo: "Descrição", rotulo: "a descrição", corpo: item.descricao },
    arte: arquivo,
    versaoAtual: item.versaoAtual,
    download: arquivo
      ? { href: arquivo, nome: item.arquivoNome ?? item.nome }
      : null,
    rodadaPendenteId: item.rodadaPendenteId,
    decididoPor: item.decididoPor,
    decididoEm: item.decididoEm,
    voltar: {
      href: `${base}/${campanha.id}`,
      rotulo: "Voltar à campanha",
    },
    vizinhos: { anterior: linkDo(anterior), proximo: linkDo(proximo) },
    rotuloDosVizinhos: grupo
      ? `Outros materiais de ${grupo.nome}`
      : "Outros materiais da campanha",
  };

  return (
    <DetalheDoConteudo
      modelo={modelo}
      versoes={versoes}
      comentarios={comentarios}
      artes={arquivos}
      agora={agora}
      nomeDaEmpresa={nomeDaEmpresa}
      comoEquipe={comoEquipe}
    />
  );
}

/**
 * O anterior e o próximo, entre os IRMÃOS.
 *
 * Passar de um sub-item do Enxoval direto para o KV cruzaria duas frentes que
 * não têm nada a ver uma com a outra — e quem está conferindo o enxoval está
 * conferindo o enxoval. A ordem é a mesma da árvore, senão "próximo" apontaria
 * para um item que não era o de baixo na lista.
 */
function vizinhosDe(item: EntregavelDoPortal, irmaos: EntregavelDoPortal[]) {
  const indice = irmaos.findIndex((i) => i.id === item.id);
  return {
    anterior: indice > 0 ? irmaos[indice - 1] : null,
    proximo:
      indice >= 0 && indice < irmaos.length - 1 ? irmaos[indice + 1] : null,
  };
}
