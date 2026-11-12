"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, type LucideIcon } from "lucide-react";

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
  icone: Icone,
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
  /**
   * A FORMA do grupo, ao lado da cor — e ela só existe com `caixa`.
   *
   * Decisão do usuário, por referência: a pílula ganhou um ícone dentro. Ele
   * vem de `iconeDoStatus()` e não de um mapa daqui, porque este componente
   * agrupa também por CLIENTE e por CONTA, e ali não há forma a escolher —
   * inventar uma seria um vocabulário de ícone que nenhuma outra tela conhece,
   * que é o mesmo argumento que mantém `caixa` fora daqueles grupos.
   *
   * **Ele é `aria-hidden`**: o nome do status está escrito ao lado, dentro da
   * mesma pílula, e um `aria-label` no ícone faria o leitor de tela dizer a
   * mesma palavra duas vezes.
   */
  icone?: LucideIcon;
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
    const lista = fechado
      ? fechados.filter((c) => c !== chave)
      : [...fechados, chave];
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
            // `group` É O CONTRATO da pílula cheia: o hover dela é
            // `group-hover:`, porque o alvo do clique é o botão inteiro — a
            // seta e a contagem incluídas — e um `hover:` na pílula só
            // acenderia com o ponteiro exatamente em cima dela.
            "group flex items-center gap-2 text-left",
            caixa
              ? "w-fit"
              : "text-text-primary hover:text-accent-strong w-full text-sm font-semibold transition-colors",
          )}
        >
          {/* A SETA SAI DE DENTRO DA PÍLULA, e isso é a referência: ela diz
              se o grupo está aberto, que é um fato sobre a LISTA e não sobre
              o status. Dentro de uma pílula cheia e saturada ela também
              competiria com o ícone do status a seis pixels de distância —
              dois glifos brancos na mesma peça, um dizendo o estado do
              trabalho e o outro o estado da dobra. */}
          <ChevronDown
            aria-hidden
            className={cn(
              "text-text-muted size-4 shrink-0 transition-transform",
              fechado && "-rotate-90",
            )}
          />
          {caixa ? (
            <span
              className={cn(
                // PÍLULA e não retângulo: `rounded-full` é o que separa um
                // rótulo de uma caixa de conteúdo, e com o chão cheio a
                // distinção passou a importar — um retângulo saturado de
                // 1100px seria uma faixa, que é o que esta decisão recusou
                // quando a caixa nasceu.
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide uppercase transition-colors",
                caixa,
              )}
            >
              {Icone ? (
                <Icone aria-hidden className="size-3.5 shrink-0" />
              ) : null}
              {titulo}
            </span>
          ) : (
            titulo
          )}
          {/* A CONTAGEM SAI DA PÍLULA, e a razão é o que cada uma responde: a
              pílula diz o que é o grupo e a contagem diz o tamanho dele —
              um fato da lista, como a seta. Dentro, ela herdava o branco e o
              caixa alta e lia como parte do nome do status. Fora, em cinza,
              ela continua sobrevivendo à dobra, que é a regra que a pôs no
              cabeçalho. */}
          <span className="text-text-muted font-normal tabular-nums">
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
