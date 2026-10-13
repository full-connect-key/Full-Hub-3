"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BookOpen, FileText, GraduationCap, Search, Clock } from "lucide-react";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import {
  EXPLICACAO_DO_TIPO,
  FILTROS_DO_ACERVO,
  MINIMO_PARA_BUSCAR,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_FILTRO,
  ROTULOS_DE_TIPO,
  TOM_DO_ESTADO,
  combinaComFiltro,
  semAcento,
} from "@/lib/dominio/academy";
import type { FiltroDoAcervo } from "@/lib/dominio/academy";
import type { ItemDoAcervo } from "@/lib/dados/academy";
import { formatarMinutos } from "@/lib/dominio/tempo";
import type { AcademyTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * O ACERVO: playbooks, e-books e cursos numa grade só.
 *
 * **UMA GRADE E NÃO TRÊS**, e é a mesma decisão que `academy_items` é uma
 * tabela e não três: quem procura "como a gente faz briefing" não sabe de
 * antemão se aquilo é um playbook ou um curso, e três listas obrigariam a
 * procurar em três lugares. O formato vira um FILTRO e um selo no cartão.
 *
 * **O FILTRO E O TERMO MORAM NA URL**, como em toda listagem do produto: o
 * link precisa ser compartilhável ("olha os obrigatórios que faltam") e
 * sobreviver ao botão de voltar.
 *
 * **"PARA VOCÊ" É O OBRIGATÓRIO MAIS O QUE COBRA RELEITURA**, e não uma
 * sugestão: o sprint pedia um bloco de recomendação lendo o que a pessoa
 * marcou como "quero desenvolver", e aquela tabela saiu do produto na 0043 por
 * decisão do usuário. Sem fonte, a escolha foi NÃO inventar uma — recomendação
 * fabricada gasta a credibilidade da seção inteira, e a resposta honesta para
 * "o que é meu agora" já existe.
 */

const ICONE_DO_TIPO: Record<AcademyTipo, typeof BookOpen> = {
  playbook: BookOpen,
  ebook: FileText,
  curso: GraduationCap,
};

export function Acervo({
  itens,
  categorias,
  filtro,
  busca,
  gestor,
}: {
  itens: ItemDoAcervo[];
  categorias: string[];
  filtro: FiltroDoAcervo;
  busca: string;
  gestor: boolean;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [, começar] = useTransition();

  const [termo, setTermo] = useState(busca);
  const categoria = parametros.get("categoria");

  function navegar(chave: string, valor: string | null) {
    const destino = new URLSearchParams(parametros.toString());
    if (valor) destino.set(chave, valor);
    else destino.delete(chave);
    // `replace` e `scroll: false`, como o seletor de visão: cada troca de
    // filtro viraria uma entrada no histórico, e quem está no fim de uma lista
    // perderia o lugar.
    começar(() => router.replace(`${caminho}?${destino.toString()}`, { scroll: false }));
  }

  const alvo = semAcento(termo.trim());
  const buscando = alvo.length >= MINIMO_PARA_BUSCAR;

  const visiveis = itens.filter((item) => {
    if (!combinaComFiltro(filtro, item.tipo, item.estado, item.obrigatorio)) return false;
    if (categoria && item.categoria !== categoria) return false;
    if (!buscando) return true;
    // A BUSCA DA GRADE É PELO NOME, pelo resumo e pelas etiquetas. O corpo do
    // playbook é buscável, e quem o faz é `buscarNoAcervo()` no servidor —
    // aqui não há o texto para procurar, e fingir que há devolveria "nada
    // encontrado" para um termo que está escrito no playbook.
    return (
      semAcento(item.titulo).includes(alvo) ||
      semAcento(item.resumo ?? "").includes(alvo) ||
      item.tags.some((t) => semAcento(t).includes(alvo))
    );
  });

  const pendentes = itens.filter((i) => i.obrigatorio && i.estado !== "concluido");

  return (
    <div className="space-y-5">
      {/* O QUE ESTÁ ESPERANDO A PESSOA, e ele some quando não há nada.
          Um bloco fixo dizendo "nenhuma pendência" ocuparia a primeira dobra
          todo dia para informar em alguns — é a regra dos blocos de exceção da
          Home. */}
      {pendentes.length > 0 ? (
        <p className="text-text-secondary text-sm">
          <strong className="text-text-primary">
            {pendentes.length} {pendentes.length === 1 ? "item" : "itens"}
          </strong>{" "}
          {pendentes.length === 1 ? "esperando" : "esperando"} você
          {pendentes.some((p) => p.vencido) ? (
            <>
              {" · "}
              <span className="text-warning font-medium">
                {pendentes.filter((p) => p.vencido).length} fora do prazo
              </span>
            </>
          ) : null}
          {" · "}
          <button
            type="button"
            onClick={() => navegar("filtro", "para_voce")}
            className="text-accent-strong hover:underline"
          >
            ver quais
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-55 flex-1">
          <Search
            className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={termo}
            onChange={(evento) => {
              setTermo(evento.target.value);
              navegar("q", evento.target.value || null);
            }}
            placeholder="Buscar no acervo"
            aria-label="Buscar no acervo do Full Academy"
            className="pl-9"
          />
        </div>

        {gestor ? (
          <Link
            href="/painel/academy/novo"
            className="pilula-de-acao rounded-full px-4 py-2 text-sm font-medium"
          >
            Novo item
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS_DO_ACERVO.map((chave) => (
          <Chip
            key={chave}
            ativo={filtro === chave}
            rotulo={ROTULOS_DE_FILTRO[chave]}
            aoClicar={() => navegar("filtro", chave === "tudo" ? null : chave)}
          />
        ))}

        {categorias.length > 0 ? (
          <>
            <span className="bg-border mx-1 hidden h-5 w-px sm:block" aria-hidden />
            {categorias.map((c) => (
              <Chip
                key={c}
                ativo={categoria === c}
                rotulo={c}
                aoClicar={() => navegar("categoria", categoria === c ? null : c)}
              />
            ))}
          </>
        ) : null}
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          title={buscando ? "Nada com esse termo" : "Nada neste recorte"}
          description={
            buscando
              ? "A busca aqui olha o título, o resumo e as etiquetas. O texto de dentro dos playbooks é buscável na página de cada um."
              : "Troque o filtro acima para ver o resto do acervo."
          }
          className="bg-card rounded-card shadow-cartao border-solid"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((item) => (
            <CartaoDoItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  ativo,
  rotulo,
  aoClicar,
}: {
  ativo: boolean;
  rotulo: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        ativo
          ? "bg-action-soft text-action-text"
          : "bg-card text-text-secondary hover:text-text-primary border",
      )}
    >
      {rotulo}
    </button>
  );
}

function CartaoDoItem({ item }: { item: ItemDoAcervo }) {
  const Icone = ICONE_DO_TIPO[item.tipo];
  const tom = TOM_DO_ESTADO[item.estado];

  return (
    <li>
      <Link
        href={`/painel/academy/${item.slug}`}
        className="bg-card rounded-card shadow-cartao hover:border-action/40 flex h-full flex-col gap-3 border p-4 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span
            className="bg-action-soft text-action-text grid size-9 shrink-0 place-items-center rounded-lg"
            aria-hidden
          >
            <Icone className="size-4.5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-text-muted text-[11px] font-medium tracking-wide uppercase">
              {ROTULOS_DE_TIPO[item.tipo]}
              {item.categoria ? ` · ${item.categoria}` : ""}
            </p>
            <h3 className="text-text-primary mt-0.5 text-sm font-semibold">{item.titulo}</h3>
          </div>

          {!item.publicado ? (
            <span className="bg-neutral-soft text-neutral shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">
              Rascunho
            </span>
          ) : null}
        </div>

        <p className="text-text-secondary line-clamp-2 text-xs">
          {item.resumo || EXPLICACAO_DO_TIPO[item.tipo]}
        </p>

        {/* A BARRA SÓ APARECE NO CURSO. No playbook e no e-book o andamento é
            binário — leu ou não leu —, e uma barra de 0% ou 100% é a mesma
            informação do selo ocupando uma linha a mais. */}
        {item.tipo === "curso" && item.total > 0 ? (
          <div className="space-y-1">
            <BarraDeProgresso
              valor={item.vistos}
              total={item.total}
              rotulo={`${item.vistos} de ${item.total} aulas`}
              tom={item.vistos >= item.total ? "sucesso" : "marca"}
            />
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              tom === "sucesso" && "bg-success-soft text-success",
              tom === "atencao" && "bg-warning-soft text-warning",
              tom === "acao" && "bg-action-soft text-action-text",
              tom === "neutro" && "bg-neutral-soft text-neutral",
            )}
          >
            {ROTULOS_DE_ESTADO[item.estado]}
          </span>

          {item.obrigatorio ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                item.vencido ? "bg-warning-soft text-warning" : "bg-neutral-soft text-neutral",
              )}
            >
              {item.vencido ? "Obrigatório · fora do prazo" : "Obrigatório"}
            </span>
          ) : null}

          {item.duracaoMinutos ? (
            <span className="text-text-muted ml-auto flex items-center gap-1 text-[11px]">
              <Clock className="size-3" aria-hidden />
              {formatarMinutos(item.duracaoMinutos)}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
