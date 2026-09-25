import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A faixa de imagem no topo de um cartão (0050).
 *
 * **Ela é o mesmo componente nos dois lados** — o cartão da agência e o do
 * portal —, porque a capa existe justamente para a campanha ser reconhecida
 * de relance: duas proporções diferentes fariam a mesma campanha parecer
 * outra em cada tela, e quem confere o portal do cliente depois de abrir a
 * campanha veria uma imagem cortada em outro lugar.
 *
 * **Sem capa NÃO vira um retângulo cinza com um ícone**, e a ausência é
 * escolha: numa grade em que quase nenhuma campanha tem imagem, o espaço
 * reservado é uma lista de buracos. A moldura vazia só aparece onde quem
 * pode trocar a capa está olhando — é ela que diz onde clicar.
 *
 * `object-cover` e não `contain`: a capa é ornamento de reconhecimento, não
 * o material. Uma imagem com barras em volta parece um erro de upload.
 */
export function CapaDoCartao({
  url,
  alt,
  proporcao = "larga",
  vazia = false,
  className,
}: {
  url: string | null;
  /** O nome da campanha; é o que um leitor de tela ouve no lugar da imagem. */
  alt: string;
  proporcao?: "larga" | "quadrada";
  /** Desenha a moldura vazia quando não há capa (só onde dá para pôr uma). */
  vazia?: boolean;
  className?: string;
}) {
  const forma =
    proporcao === "quadrada" ? "aspect-square" : "aspect-[16/6]";

  if (!url) {
    if (!vazia) return null;
    return (
      <div
        className={cn(
          "border-border bg-muted text-text-muted flex items-center justify-center rounded-lg border border-dashed",
          forma,
          className,
        )}
      >
        <ImageIcon aria-hidden className="size-5" />
      </div>
    );
  }

  return (
    // `next/image` exigiria declarar o domínio do Supabase em `next.config`, e
    // a URL assinada muda de assinatura a cada hora — o cache dele guardaria
    // uma que vence. Uma tag simples é o que esta imagem precisa.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Capa de ${alt}`}
      className={cn("w-full rounded-lg object-cover", forma, className)}
    />
  );
}
