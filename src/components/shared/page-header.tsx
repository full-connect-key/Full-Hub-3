import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho padrão de toda página do painel: título e um espaço à direita
 * para as ações da tela (botões, filtros de alto nível).
 *
 * Usar sempre este componente é o que mantém o mesmo respiro e a mesma
 * hierarquia tipográfica de um módulo para o outro.
 *
 * **NÃO TEM `description`, e a ausência é deliberada.** A linha de subtítulo
 * abaixo do título saiu de todas as telas por decisão do produto. A prop foi
 * removida junto, e não só as chamadas: prop opcional que ninguém usa volta
 * na primeira tela nova que alguém escrever copiando outra.
 *
 * Isto NÃO vale para `ConfirmDialog` nem para `EmptyState`, que continuam
 * com `description`. Lá o texto não é legenda — é o que diz que a ação não
 * tem volta, ou o que fazer numa tela vazia.
 */
/**
 * A ESCALA DO TÍTULO É A DA INTERFACE APROVADA, e ela é grande de propósito:
 * 34px no desktop contra os 20px de antes.
 *
 * O argumento está no artifact, e é sobre onde mora a hierarquia. Os cinzas
 * desta interface foram escurecidos até 11,51:1 e 7,67:1 — quer dizer que a
 * diferença entre um título e um rótulo **deixou de ser feita por clareza**,
 * que é o sinal que depende de a pessoa enxergar bem. Ela passou a ser feita
 * por PESO E TAMANHO. Com o título em 20px e o rótulo em 11px, os dois quase
 * escuros, a tela vira um bloco só.
 *
 * `titleSecundario` é a segunda metade em tom mais fraco — "Bom dia, **Ana**".
 * Ela existe como prop e não como `ReactNode` no `title` porque o `<h1>`
 * precisa do texto inteiro para o leitor de tela: quebrado em dois nós, o
 * nome da página vira "Bom dia," e a pessoa fica sem saber onde está.
 */
export function PageHeader({
  title,
  titleSecundario,
  subtitulo,
  actions,
  className,
}: {
  title: string;
  /** A segunda metade do título, em tom mais fraco. Entra no mesmo `<h1>`. */
  titleSecundario?: string;
  /** A linha embaixo: data, contagem, o que situa a página. */
  subtitulo?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          {title}
          {titleSecundario ? (
            <span className="text-text-muted"> {titleSecundario}</span>
          ) : null}
        </h1>
        {subtitulo ? (
          <p className="text-text-secondary mt-1.5 text-sm font-semibold">
            {subtitulo}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
