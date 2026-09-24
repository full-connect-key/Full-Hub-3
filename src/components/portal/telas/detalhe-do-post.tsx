import { notFound } from "next/navigation";

import { SeloDaRede } from "@/components/portal/selo-da-rede";
import {
  DetalheDoConteudo,
  dataLonga,
  type ModeloDoConteudo,
} from "@/components/portal/telas/detalhe-do-conteudo";
import { doPost } from "@/lib/aprovacoes/conteudo";
import {
  comentariosDoPost,
  enderecoDaArte,
  obterPost,
  postsDoMes,
  urlsDasArtes,
  versoesDoPost,
} from "@/lib/dados/posts";
import {
  mesDe,
  ROTULO_DA_PLATAFORMA,
  type PostDoPortal,
} from "@/lib/dominio/posts";

/**
 * O post, montado para a tela de decisão.
 *
 * **Aqui não há casca nenhuma: ela é de `DetalheDoConteudo`.** O que este
 * arquivo faz é ler `posts` e traduzir o resultado para o modelo que a casca
 * desenha. O entregável de campanha monta o mesmo modelo a partir de
 * `deliverables`, e é por isso que existe uma tela de detalhe só.
 *
 * O que é específico do post fica visível justamente por estar aqui: a rede
 * como selo, o horário na linha de contexto, o formato entre as propriedades,
 * e a vizinhança contada dentro do MÊS — porque foi de um calendário mensal
 * que a pessoa veio.
 *
 * `somenteLeitura` desliga os botões na visualização da equipe; a recusa de
 * verdade continua sendo `decidir_rodada_do_cliente`, que recusa quem não é o
 * cliente daquela rodada.
 */
export async function DetalheDoPost({
  postId,
  base,
  clienteId,
  comoEquipe,
  nomeDaEmpresa,
  agora,
}: {
  postId: string;
  base: string;
  clienteId: string | null;
  comoEquipe: boolean;
  nomeDaEmpresa: string;
  agora: string;
}) {
  const post = await obterPost(postId, clienteId ?? undefined);

  // 404 E NÃO 403, e é deliberado: para quem não pode ver, o post não existe.
  // Um 403 confirmaria que existe um material com aquele id — que é
  // exatamente o que alguém varrendo uuids quer saber.
  if (!post) notFound();

  const [versoes, comentarios, doMes] = await Promise.all([
    versoesDoPost(post.id),
    comentariosDoPost(post.id),
    postsDoMes(mesDe(post.dataPublicacao), clienteId ?? undefined),
  ]);

  const artes = await urlsDasArtes([
    post.arteUrl,
    ...versoes.map((v) => v.arteUrl),
  ]);

  const { anterior, proximo } = vizinhosDe(post, doMes);

  const modelo: ModeloDoConteudo = {
    conteudo: doPost(post.id),
    titulo: post.tema,
    linhaDeContexto:
      dataLonga(post.dataPublicacao) +
      (post.horario ? ` · ${post.horario}` : ""),
    status: post.status,
    selo: <SeloDaRede plataforma={post.plataforma} />,
    // O tema NÃO se repete aqui: ele é o título da página, logo acima. Um
    // campo que repete o cabeçalho ocupa a linha que o formato ou o prazo
    // poderiam ocupar.
    propriedades: [
      { rotulo: "Plataforma", valor: ROTULO_DA_PLATAFORMA[post.plataforma] },
      { rotulo: "Formato", valor: post.formato ?? "—" },
      { rotulo: "Horário", valor: post.horario ?? "A definir" },
      { rotulo: "Versão", valor: String(post.versaoAtual) },
      {
        rotulo: "Prazo para decidir",
        valor: post.prazoAprovacao
          ? dataLonga(post.prazoAprovacao)
          : "Sem prazo definido",
      },
    ],
    texto: { titulo: "Legenda", corpo: post.legenda },
    arte: enderecoDaArte(post.arteUrl, artes),
    versaoAtual: post.versaoAtual,
    rodadaPendenteId: post.rodadaPendenteId,
    decididoPor: post.decididoPor,
    decididoEm: post.decididoEm,
    voltar: {
      href: `${base}/social-media?mes=${mesDe(post.dataPublicacao)}`,
      rotulo: "Voltar ao calendário",
    },
    vizinhos: {
      anterior: anterior ? `${base}/social-media/${anterior.id}` : null,
      proximo: proximo ? `${base}/social-media/${proximo.id}` : null,
    },
    rotuloDosVizinhos: "Outros materiais do mês",
  };

  return (
    <DetalheDoConteudo
      modelo={modelo}
      versoes={versoes}
      comentarios={comentarios}
      artes={artes}
      agora={agora}
      nomeDaEmpresa={nomeDaEmpresa}
      comoEquipe={comoEquipe}
    />
  );
}

/**
 * O anterior e o próximo, na ordem do calendário.
 *
 * A ordem é a mesma da tela de onde a pessoa veio — data e depois horário —,
 * porque uma segunda ordem aqui faria "próximo" apontar para um post que não
 * era o de baixo na lista.
 */
function vizinhosDe(post: PostDoPortal, doMes: PostDoPortal[]) {
  const ordenados = [...doMes].sort((a, b) => {
    const porData = a.dataPublicacao.localeCompare(b.dataPublicacao);
    if (porData !== 0) return porData;
    return (a.horario ?? "99:99").localeCompare(b.horario ?? "99:99");
  });

  const indice = ordenados.findIndex((p) => p.id === post.id);
  return {
    anterior: indice > 0 ? ordenados[indice - 1] : null,
    proximo:
      indice >= 0 && indice < ordenados.length - 1
        ? ordenados[indice + 1]
        : null,
  };
}
