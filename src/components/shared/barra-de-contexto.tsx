"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SecaoDoModulo<C extends string = string> = {
  chave: C;
  rotulo: string;
  Icone: LucideIcon;
  /**
   * O que espera ação nesta seção. **Zero não vira selo** — um selo com zero é
   * a mesma linha com um número a mais, e a ausência é a resposta. É a decisão
   * da matriz do Full Days, que pinta só a exceção.
   */
  contagem?: number;
  /** O que o selo diz para quem usa leitor de tela. */
  rotuloDaContagem?: string;
};

/**
 * A BARRA DE CONTEXTO DO MÓDULO: as seções dele, num lugar só.
 *
 * ---------------------------------------------------------------------------
 * **ERAM SETE CÓPIAS, EM TRÊS DESENHOS DIFERENTES.** Gestão de Tasks, Gestão
 * de Pessoas, Financeiro, Notas Fiscais, Métricas, Comodatos e Full Days
 * tinham cada um o seu `abas.tsx`, e Minhas Tasks e Gestão de Tasks tinham
 * ainda um seletor de visão por cima — nove componentes escrevendo a mesma
 * navegação. Três deles em pílula, quatro sublinhados, e o de visão com um
 * terceiro tamanho: quem trocava de módulo trocava de vocabulário visual sem
 * que nada tivesse mudado de natureza.
 *
 * O comentário do de Pessoas já dizia, quando eram dois: *"no dia em que uma
 * terceira tela precisar disto, vira `components/shared/`"*. Eram sete.
 * ---------------------------------------------------------------------------
 *
 * **O QUE ELA CENTRALIZA É O DESENHO E O MECANISMO, nunca a lista.** Cada
 * módulo continua dizendo quais são as seções dele, quais o perfil de quem
 * está olhando alcança, e o que contar no selo — porque essas três coisas são
 * conhecimento do módulo, e uma lista central teria que carregar o `QUEM_VE`
 * das Métricas, o "só o sócio" das Notas e a contagem da fila de aval. O que
 * some é a nona cópia do `<Link>` e do `new URLSearchParams`.
 *
 * **Ela GRUDA embaixo da topbar**, e é o que a faz ser barra de contexto e não
 * mais uma linha da página: rolando uma lista de quarenta demandas, saber em
 * que seção se está continua valendo. `top-16` é a altura do cabeçalho, e o
 * fundo é o da página com desfoque, como ele — as duas lidas juntas formam uma
 * faixa só.
 *
 * **E ela é ALINHADA AO CONTEÚDO, não sangra para fora dele.** A primeira
 * versão usava `-mx-4 lg:-mx-8` para encostar nas bordas, e é a decisão que a
 * capa do cliente já pagou: `main` é `mx-auto max-w-6xl`, então tirar o respiro
 * deixa a faixa mais larga que os cartões e ainda longe da borda da janela —
 * nem alinhada nem de ponta a ponta, que é a única das três que parece erro.
 *
 * **MENOS DE DUAS SEÇÕES NÃO VIRA BARRA.** É a regra que os Comodatos e as
 * Notas Fiscais já aplicavam: o colaborador vê uma seção só, e uma navegação
 * de um item é moldura sem função — a mesma razão pela qual as abas de Equipe
 * sumiram quando sobrou uma.
 *
 * **O SCROLL É DO `nav` E O `min-w-max` É DO `ul`**, e a lição é cara: os dois
 * na mesma tag não fazem nada — um elemento com `min-w-max` tem exatamente a
 * largura do conteúdo, então nunca transborda a si mesmo; quem transborda é o
 * PAI. Em 375px a barra empurrava a página inteira para os lados, e cabeçalho,
 * conteúdo e rodapé saíam da tela. Foi a imagem de 375px que mostrou, e a
 * mesma linha estava no Full Days desde o Sprint 6. **Centralizada aqui, ela
 * deixa de poder voltar em uma das nove cópias.**
 *
 * **ELA CARREGA O `<h1>` DA PÁGINA, E ELE É `sr-only`.** Nas telas em que o
 * `PageHeader` só repetia o nome do módulo, ele saiu: a faixa de contexto
 * fica grudada embaixo da topbar, que já diz o nome — ler "Gestão de Tasks"
 * duas vezes, uma embaixo da outra, é a redundância que a interface "Leve"
 * existe para tirar. Mas a página não pode ficar sem título: quem usa leitor
 * de tela navega por cabeçalho, e uma tela sem `h1` é uma tela sem nome. É a
 * decisão do `<h1>` `sr-only` da porta, pela mesma razão — **um título por
 * tela, e estável**.
 *
 * `titulo` só vem de quem tirou o `PageHeader`. Onde ele ficou (porque diz
 * outra coisa, como "Bom dia, Ana", ou porque carrega ações), o `h1` continua
 * sendo dele e a barra não escreve um segundo.
 *
 * **Link e não estado**, como toda listagem do produto: "olha a fila de aval"
 * precisa ser um link, e trocar de seção precisa sobreviver ao botão de
 * voltar. E `limparAoSair` existe porque o filtro de uma seção não significa
 * nada na outra — um `?status=entregue` sobrevivendo até a volta para Demandas
 * filtra de verdade, e ninguém pediu.
 */
export function BarraDeContexto<C extends string>({
  rotuloAcessivel,
  titulo,
  parametro = "aba",
  atual,
  secoes,
  limparAoSair,
  acoes,
}: {
  /** "Seções de Gestão de Tasks" — o que o leitor de tela anuncia. */
  rotuloAcessivel: string;
  /** O `<h1>` da página, invisível. Só para quem tirou o `PageHeader`. */
  titulo?: string;
  /** A chave na URL. Quase sempre `aba`; Minhas Tasks usa `visao`. */
  parametro?: string;
  atual: C;
  secoes: SecaoDoModulo<C>[];
  /** Parâmetros que não fazem sentido na seção de destino. */
  limparAoSair?: (destino: C) => string[];
  /** O que fica à direita da barra — "Nova task", "Modelo do termo". */
  acoes?: React.ReactNode;
}) {
  const caminho = usePathname();
  const parametros = useSearchParams();

  if (secoes.length < 2 && !acoes) return null;

  function href(destino: C) {
    const busca = new URLSearchParams(parametros.toString());
    busca.set(parametro, destino);
    for (const chave of limparAoSair?.(destino) ?? []) busca.delete(chave);
    return `${caminho}?${busca.toString()}`;
  }

  return (
    <div className="bg-surface-page/75 sticky top-16 z-20 flex flex-wrap items-center gap-3 py-2 backdrop-blur-xl">
      {titulo ? <h1 className="sr-only">{titulo}</h1> : null}

      {secoes.length > 1 ? (
        <nav aria-label={rotuloAcessivel} className="min-w-0 overflow-x-auto">
          <ul className="bg-muted inline-flex min-w-max gap-1 rounded-xl p-1">
            {secoes.map(({ chave, rotulo, Icone, contagem, rotuloDaContagem }) => {
              const ativo = chave === atual;
              return (
                <li key={chave}>
                  <Link
                    href={href(chave)}
                    aria-current={ativo ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                      ativo
                        ? "bg-surface-card text-text-primary font-medium shadow-sm"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <Icone aria-hidden className="size-4" />
                    {rotulo}
                    {contagem && contagem > 0 ? (
                      <span
                        className="bg-warning-soft text-warning rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums"
                        aria-label={rotuloDaContagem}
                      >
                        {contagem}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {acoes ? <div className="ml-auto flex items-center gap-2">{acoes}</div> : null}
    </div>
  );
}
