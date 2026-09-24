import Image from "next/image";

import { Logo } from "@/components/shared/logo";

export default function LayoutAutenticacao({ children }: LayoutProps<"/">) {
  return (
    <main className="from-muted/60 via-background to-muted/40 flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo tamanho="lg" assinatura="nenhuma" className="flex-col gap-3" />
          <p className="text-muted-foreground text-sm">
            Plataforma interna da Full Connect Key
          </p>
        </div>
        {children}

        {/* O WORDMARK DE VERDADE VIVE AQUI, e não embaixo do nome do produto.
            Ele é um lockup fechado — três linhas que se encaixam, com o
            símbolo já dentro —, não uma linha de assinatura: colado sob "Full
            Hub" ele disputava o mesmo espaço e repetia o disco que estava
            dois centímetros acima. No pé da página ele diz o que é, que é de
            quem é a casa, e é a única tela com altura sobrando para mostrá-lo
            no tamanho em que as três linhas ainda se leem. */}
        <AssinaturaDaAgencia />
      </div>
    </main>
  );
}

/**
 * As duas versões do wordmark, uma por tema.
 *
 * **Dois arquivos e não um filtro CSS.** A versão branca é um arquivo próprio
 * da agência; clarear a colorida por `filter` daria um cinza lavado no lugar
 * do branco e apagaria o azul junto. As duas carregam o mesmo `alt`: a que
 * estiver fora do tema sai com `display: none` e o leitor de tela não a
 * alcança, então o nome é anunciado uma vez.
 *
 * 833 × 454 é a caixa do arquivo colorido; a branca vem 833 × 428, porque o
 * recorte dela é mais justo embaixo. Cada uma mantém a sua proporção — dar a
 * mesma altura às duas esticaria uma delas.
 */
function AssinaturaDaAgencia() {
  return (
    <div className="mt-10 flex justify-center">
      <Image
        src="/marca/full-connect-key.png"
        alt="Full Connect Key"
        width={132}
        height={72}
        className="h-auto w-[132px] dark:hidden"
      />
      <Image
        src="/marca/full-connect-key-branco.png"
        alt="Full Connect Key"
        width={132}
        height={68}
        className="hidden h-auto w-[132px] dark:block"
      />
    </div>
  );
}
