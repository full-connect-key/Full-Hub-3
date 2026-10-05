import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarX } from "lucide-react";

import { CalendarioDePosts } from "@/components/portal/calendario-de-posts";
import { CartaoDePost } from "@/components/portal/cartao-de-post";
import { FiltrosDePosts } from "@/components/portal/filtros-de-post";
import { GradeDoFeed } from "@/components/portal/grade-do-feed";
import { NavegacaoDoMes } from "@/components/portal/navegacao-do-mes";
import { EmptyState } from "@/components/shared/empty-state";
import {
  STATUS_DE_CONTEUDO,
  rotuloDoStatus,
} from "@/components/shared/status-badge";
import { enderecoDaArte } from "@/lib/dados/conteudo";
import { postsDoMes, urlsDasArtes } from "@/lib/dados/posts";
import { prazosDoPortal } from "@/lib/dados/portal";
import {
  ehFaseDoMaterial,
  faseDoMaterial,
  FASES_DO_MATERIAL,
  type FaseDoMaterial,
} from "@/lib/dominio/portal";
import {
  combinaComFiltroDePost,
  mesDe,
  PLATAFORMAS,
  porDia,
  type FiltrosDePost,
  type PostDoPortal,
} from "@/lib/dominio/posts";
import { corDoPontoDeStatus } from "@/components/shared/status-badge";
import type {
  ContentStatus,
  PlataformaSocial,
} from "@/lib/supabase/database.types";

/**
 * O calendário de social, num bloco só.
 *
 * Serve as duas entradas, como as outras telas do Portal: o portal do
 * cliente (`/portal/social-media`) e a visualização da equipe
 * (`/portal/{slug}/social-media`). O que muda é o parâmetro — `clienteId`,
 * obrigatório para quem é da equipe porque o RLS a deixa ver todas as
 * empresas — e o prefixo dos links.
 */

/** Lê os filtros da URL, recusando o que não existe no enum. */
export function lerFiltrosDePost(
  params: Record<string, string | string[] | undefined>,
): FiltrosDePost {
  const texto = (chave: string) =>
    typeof params[chave] === "string" ? params[chave] : "";

  const plataforma = texto("plataforma");
  const fase = texto("fase");

  return {
    plataforma: (PLATAFORMAS as string[]).includes(plataforma)
      ? (plataforma as PlataformaSocial)
      : null,
    fase: ehFaseDoMaterial(fase) ? fase : null,
  };
}

/**
 * Quantos materiais o mês tem em cada fase.
 *
 * **A conta é sobre o MÊS INTEIRO, nunca sobre o que sobrou do filtro.**
 * Filtrando por Instagram, "Aprovados 7" continua dizendo quantos o mês tem —
 * senão escolher um filtro zeraria os outros chips e a pessoa perderia o
 * caminho de volta. É o contador das abas de Pedidos pela quarta vez: o
 * recorte acontece na tela, e o número vem da lista inteira.
 */
function contarPorFase(posts: PostDoPortal[]): Record<FaseDoMaterial, number> {
  const contagens = Object.fromEntries(
    FASES_DO_MATERIAL.map((f) => [f.fase, 0]),
  ) as Record<FaseDoMaterial, number>;

  for (const post of posts) contagens[faseDoMaterial(post.status)] += 1;
  return contagens;
}

export async function SocialDoPortal({
  base,
  clienteId,
  comoEquipe,
  mes,
  visao,
  dia,
  filtros,
}: {
  base: string;
  clienteId: string | null;
  comoEquipe: boolean;
  mes: string;
  visao: "calendario" | "lista" | "feed";
  dia: string | null;
  filtros: FiltrosDePost;
}) {
  const { hoje } = prazosDoPortal();
  const todos = await postsDoMes(mes, clienteId ?? undefined);
  const posts = todos.filter((post) => combinaComFiltroDePost(post, filtros));

  const artes = await urlsDasArtes(posts.map((p) => p.thumbnailUrl));
  const doDia = dia ? (porDia(posts).get(dia) ?? []) : [];

  // As duas coisas que a faixa de filtros precisa, e as duas saem do MÊS
  // INTEIRO — nunca do que sobrou do filtro.
  const contagens = contarPorFase(todos);
  // `some(includes)` E NAO `some(===)`: uma peca que sai no Instagram e no
  // Facebook poe as DUAS redes na faixa, porque ela esta nas duas.
  const redes = PLATAFORMAS.filter((rede) =>
    todos.some((post) => post.plataformas.includes(rede)),
  );

  return (
    <div className="space-y-6">
      <NavegacaoDoMes
        mes={mes}
        mesDeHoje={mesDe(hoje)}
        visao={visao}
        base={base}
      />

      {/* A FRASE DO CONTADOR SAIU, e quem responde agora é o primeiro chip.

          Ela dizia "4 posts aguardam a sua aprovação neste mês" quarenta
          pixels acima de um chip escrito "Esperando você 4" — dois números
          para o mesmo fato, um do lado do outro, que é o cartão de "11
          entregues" com sete na lista embaixo. E o chip faz mais: ele diz o
          número E leva até os quatro, enquanto a frase só dizia o número. Por
          isso ele é o único âmbar da linha, e por isso "Esperando você" vira
          "Esperando o cliente" na visualização administrativa — a frase
          trocava de dono, e o rótulo passou a trocar no lugar dela.

          **E ela estava errada desde sempre, de um jeito que ninguém veria:**
          a conta era sobre `posts`, a lista já FILTRADA, enquanto o texto
          dizia "neste mês" — filtrando por Instagram, ela contava só o
          Instagram e continuava afirmando que aquilo era o mês.

          `esperaDecisao` continua existindo e continua sendo a pergunta certa
          para o BOTÃO: lá a rodada aberta precisa existir, senão o clique cai
          na recusa "esta rodada já foi decidida". Aqui a pergunta é outra —
          em que pé está o material deste mês. */}
      <FiltrosDePosts
        filtros={filtros}
        contagens={contagens}
        redes={redes}
        comoEquipe={comoEquipe}
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="Nenhum material neste mês"
          description={
            todos.length > 0
              ? "Nenhum material com esses filtros. Limpe os filtros para ver o resto."
              : comoEquipe
                ? "Este cliente ainda não recebeu material deste mês."
                : "Quando a Full enviar algo para este mês, ele aparece aqui."
          }
        />
      ) : visao === "feed" ? (
        /* A GRADE, como o feed da rede vai ficar (decisão do usuário).
           
           Ela recebe as redes PRESENTES no que está na tela, e não o enum
           inteiro: a linha de aviso só existe quando a grade realmente
           mistura, e com o filtro de rede aplicado ela some sozinha. */
        <GradeDoFeed
          posts={posts}
          artes={artes}
          base={base}
          redes={[...new Set(posts.flatMap((p) => p.plataformas))]}
        />
      ) : visao === "lista" ? (
        <div className="space-y-3">
          {posts.map((post) => (
            <CartaoDePost
              key={post.id}
              post={post}
              arte={enderecoDaArte(post.thumbnailUrl, artes)}
              base={base}
            />
          ))}
        </div>
      ) : (
        <>
          <CalendarioDePosts
            mes={mes}
            posts={posts}
            artes={artes}
            base={base}
            hoje={hoje}
            diaAberto={dia}
          />

          {/* A LISTA DO DIA fica abaixo da grade, e não num diálogo: num
              diálogo ela cobriria o calendário, que é o contexto de quem
              acabou de clicar num dia. */}
          {dia ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold first-letter:uppercase">
                {format(parseISO(dia), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h2>

              {doDia.length === 0 ? (
                <p className="text-text-muted text-sm">
                  Nada publicado neste dia.
                </p>
              ) : (
                <div className="space-y-3">
                  {doDia.map((post) => (
                    <CartaoDePost
                      key={post.id}
                      post={post}
                      arte={enderecoDaArte(post.thumbnailUrl, artes)}
                      base={base}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <Legenda />
        </>
      )}
    </div>
  );
}

/**
 * A legenda fica FIXA abaixo do calendário, e não num tooltip.
 *
 * A faixa colorida da miniatura é o que se lê de longe, e uma cor sem legenda
 * é uma cor que cada pessoa interpreta do seu jeito — no celular não há para
 * onde apontar o mouse.
 *
 * **E ela AGRUPA os status que dividem a mesma cor, em vez de fingir que são
 * sete cores.** Os sete estados cabem em cinco tons medidos: "em produção" e
 * "aguardando aprovação" são o mesmo azul, "aguardando informações" e "stand
 * by" o mesmo cinza. Uma legenda com sete linhas e cinco cores manda a pessoa
 * comparar dois azuis idênticos e concluir que errou a leitura. O nome exato
 * de cada post está no cartão dele — no `title` e no rótulo acessível.
 */
function Legenda() {
  // Agrupa pelo que a tela realmente mostra: a classe de cor. A ordem dentro
  // de cada grupo é a de `STATUS_DE_CONTEUDO`, que é a ordem do fluxo.
  const grupos = new Map<string, ContentStatus[]>();
  for (const status of STATUS_DE_CONTEUDO) {
    const cor = corDoPontoDeStatus(status);
    const lista = grupos.get(cor);
    if (lista) lista.push(status);
    else grupos.set(cor, [status]);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
      {[...grupos.entries()].map(([cor, status]) => (
        <span
          key={cor}
          className="text-text-muted flex items-center gap-1.5 text-xs"
        >
          <span aria-hidden className={`size-2 rounded-full ${cor}`} />
          {status.map(rotuloDoStatus).join(" · ")}
        </span>
      ))}
    </div>
  );
}
