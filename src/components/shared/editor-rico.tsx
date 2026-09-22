"use client";

import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

const CORES = [
  { nome: "Padrão", valor: "" },
  { nome: "Vermelho", valor: "#dc2626" },
  { nome: "Laranja", valor: "#ea580c" },
  { nome: "Verde", valor: "#059669" },
  { nome: "Azul", valor: "#2563eb" },
  { nome: "Roxo", valor: "#7c3aed" },
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
    <div className="bg-muted/40 flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
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

      <div className="flex items-center gap-1 px-1">
        {CORES.map((cor) => (
          <button
            key={cor.nome}
            type="button"
            title={`Cor: ${cor.nome}`}
            aria-label={`Cor do texto: ${cor.nome}`}
            onClick={() =>
              cor.valor
                ? editor.chain().focus().setColor(cor.valor).run()
                : editor.chain().focus().unsetColor().run()
            }
            className={cn(
              "size-4 rounded-full border transition-transform hover:scale-110",
              !cor.valor && "bg-foreground",
            )}
            style={cor.valor ? { backgroundColor: cor.valor } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

const EXTENSOES = [
  StarterKit.configure({
    link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
  }),
  TextStyle,
  Color,
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
    return <div className={cn("bg-muted/30 h-44 animate-pulse rounded-md border", className)} />;
  }

  return (
    <div
      className={cn(
        "focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-md border transition-[color,box-shadow] focus-within:ring-[3px]",
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

  if (!editor) return <div className="bg-muted/30 h-20 animate-pulse rounded-md" />;
  return <EditorContent editor={editor} />;
}
