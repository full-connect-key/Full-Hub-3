import type { Metadata, Viewport } from "next";
import { Geist_Mono, Google_Sans } from "next/font/google";

import { ProvedorDeTema } from "@/components/shared/provedor-de-tema";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

/**
 * A LETRA DO PRODUTO É UMA SÓ, e é a Google Sans.
 *
 * Decisão do usuário, depois de comparar quatro famílias na mesma tela. Ela
 * entra no `layout.tsx` da raiz, então vale no painel, no portal **e na
 * porta** — que era a única tela com letra própria.
 *
 * **Sora saiu, e com ela saiu o argumento que a justificava.** Ela era
 * carregada só em `(auth)` porque era uma SEGUNDA família, e uma letra a mais
 * no produto inteiro seria peso em toda visita para uma tela que se vê uma vez
 * por dia. Com uma família só essa conta não existe mais: a porta usa a mesma
 * letra do trabalho, e o `--font-porta` que apontava para a Sora foi apagado
 * do `globals.css` — dois tokens para a mesma família seriam duas verdades
 * esperando divergir.
 *
 * **É a VARIÁVEL, e o eixo `wght` dela vai de 400 a 700** — conferido no
 * catálogo do `next/font`, não lembrado. O produto não usa nada acima de 700
 * (nenhum `font-extrabold`, nenhum `font-black`), então a faixa cobre a escala
 * inteira sem o navegador precisar engordar peso nenhum. Por isso não há
 * `weight` aqui: pedir pesos soltos baixaria vários arquivos estáticos no
 * lugar de um variável.
 *
 * **`Google Sans Text` NÃO entra, e a ausência é decisão.** É ela a face
 * desenhada para tamanho pequeno — olho maior, espaço mais largo —, e é assim
 * que o Google usa o par. Só que ela **não está no catálogo do `next/font`**:
 * entraria por `next/font/local`, com os arquivos versionados no repositório.
 * O ganho é real e pequeno; o custo é binário no repo e uma segunda família
 * para manter. Se um dia o texto de 11px pedir, é essa a porta.
 *
 * O mono continua Geist Mono: ele responde a outra pergunta — cronômetro,
 * código, senha provisória — e a família de texto não faz esse trabalho.
 */
const googleSans = Google_Sans({
  variable: "--fonte-google-sans",
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Full Hub",
    template: "%s | Full Hub",
  },
  description: "Plataforma interna da Full Connect Key.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F6F8" },
    { media: "(prefers-color-scheme: dark)", color: "#17191D" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${googleSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ProvedorDeTema>
          {children}
          <Toaster position="top-center" richColors />
        </ProvedorDeTema>
      </body>
    </html>
  );
}
