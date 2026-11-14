"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TETO_DE_PECAS,
  type EtapaQueMultiplica,
  type PecasPorEtapa,
} from "@/lib/dominio/workflows";

/**
 * Quantas peças cada etapa entrega NESTA aplicação (migration 0140).
 *
 * ## POR QUE A PERGUNTA EXISTE
 *
 * O pedido inteiro está na segunda metade da frase: *"definir quantas peças
 * vão precisar ser entregues, já que por exemplo, em um mês, podem ter 50
 * produtos e no outro 80 produtos"*. Um número fixo no modelo estaria errado
 * em metade dos meses — e corrigi-lo a cada mês mudaria a cadeia para toda
 * conta que o usa, porque `regravarEtapas()` reescreve o workflow inteiro a
 * cada salvamento.
 *
 * Então o modelo é a SUGESTÃO e esta tela confirma, que é a decisão da 0122
 * palavra por palavra: *o modelo é ponto de partida, não contrato*.
 *
 * ## ELE MORA AO LADO DO CHAMADOR, e não em `components/shared/`
 *
 * Tem um consumidor só — o seletor de workflow do detalhe da demanda, que a
 * página cheia e o painel de Minhas Tasks desenham. **A abertura de campanha
 * NÃO o usa**, e a ausência é decisão: lá a árvore é plantada EDITÁVEL, e o
 * número se ajusta nela — que é a frase da 0122 outra vez. De quebra aquela
 * tela já tem o `EditorDaComposicao` perguntando quantos materiais de cada
 * tipo, e um segundo diálogo de quantidade ao lado dele seriam duas perguntas
 * de número na mesma tela, em duas dimensões diferentes.
 *
 * ## ELE SÓ EXISTE ENQUANTO HÁ O QUE PERGUNTAR
 *
 * O chamador o monta quando o workflow escolhido tem etapa que multiplica
 * (`etapasQueMultiplicam()`) e o desmonta na resposta. **É isso que faz o
 * rascunho nascer na sugestão daquele workflow** em vez de `useEffect`
 * ressincronizando estado — que é o que o `react-hooks/set-state-in-effect`
 * do projeto reprova, e a mesma decisão do editor de post, que se remonta por
 * `key`.
 *
 * Num workflow em que toda etapa entrega uma peça não há escolha a fazer, e um
 * diálogo com a lista vazia seria um passo a mais entre o clique e o resultado
 * — a opção pré-marcada que ninguém lê, em outra forma.
 */
export function DialogoDePecas({
  etapas,
  onFechar,
  onConfirmar,
  rotulo = "Aplicar",
}: {
  etapas: EtapaQueMultiplica[];
  onFechar: () => void;
  onConfirmar: (pecas: PecasPorEtapa) => void;
  rotulo?: string;
}) {
  /**
   * O VALOR É TEXTO, pela razão do campo do editor de workflow: um
   * `<input type="number"` controlado por número não deixa o campo ficar
   * vazio enquanto a pessoa apaga para digitar outro valor — ela apaga o "50"
   * e o React o devolve na mesma tecla.
   */
  const [numeros, setNumeros] = useState<Record<number, string>>(() =>
    Object.fromEntries(etapas.map((etapa) => [etapa.ordem, String(etapa.quantidade)])),
  );

  function confirmar() {
    const pecas: PecasPorEtapa = {};
    for (const etapa of etapas) {
      /* O CAMPO VAZIO É A SUGESTÃO DO MODELO, e nunca zero: o banco recusa
         zero, e quem apagou o campo para digitar outro número não está
         dizendo "nenhuma peça". */
      const escrito = Number(numeros[etapa.ordem]);
      pecas[etapa.ordem] = Number.isFinite(escrito) && escrito >= 1 ? escrito : etapa.quantidade;
    }
    onConfirmar(pecas);
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quantas peças neste mês?</DialogTitle>
          <DialogDescription>
            Este workflow tem {etapas.length === 1 ? "uma etapa" : `${etapas.length} etapas`} que
            entregam mais de uma peça. O número do workflow é a sugestão — confirme o deste mês, e
            cada peça nasce como uma sub-etapa.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {etapas.map((etapa) => (
            <li key={etapa.ordem} className="flex items-center justify-between gap-3">
              <Label
                htmlFor={`pecas-de-${etapa.ordem}`}
                className="min-w-0 flex-1 text-sm font-normal"
              >
                {/* O NOME NÃO ENCOLHE ATÉ SUMIR: ele é a única coisa que
                    distingue uma linha da outra, e é a última que pode ceder
                    largura — a lição que esta casa já pagou três vezes. */}
                <span className="block truncate">{etapa.nome}</span>
              </Label>
              <Input
                id={`pecas-de-${etapa.ordem}`}
                type="number"
                min={1}
                max={TETO_DE_PECAS}
                className="w-24 shrink-0"
                value={numeros[etapa.ordem] ?? String(etapa.quantidade)}
                onChange={(e) =>
                  setNumeros((atual) => ({ ...atual, [etapa.ordem]: e.target.value }))
                }
              />
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>{rotulo}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
