"use client";

import { CalendarRange, Images, Workflow } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

export type AbaDoSocial = "posts" | "meses" | "fluxos";

/**
 * As seções de Social Media — duas na 0087, três desde a navegação por mês.
 *
 * ---------------------------------------------------------------------------
 * **ESTE ARQUIVO É CLIENTE, E A RAZÃO É MECÂNICA.** `SecaoDoModulo` carrega um
 * `Icone` — um componente do lucide —, e componente não atravessa a fronteira
 * dentro de um objeto: montar a lista num Server Component e passá-la ao
 * `BarraDeContexto` derruba a página com *"Functions cannot be passed directly
 * to Client Components"*. É a família do valor exportado de arquivo `"use
 * client"`, vista do outro lado.
 *
 * E ele é o oitavo `abas.tsx` do produto depois de a `BarraDeContexto` ter
 * desfeito sete — o que ela centralizou é o DESENHO e o MECANISMO, nunca a
 * lista: *"cada módulo continua dizendo quais são as seções dele, quais o
 * perfil de quem está olhando alcança, e o que contar no selo"*.
 *
 * **E QUEM NÃO É GESTÃO PASSOU A GANHAR A BARRA**, o que antes não acontecia.
 * Até aqui ele alcançava uma seção só — Posts —, e "menos de duas seções não
 * vira barra" o deixava com o `PageHeader`. Com Meses sendo de `EQUIPE` ele
 * alcança duas, e a barra aparece: a regra não mudou, mudou quantas seções ele
 * tem. **Fluxos continua sendo só da gestão**, pela separação da 0046 e da
 * 0068 — desenhar a corrente que toda conta percorre é configuração do
 * produto, e achar o mês em que se trabalha é o trabalho do dia.
 * ---------------------------------------------------------------------------
 */
const SECOES: SecaoDoModulo<AbaDoSocial>[] = [
  { chave: "posts", rotulo: "Posts", Icone: Images },
  // MESES VEM NO MEIO, e não no fim: a ordem das seções é a da pergunta — o
  // que está acontecendo (Posts), onde mais há trabalho (Meses), e como a
  // corrente é montada (Fluxos, que é configuração). No fim, a navegação que
  // esta seção acrescenta ficaria depois da configuração que quase ninguém
  // abre.
  { chave: "meses", rotulo: "Meses", Icone: CalendarRange },
  { chave: "fluxos", rotulo: "Fluxos", Icone: Workflow },
];

export function AbasDoSocial({
  atual,
  souGestor,
}: {
  atual: AbaDoSocial;
  souGestor: boolean;
}) {
  return (
    <BarraDeContexto
      rotuloAcessivel="Seções de Social Media"
      titulo="Social Media"
      atual={atual}
      // O RECORTE POR PERFIL MORA AQUI, e é o que a `BarraDeContexto` NÃO
      // centraliza: *"cada módulo continua dizendo quais são as seções dele, e
      // quais o perfil de quem está olhando alcança"*. Uma lista central
      // teria que carregar o "só a gestão" desta aba junto com o `QUEM_VE` das
      // Métricas e o "só o sócio" das Notas.
      secoes={souGestor ? SECOES : SECOES.filter((s) => s.chave !== "fluxos")}
      // OS FILTROS DOS POSTS NÃO ATRAVESSAM PARA FLUXOS, e não é zelo: um
      // `?cliente=` sobrevivendo até a volta filtraria a lista de posts por uma
      // conta que a pessoa escolheu antes de ir montar um fluxo. É a decisão
      // das quatro abas de Gestão de Tasks.
      limparAoSair={(destino) => {
        // OS FILTROS DOS POSTS SÃO LIMPOS AO SAIR PARA AS DUAS OUTRAS, e as
        // razões são diferentes. Em Fluxos eles não filtram nada. Em Meses eles
        // filtram: `?cliente=` é o parâmetro que a árvore usa para estreitar, e
        // chegar nela com a conta que a pessoa escolheu antes de ir procurar um
        // mês mostraria UMA conta onde ela veio ver todas.
        if (destino === "posts") return ["situacao", "contas", "anos"];
        return ["visao", "mes", "cliente", "foco", "post"];
      }}
    />
  );
}
