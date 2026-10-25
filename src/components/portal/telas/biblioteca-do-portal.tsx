import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Download, FolderOpen, ImageOff } from "lucide-react";

import { BuscaDaBiblioteca } from "@/components/portal/busca-da-biblioteca";
import { EmptyState } from "@/components/shared/empty-state";
import { arquivosDaBiblioteca } from "@/lib/dados/biblioteca";
import {
  combinaComBusca,
  type ArquivoDaBiblioteca,
} from "@/lib/dominio/biblioteca";
import { ROTULO_DA_FRENTE } from "@/lib/dominio/cronograma";

/**
 * A BIBLIOTECA — onde o cliente pega de volta o material pronto.
 *
 * **Uma seção e nenhuma aba**, e a razão está escrita em
 * `lib/dominio/biblioteca.ts`: das cinco abas do roteiro, quatro não têm
 * tabela, bucket nem tela de upload por trás.
 *
 * **A busca mora na URL**, como todo filtro de listagem do produto: "manda o
 * link do KV" precisa ser um link.
 */
export async function BibliotecaDoPortal({
  base,
  clienteId,
  busca,
}: {
  base: string;
  clienteId: string | null;
  busca: string;
}) {
  const todos = await arquivosDaBiblioteca(base, clienteId ?? undefined);
  const encontrados = todos.filter((arquivo) =>
    combinaComBusca(arquivo, busca),
  );

  return (
    <div className="space-y-5">
      <BuscaDaBiblioteca
        busca={busca}
        // A CONTAGEM É A DO RECORTE, e não a do acervo inteiro: ela está ao
        // lado do campo que acabou de produzi-la, e um número que não muda
        // quando se digita é um número sobre outra coisa.
        encontrados={encontrados.length}
        temAlgum={todos.length > 0}
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
           para quem acabou de digitar três letras seria a tela afirmando que
           o acervo está vazio quando ela só não achou aquela palavra. */
        <p className="text-text-muted rounded-card border border-dashed p-4 text-sm">
          Nenhum material com esse nome.
        </p>
      ) : (
        /* TRÊS COLUNAS, como o roteiro pede, e duas em tela média: num
           notebook de 1280 o conteúdo tem cerca de 1100px, e três cartões de
           340px cabem com folga. Em 375px vira uma. */
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {encontrados.map((arquivo) => (
            <Cartao key={arquivo.id} arquivo={arquivo} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Cartao({ arquivo }: { arquivo: ArquivoDaBiblioteca }) {
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
        <p className="text-text-muted text-[11px] font-semibold tracking-wide uppercase">
          {ROTULO_DA_FRENTE[arquivo.frente]}
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
