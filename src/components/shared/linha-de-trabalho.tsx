import { cn } from "@/lib/utils";

/**
 * A ORDEM DE LEITURA DE TODA LINHA DE TRABALHO: status, nome, prioridade,
 * vencimento.
 *
 * Decisão do usuário, e ela é sobre CONSISTÊNCIA antes de ser sobre ordem:
 * *"a mesma estrutura para tasks e subtarefas, consistente entre os
 * módulos"*. O produto tinha quatro ordens — a lista da Gestão de Tasks, a
 * lista de etapas do detalhe, a de Minhas Tasks e a árvore da campanha —, e
 * em três delas o status vinha depois do prazo. Quem troca de módulo
 * reaprendia onde olhar a cada tela.
 *
 * **ELA É UM COMPONENTE E NÃO UMA CONVENÇÃO ESCRITA**, pela razão das sete
 * cópias de `abas.tsx`: uma ordem combinada em prosa é uma ordem que a quinta
 * tela quebra sem ninguém notar, porque nada reprova. Aqui a sequência é o
 * tipo — quem mexer nela mexe num lugar, e quem escrever a tela nova não tem
 * como inventar outra.
 *
 * **O QUE ELA NÃO FAZ é decidir o que vai em cada posição.** Cada módulo sabe
 * o que mostrar: a lista do detalhe põe o seletor de status, a de Minhas
 * Tasks põe o selo, a agrupadora não tem prioridade nem prazo porque os dois
 * passaram a ser das filhas. É a decisão da `BarraDeContexto` — o que se
 * centraliza é o desenho e o mecanismo, nunca a lista.
 *
 * **O STATUS PODE VIR DE FORA DA LINHA, e isso não quebra a regra.** Numa
 * lista agrupada por status o cabeçalho já o diz, e na coluna do board é a
 * coluna que o carrega — repetir o selo em cada linha seria a mesma palavra
 * duas vezes a dois centímetros de distância. O que a posição garante é que,
 * onde ele aparece, ele aparece ANTES do nome.
 *
 * **`extras` vem DEPOIS dos quatro**, e é onde moram o responsável, o
 * cronômetro, os cadeados e os botões de ação: eles são informação sobre a
 * linha, e nenhum deles é o que se procura ao varrer a lista.
 */
export function LinhaDeTrabalho({
  status,
  nome,
  prioridade,
  vencimento,
  antes,
  extras,
  className,
  ...resto
}: {
  /** Primeiro. Nulo quando quem o diz é o cabeçalho do grupo ou a coluna. */
  status?: React.ReactNode;
  /** Segundo, e é ele que cede largura: os outros são `shrink-0`. */
  nome: React.ReactNode;
  prioridade?: React.ReactNode;
  vencimento?: React.ReactNode;
  /** Antes do status: a alça de arrastar, o recuo da sub-etapa. */
  antes?: React.ReactNode;
  extras?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "children">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...resto}
    >
      {antes}
      {status ? (
        <div className="flex shrink-0 items-center">{status}</div>
      ) : null}

      {/* UM PISO, e não só `min-w-0`. Com o mínimo em zero o nome é o único
          da linha a ceder largura — todo o resto é `shrink-0` —, e num painel
          estreito "Revisar o texto do manual" saía como "Rev". Com o piso, o
          resto quebra para a linha de baixo, que é o que o `flex-wrap` do pai
          está aqui para fazer. */}
      <div className="min-w-[10rem] flex-1">{nome}</div>

      {prioridade || vencimento || extras ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {prioridade}
          {vencimento}
          {extras}
        </div>
      ) : null}
    </div>
  );
}
