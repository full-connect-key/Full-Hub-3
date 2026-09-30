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
 * **SEM CAPA SÃO TRÊS RESPOSTAS, e não duas**, porque a pergunta "o que
 * desenhar quando não há imagem" tem três donos diferentes:
 *
 *   `nada`    — a faixa some. É para onde a capa é enfeite de reconhecimento e
 *               quem olha não pode pôr uma.
 *   `moldura` — o retângulo pontilhado, onde quem pode trocar a capa está
 *               olhando: é ele que diz onde clicar.
 *   `fundo`   — a faixa fica, na cor da marca. É para a GRADE.
 *
 * **O terceiro nasceu da imagem do protótipo**, e ele desfaz metade do que
 * estava escrito aqui. A regra antiga dizia que o espaço reservado numa grade
 * é "uma lista de buracos" — e a imagem mostrou o oposto: com uns cartões
 * carregando imagem e outros não, a grade fica com alturas desiguais e um vão
 * no fim da linha, que é a única das três que parece defeito. Um buraco é um
 * retângulo cinza vazio; `--brand-navy` é um fundo ESCOLHIDO, o mesmo que a
 * identidade do cliente usa quando não há capa, e ele dá ritmo à grade em vez
 * de tirá-lo.
 *
 * A regra antiga também supunha que quase nenhuma campanha teria capa. Isso
 * era verdade enquanto o único lugar de pôr uma era o cartão da listagem — e
 * deixou de ser no dia em que a tela de produção ganhou o uploader.
 *
 * `object-cover` e não `contain`: a capa é ornamento de reconhecimento, não
 * o material. Uma imagem com barras em volta parece um erro de upload.
 */
export function CapaDoCartao({
  url,
  alt,
  proporcao = "larga",
  semCapa = "nada",
  className,
}: {
  url: string | null;
  /** O nome da campanha; é o que um leitor de tela ouve no lugar da imagem. */
  alt: string;
  proporcao?: "larga" | "quadrada";
  /** O que desenhar quando não há capa — ver as três respostas acima. */
  semCapa?: "nada" | "moldura" | "fundo";
  className?: string;
}) {
  const forma =
    proporcao === "quadrada" ? "aspect-square" : "aspect-[16/6]";

  if (!url) {
    if (semCapa === "nada") return null;

    if (semCapa === "fundo") {
      return (
        <div
          aria-hidden
          className={cn("bg-brand-navy rounded-lg", forma, className)}
        />
      );
    }

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
