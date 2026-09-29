/**
 * O título da porta: alterna entre a saudação e o lema da Full Connect Key.
 *
 * **O `<h1>` continua sendo "Entrar" e ele é `sr-only`.** Quem usa leitor de
 * tela ouve o nome da tela, não uma saudação que troca sozinha a cada cinco
 * segundos — e a página fica com um título estável, que é o que a estrutura do
 * documento precisa. O que alterna é decoração, e leva `aria-hidden`.
 *
 * Sem isso a mesma tela teria dois títulos diferentes conforme o segundo em que
 * alguém chegasse nela.
 *
 * **A animação é CSS puro** (`.lema` e `.lema-palavra` no `globals.css`), sem
 * estado e sem `setInterval`: a porta é a tela que alguém abre quando nada mais
 * funciona, e uma frase que depende de hidratar é uma frase que pode não
 * aparecer. Este componente só monta as palavras e numera cada uma — o `--i` é
 * o que escalona a entrada.
 *
 * `*...*` marca a palavra que sai em azul. É "chave", que liga o lema ao nome
 * da agência.
 */

const AZUL = "*";

/** A saudação vem primeiro porque é ela que a pessoa vê ao abrir a tela. */
const FRASES = [
  "Sejam bem-vindos!",
  `Entender, Conectar e Vender, essa é a ${AZUL}chave!${AZUL}`,
] as const;

function Frase({ texto, ordem }: { texto: string; ordem: number }) {
  return (
    <span className={`lema-frase lema-frase-${ordem}`}>
      {texto.split(" ").map((palavra, i) => {
        const azul =
          palavra.startsWith(AZUL) && palavra.endsWith(AZUL) && palavra.length > 2;
        const limpa = azul ? palavra.slice(1, -1) : palavra;

        return (
          <span key={`${ordem}-${i}`}>
            {i > 0 ? " " : null}
            <span
              className={`lema-palavra${azul ? " lema-chave" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              {limpa}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function LemaDaAgencia({ titulo }: { titulo: string }) {
  return (
    <>
      <h1 className="sr-only">{titulo}</h1>
      <p
        aria-hidden
        className="lema text-auth-texto text-[26px] leading-tight font-semibold tracking-tight text-balance lg:text-[27px]"
      >
        {FRASES.map((texto, i) => (
          <Frase key={i} texto={texto} ordem={i + 1} />
        ))}
      </p>
    </>
  );
}

/**
 * O título das OUTRAS três telas de (auth).
 *
 * **Só o login alterna a saudação e o lema**, e a razão é o que cada tela é: a
 * porta recebe, e as outras três respondem a um pedido — "Recuperar senha",
 * "Criar nova senha", "Olá, Joana". Pôr o lema piscando por cima delas trocaria
 * a informação de que a pessoa precisa por uma frase de marca, no momento em que
 * ela está tentando resolver um problema.
 *
 * O que ele compartilha com o lema é a escala de texto, e é por isso que os dois
 * moram no mesmo arquivo: em dois, o tamanho do título divergiria na primeira
 * mudança e a mesma casca teria duas alturas de cabeçalho.
 */
export function TituloDaPorta({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-auth-texto text-[26px] leading-tight font-semibold tracking-tight text-balance lg:text-[27px]">
      {children}
    </h1>
  );
}
