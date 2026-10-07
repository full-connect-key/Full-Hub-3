"use client";

import { CalendarRange, Workflow } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

export type AbaDoSocial = "social" | "fluxos";

/**
 * As DUAS seções de Social Media.
 *
 * ---------------------------------------------------------------------------
 * **A ABA POSTS SAIU, e "Meses" virou "Social"** — decisão do usuário: *"a aba
 * Posts pode deletar, quero que a visualização seja apenas por contas e
 * separada por meses, (…) quero que mude de meses para Social"*. Elas chegaram
 * a ser três.
 *
 * **"Social" e não "Meses" porque a seção deixou de ser uma navegação e passou
 * a ser O MÓDULO**: é por ela que se chega a tudo — a conta, o mês, e os posts
 * dentro dele. Um rótulo que nomeia o nível de cima da árvore descreveria o
 * índice, e o índice é só a primeira tela dela.
 * ---------------------------------------------------------------------------
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
  { chave: "social", rotulo: "Social", Icone: CalendarRange },
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
      // SAIR PARA FLUXOS LIMPA TUDO O QUE É DO SOCIAL, e não é zelo: um
      // `?cliente=` sobrevivendo até a volta traria a pessoa de Fluxos direto
      // para dentro de uma conta, em vez do índice que ela veio ver. É a
      // decisão das quatro abas de Gestão de Tasks.
      //
      // **E voltar para Social limpa `?mes=` também**, que é o que faz o
      // clique na própria seção ser o caminho de volta ao índice: sem isso,
      // quem está num mês aberto clicaria em "Social" e continuaria nele.
      limparAoSair={() => [
        "visao",
        "mes",
        "cliente",
        "foco",
        "post",
        "situacao",
        "contas",
        "anos",
      ]}
    />
  );
}
