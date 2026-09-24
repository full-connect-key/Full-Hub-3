import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { SeloDaRede } from "@/components/portal/selo-da-rede";
import { corDoPontoDeStatus } from "@/components/shared/status-badge";
import {
  gradeDoMes,
  mesDe,
  porDia,
  type PostDoPortal,
} from "@/lib/dominio/posts";
import { cn } from "@/lib/utils";

const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/**
 * O mês, em grade.
 *
 * **Sem JavaScript de estado.** O mês, o dia aberto e os filtros moram na URL,
 * como em toda listagem do produto — o link precisa poder ser colado num
 * e-mail ("olha o dia 15") e sobreviver a um F5 no meio da conferência. Isso
 * também é o que permite a grade inteira ser componente de servidor: o que ela
 * desenha já veio decidido.
 *
 * **No celular a grade vira lista por dia.** Sete colunas em 375px dão 50px
 * por dia, e 50px não cabem miniatura, rede e tema — cabem um quadrado
 * colorido que não diz nada. A troca é por CSS e não por `useMediaQuery`:
 * medir a janela no navegador faria o servidor renderizar uma das duas e o
 * navegador trocar depois, com o salto na tela.
 */
export function CalendarioDePosts({
  mes,
  posts,
  artes,
  base,
  hoje,
  diaAberto,
}: {
  mes: string;
  posts: PostDoPortal[];
  /** Miniaturas já assinadas, por caminho. */
  artes: Record<string, string>;
  base: string;
  hoje: string;
  diaAberto: string | null;
}) {
  const dias = gradeDoMes(mes);
  const mapa = porDia(posts);

  return (
    <>
      {/* ---------------------------------------------------------- grade -- */}
      <div className="hidden sm:block">
        <div className="text-text-muted grid grid-cols-7 gap-px pb-2 text-center text-xs font-medium">
          {DIAS_DA_SEMANA.map((dia) => (
            <div key={dia}>{dia}</div>
          ))}
        </div>

        <div className="bg-border grid grid-cols-7 gap-px overflow-hidden rounded-xl border">
          {dias.map((dia) => {
            const doDia = mapa.get(dia) ?? [];
            const foraDoMes = mesDe(dia) !== mes;

            return (
              <div
                key={dia}
                className={cn(
                  "bg-surface-card min-h-28 p-1.5",
                  // O dia de outro mês fica apagado em vez de sumir: a coluna
                  // precisa dele para a semana não quebrar, e sumir deixaria
                  // um buraco que parece bug.
                  foraDoMes && "bg-surface-page",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  {/* O NÚMERO DO DIA É O QUE ABRE A LISTA DAQUELE DIA, e a
                      miniatura é o que vai ao post. São duas ações, e por isso
                      são dois alvos — um clique no cartão inteiro teria que
                      escolher uma. */}
                  <Link
                    href={`?mes=${mes}&dia=${dia}`}
                    scroll={false}
                    aria-label={`Ver os materiais de ${format(parseISO(dia), "d 'de' MMMM", { locale: ptBR })}`}
                    className={cn(
                      "flex size-6 items-center justify-center rounded text-xs tabular-nums transition-colors",
                      foraDoMes ? "text-text-muted" : "text-text-primary",
                      dia === hoje &&
                        "bg-blue-soft text-text-primary font-semibold",
                      dia === diaAberto && "border-accent-strong border",
                      doDia.length > 0 && "hover:bg-accent",
                    )}
                  >
                    {Number(dia.slice(8))}
                  </Link>

                  {doDia.length > 2 ? (
                    <Link
                      href={`?mes=${mes}&dia=${dia}`}
                      scroll={false}
                      className="text-accent-strong text-[0.65rem] hover:underline"
                    >
                      +{doDia.length - 2}
                    </Link>
                  ) : null}
                </div>

                {/* Até 2 miniaturas empilhadas. A terceira vira "+N": três
                    miniaturas de 40px numa célula de 100px não deixam espaço
                    para o tema, que é o que diz do que o post trata. */}
                <div className="mt-1 space-y-1">
                  {doDia.slice(0, 2).map((post) => (
                    <Miniatura
                      key={post.id}
                      post={post}
                      arte={
                        post.thumbnailUrl
                          ? (artes[post.thumbnailUrl] ?? post.thumbnailUrl)
                          : null
                      }
                      base={base}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------- no celular -- */}
      <div className="space-y-4 sm:hidden">
        {dias
          .filter(
            (dia) => mesDe(dia) === mes && (mapa.get(dia)?.length ?? 0) > 0,
          )
          .map((dia) => (
            <section key={dia} className="space-y-2">
              <h3
                className={cn(
                  "text-sm font-medium first-letter:uppercase",
                  dia === hoje && "text-accent-strong",
                )}
              >
                {format(parseISO(dia), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <div className="space-y-2">
                {(mapa.get(dia) ?? []).map((post) => (
                  <Miniatura
                    key={post.id}
                    post={post}
                    arte={
                      post.thumbnailUrl
                        ? (artes[post.thumbnailUrl] ?? post.thumbnailUrl)
                        : null
                    }
                    base={base}
                    larga
                  />
                ))}
              </div>
            </section>
          ))}
      </div>
    </>
  );
}

function Miniatura({
  post,
  arte,
  base,
  larga = false,
}: {
  post: PostDoPortal;
  arte: string | null;
  base: string;
  larga?: boolean;
}) {
  return (
    <Link
      href={`${base}/social-media/${post.id}`}
      className={cn(
        "hover:bg-accent flex items-center gap-1.5 rounded p-1 transition-colors",
        larga && "bg-surface-card border p-2",
      )}
    >
      <span className="bg-neutral-soft relative size-7 shrink-0 overflow-hidden rounded">
        {arte ? (
          <Image src={arte} alt="" fill sizes="28px" className="object-cover" />
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <SeloDaRede
            plataforma={post.plataforma}
            className="h-4 min-w-7 text-[0.6rem]"
          />
          {post.horario ? (
            <span className="text-text-muted text-[0.65rem] tabular-nums">
              {post.horario}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs">{post.tema}</span>
      </span>

      {/* A FAIXA DE STATUS FICA NA BORDA, e não no texto: numa célula com duas
          miniaturas, dois selos escritos ocupariam mais espaço que o tema. A
          cor sai do mesmo mapa do selo, e não de um paralelo. */}
      <span
        aria-hidden
        className={cn(
          "h-7 w-1 shrink-0 rounded-full",
          corDoPontoDeStatus(post.status),
        )}
      />
    </Link>
  );
}
