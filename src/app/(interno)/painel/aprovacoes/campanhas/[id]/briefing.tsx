"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";

import { BriefingDaCampanhaCampos } from "@/components/shared/briefing-da-campanha";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  briefingEstaVazio,
  CAMPOS_DO_BRIEFING,
  FORMATOS_SUGERIDOS,
  ROTULO_DO_TIPO,
  type BriefingDaCampanha,
  type ComposicaoDaCampanha,
} from "@/lib/dominio/campanhas";

import {
  copiarBriefingDeOutraCampanha,
  salvarBriefingDaCampanha,
} from "../../acoes-de-campanha";

const SEM_COPIA = "__nenhuma__";

/**
 * O BRIEFING NO PAINEL DA CAMPANHA (0125): ler, e editar quem pode.
 *
 * **A SEÇÃO SOME QUANDO NÃO HÁ BRIEFING E NÃO HÁ QUEM O ESCREVA**, que é a
 * regra dos blocos de exceção do Início: a campanha anterior à 0125 não tem
 * nenhum dos sete campos, e sete rótulos com um travessão embaixo ocupariam a
 * tela toda para informar em nenhuma. Para quem PODE escrever ela aparece
 * vazia de propósito — ali a ausência é uma falta, e esconder esconderia a
 * falta.
 *
 * **ELA FICA ENTRE A IDENTIDADE E A COMPOSIÇÃO**, e a ordem é a de quem abre
 * a tela para produzir: o que esta campanha é, o que ela precisa dizer, e só
 * então quantas peças. Depois da árvore o briefing seria lido por último, por
 * quem já escolheu o que fazer.
 *
 * **E ela tem BOTÃO**, ao contrário da tela de task que salva campo a campo
 * (0028): lá o rascunho é de quem o criou; aqui cada salvamento parcial muda
 * o combinado que quem produz vai ler, e um objetivo pela metade é pior que o
 * objetivo antigo. É a decisão do editor de recorrência.
 */
export function BriefingDoPainel({
  campanhaId,
  briefing: gravado,
  composicao,
  paraCopiar,
  podeEditar,
}: {
  campanhaId: string;
  briefing: BriefingDaCampanha;
  composicao: ComposicaoDaCampanha[];
  paraCopiar: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(gravado);
  const [formatos, setFormatos] = useState(() =>
    composicao.map((l) => ({
      tipo: l.tipo,
      formato: l.formato ?? "",
      dimensoes: l.dimensoes ?? "",
    })),
  );
  const [copiarDe, setCopiarDe] = useState(SEM_COPIA);
  const [salvando, salvar] = useTransition();

  const vazio = briefingEstaVazio(gravado);
  if (vazio && !podeEditar) return null;

  function enviar() {
    salvar(async () => {
      const resultado = await chamarAcao(() =>
        salvarBriefingDaCampanha(campanhaId, {
          ...rascunho,
          composicao: formatos,
        }),
      );

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(resultado.mensagem);
      setEditando(false);
      router.refresh();
    });
  }

  function copiar() {
    if (copiarDe === SEM_COPIA) return;

    salvar(async () => {
      const resultado = await chamarAcao(() =>
        copiarBriefingDeOutraCampanha(copiarDe),
      );

      if (!resultado.ok || !resultado.dados) {
        toast.error(resultado.ok ? "Não veio nada." : resultado.error);
        return;
      }

      // O QUE ELE COPIA CAI NO RASCUNHO e não no banco: a pessoa confere e
      // ajusta antes de salvar. Gravar no clique poria o público de outra
      // campanha no combinado desta sem ninguém ter lido — e "reutilizável"
      // quer dizer partir de, não herdar.
      setRascunho(resultado.dados);
      setCopiarDe(SEM_COPIA);
      toast.success("Briefing copiado. Confira e salve.");
    });
  }

  return (
    <section
      aria-labelledby="titulo-do-briefing"
      className="bg-surface-card shadow-cartao rounded-card space-y-4 border p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-do-briefing" className="text-lg font-semibold">
            O briefing
          </h2>
          <p className="text-text-muted text-sm">
            O que foi combinado com o cliente. Quem produz lê aqui.
          </p>
        </div>

        {podeEditar && !editando ? (
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            <Pencil aria-hidden className="size-4" />
            {vazio ? "Escrever" : "Editar"}
          </Button>
        ) : null}
      </div>

      {editando ? (
        <div className="space-y-5">
          {/* O "REUTILIZÁVEL" DO PEDIDO é copiar de uma campanha de verdade
              desta conta, e não um modelo guardado: um modelo seria uma
              terceira tabela de template ao lado de `campaign_templates` e de
              `workflow_templates`, para guardar o que a campanha anterior já
              tem escrito — e alguém teria de mantê-lo em dia. */}
          {paraCopiar.length > 0 ? (
            <div className="bg-muted flex flex-wrap items-end gap-2 rounded-xl p-3">
              <div className="min-w-56 flex-1 space-y-1.5">
                <Label htmlFor="copiar-briefing">
                  Partir do briefing de outra campanha
                </Label>
                <Select value={copiarDe} onValueChange={setCopiarDe}>
                  <SelectTrigger
                    id="copiar-briefing"
                    aria-label="Campanha de onde copiar o briefing"
                  >
                    <SelectValue placeholder="Escolha uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_COPIA}>Nenhuma</SelectItem>
                    {paraCopiar.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={copiar}
                disabled={copiarDe === SEM_COPIA || salvando}
              >
                <Copy aria-hidden className="size-4" />
                Copiar
              </Button>
            </div>
          ) : null}

          <BriefingDaCampanhaCampos
            briefing={rascunho}
            onChange={setRascunho}
            desabilitado={salvando}
          />

          {formatos.length > 0 ? (
            <div className="space-y-2 border-t pt-5">
              <h3 className="text-sm font-medium">
                O formato e a medida de cada material
              </h3>
              <ul className="space-y-2">
                {formatos.map((linha, i) => (
                  <li
                    key={linha.tipo}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="w-32 shrink-0 text-sm">
                      {ROTULO_DO_TIPO[linha.tipo]}
                    </span>
                    <Input
                      list={`fmt-${linha.tipo}`}
                      value={linha.formato}
                      disabled={salvando}
                      onChange={(e) =>
                        setFormatos((atual) =>
                          atual.map((l, j) =>
                            j === i ? { ...l, formato: e.target.value } : l,
                          ),
                        )
                      }
                      placeholder="Formato"
                      aria-label={`Formato de ${ROTULO_DO_TIPO[linha.tipo]}`}
                      className="min-w-36 flex-1"
                    />
                    <datalist id={`fmt-${linha.tipo}`}>
                      {FORMATOS_SUGERIDOS.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                    <Input
                      value={linha.dimensoes}
                      disabled={salvando}
                      onChange={(e) =>
                        setFormatos((atual) =>
                          atual.map((l, j) =>
                            j === i ? { ...l, dimensoes: e.target.value } : l,
                          ),
                        )
                      }
                      placeholder="Medida"
                      aria-label={`Medida de ${ROTULO_DO_TIPO[linha.tipo]}`}
                      className="min-w-36 flex-1"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={enviar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar o briefing"}
            </Button>
            <Button
              variant="ghost"
              disabled={salvando}
              onClick={() => {
                setRascunho(gravado);
                setEditando(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <BriefingLido briefing={gravado} vazio={vazio} />
      )}
    </section>
  );
}

/**
 * O briefing para LER, e **só o que tem valor aparece**.
 *
 * É a regra da ficha técnica do equipamento (0070): "Restrições —" numa
 * campanha sem restrição ocupa uma linha para dizer que não há o que dizer.
 * No formulário é o contrário, porque lá o campo vazio é onde se escreve.
 */
function BriefingLido({
  briefing,
  vazio,
}: {
  briefing: BriefingDaCampanha;
  vazio: boolean;
}) {
  if (vazio) {
    return (
      <p className="text-text-muted rounded-xl border border-dashed p-4 text-sm">
        Esta campanha ainda não tem briefing. Escreva o objetivo, o público e a
        mensagem — é o que quem produz lê antes de desenhar a peça.
      </p>
    );
  }

  return (
    <dl className="space-y-4">
      {CAMPOS_DO_BRIEFING.filter((campo) =>
        (briefing[campo.chave] as string)?.trim(),
      ).map((campo) => (
        <div key={campo.chave}>
          <dt className="text-text-secondary text-xs font-medium uppercase">
            {campo.rotulo}
          </dt>
          {/* `whitespace-pre-line` porque o campo é um `<textarea>`: sem ele
              um briefing de três parágrafos sai como um bloco corrido, e a
              quebra que a pessoa digitou desaparece. */}
          <dd className="mt-0.5 text-sm whitespace-pre-line">
            {briefing[campo.chave] as string}
          </dd>
        </div>
      ))}

      {briefing.canais.length > 0 ? (
        <div>
          <dt className="text-text-secondary text-xs font-medium uppercase">
            Canais
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {briefing.canais.map((canal) => (
              <Badge key={canal} variant="secondary">
                {canal}
              </Badge>
            ))}
          </dd>
        </div>
      ) : null}

      {/* O FORMATO NÃO É REPETIDO AQUI, e a ausência é decisão: ele aparece
          embaixo do nome de cada tipo na tabela da composição, logo abaixo —
          que é onde o plano por tipo mora. Dois lugares dizendo "1080x1350" a
          dez centímetros de distância é o cartão de "11 entregues" com sete na
          lista embaixo, que este produto já pagou uma vez.

          **Ele continua sendo EDITADO nesta seção**, e a assimetria é a
          decisão: o briefing se escreve de uma vez, e o formato é parte do que
          foi combinado — tirá-lo do editor obrigaria a pessoa a salvar aqui e
          ir procurar outro lugar para a medida. */}
    </dl>
  );
}
