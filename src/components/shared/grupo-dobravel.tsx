"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Um grupo de lista que abre e fecha pelo próprio cabeçalho.
 *
 * Decisão do usuário: *"pode colocar os itens, na visualização de lista,
 * separados por status? Tipo, um botão de Iniciar, que ao clicar, aparecem
 * todas as minhas tasks para iniciar"*.
 *
 * ---------------------------------------------------------------------------
 * **TODOS NASCEM ABERTOS, e o botão DOBRA.** O contrário — abrir a tela com
 * seis botões e nenhuma linha — troca uma lista por um índice, e obriga um
 * clique antes de ver qualquer trabalho. Aqui o primeiro clique tira da
 * frente o que já foi feito, e o segundo traz de volta.
 *
 * **A CONTAGEM FICA NO CABEÇALHO, sempre**, e é ela que faz dobrar ser
 * seguro: um grupo fechado continua dizendo quantos tem dentro, então nada
 * some — o que é a diferença entre recolher e esconder.
 * ---------------------------------------------------------------------------
 *
 * **O QUE ESTÁ FECHADO MORA NA URL**, como todo filtro de listagem deste
 * produto, e não em estado do componente nem no `localStorage`:
 *
 * - em estado, dobrar o grupo e trocar de visão desmonta a lista e devolve
 *   tudo aberto — exatamente o que a convenção quer dizer com *"o link
 *   precisa sobreviver à troca de visualização"*;
 * - no `localStorage`, a tela abriria com o que a URL diz e trocaria sozinha
 *   um instante depois para o que o navegador lembrava. É a decisão das
 *   camadas do Calendário Full, e o motivo é o mesmo: duas fontes para o
 *   mesmo estado é uma que mente.
 *
 * *O custo, dito em vez de escondido:* cada dobra é uma navegação, com a ida
 * ao servidor que toda outra faixa de filtro desta tela já faz. Em troca, o
 * recorte sobrevive ao recarregar, à troca de visão e ao link colado no
 * WhatsApp.
 *
 * **É `<button aria-expanded>` e não `<details>`**, porque o `<details>` com
 * o `open` controlado pela URL briga com o toggle nativo — o navegador abre,
 * o React fecha, e o grupo pisca. Com o botão, quem manda é um lugar só.
 */
export function GrupoDobravel({
  chave,
  titulo,
  contagem,
  ponto,
  parametro = "fechados",
  children,
}: {
  /** Identifica o grupo na URL. É o valor do status, não o rótulo. */
  chave: string;
  titulo: string;
  contagem: number;
  /** A classe do ponto colorido, quando o grupo tem uma cor própria. */
  ponto?: string;
  /** O nome do parâmetro, para duas listas na mesma tela não se misturarem. */
  parametro?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  // A VÍRGULA SEPARA, ENTÃO A CHAVE É ESCAPADA. Aqui ela é o valor de um
  // status na maioria dos casos, mas na Gestão de Tasks dá para agrupar por
  // cliente — e "Mundo Verde, Matriz" partiria a lista em dois grupos que
  // não existem.
  const fechados = (parametros.get(parametro) ?? "")
    .split(",")
    .filter(Boolean)
    .map(decodeURIComponent);
  const fechado = fechados.includes(chave);
  const idDoConteudo = `grupo-${parametro}-${chave}`;

  function alternar() {
    const proximos = new URLSearchParams(parametros.toString());
    const lista = fechado ? fechados.filter((c) => c !== chave) : [...fechados, chave];
    if (lista.length === 0) proximos.delete(parametro);
    else proximos.set(parametro, lista.map(encodeURIComponent).join(","));
    // `scroll: false` porque dobrar um grupo no meio da página e ser jogado
    // para o topo é perder o lugar onde a pessoa estava lendo.
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  return (
    <section className="space-y-2">
      <h2>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!fechado}
          aria-controls={idDoConteudo}
          className="text-text-primary hover:text-accent-strong flex w-full items-center gap-2 text-left text-sm font-semibold"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "text-text-muted size-4 shrink-0 transition-transform",
              fechado && "-rotate-90",
            )}
          />
          {ponto ? (
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", ponto)} />
          ) : null}
          {titulo}
          <span className="text-text-muted font-normal tabular-nums">{contagem}</span>
        </button>
      </h2>

      {/* O conteúdo SAI DA ÁRVORE quando fechado, em vez de ficar escondido
          por CSS: um `hidden` deixaria os botões de ação de cada etapa
          alcançáveis pelo Tab dentro de um grupo que a pessoa fechou. */}
      {fechado ? null : <div id={idDoConteudo}>{children}</div>}
    </section>
  );
}
