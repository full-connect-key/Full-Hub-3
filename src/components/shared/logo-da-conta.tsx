import { ImagemAssinada } from "@/components/shared/imagem-assinada";
import { iniciaisDe } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

/**
 * A MARCA DA CONTA — o logo do cliente, ou as iniciais da empresa.
 *
 * Decisão do usuário: *"utilizar o logo do cliente em todos os locais onde
 * hoje aparecem apenas as iniciais, sem recorte nem distorção, com as
 * iniciais como fallback"*.
 *
 * ===========================================================================
 * A COLUNA EXISTIA E ERA DESENHADA EM TRÊS LUGARES, TODOS OS TRÊS CORTANDO
 *
 * `clients.logo_url` nasceu na 0002 e passou doze sprints como campo de
 * anotação — a quinta ponte construída e nunca atravessada. A capa do portal
 * (0063), o filtro de contas da Gestão de Tasks e a grade de Portais do
 * Cliente a atravessaram depois, e **os três a desenham em CÍRCULO com
 * `object-cover`**, que é precisamente o recorte que o pedido proíbe: um
 * wordmark de 833 × 454 num círculo de 32px é escalado até cobrir, e **45% da
 * largura é cortada** — "Mundo Verde" sai "do Ve".
 *
 * Então este componente não é só "o logo em mais telas": ele é a regra de
 * COMO o logo se desenha, e os três lugares antigos passaram a usá-la.
 *
 * ===========================================================================
 * `object-contain`, E O CUSTO ESTÁ DITO EM VEZ DE ESCONDIDO
 *
 * Com `contain`, aquele mesmo wordmark num quadrado de 32px vira uma faixa de
 * 32 × 17 — **inteiro e pequeno**, em vez de pela metade e grande. É o lado
 * certo do erro para o que o pedido pede: um logo cortado afirma uma marca que
 * não é aquela, e um logo pequeno só pede uma versão quadrada do arquivo, que
 * é a convenção de todo campo de avatar.
 *
 * **É QUADRADO E NÃO CÍRCULO, e é a medida que decide a forma:** a caixa
 * inscrita num círculo tem 0,707 do lado, então o quadrado devolve **41% mais
 * largura útil** a uma marca deitada. E um wordmark num quadrado arredondado
 * se lê como ladrilho de marca; num círculo, como rosto.
 *
 * ===========================================================================
 * `ImagemAssinada` E `iniciaisDe()`, E NENHUMA SEGUNDA CÓPIA DE NADA
 *
 * O logo mora no bucket PRIVADO `campanhas-arquivos`: quem o desenha precisa
 * do endereço assinado, e `next/image` guardaria uma assinatura que vence —
 * a regra inteira está no cabeçalho de `imagem-assinada.tsx`, e passar por
 * ela é o que traz de graça a guarda do caminho cru de bucket.
 *
 * E as iniciais saem de `iniciaisDe()`, do `UserAvatar`: o índice do Social
 * tinha a função dele, `sigla()`, que é a MESMA conta escrita duas vezes —
 * o que a história das sete cópias de `abas.tsx` existe para não repetir.
 *
 * ***O que ele NÃO resolve, e é dito em vez de escondido:*** o chão. Um logo
 * PNG com fundo transparente e tinta escura perde contraste no tema escuro, e
 * o produto não tem como saber qual dos dois o arquivo é — a saída é a conta
 * subir um logo com o próprio fundo, que é o que quase todo arquivo de marca
 * já traz. **Isso não é novo:** os três lugares antigos já desenhavam sobre a
 * superfície de trás, e o que mudaria seria um ladrilho sempre claro — ou
 * seja, um quadrado branco no tema escuro, que é uma decisão de paleta que
 * ninguém pediu.
 */
const TAMANHOS = {
  /** A célula estreita: o item de um `Select`, a linha de uma tabela densa. */
  xs: "size-5 rounded text-[9px]",
  sm: "size-6 rounded-md text-[10px]",
  md: "size-8 rounded-lg text-[11px]",
  lg: "size-10 rounded-lg text-xs",
} as const;

export function LogoDaConta({
  nome,
  src,
  tamanho = "md",
  className,
}: {
  /** O nome da empresa — é dele que saem as iniciais do fallback. */
  nome: string;
  /** O endereço JÁ ASSINADO. Nulo é a conta que não subiu logo nenhum. */
  src: string | null;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // O CHÃO É `--muted` E NÃO O DO CARTÃO, e foi a imagem que mandou.
        // Com `bg-card` o ladrilho é branco sobre um cartão branco: a marca
        // que não traz fundo próprio — que é a maioria, porque logo de
        // cliente chega em PNG ou SVG transparente — fica FLUTUANDO, e uma
        // marca deitada sem ladrilho em volta lê como um risco solto, não
        // como um logo. Com o chão pálido ela é um ladrilho em qualquer
        // superfície, e as duas respostas deste componente passam a ser o
        // MESMO objeto: o logo e as iniciais no mesmo chão, na mesma caixa.
        // Com `bg-card` a conta com logo ganhava ladrilho branco e a sem logo
        // ladrilho cinza — dois desenhos na mesma coluna.
        "bg-muted relative block shrink-0 overflow-hidden",
        TAMANHOS[tamanho],
        className,
      )}
    >
      <ImagemAssinada
        src={src}
        // `alt` VAZIO de propósito: em toda chamada o nome da empresa está
        // escrito ao lado, e um `alt` com o nome o leria duas vezes. Onde ele
        // não estiver, quem nomeia é o chamador — é a decisão do chip do
        // calendário.
        alt=""
        className="object-contain p-0.5"
        // AS INICIAIS, e não o aviso de arquivo ausente: aqui "não há logo" é
        // o estado NORMAL de quase toda conta, e `ImagemAssinada` desenharia
        // "Arquivo indisponível" num ladrilho de 32px. O par é o neutro que o
        // `check:cores` já mede.
        aoFalhar={
          <span
            aria-hidden
            // Sem `bg-muted` próprio: o chão já é o do invólucro, e repetir
            // seria a mesma cor escrita em dois lugares para divergir num.
            className="text-text-secondary absolute inset-0 grid place-items-center font-bold"
          >
            {iniciaisDe(nome)}
          </span>
        }
      />
    </span>
  );
}
