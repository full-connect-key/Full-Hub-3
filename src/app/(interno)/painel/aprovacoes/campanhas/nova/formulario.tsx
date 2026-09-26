"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { EditorRico } from "@/components/shared/editor-rico";
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
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
  entregaveisDoTemplate,
  ROTULO_DA_CAMPANHA,
} from "@/lib/dominio/campanhas";
import type { CampaignStatus } from "@/lib/supabase/database.types";
import type { JSONContent } from "@tiptap/react";
import type { TemplateDeCampanha } from "@/lib/dados/campanhas";

import { criarCampanha } from "../../acoes-de-campanha";

/**
 * Abrir uma campanha, na versão que dá para usar.
 *
 * **O modelo é ponto de partida, não contrato.** Escolhê-lo expande a árvore
 * aqui, na tela, e a partir daí o Atendimento acrescenta, remove e datilografa
 * prazos. É por isso que o que viaja para a action é a ÁRVORE, e não o id do
 * modelo: se a action reexpandisse o modelo, tudo isso seria desfeito no
 * clique de salvar — a pessoa veria uma árvore e gravaria outra.
 *
 * **Três seções numeradas**, como o pedido do Full Days: cada uma responde uma
 * pergunta, e a terceira só faz sentido depois das duas primeiras.
 *
 * O estado da árvore é `useState` e não react-hook-form, como em Workflows:
 * rhf resolve campo plano com validação por campo, e aqui o objeto é uma
 * árvore de dois níveis que se reordena inteira. O mesmo esquema zod valida
 * do outro lado, na action — que é onde a validação conta.
 */

const SEM_MODELO = "__vazio__";

/**
 * Cada entregável carrega RESPONSÁVEL e PRAZO, porque cada um vira uma ETAPA
 * da Task da campanha (decisão do usuário). Sem responsável, a etapa nasce
 * órfã: ela existe no board da agência e não aparece no "Minhas Tasks" de
 * ninguém — é o pior tipo de trabalho, o que ninguém sabe que nasceu, e a
 * recorrência já tinha aprendido isso com o responsável padrão.
 */
type ItemEmEdicao = {
  chave: string;
  nome: string;
  prazo: string;
  responsavelId: string;
};
type NoEmEdicao = ItemEmEdicao & { filhos: ItemEmEdicao[] };

const SEM_DONO = "__sem_dono__";

function chave() {
  return Math.random().toString(36).slice(2);
}

function item(nome = ""): ItemEmEdicao {
  return { chave: chave(), nome, prazo: "", responsavelId: SEM_DONO };
}

export function FormularioDeCampanha({
  clientes,
  templates,
  pessoas,
}: {
  clientes: { id: string; nome: string }[];
  templates: TemplateDeCampanha[];
  pessoas: { id: string; nome: string; funcao: string | null }[];
}) {
  const router = useRouter();
  const [salvando, salvar] = useTransition();

  const [clienteId, setClienteId] = useState("");
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [templateId, setTemplateId] = useState(SEM_MODELO);
  // ATIVA por padrão, e não "planejamento" como o banco.
  //
  // Quem abre uma campanha está abrindo uma campanha que vai acontecer. Com
  // o default do banco ela nascia em planejamento e sumia das duas telas que
  // filtram por ativa — existia sem aparecer.
  const [status, setStatus] = useState<CampaignStatus>("ativa");
  // A PASTA DE ENTREGA é da Task, e é obrigatória lá desde a 0015
  // (`tasks_exige_pasta_de_entrega`). Como a campanha passa a nascer com uma
  // Task, o campo precisa estar aqui: sem ele o banco recusa a demanda e a
  // campanha nasceria sem o trabalho dela.
  const [linkEntrega, setLinkEntrega] = useState("");
  const [briefing, setBriefing] = useState<JSONContent | null>(null);
  const [arvore, setArvore] = useState<NoEmEdicao[]>([]);

  /**
   * Trocar de modelo REESCREVE a árvore, e a tela avisa antes.
   *
   * Preservar o que já foi editado ao trocar daria uma árvore que não é nem a
   * de um modelo nem a do outro, e ninguém conseguiria explicar de onde ela
   * veio. Perguntar é honesto; o trabalho perdido é o de quem trocou de ideia.
   */
  function escolherModelo(id: string) {
    const temTrabalho = arvore.length > 0;
    if (
      temTrabalho &&
      !window.confirm(
        "Trocar de modelo refaz a lista de entregáveis. O que você já ajustou aqui se perde. Trocar mesmo assim?",
      )
    ) {
      return;
    }

    setTemplateId(id);

    if (id === SEM_MODELO) {
      setArvore([]);
      return;
    }

    const modelo = templates.find((t) => t.id === id);
    if (!modelo) return;

    setArvore(
      entregaveisDoTemplate(modelo.estrutura).map((no) => ({
        ...item(no.nome),
        filhos: no.filhos.map((filho) => item(filho)),
      })),
    );
  }

  function mudarNo(chaveDoNo: string, mudanca: Partial<ItemEmEdicao>) {
    setArvore((atual) =>
      atual.map((no) => (no.chave === chaveDoNo ? { ...no, ...mudanca } : no)),
    );
  }

  function mudarFilho(
    chaveDoNo: string,
    chaveDoFilho: string,
    mudanca: Partial<ItemEmEdicao>,
  ) {
    setArvore((atual) =>
      atual.map((no) =>
        no.chave !== chaveDoNo
          ? no
          : {
              ...no,
              filhos: no.filhos.map((f) =>
                f.chave === chaveDoFilho ? { ...f, ...mudanca } : f,
              ),
            },
      ),
    );
  }

  function enviar() {
    salvar(async () => {
      const resultado = await chamarAcao(() =>
        criarCampanha({
          clienteId,
          nome,
          dataInicio,
          dataFim,
          status,
          linkEntrega,
          briefing,
          templateId: templateId === SEM_MODELO ? null : templateId,
          estrutura: arvore
            // Linha em branco não vira entregável: quem clicou em "adicionar"
            // e desistiu não deve ganhar um material sem nome na campanha.
            .filter((no) => no.nome.trim().length > 0)
            .map((no) => ({
              nome: no.nome,
              prazo: no.prazo || null,
              responsavelId: no.responsavelId === SEM_DONO ? null : no.responsavelId,
              filhos: no.filhos
                .filter((f) => f.nome.trim().length > 0)
                .map((f) => ({
                  nome: f.nome,
                  prazo: f.prazo || null,
                  responsavelId:
                    f.responsavelId === SEM_DONO ? null : f.responsavelId,
                })),
            })),
        }),
      );

      if (resultado.ok) {
        toast.success(resultado.mensagem ?? "Campanha criada.");
        router.push("/painel/aprovacoes");
        router.refresh();
      }
    });
  }

  const modelo = templates.find((t) => t.id === templateId);

  return (
    <div className="space-y-8">
      <SecaoDoFormulario numero={1} titulo="De quem é, e como se chama">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cliente">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger aria-label="Cliente" id="cliente" className="w-full">
                <SelectValue placeholder="Escolha o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da campanha</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Wave Outubro Rosa"
            />
          </div>
        </div>
      </SecaoDoFormulario>

      <SecaoDoFormulario
        numero={2}
        titulo="Quando acontece, e onde o material vai ficar"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inicio">Início</Label>
            <Input
              id="inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fim">Encerramento</Label>
            <Input
              id="fim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as CampaignStatus)}
            >
              <SelectTrigger aria-label="Estado" id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* `cancelada` fica de fora: ninguém abre uma campanha
                    cancelada, e oferecer o valor aqui seria oferecer um
                    caminho que só serve para errar. */}
                {(["ativa", "planejamento", "finalizada"] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {ROTULO_DA_CAMPANHA[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-text-muted text-sm">
              {status === "ativa"
                ? "O cliente vê a campanha na tela inicial dele assim que ela existir."
                : "Fora de “Ativa”, ela fica no filtro correspondente do portal — o cliente precisa trocar o filtro para vê-la."}
            </p>
          </div>

          {/* A PASTA DE ENTREGA É OBRIGATÓRIA, e a trava é da Task: o trigger
              `tasks_exige_pasta_de_entrega` recusa demanda nova sem ela desde
              a 0015. O motivo vale igual aqui — quem abre a campanha está com
              pressa, quem procura o material está semanas depois, e as duas
              pessoas raramente são a mesma. */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="entrega">Pasta de entrega</Label>
            <Input
              id="entrega"
              value={linkEntrega}
              onChange={(e) => setLinkEntrega(e.target.value)}
              placeholder="https://drive.google.com/..."
              inputMode="url"
            />
            <p className="text-text-muted text-sm">
              O endereço do material final. É o que alguém vai procurar semanas
              depois — e é obrigatório.
            </p>
          </div>
        </div>
      </SecaoDoFormulario>

      {/* O BRIEFING É O DA TASK, e não uma coluna nova em `campaigns`. A
          campanha nasce com uma demanda; a demanda já tem onde guardar o que
          precisa ser feito. Uma segunda caixa de texto com o mesmo papel em
          outra tabela seria o lugar onde as duas versões do briefing
          divergem. */}
      <SecaoDoFormulario numero={3} titulo="O briefing da campanha">
        <EditorRico
          conteudo={briefing}
          onChange={({ json }) => setBriefing(json)}
          placeholder="O conceito, o que o cliente pediu, o que não pode faltar…"
        />
      </SecaoDoFormulario>

      <SecaoDoFormulario
        numero={4}
        titulo="O que a campanha entrega, e quem faz cada peça"
        acao={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setArvore((atual) => [...atual, { ...item(), filhos: [] }])
            }
          >
            <Plus aria-hidden className="size-4" />
            Entregável
          </Button>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="modelo">Partir de um modelo</Label>
          <Select value={templateId} onValueChange={escolherModelo}>
            <SelectTrigger aria-label="Partir de um modelo" id="modelo" className="w-full sm:max-w-sm">
              <SelectValue placeholder="Escolha um modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_MODELO}>Montar do zero</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modelo?.descricao ? (
            <p className="text-text-muted text-sm">{modelo.descricao}</p>
          ) : null}
        </div>

        {arvore.length === 0 ? (
          <p className="text-text-muted rounded-xl border border-dashed p-4 text-sm">
            Escolha um modelo acima para carregar a lista pronta, ou acrescente
            os entregáveis um a um. Dá para fazer isso depois também — a
            campanha existe sem eles.
          </p>
        ) : null}

        <ul className="space-y-3">
          {arvore.map((no) => (
            <li key={no.chave} className="bg-surface-card rounded-xl border p-3">
              <Linha
                item={no}
                placeholder="Nome do entregável"
                pessoas={pessoas}
                aoMudar={(m) => mudarNo(no.chave, m)}
                aoRemover={() =>
                  setArvore((atual) =>
                    atual.filter((outro) => outro.chave !== no.chave),
                  )
                }
              />

              {no.filhos.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t pt-3 pl-3 sm:pl-6">
                  {no.filhos.map((filho) => (
                    <li key={filho.chave}>
                      <Linha
                        item={filho}
                        placeholder="Nome do sub-item"
                        pessoas={pessoas}
                        aoMudar={(m) => mudarFilho(no.chave, filho.chave, m)}
                        aoRemover={() =>
                          setArvore((atual) =>
                            atual.map((outro) =>
                              outro.chave !== no.chave
                                ? outro
                                : {
                                    ...outro,
                                    filhos: outro.filhos.filter(
                                      (f) => f.chave !== filho.chave,
                                    ),
                                  },
                            ),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* SÓ DOIS NÍVEIS: o sub-item não ganha um botão de acrescentar.
                  O banco recusa o neto por trigger, e oferecer aqui um botão
                  que o banco recusa é oferecer um caminho sem saída. */}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() =>
                  setArvore((atual) =>
                    atual.map((outro) =>
                      outro.chave === no.chave
                        ? { ...outro, filhos: [...outro.filhos, item()] }
                        : outro,
                    ),
                  )
                }
              >
                <Plus aria-hidden className="size-4" />
                Sub-item
              </Button>
            </li>
          ))}
        </ul>
      </SecaoDoFormulario>

      <div className="flex flex-wrap gap-2">
        <Button onClick={enviar} disabled={salvando}>
          {salvando ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : null}
          Criar campanha
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/painel/aprovacoes")}
          disabled={salvando}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Uma linha da árvore: nome, quem faz, até quando.
 *
 * **Os três controles ficam NA MESMA LINHA**, e não num painel que abre ao
 * clicar. Quem monta uma Wave está distribuindo quinze peças entre quatro
 * pessoas de uma vez: um painel por item seriam quinze aberturas, e a
 * pergunta "quem está com o quê" — que é a razão de a tela existir — só se
 * responde vendo a coluna inteira.
 *
 * Em 375px eles empilham (`flex-wrap`), e o nome fica sozinho na primeira
 * linha porque é `flex-1`.
 */
function Linha({
  item: valor,
  placeholder,
  pessoas,
  aoMudar,
  aoRemover,
}: {
  item: ItemEmEdicao;
  placeholder: string;
  pessoas: { id: string; nome: string; funcao: string | null }[];
  aoMudar: (mudanca: Partial<ItemEmEdicao>) => void;
  aoRemover: () => void;
}) {
  const nome = valor.nome || placeholder;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={valor.nome}
        onChange={(e) => aoMudar({ nome: e.target.value })}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-[10rem] flex-1"
      />

      <Select
        value={valor.responsavelId}
        onValueChange={(v) => aoMudar({ responsavelId: v })}
      >
        <SelectTrigger aria-label={`Responsável por ${nome}`} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* "Sem responsável" É UMA OPÇÃO, e fica no topo. Nem toda peça tem
              dono na abertura — obrigar a escolher faria a pessoa pôr o nome
              de quem estiver mais à mão, que é pior que vazio: um nome errado
              ninguém corrige, um vazio aparece. */}
          <SelectItem value={SEM_DONO}>Sem responsável</SelectItem>
          {pessoas.map((pessoa) => (
            <SelectItem key={pessoa.id} value={pessoa.id}>
              {pessoa.funcao ? `${pessoa.nome} · ${pessoa.funcao}` : pessoa.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={valor.prazo}
        onChange={(e) => aoMudar({ prazo: e.target.value })}
        aria-label={`Prazo de ${nome}`}
        className="w-auto"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={aoRemover}
        aria-label={`Remover ${nome}`}
      >
        <X aria-hidden className="size-4" />
      </Button>
    </div>
  );
}
