"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CalendarDays, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ROTULO_DA_MAO,
  SIGLA_DA_PLATAFORMA,
  ROTULO_DA_PLATAFORMA,
  deslocarMes,
  gradeDoMes,
  maoDoPost,
  rotuloDaData,
} from "@/lib/dominio/posts";
import { cn } from "@/lib/utils";
import type {
  PostDaAgencia,
  ReferenciaDoPost,
  VersaoDoPost,
} from "@/lib/dados/social-media";
import type { EtapaDoPost } from "@/lib/dominio/posts";

import { EditorDoPost, type QuemLe } from "./editor-do-post";
import { AbrirOMes } from "./abrir-o-mes";
import { NovoPost } from "./novo-post";

const TODOS = "__todos__";

/**
 * A cor da barra de cada post.
 *
 * **SÃO CINCO MÃOS E QUATRO CORES, e a legenda agrupa as duas que dividem o
 * azul** — é a mesma decisão do calendário do portal, que agrupa os sete
 * status em cinco tons. Produção e Revisão são o mesmo trabalho em curso; o
 * que muda é quem está com ele.
 *
 * A primeira versão dava `--accent-strong` à Revisão achando que era um azul
 * diferente. No tema claro ele É `--blue-strong` — o token existe para dizer
 * "o azul legível no tema de agora", e no claro esse azul é justamente o
 * outro. Duas entradas de legenda com a mesma cor são piores que uma: a
 * pessoa procura a diferença, não acha, e passa a desconfiar do resto.
 *
 * **E a cor nunca é o único sinal:** cada card carrega o passo exato no
 * `title` e no rótulo acessível, como os cards do portal.
 */
const TOM_DA_MAO: Record<string, string> = {
  briefing: "bg-neutral",
  producao: "bg-blue-strong",
  revisao: "bg-blue-strong",
  com_cliente: "bg-warning",
  encerrado: "bg-success",
};

/** O que a legenda mostra: as cores, com as duas do azul juntas. */
const LEGENDA: { tom: string; rotulo: string }[] = [
  { tom: "bg-neutral", rotulo: "Sem responsável" },
  { tom: "bg-blue-strong", rotulo: "Em produção ou pronto para enviar" },
  { tom: "bg-warning", rotulo: "Com o cliente" },
  { tom: "bg-success", rotulo: "Encerrado" },
];

function Selo({ post }: { post: PostDaAgencia }) {
  return (
    <span
      aria-hidden
      className="bg-muted text-text-secondary inline-grid size-5 shrink-0 place-items-center rounded text-[9px] font-bold"
      title={ROTULO_DA_PLATAFORMA[post.plataforma]}
    >
      {SIGLA_DA_PLATAFORMA[post.plataforma]}
    </span>
  );
}

/**
 * "Programado" — e ele só aparece quando é verdade (decisão do usuário).
 *
 * ---------------------------------------------------------------------------
 * **A MARCA JÁ EXISTIA, e o que faltava era ela ser visível.**
 *
 * Concluir a etapa "Programar" da corrente é marcar o post como programado
 * desde a 0045 — mas a corrente mora no painel do post aberto, e a lista
 * mostrava a mesma linha para o post aprovado que ainda não foi agendado e
 * para o que já está na fila da rede. Duas situações opostas com a mesma cara,
 * na tela em que o Social Media confere o mês.
 *
 * **E o par "A programar" NÃO existe**, de propósito: um selo cinza dizendo
 * "a programar" em trinta linhas de um mês recém-aberto é trinta selos que não
 * informam nada. O que se procura aqui é o que JÁ SAIU da fila — a ausência do
 * selo é a resposta para o resto, e é a mesma decisão da matriz do Full Days,
 * que pinta só a exceção.
 * ---------------------------------------------------------------------------
 */
function SeloProgramado({ horario }: { horario: string | null }) {
  return (
    <span
      className="bg-success-soft text-success inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
      title={
        horario
          ? `Programado para as ${horario}`
          : "Programado — a etapa Programar está concluída"
      }
    >
      <CalendarCheck aria-hidden className="size-3" />
      Programado
    </span>
  );
}

/**
 * O Social Media da agência, nas duas visões.
 *
 * **Lista e calendário são a MESMA rota, e a escolha mora na URL** — como toda
 * listagem do produto. "Olha o dia 15" precisa ser um link, e trocar de visão
 * não pode perder o cliente filtrado.
 *
 * **E o editor é o mesmo componente nas duas.** Na lista ele é a coluna
 * direita; no calendário, o painel. Duas telas parecidas divergiriam na
 * primeira mudança, e a divergência apareceria no botão de enviar.
 */
export function SocialMedia({
  posts,
  semData,
  aberto,
  versoes,
  etapas,
  referencias,
  clientes,
  equipe,
  driveLigado = false,
  quemLe,
  mes,
}: {
  posts: PostDaAgencia[];
  /** Os que ninguém datou ainda. Só o calendário os recebe — ver page.tsx. */
  semData: PostDaAgencia[];
  aberto: PostDaAgencia | null;
  versoes: VersaoDoPost[];
  etapas: EtapaDoPost[];
  referencias: ReferenciaDoPost[];
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
  /** A integração com o Drive está ligada? Decide o botão "Criar no Drive". */
  driveLigado?: boolean;
  quemLe: QuemLe;
  mes: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const visao =
    parametros.get("visao") === "calendario" ? "calendario" : "lista";
  const cliente = parametros.get("cliente") ?? TODOS;
  const foco = parametros.get("foco") ?? "todos";

  function comParametro(mudancas: Record<string, string | null>) {
    const destino = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) destino.delete(chave);
      else destino.set(chave, valor);
    }
    return `${pathname}?${destino.toString()}`;
  }

  function abrir(id: string) {
    router.push(comParametro({ post: id }), { scroll: false });
  }

  /**
   * A lista agrupa por QUEM ESTÁ SEGURANDO, e não por status.
   *
   * É o que faz a mesma tela servir aos três perfis internos: o colaborador
   * abre e a primeira seção é a dele. Agrupar por status daria cinco caixas em
   * que ele precisaria procurar o próprio nome.
   */
  const grupos = useMemo(() => {
    const meus: PostDaAgencia[] = [];
    const esperando: PostDaAgencia[] = [];
    const outros: PostDaAgencia[] = [];
    for (const p of posts) {
      if (p.responsavelId === quemLe.id) meus.push(p);
      else if (p.responsavelId === null) esperando.push(p);
      else outros.push(p);
    }
    return [
      { titulo: "Comigo", itens: meus },
      { titulo: "Esperando alguém", itens: esperando },
      { titulo: "Fora das minhas mãos", itens: outros },
    ].filter((g) => g.itens.length > 0);
  }, [posts, quemLe.id]);

  const porDia = useMemo(() => {
    // O SEM DATA FICA DE FORA DO CALENDÁRIO, e não numa célula qualquer: não
    // existe dia onde ele caiba. Ele aparece na faixa abaixo da grade, que é
    // onde alguém vai buscá-lo justamente para escolher o dia.
    const mapa = new Map<string, PostDaAgencia[]>();
    for (const p of posts) {
      if (!p.dataPublicacao) continue;
      const atual = mapa.get(p.dataPublicacao) ?? [];
      atual.push(p);
      mapa.set(p.dataPublicacao, atual);
    }
    return mapa;
  }, [posts]);

  const editor = aberto ? (
    <EditorDoPost
      // `key` E NAO `useEffect`: trocar de post remonta o editor, e os campos
      // nascem com o valor do post novo. Ressincronizar por efeito dispara
      // renderizacao em cascata e sobrescreve o que a pessoa digitou.
      key={aberto.id}
      post={aberto}
      versoes={versoes}
      etapas={etapas}
      referencias={referencias}
      equipe={equipe}
      quemLe={quemLe}
      compacto={visao === "calendario"}
      aoFechar={() =>
        router.push(comParametro({ post: null }), { scroll: false })
      }
    />
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Visão">
          <ul className="bg-muted inline-flex gap-1 rounded-xl p-1">
            {(
              [
                ["lista", "Lista", List],
                ["calendario", "Calendário", CalendarDays],
              ] as const
            ).map(([chave, rotulo, Icone]) => (
              <li key={chave}>
                <Link
                  href={comParametro({ visao: chave })}
                  aria-current={visao === chave ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors",
                    visao === chave
                      ? "bg-surface-card text-text-primary font-medium shadow-sm"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  <Icone aria-hidden className="size-4" />
                  {rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {visao === "calendario" ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={comParametro({ mes: deslocarMes(mes, -1) })}
                aria-label="Mês anterior"
              >
                ‹
              </Link>
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold">
              {format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", {
                locale: ptBR,
              })}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={comParametro({ mes: deslocarMes(mes, 1) })}
                aria-label="Próximo mês"
              >
                ›
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={cliente}
            onValueChange={(v) =>
              router.push(comParametro({ cliente: v === TODOS ? null : v }), {
                scroll: false,
              })
            }
          >
            <SelectTrigger className="w-44" aria-label="Cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={foco}
            onValueChange={(v) =>
              router.push(comParametro({ foco: v === "todos" ? null : v }), {
                scroll: false,
              })
            }
          >
            <SelectTrigger className="w-40" aria-label="Foco">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo mundo</SelectItem>
              <SelectItem value="meus">Meus posts</SelectItem>
              <SelectItem value="sem_dono">Sem responsável</SelectItem>
            </SelectContent>
          </Select>

          {/* ABRIR O MÊS VEM ANTES DE "+ NOVO POST", e a ordem é a frequência:
              com dez clientes de social, abrir o mês é o que se faz uma vez por
              cliente por mês; o post avulso é a exceção — o story que o cliente
              pediu hoje. */}
          {quemLe.ehGestor ? (
            <>
              <AbrirOMes
                clientes={clientes}
                equipe={equipe}
                driveLigado={driveLigado}
              />
              <NovoPost clientes={clientes} equipe={equipe} />
            </>
          ) : null}
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum post por aqui"
          description={
            quemLe.ehGestor
              ? "Abra um post, escolha a mídia e libere para quem vai produzir."
              : "Quando a gestão liberar um post para você, ele aparece aqui — e o sino avisa."
          }
        />
      ) : visao === "lista" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <div className="border-border bg-surface-card overflow-hidden rounded-xl border">
            {grupos.map((grupo) => (
              <section key={grupo.titulo}>
                <h2 className="bg-muted text-text-secondary flex justify-between px-3 py-1.5 text-[11px] tracking-wide uppercase">
                  {grupo.titulo}
                  <span>{grupo.itens.length}</span>
                </h2>
                <ul>
                  {grupo.itens.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => abrir(p.id)}
                        aria-current={aberto?.id === p.id ? "true" : undefined}
                        className={cn(
                          "border-border flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left",
                          aberto?.id === p.id
                            ? "bg-blue-soft"
                            : "hover:bg-muted",
                        )}
                      >
                        <span className="bg-muted size-10 shrink-0 overflow-hidden rounded-md">
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-text-primary block truncate text-sm font-medium">
                            {p.tema}
                          </span>
                          <span className="text-text-secondary mt-0.5 flex items-center gap-1.5 text-xs">
                            <Selo post={p} />
                            {rotuloDaData(
                              p.dataPublicacao
                                ? format(parseISO(p.dataPublicacao), "dd/MM")
                                : null,
                            )}{" "}
                            · {ROTULO_DA_MAO[maoDoPost(p)].toLowerCase()}
                            {p.programado ? (
                              <SeloProgramado horario={p.horario} />
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="border-border bg-surface-card rounded-xl border p-4 lg:p-5">
            {editor ?? (
              <p className="text-text-secondary py-12 text-center text-sm">
                Escolha um post à esquerda.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4 items-start",
            aberto ? "xl:grid-cols-[minmax(0,1fr)_400px]" : "",
          )}
        >
          <div>
            <div className="border-border grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-[var(--border)]">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <div
                  key={d}
                  className="bg-muted text-text-secondary p-1.5 text-center text-[10px] tracking-wide uppercase"
                >
                  {d}
                </div>
              ))}
              {gradeDoMes(mes).map((dia) => {
                const doDia = porDia.get(dia) ?? [];
                const doMes = dia.startsWith(mes);
                return (
                  <div
                    key={dia}
                    className={cn(
                      "bg-surface-card min-h-24 p-1.5",
                      doMes ? "" : "bg-muted/40",
                    )}
                  >
                    <p className="text-text-secondary mb-1 text-[11px]">
                      {Number(dia.slice(8))}
                    </p>
                    <ul className="space-y-1">
                      {doDia.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => abrir(p.id)}
                            title={`${p.tema} — ${p.cliente} · ${ROTULO_DA_MAO[maoDoPost(p)]}${p.responsavel ? ` · com ${p.responsavel}` : ""}${p.programado ? " · programado" : ""}`}
                            className="border-border hover:bg-muted flex w-full items-center gap-1.5 rounded-md border px-1 py-0.5 text-left"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "h-5 w-1 shrink-0 rounded-sm",
                                TOM_DA_MAO[maoDoPost(p)],
                              )}
                            />
                            <span className="text-text-primary truncate text-[11px]">
                              {p.tema}
                            </span>
                            {/* NO CALENDÁRIO O SELO VIRA UM ÍCONE, e não a
                                palavra: a célula de um dia com três posts tem
                                onze pixels de sobra, e "Programado" escrito
                                empurraria o tema para fora. O nome inteiro
                                está no `title` e no rótulo acessível. */}
                            {p.programado ? (
                              <CalendarCheck
                                aria-hidden
                                className="text-success ml-auto size-3 shrink-0"
                              />
                            ) : null}
                            {/* O PASSO EXATO, para quem não distingue as cores
                                e para quem usa leitor de tela. A barra diz o
                                grupo; isto diz qual dos dois. */}
                            <span className="sr-only">
                              {p.cliente}, {ROTULO_DA_MAO[maoDoPost(p)]}
                              {p.programado ? ", programado" : ""}
                              {p.responsavel ? `, com ${p.responsavel}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* A LEGENDA É DA CORRENTE, e não do status: o que a pessoa
                procura no calendário da agência é em que mão o post está. */}
            <ul className="text-text-secondary mt-3 flex flex-wrap gap-3 text-xs">
              {LEGENDA.map((item) => (
                <li key={item.rotulo} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn("size-2.5 rounded-sm", item.tom)}
                  />
                  {item.rotulo}
                </li>
              ))}
            </ul>

            {/* A FAIXA "SEM DATA AINDA" (0044).
                Ela existe porque o mês passou a abrir em branco: doze posts
                nascem de uma vez e nenhum tem dia. Sem a faixa eles existiriam
                no banco e não apareceriam em tela nenhuma — o pior resultado
                possível, porque ninguém desconfia de uma grade vazia.
                É UMA LISTA ROLÁVEL E NÃO UMA CÉLULA "sem data" NA GRADE: uma
                sexta coluna quebraria a semana, e sessenta posts numa célula
                de calendário empurrariam o mês inteiro para baixo. */}
            {semData.length > 0 ? (
              <section className="border-border mt-4 border-t pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-text-primary text-sm font-semibold">
                    Sem data ainda
                  </h3>
                  <span className="text-text-muted text-xs tabular-nums">
                    {semData.length}
                  </span>
                </div>
                <p className="text-text-muted mt-0.5 text-xs">
                  Abertos e esperando alguém escolher o dia. Eles não vão ao
                  cliente enquanto não tiverem data.
                </p>
                <ul className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                  {semData.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => abrir(p.id)}
                        className="border-border bg-surface-card hover:bg-muted flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-2 rounded-sm",
                            TOM_DA_MAO[maoDoPost(p)],
                          )}
                        />
                        <span className="text-text-primary max-w-44 truncate">
                          {p.tema}
                        </span>
                        <span className="text-text-muted">
                          {SIGLA_DA_PLATAFORMA[p.plataforma]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* O PAINEL EMPURRA, não cobre. Coberto, ele comia sábado e domingo
              — foi a imagem da proposta que mostrou. */}
          {editor ? (
            <aside className="border-border bg-surface-card rounded-xl border p-4 xl:sticky xl:top-4">
              {editor}
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
