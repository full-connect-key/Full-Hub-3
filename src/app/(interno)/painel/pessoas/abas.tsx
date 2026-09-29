"use client";

import { Building2, Users } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

// `Aba`, `ABAS` e `ehAba` moram em `vocabulario.ts`, sem diretiva: este
// arquivo e "use client", e o `page.tsx` -- que e de servidor -- chama
// `ehAba`. Valor exportado daqui chega la como referencia de cliente, e a
// chamada estoura em tempo de requisicao. O cabecalho de `vocabulario.ts`
// conta a historia inteira.
import { ABAS, type Aba } from "./vocabulario";

export type { Aba };

const ROTULOS: Record<Aba, { rotulo: string; Icone: typeof Users }> = {
  clientes: { rotulo: "Clientes", Icone: Building2 },
  equipe: { rotulo: "Equipe", Icone: Users },
};

/**
 * As duas seções de Gestão de Pessoas, na URL.
 *
 * **Link e não estado**, e quem garante isso agora é a `BarraDeContexto`:
 * "olha a ficha do Mundo Verde" precisa ser um link, e trocar de seção precisa
 * sobreviver ao botão de voltar.
 *
 * E trocar de seção troca a página no SERVIDOR — cada uma carrega só a própria
 * consulta. Quem abriu para cadastrar um cliente não busca a equipe inteira.
 *
 * **O comentário que estava aqui virou o componente compartilhado.** Ele dizia
 * *"no dia em que uma terceira tela precisar disto, vira `components/shared/`"*
 * — e quando alguém foi contar, eram sete, em três desenhos diferentes.
 */
export function AbasDePessoas({ atual, acoes }: { atual: Aba; acoes?: React.ReactNode }) {
  const secoes: SecaoDoModulo<Aba>[] = ABAS.map((aba) => ({ chave: aba, ...ROTULOS[aba] }));

  return (
    <BarraDeContexto
      rotuloAcessivel="Seções de Gestão de Pessoas"
      titulo="Gestão de Pessoas"
      atual={atual}
      secoes={secoes}
      acoes={acoes}
    />
  );
}
