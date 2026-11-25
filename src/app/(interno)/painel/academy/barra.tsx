"use client";

import { BookOpen, ClipboardList } from "lucide-react";

import { BarraDeContexto } from "@/components/shared/barra-de-contexto";

/**
 * As duas seções do Full Academy.
 *
 * **SÓ A GESTÃO VÊ A SEGUNDA**, e para quem não é gestão não há barra nenhuma:
 * menos de duas seções não vira barra, que é a regra que os Comodatos e as
 * Notas Fiscais já aplicavam. O `titulo` continua vindo daqui nos dois casos,
 * porque o `<h1>` é da barra desde que o `PageHeader` saiu das sete telas —
 * uma tela sem `h1` é uma tela sem nome para quem navega por cabeçalho.
 *
 * **E `?aba=gestao` digitado por quem não é gestão cai no acervo**, em vez de
 * levar 403: ver o acervo é do trabalho dela; o que ela não tem é a tabela de
 * quem deve o quê — e quem recusa isso é `academy_acompanhamento()`, no banco.
 */
export function BarraDaAcademy({
  atual,
  gestor,
}: {
  atual: "acervo" | "gestao";
  gestor: boolean;
}) {
  return (
    <BarraDeContexto
      rotuloAcessivel="Seções do Acervo"
      titulo="Acervo"
      atual={atual}
      secoes={
        gestor
          ? [
              { chave: "acervo" as const, rotulo: "Biblioteca", Icone: BookOpen },
              { chave: "gestao" as const, rotulo: "Acompanhamento", Icone: ClipboardList },
            ]
          : [{ chave: "acervo" as const, rotulo: "Biblioteca", Icone: BookOpen }]
      }
      // OS QUATRO RECORTES SÃO DO ACERVO: levados para o acompanhamento eles
      // não filtram nada e ficam na URL mentindo que filtram. É o
      // `?status=entregue` que sobrevivia à troca de aba em Gestão de Tasks.
      //
      // E eram DOIS nesta lista, com `categoria` vazando desde que ela nasceu —
      // o chip de categoria era um grupo próprio na fileira antiga e ninguém o
      // acrescentou aqui. Quatro dimensões e quatro nomes: a lista completa é o
      // que impede a quinta de nascer esquecida.
      limparAoSair={(destino) =>
        destino === "gestao" ? ["q", "filtro", "formato", "categoria"] : []
      }
    />
  );
}
