import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Download, FolderOpen, ImageOff } from "lucide-react";

import { FiltrosDaBiblioteca as BarraDaBiblioteca } from "@/components/portal/filtros-da-biblioteca";
import { EmptyState } from "@/components/shared/empty-state";
import { arquivosDaBiblioteca } from "@/lib/dados/biblioteca";
import { vertentesDoCliente } from "@/lib/dados/vertentes";
import {
  combinaComFiltros,
  empresaUnicaDoAcervo,
  opcoesDaBiblioteca,
  type ArquivoDaBiblioteca,
  type FiltrosDaBiblioteca,
} from "@/lib/dominio/biblioteca";
import { ROTULO_DA_FRENTE } from "@/lib/dominio/cronograma";
import type { Vertente } from "@/lib/dominio/vertentes";

/**
 * A BIBLIOTECA — onde o cliente pega de volta o material pronto.
 *
 * **Uma seção e nenhuma aba**, e a razão está escrita em
 * `lib/dominio/biblioteca.ts`: das cinco abas do roteiro, quatro não têm
 * tabela, bucket nem tela de upload por trás. O que entrou no lugar é a
 * **navegação por vertente** (item 29, migration 0119), que é a fileira de
 * chips com "Todos os materiais" na primeira posição.
 *
 * **Tudo mora na URL**, como todo filtro de listagem do produto: "manda o
 * link do KV" precisa ser um link.
 */
export async function BibliotecaDoPortal({
  base,
  clienteId,
  filtros,
}: {
  base: string;
  clienteId: string | null;
  filtros: FiltrosDaBiblioteca;
}) {
  const todos = await arquivosDaBiblioteca(base, clienteId ?? undefined);

  /* ------------------------------------------------- de quem é este acervo --
     A FILEIRA DE VERTENTES SÓ EXISTE PARA UMA EMPRESA, e quem responde é o
     próprio acervo: `empresaUnicaDoAcervo()`. Nenhuma consulta a mais para
     descobrir isso — quem responde por duas contas e não escolheu nenhuma no
     cabeçalho vê o material das duas, e "Institucional" existe nas duas com
     ids diferentes.

     **Ela sai de `clienteId` só quando ele vem**, que é a visualização
     administrativa; no portal do cliente ele é nulo na maioria das visitas, e
     aí é o acervo que diz. Perguntar `obterMinhasEmpresas()` daria a mesma
     resposta e uma ida ao banco a mais. */
  const empresa = empresaUnicaDoAcervo(todos);
  const vertentes: Vertente[] = empresa
    ? await vertentesDoCliente(empresa)
    : [];

  const encontrados = todos.filter((arquivo) =>
    combinaComFiltros(arquivo, filtros),
  );

  // CADA DIMENSÃO CONTADA COM AS OUTRAS APLICADAS, nunca com ela mesma — a
  // razão inteira está em `opcoesDaBiblioteca()`, e ela veio da imagem: a
  // fileira prometia "E-commerce 2" num mês que tem um material.
  const opcoes = opcoesDaBiblioteca(todos, filtros);

  return (
    <div className="space-y-5">
      <BarraDaBiblioteca
        filtros={filtros}
        encontrados={encontrados.length}
        temAlgum={todos.length > 0}
        vertentes={vertentes}
        porVertente={opcoes.porVertente}
        frentes={opcoes.frentes}
        meses={opcoes.meses}
      />

      {todos.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nada aprovado ainda"
          description="Quando você aprovar um material, ele fica guardado aqui para baixar depois."
          className="bg-card rounded-card shadow-cartao border-solid"
        />
      ) : encontrados.length === 0 ? (
        /* O VAZIO DO RECORTE TEM FRASE PRÓPRIA. Repetir "nada aprovado ainda"
           para quem acabou de escolher uma vertente seria a tela afirmando que
           o acervo está vazio quando ela só não achou nada NAQUELE recorte.

           **E ela não nomeia o que foi escolhido**, de propósito: com quatro
           controles a frase teria de dizer qual dos quatro esvaziou a grade —
           e os quatro estão à vista, logo acima, com o "Limpar" ao lado. */
        <p className="text-text-muted rounded-card border border-dashed p-4 text-sm">
          Nenhum material neste recorte.
        </p>
      ) : (
        /* TRÊS COLUNAS, como o roteiro pede, e duas em tela média: num
           notebook de 1280 o conteúdo tem cerca de 1100px, e três cartões de
           340px cabem com folga. Em 375px vira uma. */
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {encontrados.map((arquivo) => (
            <Cartao key={arquivo.id} arquivo={arquivo} vertentes={vertentes} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Cartao({
  arquivo,
  vertentes,
}: {
  arquivo: ArquivoDaBiblioteca;
  vertentes: Vertente[];
}) {
  // O NOME DA VERTENTE SAI DA LISTA DA CONTA, não de uma coluna no material: o
  // material guarda o id, e é isso que faz renomear uma vertente aparecer em
  // toda tela de uma vez — o item 33 do pedido, de graça.
  const vertente = arquivo.vertenteId
    ? vertentes.find((v) => v.id === arquivo.vertenteId)
    : null;

  return (
    <li className="bg-surface-card rounded-card shadow-cartao flex flex-col overflow-hidden border">
      {/* A MINIATURA TEM ALTURA RESERVADA mesmo sem imagem, e o vão é uma
          moldura escolhida e não um buraco: numa grade, altura desigual
          deixa a última linha torta — é a decisão da capa da campanha, que
          tem três respostas para "sem imagem" e usa a do FUNDO na grade. */}
      <div className="bg-neutral-soft relative aspect-[4/3] w-full">
        {arquivo.miniatura ? (
          <Image
            src={arquivo.miniatura}
            alt=""
            fill
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="text-text-muted flex h-full items-center justify-center">
            <ImageOff aria-hidden className="size-6" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3.5">
        {/* A FRENTE E A VERTENTE NA MESMA LINHA DE CIMA, separadas por ponto:
            as duas situam o material e nenhuma delas é o material. O ponto é o
            separador que a lista do Social Media já usa, e sem ele "Campanhas
            Institucional" se lê como uma coisa só.

            **A vertente SOME quando não há**, e não vira "Sem vertente" aqui:
            o cartão não é o lugar de afirmar uma ausência — quem a afirma é o
            chip, que existe só quando há material nele. */}
        <p className="text-text-muted text-[11px] font-semibold tracking-wide uppercase">
          {ROTULO_DA_FRENTE[arquivo.frente]}
          {vertente ? (
            <>
              {" · "}
              <span className="normal-case">{vertente.nome}</span>
            </>
          ) : null}
        </p>
        <p className="text-sm leading-snug font-semibold">{arquivo.titulo}</p>
        {/* O CONTEXTO SOME QUANDO ELE REPETE O TÍTULO. A demanda de um
            material às vezes se chama igual a ele — "Landing page da
            promoção" dentro da demanda "Landing page da promoção" —, e a
            linha repetida ocupa espaço para não dizer nada. */}
        {arquivo.contexto && arquivo.contexto !== arquivo.titulo ? (
          <p className="text-text-muted truncate text-xs">{arquivo.contexto}</p>
        ) : null}
        {arquivo.enviadoEm ? (
          <p className="text-text-muted text-xs tabular-nums">
            enviado em{" "}
            {format(parseISO(arquivo.enviadoEm), "dd/MM/yy", { locale: ptBR })}
          </p>
        ) : null}

        <div className="mt-auto pt-3">
          {/* BAIXAR QUANDO HÁ ARQUIVO, e abrir quando não há.
              **O post nunca tem**, e é decisão escrita do produto: quem
              publica é a agência, e o que o cliente leva é a peça no ar.
              Um botão "Baixar" desligado em toda peça de social seria ruído
              em metade da grade. */}
          {arquivo.arquivo ? (
            <a
              href={arquivo.arquivo.href}
              download={arquivo.arquivo.nome}
              className="hover:bg-accent inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            >
              <Download aria-hidden className="size-4" />
              Baixar
            </a>
          ) : arquivo.caminho ? (
            <Link
              href={arquivo.caminho}
              className="hover:bg-accent inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            >
              Abrir
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            /* SEM ARQUIVO E SEM TELA: o material de demanda que foi aprovado
               sem nada anexado. A frase diz isso em vez de um botão que não
               leva a lugar nenhum. */
            <p className="text-text-muted text-xs italic">
              Sem arquivo guardado.
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
