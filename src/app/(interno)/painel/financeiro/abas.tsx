"use client";

import { Inbox, Receipt } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

import { ABAS, type Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { rotulo: string; Icone: typeof Inbox }> = {
  // "NOTAS RECEBIDAS" e não "A conferir": a seção carrega as quatro colunas do
  // ciclo inteiro — o que espera leitura, o que espera transferência, o que
  // espera uma nota nova e o que já saiu —, e "a conferir" nomeia só a
  // primeira. O selo ao lado é que cobra a primeira.
  notas: { rotulo: "Notas recebidas", Icone: Inbox },
  // "SOFTWARES" É O NOME DA ABA, e ela guarda TODO gasto da agência — decisão
  // do usuário, com a pergunta feita e respondida: *"Todos os gastos, e
  // 'Softwares' é só o nome da aba"*. É o nome que a casa usa porque a
  // assinatura é o gasto que mais aparece ali, e a tela não estreita por causa
  // do rótulo: o seletor de categoria continua trazendo as que existem.
  softwares: { rotulo: "Softwares", Icone: Receipt },
};

/** Os filtros de cada seção, e o que não significa nada na outra. */
const DOS_GASTOS = ["cliente", "categoria", "situacao"];
const DAS_NOTAS = ["pessoa"];

/**
 * As seções do Financeiro, na URL.
 *
 * Trocar de seção troca a página no servidor, e é por isso que cada uma carrega
 * só a própria consulta: quem abriu para pagar a nota de alguém não paga pela
 * lista de gastos do mês.
 *
 * **`mes` SOBREVIVE À TROCA, e é o único que sobrevive.** As duas seções o
 * usam, e querem dizer a mesma coisa com ele — a competência. Limpá-lo faria
 * quem está conferindo setembro voltar para o mês corrente ao trocar de aba,
 * no meio do fechamento. Os outros vão: `categoria=…` numa URL de notas não
 * significa nada e só atrapalharia quem lê o endereço.
 */
export function AbasDoFinanceiro({
  atual,
  aConferir,
  acoes,
}: {
  atual: Aba;
  /** Quantas notas esperam leitura. Zero não vira selo: só o que pede ação aparece. */
  aConferir: number;
  acoes?: React.ReactNode;
}) {
  const secoes: SecaoDoModulo<Aba>[] = ABAS.map((aba) => ({
    chave: aba,
    ...ROTULOS[aba],
    ...(aba === "notas"
      ? { contagem: aConferir, rotuloDaContagem: `${aConferir} nota(s) esperando conferência` }
      : {}),
  }));

  return (
    <BarraDeContexto
      rotuloAcessivel="Seções do Financeiro"
      titulo="Financeiro"
      atual={atual}
      secoes={secoes}
      acoes={acoes}
      limparAoSair={(destino) => [
        ...(destino === "softwares" ? [] : DOS_GASTOS),
        ...(destino === "notas" ? [] : DAS_NOTAS),
      ]}
    />
  );
}
