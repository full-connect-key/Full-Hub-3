"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
import {
  FORMATOS_SUGERIDOS,
  ROTULO_DO_TIPO,
  TIPOS_DE_MATERIAL,
  type LinhaDaComposicao,
} from "@/lib/dominio/campanhas";
import type { DeliverableTipo } from "@/lib/supabase/database.types";

/**
 * QUANTOS MATERIAIS DE CADA TIPO — a seção, nas duas telas que a pedem.
 *
 * ---------------------------------------------------------------------------
 * **ELE É COMPARTILHADO PORQUE SÃO DUAS, e as duas concordam.**
 *
 * A abertura de campanha do Atendimento (0122) e o pedido de campanha do
 * cliente (0138) editam a MESMA coisa: uma linha por tipo, com quantidade,
 * formato e medida. Uma segunda cópia ficaria com o tipo já escolhido ainda na
 * lista dos outros, ou com o `datalist` de formatos só num lado — e a que
 * divergiria é a do cliente, que se abre menos.
 *
 * É o critério do `SeletorDeVisao` e não o do `EmptyState`: aquele mudou por
 * ser de dois donos que queriam a mesma coisa; este não foi tocado porque a
 * moldura tracejada estava certa em trinta e oito dos quarenta.
 *
 * **O QUE ELE CENTRALIZA É A EDIÇÃO, NUNCA O QUE SE FAZ COM ELA**, que é a
 * decisão de `SeletorDeResponsavel` palavra por palavra: lá a abertura do mês
 * salva no clique e o modal escreve num rascunho; aqui o Atendimento MONTA A
 * ÁRVORE com a lista — e o cliente não monta nada, porque a árvore é a
 * distribuição de trabalho da agência. Quem passa o `rodape` é quem tem o que
 * fazer com a lista.
 *
 * **E ele é dono do `SecaoDoFormulario`**, ao contrário de quase tudo em
 * `shared/`: as duas telas são formulários numerados, e o botão de acrescentar
 * tipo mora no `acao` do cabeçalho da seção — deixá-lo de fora faria cada
 * chamador montar o próprio, que é a cópia de volta com outro nome. O `numero`
 * e a `explicacao` vêm de fora porque são da tela: a posição da seção e a
 * frase que diz o que a lista FAZ ali.
 * ---------------------------------------------------------------------------
 */
export function EditorDaComposicao({
  numero,
  valor,
  onChange,
  explicacao,
  rodape,
}: {
  numero: number;
  valor: LinhaDaComposicao[];
  onChange: (valor: LinhaDaComposicao[]) => void;
  /** O que a lista faz nesta tela — monta a árvore, ou vira o pedido. */
  explicacao: string;
  /** A ação de quem tem o que fazer com a lista. O cliente não tem. */
  rodape?: React.ReactNode;
}) {
  function trocar(i: number, campos: Partial<LinhaDaComposicao>) {
    onChange(valor.map((l, j) => (j === i ? { ...l, ...campos } : l)));
  }

  return (
    <SecaoDoFormulario
      numero={numero}
      titulo="Quantos materiais de cada tipo"
      acao={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const livre = TIPOS_DE_MATERIAL.find(
              (t) => !valor.some((l) => l.tipo === t),
            );
            if (!livre) return;
            onChange([
              ...valor,
              { tipo: livre, quantidade: 1, formato: "", dimensoes: "" },
            ]);
          }}
          disabled={valor.length >= TIPOS_DE_MATERIAL.length}
        >
          <Plus aria-hidden className="size-4" />
          Tipo
        </Button>
      }
    >
      <p className="text-text-muted text-sm">{explicacao}</p>

      {valor.length === 0 ? (
        <p className="text-text-muted rounded-xl border border-dashed p-4 text-sm">
          Nenhum tipo ainda. Acrescente um acima.
        </p>
      ) : (
        <ul className="space-y-2">
          {valor.map((linha, i) => (
            <li
              key={linha.tipo}
              className="bg-surface-card flex flex-wrap items-center gap-2 rounded-xl border p-2"
            >
              <Select
                value={linha.tipo}
                onValueChange={(v) => trocar(i, { tipo: v as DeliverableTipo })}
              >
                <SelectTrigger
                  aria-label={`Tipo do material ${i + 1}`}
                  className="w-48"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DE_MATERIAL.map((t) => (
                    <SelectItem
                      key={t}
                      value={t}
                      // O TIPO JÁ ESCOLHIDO SAI DA LISTA dos outros, porque a
                      // composição é por tipo: duas linhas de "estático"
                      // seriam dois planos para o mesmo material, e o
                      // `primary key (campaign_id, tipo)` do banco guarda só
                      // o último.
                      disabled={
                        t !== linha.tipo && valor.some((l) => l.tipo === t)
                      }
                    >
                      {ROTULO_DO_TIPO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min={0}
                max={200}
                value={linha.quantidade}
                onChange={(e) =>
                  trocar(i, {
                    // ZERO É ACEITO, que é o pedido em quantas palavras. Ele
                    // quer dizer "este tipo não entra", e nenhum dos dois
                    // chamadores o leva adiante — `arvoreDaComposicao()`
                    // filtra, e o pedido do cliente descarta antes de gravar.
                    quantidade: Math.max(
                      0,
                      Math.min(200, Number(e.target.value) || 0),
                    ),
                  })
                }
                aria-label={`Quantidade de ${ROTULO_DO_TIPO[linha.tipo]}`}
                className="w-24"
              />

              <span className="text-text-muted text-sm">
                {linha.quantidade === 0
                  ? "não entra"
                  : linha.quantidade === 1
                    ? "uma peça"
                    : `${linha.quantidade} peças`}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="ms-auto"
                onClick={() => onChange(valor.filter((_, j) => j !== i))}
                aria-label={`Remover ${ROTULO_DO_TIPO[linha.tipo]}`}
              >
                <X aria-hidden className="size-4" />
              </Button>

              {/* O FORMATO E A MEDIDA SÃO DO TIPO (0125), e é por isso que
                  moram nesta linha: "dez estáticos em 1080x1350" é uma linha,
                  não dez.

                  Eles vêm na SEGUNDA linha e não ao lado da quantidade porque
                  em 375px os cinco controles juntos não cabem — e o que
                  cederia largura seria justamente o campo de texto. */}
              <div className="flex w-full flex-wrap gap-2">
                <Input
                  list={`formatos-${linha.tipo}`}
                  value={linha.formato}
                  onChange={(e) => trocar(i, { formato: e.target.value })}
                  placeholder="Formato (feed, story, A5…)"
                  aria-label={`Formato de ${ROTULO_DO_TIPO[linha.tipo]}`}
                  className="min-w-40 flex-1"
                />
                {/* `datalist` e não `Select`: a lista é SUGESTÃO e o campo
                    aceita qualquer coisa — o vocabulário de formato muda a
                    cada temporada de produto das plataformas (0032). */}
                <datalist id={`formatos-${linha.tipo}`}>
                  {FORMATOS_SUGERIDOS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>

                <Input
                  value={linha.dimensoes}
                  onChange={(e) => trocar(i, { dimensoes: e.target.value })}
                  placeholder="Medida (1080x1350, A4, 9:16…)"
                  aria-label={`Medida de ${ROTULO_DO_TIPO[linha.tipo]}`}
                  className="min-w-40 flex-1"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {valor.length > 0 ? rodape : null}
    </SecaoDoFormulario>
  );
}

/** A soma das quantidades — a frase do rodapé, nos dois chamadores. */
export function totalDaComposicao(valor: LinhaDaComposicao[]): number {
  return valor.reduce((soma, l) => soma + l.quantidade, 0);
}
