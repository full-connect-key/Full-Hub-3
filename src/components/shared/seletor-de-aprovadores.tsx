"use client";

import { Check } from "lucide-react";

import type { AprovadorDaConta } from "@/app/(interno)/painel/_actions/aprovadores";
import { cn } from "@/lib/utils";

/**
 * QUEM VAI APROVAR O MATERIAL — uma pessoa ou várias, em chips (0129).
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário, item 15: *"vários responsáveis"*. A 0128 nomeou UMA
 * pessoa no envio; esta passa a aceitar N.
 *
 * **É CHIP E NÃO `<select multiple>`**, pela razão escrita de
 * `SeletorDeRedes`: o multi-select nativo abre uma lista em que marcar o
 * segundo item desmarca o primeiro em metade dos navegadores de celular — e o
 * celular é o caminho principal deste produto. E não é um `<Select>` do Radix
 * porque aquele escolhe UM valor, que é exatamente o que deixou de bastar.
 *
 * **É COMPARTILHADO PORQUE SÃO CINCO TELAS, e a quinta já era uma cópia.**
 * `EnvioAoCliente` serve quatro — a etapa de demanda, o post avulso, a peça de
 * campanha e a fila de aprovações internas — e `envio-do-mes.tsx` tem o
 * seletor dele escrito à parte desde a 0128, porque aquele painel carrega
 * também a lista do que falta para o mês sair. Com o seletor virando múltiplo,
 * uma cópia que ficasse simples largaria as pessoas a mais em silêncio: é a
 * camada deixada para trás que a 0088 pagou, e que a 0090 encontrou filtrando
 * fora as linhas que ela acabara de criar.
 *
 * **A ORDEM DA LISTA É A ORDEM EM QUE A PESSOA CLICOU**, e não a alfabética
 * dos chips: a PRIMEIRA escolhida é quem vai para `approval_rounds.
 * aprovador_id`, que é a coluna que o produto inteiro lê como "quem recebeu"
 * desde a 0128. Reordenar aqui faria a coluna apontar para outra pessoa que a
 * que a tela mostra em primeiro lugar — e `definir_aprovadores_da_rodada()`
 * dedupe preservando esta ordem justamente para isso.
 *
 * **UMA PESSOA SÓ JÁ VEM MARCADA**, e quem faz isso é o chamador: com uma
 * pessoa na conta não há escolha a fazer, e é o estado da única conta deste
 * banco que tem portal. Com duas ou mais, nada vem marcado — a opção
 * pré-marcada é a que ninguém lê.
 * ---------------------------------------------------------------------------
 */
export function SeletorDeAprovadores({
  pessoas,
  valor,
  aoMudar,
  desabilitado,
  id,
  rotulo = "Quem vai aprovar",
}: {
  pessoas: AprovadorDaConta[];
  /** Os ids escolhidos, NA ORDEM em que foram escolhidos. */
  valor: string[];
  aoMudar: (ids: string[]) => void;
  desabilitado?: boolean;
  id?: string;
  rotulo?: string;
}) {
  function alternar(pessoaId: string) {
    aoMudar(
      valor.includes(pessoaId)
        ? valor.filter((x) => x !== pessoaId)
        : [...valor, pessoaId],
    );
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={rotulo}
      className="flex flex-wrap items-center gap-1.5"
    >
      {pessoas.map((pessoa) => {
        const marcada = valor.includes(pessoa.id);
        return (
          <button
            key={pessoa.id}
            type="button"
            disabled={desabilitado}
            onClick={() => alternar(pessoa.id)}
            aria-pressed={marcada}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:opacity-50",
              // O HOVER DO CHIP SOLTO NÃO É `bg-accent`, e a razão é que ele é
              // o chão do chip MARCADO: com os dois iguais, passar o mouse num
              // chip desmarcado o faz parecer escolhido — a cor dizendo duas
              // coisas, que é o que o `DropdownMenuItem` verde da 0127 recusou.
              marcada
                ? "border-accent-strong bg-accent text-accent-foreground font-medium"
                : "hover:bg-muted",
            )}
          >
            {/* O ÍCONE É O SEGUNDO SINAL, e não o único: `aria-pressed` diz o
                estado a quem usa leitor de tela, o par de cor diz a quem vê, e
                o visto diz a quem não separa os dois tons — a regra do chip do
                calendário, onde a cor nunca é o único sinal. */}
            {marcada ? <Check aria-hidden="true" className="size-3.5" /> : null}
            {pessoa.nome}
          </button>
        );
      })}
    </div>
  );
}
