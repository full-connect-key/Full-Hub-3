"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { BackgroundColor, Color, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import {
  Bold,
  Columns3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Quote,
  Rows3,
  Square,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";

import {
  CaixaDoBriefing,
  ROTULO_DA_CAIXA,
  TIPOS_DE_CAIXA,
  type TipoDeCaixa,
} from "@/components/shared/caixa-do-briefing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Editor de texto rico do briefing.
 *
 * O conteúdo é guardado em duas formas: o JSON do editor, que preserva a
 * formatação, e o texto puro, que é o que a busca consegue varrer. Por isso
 * `onChange` devolve os dois.
 *
 * StarterKit v3 já traz negrito, itálico, sublinhado, títulos, listas,
 * citação e link — só cor de texto e placeholder precisam ser acrescentados.
 */

/**
 * A PALETA, e ela passou a ser um NOME em vez de um hexadecimal.
 *
 * ---------------------------------------------------------------------------
 * **ISTO FECHA A "DECISÃO EM SUSPENSO" deste produto**, que registrava a conta
 * com os números: as cinco cores de antes eram hex literais gravados DENTRO do
 * documento, e por isso este arquivo era exceção do `check:cores` — *"no tema
 * claro três das cinco reprovam; no escuro as cinco reprovam, de 2,30 a 3,68.
 * Não existe hex que resolva os dois"*.
 *
 * **Não existe, e era essa a armadilha: a saída não é um hex, é um NOME.** O
 * documento grava `var(--rico-vermelho)`, o valor mora no `globals.css` com
 * par no `.dark`, e a mesma frase se lê nos dois temas. Medido: o pior par das
 * nove cores sobre os oito chãos possíveis é **4,95:1 no claro** e **6,82:1 no
 * escuro**.
 *
 * **E ISSO FUNCIONA porque o TipTap guarda o VALOR e não a cor resolvida:** o
 * `Color` do `@tiptap/extension-text-style` escreve `style="color: …"` e lê de
 * volta a declaração crua do atributo, nunca a cor computada. Foi conferido no
 * código dele, não suposto — `getStyleProperty` parte o atributo `style` por
 * `;` e devolve o texto depois dos dois-pontos.
 * ---------------------------------------------------------------------------
 */
const CORES = [
  { nome: "Padrão", valor: "" },
  { nome: "Vermelho", valor: "var(--rico-vermelho)" },
  { nome: "Laranja", valor: "var(--rico-laranja)" },
  { nome: "Âmbar", valor: "var(--rico-ambar)" },
  { nome: "Verde", valor: "var(--rico-verde)" },
  { nome: "Azul", valor: "var(--rico-azul)" },
  { nome: "Roxo", valor: "var(--rico-roxo)" },
  { nome: "Rosa", valor: "var(--rico-rosa)" },
  { nome: "Cinza", valor: "var(--rico-cinza)" },
];

/**
 * OS PASTÉIS, e eles são REALCE — não cor de letra.
 *
 * É a única leitura honesta de *"mais cores, pasteis"*: um pastel como cor de
 * texto é ilegível sobre fundo claro por construção, que é a conta que
 * derrubou os cinco hex de antes levada ao extremo. Como CHÃO, com a cor do
 * documento em cima, ele é exatamente o que "pastel" quer dizer num briefing.
 *
 * No tema escuro eles viram tinturas escuras da mesma matiz: um pastel de
 * verdade ali seria um bloco luminoso com texto claro por cima.
 */
const REALCES = [
  { nome: "Sem realce", valor: "" },
  { nome: "Amarelo", valor: "var(--rico-realce-amarelo)" },
  { nome: "Verde", valor: "var(--rico-realce-verde)" },
  { nome: "Azul", valor: "var(--rico-realce-azul)" },
  { nome: "Rosa", valor: "var(--rico-realce-rosa)" },
  { nome: "Roxo", valor: "var(--rico-realce-roxo)" },
  { nome: "Laranja", valor: "var(--rico-realce-laranja)" },
];

function BotaoDaBarra({
  ativo,
  titulo,
  onClick,
  children,
}: {
  ativo?: boolean;
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      onClick={onClick}
      className={cn("size-8", ativo && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}

function Barra({ editor }: { editor: Editor }) {
  function inserirLink() {
    const atual = editor.getAttributes("link").href as string | undefined;
    const endereco = window.prompt("Endereço do link", atual ?? "https://");
    if (endereco === null) return;
    if (endereco.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: endereco.trim() }).run();
  }

  return (
    <div className="bg-muted flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
      <BotaoDaBarra
        titulo="Negrito"
        ativo={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden />
      </BotaoDaBarra>
      <BotaoDaBarra
        titulo="Itálico"
        ativo={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden />
      </BotaoDaBarra>
      <BotaoDaBarra
        titulo="Sublinhado"
        ativo={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon aria-hidden />
      </BotaoDaBarra>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {[1, 2, 3].map((nivel) => (
        <Button
          key={nivel}
          type="button"
          variant="ghost"
          size="sm"
          title={`Título ${nivel}`}
          aria-pressed={editor.isActive("heading", { level: nivel })}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({ level: nivel as 1 | 2 | 3 })
              .run()
          }
          className={cn(
            "h-8 px-2 font-semibold",
            editor.isActive("heading", { level: nivel }) && "bg-accent text-accent-foreground",
          )}
        >
          H{nivel}
        </Button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      <BotaoDaBarra
        titulo="Lista com marcadores"
        ativo={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden />
      </BotaoDaBarra>
      <BotaoDaBarra
        titulo="Lista numerada"
        ativo={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden />
      </BotaoDaBarra>
      <BotaoDaBarra
        titulo="Citação"
        ativo={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote aria-hidden />
      </BotaoDaBarra>
      <BotaoDaBarra titulo="Link" ativo={editor.isActive("link")} onClick={inserirLink}>
        <Link2 aria-hidden />
      </BotaoDaBarra>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* A CAIXA, a tabela, a cor e o realce viraram MENUS, e a fileira de
          bolinhas saiu. Com nove cores, sete realces e quatro caixas, vinte
          alvos de 16px soltos numa barra que o modal da etapa também desenha
          seriam duas fileiras inteiras acima do campo — e um alvo de 16px é o
          que a diretriz de toque chama de pequeno demais.

          E CADA MENU DIZ A PALAVRA ao lado da amostra: num item de lista a
          cor sozinha não tem como ser o único sinal, que é a regra desta casa
          desde o chip do calendário. */}
      <MenuDaBarra titulo="Cor do texto" icone={<Palette aria-hidden />}>
        {CORES.map((cor) => (
          <DropdownMenuItem
            key={cor.nome}
            onSelect={() =>
              cor.valor
                ? editor.chain().focus().setColor(cor.valor).run()
                : editor.chain().focus().unsetColor().run()
            }
          >
            <span
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 rounded-full border",
                !cor.valor && "bg-foreground",
              )}
              style={cor.valor ? { backgroundColor: cor.valor } : undefined}
            />
            {cor.nome}
          </DropdownMenuItem>
        ))}
      </MenuDaBarra>

      <MenuDaBarra titulo="Realce" icone={<Highlighter aria-hidden />}>
        {REALCES.map((realce) => (
          <DropdownMenuItem
            key={realce.nome}
            onSelect={() =>
              realce.valor
                ? editor.chain().focus().setBackgroundColor(realce.valor).run()
                : editor.chain().focus().unsetBackgroundColor().run()
            }
          >
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-sm border"
              style={realce.valor ? { backgroundColor: realce.valor } : undefined}
            />
            {realce.nome}
          </DropdownMenuItem>
        ))}
      </MenuDaBarra>

      <MenuDaBarra titulo="Caixa" icone={<Square aria-hidden />}>
        {TIPOS_DE_CAIXA.map((tipo) => (
          <DropdownMenuItem
            key={tipo}
            onSelect={() => editor.chain().focus().alternarCaixa(tipo).run()}
          >
            <span
              aria-hidden
              data-caixa={tipo}
              className="conteudo-rico size-3.5 shrink-0 rounded-sm border"
              style={{ padding: 0, borderRadius: "0.25rem" }}
            />
            {ROTULO_DA_CAIXA[tipo as TipoDeCaixa]}
          </DropdownMenuItem>
        ))}
      </MenuDaBarra>

      <ControleDaTabela editor={editor} />
    </div>
  );
}

/**
 * Um menu da barra: o gatilho é um botão de ícone como os outros.
 *
 * Ele existe porque são TRÊS menus com a mesma casca — cor, realce e caixa —,
 * e a terceira cópia é a que divergiria no `aria-label` ou no tamanho do
 * ícone, que é a história das sete cópias de `abas.tsx` em miniatura.
 *
 * A TABELA SAIU DAQUI quando a dimensão passou a ser escolhida: um campo de
 * texto dentro de um `DropdownMenu` do Radix não recebe o que se digita — o
 * menu captura a tecla para a busca por letra dele. Por isso `ControleDaTabela`
 * é um `Popover`, que é o que a documentação do Radix manda usar para conteúdo
 * com campo dentro.
 */
/** Quantas linhas e colunas a tabela pode ter, e os dois têm razão. */
const MAX_LINHAS = 50;
const MAX_COLUNAS = 12;

/**
 * O controle de tabela: a dimensão se escolhe, e a tabela cresce depois.
 *
 * ISTO É UMA REVERSÃO DECLARADA, e a frase do usuário é o que a decide: *"no
 * texto do briefing ele permite apenas tabelas 3x3, pode mudar isso? quero que
 * seja ajustavel"*. O que estava escrito aqui era o contrário — *"o tamanho
 * inicial não é um seletor de dimensão, porque um briefing que pede tabela
 * pede quase sempre campo/valor ou peça/formato/prazo, e as linhas se
 * acrescentam dentro com o Tab"*.
 *
 * **O ARGUMENTO ERRAVA SOBRE A DESCOBERTA, e não sobre o caso comum.** As
 * linhas se acrescentam mesmo, e o 3×3 serve mesmo para quase todo briefing —
 * só que os comandos que fazem a tabela crescer só existem DENTRO dela, num
 * menu que precisa do cursor na célula para aparecer. Quem inseriu uma 3×3 e
 * precisava de cinco colunas leu o rótulo do botão — "Inserir tabela 3×3" — e
 * concluiu, com razão, que o produto só faz tabela 3×3. **Um caminho que
 * existe e não se anuncia é indistinguível de um caminho que não existe.**
 *
 * **SÃO DOIS CAMPOS E NÃO UMA GRADE DE PASSAR O MOUSE.** A grade é o que o
 * Word e o Google Docs fazem, e ela é mais bonita; ela tem um teto que o campo
 * não tem — uma grade de 6×6 não oferece as oito colunas que uma tabela de
 * cronograma pede —, e ela é um `role="grid"` com navegação por seta escrita à
 * mão, onde dois campos e um botão são teclado nativo.
 *
 * **O VALOR MORA NO RASCUNHO COMO TEXTO**, que é a razão escrita da quantidade
 * de peças do workflow (0140): um `<input type="number">` controlado por
 * número não deixa o campo ficar vazio enquanto a pessoa apaga o 3 para
 * digitar outro — ela apaga e o React devolve o 3 na mesma tecla.
 *
 * **E O BOTÃO CONTA**, em vez de dizer "Inserir": *"Inserir tabela 4 × 6"* é a
 * diferença entre um botão e uma instrução, que é a decisão da barra de salvar
 * do modal da etapa. Fora da faixa ele fica inerte **com a razão escrita** —
 * aceitar 300 colunas e clampar para 12 em silêncio seria aceitar e fazer
 * outra coisa, que a 0025 diz ser pior que recusar com explicação.
 *
 * **O CABEÇALHO CONTINUA VINDO, e não virou uma terceira escolha.** As duas
 * formas que um briefing pede — campo/valor e peça/formato/prazo — querem as
 * duas um cabeçalho, e quem não quer apaga a linha pelo próprio menu. Um
 * interruptor ali seria uma decisão a mais na frente da que ele pediu.
 *
 * **E A FRASE DO PÉ É A OUTRA METADE DA ENTREGA**: ela diz que a tabela cresce
 * depois e onde, que é o caminho que ninguém achava. Ela é uma frase e não um
 * mecanismo — os comandos continuam aparecendo só dentro da tabela, porque
 * fora dela a razão não é um passo que falta, é que não há tabela nenhuma a
 * que eles se apliquem.
 */
function ControleDaTabela({ editor }: { editor: Editor }) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState("3");
  const [colunas, setColunas] = useState("3");

  const pedidoDeLinhas = Number(linhas);
  const pedidoDeColunas = Number(colunas);
  const cabem =
    Number.isInteger(pedidoDeLinhas) &&
    Number.isInteger(pedidoDeColunas) &&
    pedidoDeLinhas >= 1 &&
    pedidoDeLinhas <= MAX_LINHAS &&
    pedidoDeColunas >= 1 &&
    pedidoDeColunas <= MAX_COLUNAS;

  const dentroDeUmaTabela = editor.isActive("table");

  function inserir() {
    if (!cabem) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: pedidoDeLinhas, cols: pedidoDeColunas, withHeaderRow: true })
      .run();
    setAberto(false);
  }

  /** Todo comando de dentro fecha o popover: ele agiu, não há o que escolher. */
  function comandar(acao: () => void) {
    acao();
    setAberto(false);
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Tabela"
          aria-label="Tabela"
          className="size-8"
        >
          <TableIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Tabela" className="w-72 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="tabela-linhas" className="text-xs">
              Linhas
            </Label>
            <Input
              id="tabela-linhas"
              inputMode="numeric"
              value={linhas}
              onChange={(e) => setLinhas(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tabela-colunas" className="text-xs">
              Colunas
            </Label>
            <Input
              id="tabela-colunas"
              inputMode="numeric"
              value={colunas}
              onChange={(e) => setColunas(e.target.value)}
              className="h-8"
            />
          </div>
        </div>

        {cabem ? null : (
          <p className="text-warning text-xs">
            De 1 a {MAX_LINHAS} linhas e de 1 a {MAX_COLUNAS} colunas.
          </p>
        )}

        <Button type="button" size="sm" className="w-full" disabled={!cabem} onClick={inserir}>
          <TableIcon aria-hidden className="size-3.5" />
          {cabem ? `Inserir tabela ${pedidoDeLinhas} \u00d7 ${pedidoDeColunas}` : "Inserir tabela"}
        </Button>

        <p className="text-text-muted text-xs">
          A primeira linha vira o cabeçalho.
          {dentroDeUmaTabela
            ? null
            : " A tabela cresce depois: com o cursor dentro dela, este menu ganha acrescentar linha e coluna."}
        </p>

        {/* OS COMANDOS DE DENTRO SÓ EXISTEM DENTRO, e não aparecem desligados:
            fora de uma tabela a razão não é um passo que falta, é que não há
            tabela nenhuma a que eles se apliquem. */}
        {dentroDeUmaTabela ? (
          <div className="space-y-1 border-t pt-3">
            <ComandoDaTabela
              onClick={() => comandar(() => editor.chain().focus().addRowAfter().run())}
              icone={<Rows3 aria-hidden className="size-3.5" />}
            >
              Acrescentar linha
            </ComandoDaTabela>
            <ComandoDaTabela
              onClick={() => comandar(() => editor.chain().focus().addColumnAfter().run())}
              icone={<Columns3 aria-hidden className="size-3.5" />}
            >
              Acrescentar coluna
            </ComandoDaTabela>
            <ComandoDaTabela
              onClick={() => comandar(() => editor.chain().focus().deleteRow().run())}
              icone={<Rows3 aria-hidden className="size-3.5" />}
            >
              Apagar a linha
            </ComandoDaTabela>
            <ComandoDaTabela
              onClick={() => comandar(() => editor.chain().focus().deleteColumn().run())}
              icone={<Columns3 aria-hidden className="size-3.5" />}
            >
              Apagar a coluna
            </ComandoDaTabela>
            <ComandoDaTabela
              onClick={() => comandar(() => editor.chain().focus().deleteTable().run())}
              icone={<Trash2 aria-hidden className="size-3.5" />}
              destrutivo
            >
              Apagar a tabela
            </ComandoDaTabela>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Uma linha de comando do popover da tabela. */
function ComandoDaTabela({
  onClick,
  icone,
  destrutivo,
  children,
}: {
  onClick: () => void;
  icone: React.ReactNode;
  destrutivo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
        destrutivo && "text-danger",
      )}
    >
      {icone}
      {children}
    </button>
  );
}

function MenuDaBarra({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={titulo}
          aria-label={titulo}
          className="size-8"
        >
          {icone}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const EXTENSOES = [
  StarterKit.configure({
    link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
  }),
  TextStyle,
  Color,
  // O REALCE JÁ VINHA NA MESMA CAIXA, e isto é o que torna os pastéis de graça:
  // `BackgroundColor` mora dentro de `@tiptap/extension-text-style`, que já era
  // dependência por causa do `Color`. Nenhum pacote novo para a metade do
  // pedido que fala de cor.
  BackgroundColor,
  CaixaDoBriefing,
  // `TableKit` traz a tabela, a linha, a célula e o cabeçalho de uma vez.
  // `resizable` porque uma tabela de briefing quase nunca tem colunas iguais —
  // "peça" é curta e "observação" é longa.
  TableKit.configure({ table: { resizable: true } }),
];

export function EditorRico({
  conteudo,
  onChange,
  placeholder = "Descreva o que precisa ser feito…",
  className,
}: {
  conteudo?: JSONContent | null;
  onChange: (dados: { json: JSONContent; texto: string }) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      ...EXTENSOES,
      Placeholder.configure({ placeholder, emptyNodeClass: "esta-vazio" }),
    ],
    content: conteudo ?? "",
    // Sem isto o Next tenta renderizar o editor no servidor e o React acusa
    // divergência na hidratação.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "conteudo-rico min-h-32 px-3 py-2.5 outline-none",
      },
    },
    onUpdate: ({ editor: instancia }) => {
      onChange({ json: instancia.getJSON(), texto: instancia.getText() });
    },
  });

  if (!editor) {
    return <div className={cn("bg-muted h-44 animate-pulse rounded-md border", className)} />;
  }

  return (
    <div
      className={cn(
        // BRANCO, E A BORDA DE CONTROLE. O invólucro não pintava chão
        // nenhum: na tela de detalhe da demanda o editor mora direto na
        // PÁGINA, então a caixa inteira era cinza sobre cinza, contornada por
        // `--border` a 1,07:1 — ou seja, um retângulo que não se via. E a
        // barra dentro dela era `bg-muted`, que sobre a página dá 1,04:1:
        // invisível também.
        //
        // Sobre o branco a barra passa a ser a faixa de 1,11:1 que um
        // cabeçalho de ferramenta é, e a caixa ganha 1,16:1 de chão mais
        // 3,43:1 de limite. **É o mesmo par do botão `outline`**, pela mesma
        // razão: aqui se clica e se digita.
        //
        // E ele é CONTEÚDO e não composição: o briefing é gravado e lido por
        // quem produz, como "Arquivos da entrega" logo abaixo — que já era
        // cartão branco. O campo de comentário continua transparente, e a
        // distinção é essa: **branco é o que fica, contornado é o que se
        // escreve agora.**
        "focus-within:border-ring focus-within:ring-ring/50 bg-card border-input overflow-hidden rounded-md border transition-[color,box-shadow] focus-within:ring-[3px]",
        className,
      )}
    >
      <Barra editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

/** Mostra o briefing já formatado, sem deixar editar. */
export function VisualizadorRico({
  conteudo,
  className,
}: {
  conteudo: JSONContent | null;
  className?: string;
}) {
  const editor = useEditor({
    extensions: EXTENSOES,
    content: conteudo ?? "",
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn("conteudo-rico outline-none", className) } },
  });

  if (!editor) return <div className="bg-muted h-20 animate-pulse rounded-md" />;
  return <EditorContent editor={editor} />;
}
