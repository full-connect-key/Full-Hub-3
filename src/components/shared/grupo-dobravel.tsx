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
  caixa,
  parametro = "fechados",
  extra,
  children,
}: {
  /** Identifica o grupo na URL. É o valor do status, não o rótulo. */
  chave: string;
  titulo: string;
  contagem: number;
  /**
   * O PAR NOMEADO do grupo, quando ele tem uma cor própria — e com ele o
   * cabeçalho vira uma CAIXA.
   *
   * Decisão do usuário: *"cada status como 'Iniciar, Em Andamento, Aguardando
   * Aprovação etc...' estejam em um box com uma cor única, e o título fique em
   * caixa alta"*. Era um ponto de 8px ao lado de um título preto: a cor estava
   * lá e não se lia a dois metros, que é a distância de que uma lista de
   * quarenta linhas é olhada.
   *
   * **A CAIXA E A CAIXA ALTA ANDAM JUNTAS, e as duas dependem desta prop.**
   * Sem ela o grupo é por CLIENTE ou por CONTA, e ali as duas estariam
   * erradas: não existe cor da "Mundo Verde" no produto — inventar uma criaria
   * um vocabulário de cor que nenhuma outra tela conhece —, e caixa alta num
   * nome de empresa é a tela gritando o nome de quem contratou.
   *
   * **E O PONTO SAIU COM ELA.** Dentro de uma caixa já pintada com o par do
   * status, a bolinha é a mesma cor dita duas vezes a quatro pixels de
   * distância. O que garante que a cor não é o único sinal continua sendo o
   * NOME, que está escrito dentro da caixa.
   *
   * O valor vem de `classesDoChipDeStatus()`, que sai do MESMO mapa do selo e
   * do seletor: um segundo de-para de cor para os mesmos estados diverge na
   * primeira vez que alguém acrescenta um status e só lembra de um deles.
   */
  caixa?: string;
  /** O nome do parâmetro, para duas listas na mesma tela não se misturarem. */
  parametro?: string;
  /**
   * UM SEGUNDO FATO NO CABEÇALHO, para o grupo fechado continuar respondendo.
   *
   * Ele nasceu no Social Media, onde a lista passou a agrupar por CONTA e o
   * agrupamento anterior — Comigo / Esperando alguém / Fora das minhas mãos —
   * saiu. O que se perderia sem isto é a única coisa que aquele dava de
   * relance: em quais contas há trabalho esperando por MIM. Com "4 suas" ao
   * lado do total, a resposta sobrevive à dobra, que é a mesma razão pela
   * qual a contagem fica no cabeçalho.
   */
  extra?: React.ReactNode;
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
          className={cn(
            "flex items-center gap-2 text-left transition-colors",
            caixa
              ? // A CAIXA ABRAÇA O TÍTULO e não a linha inteira: uma faixa
                // colorida de 1100px por grupo pesa mais que a lista que ela
                // nomeia, e o pedido é um "box" em volta do status.
                //
                // **O HOVER É A BORDA E NÃO O CHÃO**, pela razão da 0127: um
                // filtro do Tailwind (`brightness`) não é cor nomeada e passa
                // despercebido pelo `check:cores`. `border-current` é a cor
                // de frente do próprio par — medida por construção, porque é
                // ela que o par mede contra o fundo.
                cn(
                  "w-fit rounded-lg border px-3 py-1.5 text-xs font-bold tracking-wide uppercase hover:border-current",
                  caixa,
                )
              : "text-text-primary hover:text-accent-strong w-full text-sm font-semibold",
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform",
              !caixa && "text-text-muted",
              fechado && "-rotate-90",
            )}
          />
          {titulo}
          <span
            className={cn(
              "font-normal tabular-nums",
              !caixa && "text-text-muted",
            )}
          >
            {contagem}
          </span>
          {extra}
        </button>
      </h2>

      {/* O conteúdo SAI DA ÁRVORE quando fechado, em vez de ficar escondido
          por CSS: um `hidden` deixaria os botões de ação de cada etapa
          alcançáveis pelo Tab dentro de um grupo que a pessoa fechou. */}
      {fechado ? null : <div id={idDoConteudo}>{children}</div>}
    </section>
  );
}
