"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** O valor que o `Select` do Radix usa para "ninguém": ele não aceita "". */
export const SEM_RESPONSAVEL = "__sem__";

export type PessoaDoSeletor = {
  id: string;
  nome: string;
  avatar_url?: string | null;
};

/**
 * QUEM FAZ ESTA ETAPA, escolhido onde a pergunta é feita.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"preciso que quando alguém vá abrir uma task, ela
 * possa selecionar o responsável, clicando na palavra responsável, sem
 * precisar abrir mais abas para editar, quero que a plataforma de maneira
 * geral seja intuitiva"*.
 *
 * **A PALAVRA ERA TEXTO MORTO**, e é literalmente ela que o pedido nomeia: a
 * linha de uma etapa sem dono escrevia `sem responsável` em cinza, do lado do
 * relógio — uma frase que descreve uma falta, parece o lugar de resolvê-la, e
 * não respondia ao clique. Quem queria distribuir trabalho tinha de abrir o
 * modal da etapa, achar o campo no meio de doze, e fechar. É a ponte
 * construída e nunca atravessada pela vigésima vez: `atualizarSubtarefa`
 * grava `responsavel_id` desde o Sprint 3B, e o que faltava era um lugar de
 * clicar.
 *
 * ---------------------------------------------------------------------------
 * **ELE NÃO DECIDE QUANDO GRAVAR**, e é isso que o deixa servir aos dois
 * chamadores sem desfazer a decisão de nenhum — é a assimetria escrita de
 * `FaixaDeDisponibilidade`. Ele devolve a pessoa escolhida, e quem grava
 * resolve:
 *
 *   * na **linha da etapa** o clique É a escrita, porque uma linha de lista
 *     não tem botão de salvar e nunca vai ter;
 *   * no **modal da etapa** ele só marca a escolha, e quem oficializa é o
 *     botão Salvar.
 *
 * Duas cópias deste seletor divergiriam na primeira mudança, e a que
 * divergiria é a da linha — ela se relê menos que a do modal.
 *
 * ---------------------------------------------------------------------------
 * **`compacto` TROCA O GATILHO E NÃO A LISTA.** No modal ele é o campo de
 * sempre, de largura inteira, com borda. Na linha ele é o avatar (ou a frase)
 * com um `chevron` que só aparece no ponteiro em cima: a linha tem dez peças
 * disputando a largura, e um campo com borda ali seria a décima primeira.
 *
 * **`tooltip={false}` no avatar, e isto é regra e não gosto:** ele mora dentro
 * do `SelectTrigger`, que é um `<button>`, e o `TooltipTrigger` do Radix é
 * interativo — um interativo dentro de outro é `nested-interactive`, crítico
 * no axe, e na prática duas paradas de Tab para a mesma coisa. O nome vai no
 * `aria-label` do gatilho, que é o que o leitor de tela anuncia.
 * ---------------------------------------------------------------------------
 */
export function SeletorDeResponsavel({
  valor,
  atual,
  equipe,
  aoMudar,
  podeEditar,
  compacto = false,
  desabilitado = false,
}: {
  valor: string | null;
  /**
   * A PESSOA COMO A LINHA A CONHECE, e ela existe por causa de uma imagem.
   *
   * A primeira versão desenhava o gatilho procurando `valor` dentro de
   * `equipe` — e `equipe` é a lista de quem está ATIVO. A imagem do protótipo
   * saiu com três etapas marcadas "sem responsável" tendo dono: a pessoa
   * delas não estava naquela lista. **E o estrago é o pior possível**, porque
   * a frase é plausível: quem a lê conclui que a etapa está órfã e vai
   * distribuí-la de novo.
   *
   * A linha já SABE quem é — ela desenha o avatar dessa pessoa desde o Sprint
   * 3B. Então ela passa, e `equipe` volta a ter um trabalho só: a lista de
   * para quem dá para mudar.
   */
  atual?: PessoaDoSeletor | null;
  equipe: PessoaDoSeletor[];
  aoMudar: (responsavelId: string | null) => void;
  podeEditar: boolean;
  compacto?: boolean;
  desabilitado?: boolean;
}) {
  // A ORDEM É `atual` PRIMEIRO, e em produção ela não muda nada: os dois saem
  // de `profiles`, na mesma requisição. Ela é esta porque é a mais fácil de
  // defender quando um dia divergirem — a linha é o REGISTRO de quem responde
  // por esta etapa, e `equipe` é a lista de para quem dá para mudar.
  //
  // E o `atual?.id === valor` é obrigatório por causa do modal: lá o seletor
  // escreve num rascunho, então `valor` vira a pessoa recém-escolhida enquanto
  // `atual` ainda é a de antes. Sem a guarda o gatilho mostraria a antiga.
  const pessoa = valor
    ? ((atual?.id === valor ? atual : undefined) ??
      equipe.find((p) => p.id === valor))
    : undefined;

  // O NOME DE QUEM NINGUÉM SABE QUEM É, e a ausência é honesta: sobra o caso
  // em que há `responsavel_id` gravado e nem a lista nem a linha sabem de quem
  // é. Escrever "sem responsável" afirmaria que a etapa não tem dono; o que a
  // tela sabe é que não sabe quem é.
  const rotulo = pessoa
    ? pessoa.nome
    : valor
      ? "Responsável fora da equipe"
      : "Sem responsável";

  const conteudo = pessoa ? (
    <span className="flex items-center gap-1.5">
      <UserAvatar
        name={pessoa.nome}
        src={pessoa.avatar_url}
        size="sm"
        tooltip={false}
      />
      {compacto ? null : <span className="truncate">{pessoa.nome}</span>}
    </span>
  ) : (
    // NO COMPACTO A FRASE ENCURTA e nunca troca de sentido: "fora da equipe"
    // é a mesma informação de "Responsável fora da equipe" numa linha que tem
    // dez peças disputando a largura, e o rótulo inteiro continua no
    // `aria-label` e no `title`.
    <span
      className={cn("truncate", compacto && "text-muted-foreground text-xs")}
    >
      {compacto ? (valor ? "fora da equipe" : "sem responsável") : rotulo}
    </span>
  );

  // SEM PERMISSÃO NÃO HÁ GATILHO, em vez de um campo desligado: na linha de
  // uma lista um `<button>` permanentemente inerte é ruído em toda linha, e a
  // razão — "esta etapa não é sua para distribuir" — não é um passo que falta.
  // É a decisão do "Abrir em página inteira" do painel de Minhas Tasks.
  if (!podeEditar) {
    return pessoa ? (
      <UserAvatar name={pessoa.nome} src={pessoa.avatar_url} size="sm" />
    ) : (
      <span className="text-muted-foreground text-xs">
        {compacto ? "sem responsável" : rotulo}
      </span>
    );
  }

  return (
    <Select
      value={valor ?? SEM_RESPONSAVEL}
      disabled={desabilitado}
      onValueChange={(escolhido) =>
        aoMudar(escolhido === SEM_RESPONSAVEL ? null : escolhido)
      }
    >
      <SelectTrigger
        aria-label={`Responsável: ${rotulo}`}
        title={compacto ? `Responsável: ${rotulo}` : undefined}
        className={cn(
          compacto
            ? // O GATILHO SEM CHROME, E O CHEVRON APARECE EM REPOUSO.
              //
              // A primeira versão era `[&>svg]:opacity-0 hover:…:opacity-100`,
              // e ela errava o pedido inteiro: *"quero que a plataforma de
              // maneira geral seja intuitiva"*. Em repouso o controle ficava
              // IDÊNTICO ao `<span>` morto que ele substituiu — o nome da
              // pessoa, ou "sem responsável", em texto cinza. Quem não passasse
              // o ponteiro por cima não tinha como saber que ali se clica, que
              // é exatamente a queixa que abriu esta entrega.
              //
              // **E A IMAGEM PROVOU ISSO**, pelo outro lado: a tela do
              // protótipo precisava ABRIR a lista para a peça aparecer — e
              // fotografar um `Select` aberto custa três nós de
              // `aria-hidden-focus` no axe, que é comportamento dos 52 Selects
              // do produto e não desta tela. Com o chevron em repouso, a
              // imagem fechada já prova que o controle existe.
              //
              // Ele é `--text-muted` e some para `--text-primary` no ponteiro:
              // visível o bastante para dizer "aqui se escolhe", discreto o
              // bastante para onze linhas não virarem onze setas gritando.
              "h-auto w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-1 data-[size=default]:h-auto [&>svg]:text-muted-foreground hover:[&>svg]:text-foreground focus-visible:[&>svg]:text-foreground"
            : "w-full",
        )}
      >
        {/* O CHEVRON NÃO É ESCRITO AQUI, e a primeira versão escrevia: o
            `SelectTrigger` do shadcn já desenha um `ChevronDownIcon` como
            último filho, então a linha saía com DOIS — `sem responsável ⌄ ⌄`.
            Só a imagem pega: dois ícones iguais lado a lado não são erro de
            tipo, de cor nem de árvore de acessibilidade. O `[&>svg]` do
            `className` estiliza o que já existe. */}
        {compacto ? conteudo : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {/* "Sem responsável" É UMA OPÇÃO e fica no topo: tirar o dono de uma
            etapa é um estado que o produto desenha — o board diz isso, e a
            abertura do mês de social avisa por extenso. */}
        <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
        {equipe.map((p) => (
          <SelectItem key={p.id} value={p.id} textValue={p.nome}>
            <span className="flex items-center gap-2">
              <UserAvatar
                name={p.nome}
                src={p.avatar_url}
                size="sm"
                tooltip={false}
              />
              {p.nome}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
