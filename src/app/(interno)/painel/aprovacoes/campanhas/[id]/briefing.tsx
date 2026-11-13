"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";

import { EditorRico, VisualizadorRico } from "@/components/shared/editor-rico";
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
  FORMATOS_SUGERIDOS,
  ROTULO_DO_TIPO,
  type ComposicaoDaCampanha,
} from "@/lib/dominio/campanhas";

import {
  copiarBriefingDeOutraCampanha,
  salvarBriefingDaCampanha,
} from "../../acoes-de-campanha";

const SEM_COPIA = "__nenhuma__";

/** O briefing da campanha como ele volta do banco. */
export type BriefingGravado = { rico: unknown; texto: string } | null;

/**
 * O BRIEFING NO PAINEL DA CAMPANHA: ler, e editar quem pode.
 *
 * ---------------------------------------------------------------------------
 * **É UMA CAIXA DE TEXTO e não sete campos** (0136), por decisão do usuário —
 * *"Briefing deve ser apenas uma caixa de texto, sem todos os questionamentos
 * que aparecem atualmente quando vou abrir uma campanha"*. E isto **restaura a
 * 0051**, que já tinha escrito a razão: o briefing é da DEMANDA, e uma segunda
 * caixa com o mesmo papel noutra tabela é o lugar onde as duas versões
 * divergem.
 *
 * **O PREÇO DAQUELA SEGUNDA CAIXA APARECIA AQUI:** as OBSERVAÇÕES que a
 * pessoa escrevia na abertura iam para `tasks.briefing_rico`, e esta seção
 * desenhava só as sete colunas de `campaigns` — o briefing digitado não
 * aparecia na tela onde ele seria relido.
 *
 * **É O MESMO `EditorRico` da demanda**, com caixa, tabela e a paleta nomeada:
 * um `<textarea>` aqui seria um segundo editor de briefing no produto, e o que
 * divergiria é este, que se abre menos.
 * ---------------------------------------------------------------------------
 *
 * **A SEÇÃO SOME QUANDO NÃO HÁ BRIEFING E NÃO HÁ QUEM O ESCREVA**, que é a
 * regra dos blocos de exceção do Início. Para quem PODE escrever ela aparece
 * vazia de propósito — ali a ausência é uma falta, e esconder esconderia a
 * falta.
 *
 * **ELA FICA ENTRE A IDENTIDADE E A COMPOSIÇÃO**, e a ordem é a de quem abre
 * a tela para produzir: o que esta campanha é, o que ela precisa dizer, e só
 * então quantas peças.
 *
 * **E ela tem BOTÃO**, ao contrário da tela de task que salva campo a campo
 * (0028): lá o rascunho é de quem o criou; aqui cada salvamento parcial muda
 * o combinado que quem produz vai ler, e um briefing pela metade é pior que o
 * briefing antigo. É a decisão do editor de recorrência.
 */
export function BriefingDoPainel({
  campanhaId,
  briefing: gravado,
  composicao,
  paraCopiar,
  podeEditar,
}: {
  campanhaId: string;
  briefing: BriefingGravado;
  composicao: ComposicaoDaCampanha[];
  paraCopiar: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);

  // O VALOR MORA NUM `ref` E O AVISO NUM ESTADO, que é a forma do briefing da
  // demanda e da sub-etapa: o `onChange` do TipTap dispara a cada tecla, e
  // pô-lo no `useState` re-renderizaria a seção inteira — com a lista de
  // formatos dentro — a cada letra digitada.
  const rascunho = useRef<{ json: JSONContent | null; texto: string }>({
    json: (gravado?.rico as JSONContent | null) ?? null,
    texto: gravado?.texto ?? "",
  });

  // A `key` DO EDITOR, e é ela que faz a cópia aparecer na tela: o TipTap lê
  // o `conteudo` na montagem e não o resincroniza depois — sem remontar, o
  // briefing copiado iria para o `ref` e a caixa continuaria mostrando o
  // texto antigo. É a decisão do editor de post, que se remonta por `key` em
  // vez de ressincronizar por efeito.
  const [versaoDoEditor, setVersaoDoEditor] = useState(0);
  const [conteudo, setConteudo] = useState<JSONContent | null>(
    (gravado?.rico as JSONContent | null) ?? null,
  );

  const [formatos, setFormatos] = useState(() =>
    composicao.map((l) => ({
      tipo: l.tipo,
      formato: l.formato ?? "",
      dimensoes: l.dimensoes ?? "",
    })),
  );
  const [copiarDe, setCopiarDe] = useState(SEM_COPIA);
  const [salvando, salvar] = useTransition();

  // QUEM DECIDE SE HÁ BRIEFING É O TEXTO, e não o documento: um documento do
  // TipTap sem nada dentro ainda é um parágrafo vazio.
  const vazio = (gravado?.texto ?? "").trim() === "";
  if (vazio && !podeEditar) return null;

  function enviar() {
    salvar(async () => {
      const resultado = await chamarAcao(() =>
        salvarBriefingDaCampanha(campanhaId, {
          rico: rascunho.current.json,
          texto: rascunho.current.texto,
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
      // ajusta antes de salvar. Gravar no clique poria o combinado de outra
      // campanha neste sem ninguém ter lido — e "reutilizável" quer dizer
      // partir de, não herdar.
      const vindo = (resultado.dados.rico as JSONContent | null) ?? null;
      rascunho.current = { json: vindo, texto: resultado.dados.texto };
      setConteudo(vindo);
      setVersaoDoEditor((v) => v + 1);
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

          <EditorRico
            key={versaoDoEditor}
            conteudo={conteudo}
            placeholder="O objetivo, o público, a mensagem, o que não pode faltar…"
            onChange={(dados) => {
              rascunho.current = { json: dados.json, texto: dados.texto };
            }}
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
                const original = (gravado?.rico as JSONContent | null) ?? null;
                rascunho.current = { json: original, texto: gravado?.texto ?? "" };
                setConteudo(original);
                setVersaoDoEditor((v) => v + 1);
                setEditando(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : vazio ? (
        <p className="text-text-muted rounded-xl border border-dashed p-4 text-sm">
          Esta campanha ainda não tem briefing. Escreva o que foi combinado —
          é o que quem produz lê antes de desenhar a peça.
        </p>
      ) : (
        <VisualizadorRico
          conteudo={(gravado?.rico as JSONContent | null) ?? null}
        />
      )}

      {/* O FORMATO NÃO É REPETIDO NA LEITURA, e a ausência é decisão: ele
          aparece embaixo do nome de cada tipo na tabela da composição, logo
          abaixo — que é onde o plano por tipo mora. Dois lugares dizendo
          "1080x1350" a dez centímetros de distância é o cartão de "11
          entregues" com sete na lista embaixo, que este produto já pagou uma
          vez.

          **Ele continua sendo EDITADO nesta seção**, e a assimetria é a
          decisão: o briefing se escreve de uma vez, e o formato é parte do que
          foi combinado — tirá-lo do editor obrigaria a pessoa a salvar aqui e
          ir procurar outro lugar para a medida. */}
    </section>
  );
}
