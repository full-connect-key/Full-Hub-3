"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BookOpen,
  Clock,
  FileText,
  GraduationCap,
  Search,
  X,
} from "lucide-react";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { ControleSegmentado } from "@/components/shared/controle-segmentado";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPLICACAO_DO_TIPO,
  PLURAL_DO_TIPO,
  RECORTES_DO_ACERVO,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_RECORTE,
  ROTULOS_DE_TIPO,
  TIPOS_DO_ACERVO,
  TOM_DO_ESTADO,
  algumFiltroAtivo,
  combinaComFiltrosDoAcervo,
  escreverFormatos,
} from "@/lib/dominio/academy";
import type { FiltrosDoAcervo } from "@/lib/dominio/academy";
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
 * **OS FILTROS E O TERMO MORAM NA URL**, como em toda listagem do produto: o
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

const RECORTES = RECORTES_DO_ACERVO.map((chave) => ({
  chave,
  rotulo: ROTULOS_DE_RECORTE[chave],
}));

export function Acervo({
  itens,
  categorias,
  filtros,
  gestor,
}: {
  itens: ItemDoAcervo[];
  categorias: string[];
  filtros: FiltrosDoAcervo;
  gestor: boolean;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [, começar] = useTransition();

  // O TERMO É LOCAL E TAMBÉM VAI PARA A URL, e os dois têm papéis diferentes:
  // o estado filtra a grade a cada tecla, e a URL é o que sobrevive ao botão de
  // voltar e ao link colado no chat. Quem filtra é o estado — sem ele, cada
  // letra esperaria uma ida ao servidor para a lista mexer.
  const [termo, setTermo] = useState(filtros.busca);
  const comTermo = { ...filtros, busca: termo };

  function navegar(mudancas: Record<string, string | null>) {
    const destino = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) destino.set(chave, valor);
      else destino.delete(chave);
    }
    // `replace` e `scroll: false`, como o seletor de visão: cada troca de
    // filtro viraria uma entrada no histórico, e quem está no fim de uma lista
    // perderia o lugar.
    começar(() =>
      router.replace(`${caminho}?${destino.toString()}`, { scroll: false }),
    );
  }

  const visiveis = itens.filter((item) =>
    combinaComFiltrosDoAcervo(item, comTermo),
  );

  // CADA DIMENSÃO SE CONTA COM AS OUTRAS E NUNCA COM ELA MESMA, que é a regra
  // escrita da Biblioteca do portal: com "Concluídos" escolhido, o chip de
  // Cursos tem de dizer quantos cursos concluídos existem — e não quantos
  // cursos o acervo tem, que é um número que o clique não cumpre.
  const semFormato = itens.filter((item) =>
    combinaComFiltrosDoAcervo(item, { ...comTermo, formatos: [] }),
  );

  const formatos = TIPOS_DO_ACERVO.filter((tipo) =>
    // SÓ O FORMATO QUE O ACERVO TEM. Um chip de "Cursos" numa agência que não
    // tem nenhum não é uma resposta, é ruído — é a razão pela qual a fileira de
    // redes do portal mostra só as redes do mês.
    itens.some((item) => item.tipo === tipo),
  );

  const pendentes = itens.filter(
    (i) => i.obrigatorio && i.estado !== "concluido",
  );

  function alternarFormato(tipo: AcademyTipo) {
    const proximos = filtros.formatos.includes(tipo)
      ? filtros.formatos.filter((t) => t !== tipo)
      : [...filtros.formatos, tipo];
    navegar({ formato: escreverFormatos(proximos) });
  }

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
          esperando você
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
            onClick={() => navegar({ filtro: "para_voce" })}
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
              navegar({ q: evento.target.value || null });
            }}
            placeholder="Buscar na biblioteca"
            aria-label="Buscar na biblioteca do Acervo"
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

      {/* -------------------------------------------------------------------
          ERAM ONZE PÍLULAS IGUAIS DE TRÊS DIMENSÕES, NUMA LINHA SÓ.

          Decisão do usuário: *"no acervo, quero uma nova proposta de
          visualização dos filtros, acho que 3 possibilidades de tipos de
          pesquisa está confuso."*

          Agora cada pergunta tem a FORMA que diz o que ela faz: o recorte é
          exclusivo e é um controle segmentado; o formato se acumula e são
          chips; a categoria cresce com o acervo e é um `<Select>`. O argumento
          inteiro — e as duas saídas recusadas — está em `lib/dominio/academy.ts`,
          ao lado de `combinaComFiltrosDoAcervo`.

          E O VÃO DE FORA É MAIOR QUE O DE DENTRO, que é o que faz a leitura
          valer: os chips de formato se encostam com `gap-1.5` e as três
          perguntas se separam com `gap-3`. Com o mesmo vão nos dois níveis, a
          proximidade não agrupa nada e a linha volta a se ler como uma fileira
          de peças soltas — que é o defeito que esta entrega desfaz.
          ------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <ControleSegmentado
          opcoes={RECORTES}
          atual={filtros.recorte}
          aoTrocar={(chave) =>
            navegar({ filtro: chave === "tudo" ? null : chave })
          }
          rotuloAcessivel="Recorte do acervo"
        />

        {/* O FORMATO VEM DEPOIS DO RECORTE, que é a ordem da pergunta: o
            recorte diz de QUEM é o material — meu, em andamento, fechado —, e o
            formato diz o que ele É. E eles só aparecem quando há mais de um:
            com um formato só, a linha pediria uma escolha que não existe. */}
        {formatos.length > 1 ? (
          <div
            role="group"
            aria-label="Formato"
            className="flex flex-wrap items-center gap-1.5"
          >
            {formatos.map((tipo) => (
              <Chip
                key={tipo}
                ativo={filtros.formatos.includes(tipo)}
                aoClicar={() => alternarFormato(tipo)}
              >
                {PLURAL_DO_TIPO[tipo]}
                <span className="tabular-nums opacity-70">
                  {semFormato.filter((item) => item.tipo === tipo).length}
                </span>
              </Chip>
            ))}
          </div>
        ) : null}

        {categorias.length > 1 ? (
          <Select
            value={filtros.categoria ?? "todas"}
            onValueChange={(valor) =>
              navegar({ categoria: valor === "todas" ? null : valor })
            }
          >
            <SelectTrigger
              className="w-auto min-w-40 rounded-full"
              aria-label="Filtrar por categoria"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map((categoria) => (
                <SelectItem key={categoria} value={categoria}>
                  {categoria}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {/* A CONTAGEM E O "LIMPAR" SÓ EXISTEM COM REFINAMENTO ATIVO — pinta-se
            a exceção, e o repouso é o acervo inteiro à vista, onde "12 de 12"
            e um botão que não limpa nada seriam duas peças dizendo que nada
            aconteceu. */}
        {algumFiltroAtivo(comTermo) ? (
          <>
            <p className="text-text-muted text-sm">
              {visiveis.length} de {itens.length}{" "}
              {itens.length === 1 ? "item" : "itens"}
            </p>
            <button
              type="button"
              onClick={() => {
                setTermo("");
                navegar({ q: null, filtro: null, formato: null, categoria: null });
              }}
              className="text-text-muted hover:text-foreground inline-flex items-center gap-1 text-sm underline underline-offset-4"
            >
              <X aria-hidden className="size-3.5" />
              Limpar
            </button>
          </>
        ) : null}
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          title={
            termo.trim() !== "" ? "Nada com esse termo" : "Nada neste recorte"
          }
          description={
            termo.trim() !== ""
              ? "A busca aqui olha o título, o resumo e as etiquetas. O texto de dentro dos playbooks é buscável na página de cada um."
              : "Afrouxe um dos filtros acima para ver o resto do acervo."
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

/**
 * O CHIP QUE SE ACUMULA, e `aria-pressed` é o que diz isso.
 *
 * Ele é o mesmo desenho do chip da Biblioteca do portal, e a diferença com o
 * `ControleSegmentado` ao lado é de FORMA e não de estilo: a caixa com um gomo
 * aceso diz "escolha um", e pílulas soltas dizem "marque quantas quiser". Era
 * exatamente essa distinção que a fileira antiga não tinha — onze pílulas
 * iguais, e três comportamentos diferentes atrás delas.
 */
function Chip({
  ativo,
  aoClicar,
  children,
}: {
  ativo: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        // `min-h-9` e `text-sm` são o que alinha o chip com o controle
        // segmentado ao lado: numa linha onde as duas peças convivem, meio
        // pixel de diferença de altura lê como peça fora de lugar.
        "border-input bg-card inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
        ativo
          ? "border-action-text bg-action-soft text-action-text font-semibold"
          : "text-text-secondary hover:text-text-primary",
      )}
    >
      {children}
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
