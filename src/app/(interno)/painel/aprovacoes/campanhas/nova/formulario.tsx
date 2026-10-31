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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  arvoreDaComposicao,
  entregaveisDoTemplate,
  ROTULO_DA_CAMPANHA,
  ROTULO_DO_TIPO,
  TIPOS_DE_MATERIAL,
  type LinhaDaComposicao,
  type NoDeModelo,
} from "@/lib/dominio/campanhas";
import type {
  CampaignStatus,
  DeliverableTipo,
} from "@/lib/supabase/database.types";
import type { JSONContent } from "@tiptap/react";
import type { TemplateDeCampanha } from "@/lib/dados/campanhas";

import {
  arvoreDoWorkflowParaCampanha,
  criarCampanha,
} from "../../acoes-de-campanha";

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
  /** De que tipo é o material (0122). `SEM_TIPO` é um balde de verdade. */
  tipo: string;
};
type NoEmEdicao = ItemEmEdicao & { filhos: ItemEmEdicao[] };

const SEM_DONO = "__sem_dono__";
const SEM_TIPO = "__sem_tipo__";
const SEM_VERTENTE = "__sem_vertente__";

function chave() {
  return Math.random().toString(36).slice(2);
}

function item(nome = "", tipo: string = SEM_TIPO): ItemEmEdicao {
  return { chave: chave(), nome, prazo: "", responsavelId: SEM_DONO, tipo };
}

/** `AAAA-MM-DD` mais N dias, em UTC para não escorregar de fuso. */
function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function FormularioDeCampanha({
  clientes,
  templates,
  workflows,
  pessoas,
  vertentes,
}: {
  clientes: { id: string; nome: string }[];
  templates: TemplateDeCampanha[];
  /**
   * OS WORKFLOWS, que o seletor passou a oferecer ao lado dos modelos de
   * campanha (migration 0108).
   *
   * **A árvore deles NÃO vem pronta daqui**, ao contrário da do modelo de
   * campanha: o responsável de cada etapa é resolvido pela CONTA
   * (`etapas_resolvidas_do_workflow`, 0064), e a conta é escolhida nesta tela
   * — pré-resolver na página seria resolver todo workflow para todo cliente.
   * Quem responde é `arvoreDoWorkflowParaCampanha`, no clique.
   */
  workflows: { id: string; nome: string; descricao: string | null; etapas: number }[];
  pessoas: { id: string; nome: string; funcao: string | null }[];
  /**
   * AS FRENTES DE CADA CONTA (0118), todas de uma vez.
   *
   * Mapa e não lista: a pergunta é "quais são as da conta escolhida", e uma
   * lista única obrigaria a tela a carregar o `client_id` de cada vertente só
   * para filtrar — e duas contas podem ter uma frente com o MESMO nome, que é
   * a razão de a Biblioteca só desenhar os chips quando há uma empresa só.
   */
  vertentes: Record<string, { id: string; nome: string }[]>;
}) {
  const router = useRouter();
  const [salvando, salvar] = useTransition();
  // A MONTAGEM DA ÁRVORE TEM TRANSIÇÃO PRÓPRIA, separada do salvamento: as
  // duas acontecem em momentos diferentes, e um `salvando` só deixaria o botão
  // "Criar campanha" em "Salvando…" enquanto a pessoa só escolheu um modelo.
  const [montando, montar] = useTransition();

  const [clienteId, setClienteId] = useState("");
  const [vertenteId, setVertenteId] = useState(SEM_VERTENTE);
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
   * A COMPOSIÇÃO: deste tipo, tantos.
   *
   * Ela não é gravada daqui — quem grava o plano é `abrir_campanha()`,
   * contando as FOLHAS da árvore que esta tela mandou (0122). Aqui ela é o
   * atalho que gera a árvore: "story, 15" em vez de quinze linhas digitadas
   * uma a uma, que era o único caminho até agora.
   */
  const [composicao, setComposicao] = useState<LinhaDaComposicao[]>([]);

  /**
   * TROCAR DE CLIENTE LIMPA A FRENTE, e isso é obrigatório.
   *
   * `tasks_vertente_da_conta` (0118) recusa uma demanda apontando para a
   * vertente de OUTRA empresa — e a recusa chegaria depois de a campanha
   * inteira já ter nascido, porque a frente é gravada numa segunda escrita.
   * É a mesma limpeza que `atualizarTask` faz na tela de task, pela mesma
   * razão: "Institucional" existe em duas contas com ids diferentes.
   */
  function escolherCliente(id: string) {
    setClienteId(id);
    setVertenteId(SEM_VERTENTE);
  }

  /**
   * A COMPOSIÇÃO GERA A ÁRVORE, e ela avisa antes de reescrever.
   *
   * Mesma decisão de "trocar de modelo refaz a lista": gerar por cima do que
   * já foi ajustado daria uma árvore que não é nem a da composição nem a de
   * antes, e ninguém conseguiria explicar de onde ela veio.
   */
  function gerarDaComposicao() {
    const total = composicao.reduce((soma, l) => soma + l.quantidade, 0);
    if (total === 0) {
      toast.error("Nenhuma quantidade. Some ao menos um material.");
      return;
    }

    if (
      arvore.length > 0 &&
      !window.confirm(
        "Gerar refaz a lista de entregáveis. O que você já ajustou aqui se perde. Gerar mesmo assim?",
      )
    ) {
      return;
    }

    // O MODELO VOLTA A "Montar do zero", e não é cosmético: o seletor acima
    // diria que esta árvore saiu de um modelo que não a produziu, e
    // `templateId` viaja para a action como PROCEDÊNCIA da estrutura.
    setTemplateId(SEM_MODELO);
    plantar(arvoreDaComposicao(composicao));
  }

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
    if (modelo) {
      plantar(entregaveisDoTemplate(modelo.estrutura));
      return;
    }

    /**
     * O WORKFLOW É A SEGUNDA ORIGEM, e ela custa uma ida ao servidor.
     *
     * O modelo de campanha expande aqui mesmo — ele é uma lista de nomes que
     * já veio na página. O workflow precisa do servidor porque o responsável
     * de cada etapa depende da CONTA (0064) e o prazo depende da data de
     * início, e as duas estão nesta tela.
     *
     * **A árvore anterior só sai quando a nova chega.** Limpando antes, uma
     * recusa deixaria a pessoa com a tela vazia e o modelo antigo perdido —
     * que é a decisão do "trocar de modelo refaz a lista" ao contrário: ali o
     * trabalho se perde porque ela disse que podia, aqui se perderia por uma
     * falha.
     */
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow) return;

    montar(async () => {
      const r = await chamarAcao(() =>
        arvoreDoWorkflowParaCampanha(id, clienteId || null, dataInicio),
      );
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      plantar(r.dados ?? []);
      if (r.mensagem) toast.success(r.mensagem);
    });
  }

  /** Põe uma árvore de modelo na tela, de qualquer origem. */
  function plantar(nos: NoDeModelo[]) {
    const paraEdicao = (no: NoDeModelo): NoEmEdicao => ({
      ...item(no.nome, no.tipo ?? SEM_TIPO),
      // O RESPONSÁVEL E O PRAZO ENTRAM QUANDO O MODELO OS SABE, e é isso que
      // faz o workflow "aparecer montado completo": o modelo de campanha
      // guarda nomes e deixa os dois em branco, como já deixava.
      responsavelId: no.responsavelId ?? SEM_DONO,
      prazo: no.offsetDias !== null && dataInicio ? somarDias(dataInicio, no.offsetDias) : "",
      filhos: no.filhos.map((filho) => ({
        ...item(filho.nome, filho.tipo ?? SEM_TIPO),
        responsavelId: filho.responsavelId ?? SEM_DONO,
        prazo:
          filho.offsetDias !== null && dataInicio
            ? somarDias(dataInicio, filho.offsetDias)
            : "",
      })),
    });

    setArvore(nos.map(paraEdicao));
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
          vertenteId: vertenteId === SEM_VERTENTE ? null : vertenteId,
          estrutura: arvore
            // Linha em branco não vira entregável: quem clicou em "adicionar"
            // e desistiu não deve ganhar um material sem nome na campanha.
            .filter((no) => no.nome.trim().length > 0)
            .map((no) => ({
              nome: no.nome,
              prazo: no.prazo || null,
              responsavelId: no.responsavelId === SEM_DONO ? null : no.responsavelId,
              tipo: no.tipo === SEM_TIPO ? null : (no.tipo as DeliverableTipo),
              filhos: no.filhos
                .filter((f) => f.nome.trim().length > 0)
                .map((f) => ({
                  nome: f.nome,
                  prazo: f.prazo || null,
                  responsavelId:
                    f.responsavelId === SEM_DONO ? null : f.responsavelId,
                  tipo: f.tipo === SEM_TIPO ? null : (f.tipo as DeliverableTipo),
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

  const frentesDaConta = clienteId ? (vertentes[clienteId] ?? []) : [];
  const totalDaComposicao = composicao.reduce((s, l) => s + l.quantidade, 0);

  // A DESCRIÇÃO VEM DA ORIGEM ESCOLHIDA, qualquer das duas. Procurar só em
  // `templates` deixaria a linha de ajuda em branco para todo workflow.
  const escolhido =
    templates.find((t) => t.id === templateId) ??
    workflows.find((w) => w.id === templateId);

  return (
    <div className="space-y-8">
      <SecaoDoFormulario numero={1} titulo="De quem é, e como se chama">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cliente">Cliente</Label>
            <Select value={clienteId} onValueChange={escolherCliente}>
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

          {/* A FRENTE SÓ EXISTE QUANDO A CONTA TEM, e vem DEPOIS do cliente.
              A maioria das contas não tem vertente nenhuma, e um seletor
              permanentemente vazio na grade pede uma escolha que não existe;
              acima do cliente ele perguntaria sobre uma conta que ainda não
              foi escolhida. É a decisão do campo da tela de task. */}
          {frentesDaConta.length > 0 ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="vertente">Frente da conta</Label>
              <Select value={vertenteId} onValueChange={setVertenteId}>
                <SelectTrigger
                  aria-label="Frente da conta"
                  id="vertente"
                  className="w-full sm:max-w-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* "Sem frente" FICA, e não é indecisão: a campanha
                      institucional da conta não pertence a nenhuma das
                      frentes, e obrigar a escolha faria a pessoa marcar a
                      primeira da lista — que é pior que não classificar,
                      porque o relatório passaria a contá-la onde ela não
                      está. */}
                  <SelectItem value={SEM_VERTENTE}>Sem frente</SelectItem>
                  {frentesDaConta.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
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

      {/* A COMPOSIÇÃO VEM ANTES DA ÁRVORE, e é a ordem da decisão.
          Quem abre uma Wave decide primeiro QUANTOS de cada coisa — é o que
          está no contrato com o cliente — e só depois quem faz cada uma e
          para quando. Invertido, a pessoa distribuiria responsáveis numa
          lista que ainda vai ser refeita. */}
      <SecaoDoFormulario
        numero={4}
        titulo="Quantos materiais de cada tipo"
        acao={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const livre = TIPOS_DE_MATERIAL.find(
                (t) => !composicao.some((l) => l.tipo === t),
              );
              if (!livre) return;
              setComposicao((atual) => [
                ...atual,
                { tipo: livre, quantidade: 1 },
              ]);
            }}
            disabled={composicao.length >= TIPOS_DE_MATERIAL.length}
          >
            <Plus aria-hidden className="size-4" />
            Tipo
          </Button>
        }
      >
        <p className="text-text-muted text-sm">
          Diga quantos de cada tipo a campanha entrega e o Full Hub monta a
          lista — dez estáticos viram um grupo “Estáticos” com dez peças
          dentro. Dá para montar a lista à mão embaixo, também.
        </p>

        {composicao.length === 0 ? (
          <p className="text-text-muted rounded-xl border border-dashed p-4 text-sm">
            Nenhum tipo ainda. Acrescente um acima — ou pule esta parte e monte
            os entregáveis um a um.
          </p>
        ) : (
          <ul className="space-y-2">
            {composicao.map((linha, i) => (
              <li
                key={linha.tipo}
                className="bg-surface-card flex flex-wrap items-center gap-2 rounded-xl border p-2"
              >
                <Select
                  value={linha.tipo}
                  onValueChange={(v) =>
                    setComposicao((atual) =>
                      atual.map((l, j) =>
                        j === i ? { ...l, tipo: v as DeliverableTipo } : l,
                      ),
                    )
                  }
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
                        // O TIPO JÁ ESCOLHIDO SAI DA LISTA dos outros, porque
                        // a composição é por tipo: duas linhas de "estático"
                        // seriam dois planos para o mesmo material, e o
                        // `primary key (campaign_id, tipo)` do banco guarda
                        // só o último.
                        disabled={
                          t !== linha.tipo &&
                          composicao.some((l) => l.tipo === t)
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
                    setComposicao((atual) =>
                      atual.map((l, j) =>
                        j === i
                          ? {
                              ...l,
                              // ZERO É ACEITO, que é o pedido em quantas
                              // palavras. Ele quer dizer "este tipo não entra
                              // nesta campanha", e a árvore simplesmente não
                              // ganha a linha — `arvoreDaComposicao()` filtra.
                              quantidade: Math.max(
                                0,
                                Math.min(200, Number(e.target.value) || 0),
                              ),
                            }
                          : l,
                      ),
                    )
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
                  onClick={() =>
                    setComposicao((atual) => atual.filter((_, j) => j !== i))
                  }
                  aria-label={`Remover ${ROTULO_DO_TIPO[linha.tipo]}`}
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {composicao.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={gerarDaComposicao}>
              Montar a lista
            </Button>
            <p className="text-text-muted text-sm">
              {totalDaComposicao === 0
                ? "Todas as quantidades estão em zero."
                : `${totalDaComposicao} peça(s) no total.`}
            </p>
          </div>
        ) : null}
      </SecaoDoFormulario>

      <SecaoDoFormulario
        numero={5}
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

              {/* AS DUAS ORIGENS APARECEM NOMEADAS, e não misturadas numa lista
                  só: elas não são a mesma coisa. O modelo de campanha guarda
                  uma lista de nomes — a Wave, com a quantidade de Feed/Storys
                  que `workflow_steps` não tem coluna para expressar —, e o
                  workflow carrega função, responsável e prazo relativo de cada
                  etapa. Juntas sem rótulo, a pessoa não saberia por que um
                  traz os responsáveis preenchidos e o outro não. */}
              {templates.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Modelos de campanha</SelectLabel>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}

              {workflows.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Workflows</SelectLabel>
                  {workflows.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.nome}
                      {w.etapas > 0 ? ` · ${w.etapas} etapa(s)` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
          {montando ? (
            <p className="text-text-muted flex items-center gap-2 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Montando a árvore deste workflow…
            </p>
          ) : escolhido?.descricao ? (
            <p className="text-text-muted text-sm">{escolhido.descricao}</p>
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

      {/* O TIPO FICA ENTRE O NOME E O RESPONSÁVEL, e a ordem é a da pergunta:
          o que é esta peça, quem faz, até quando. Ele vem preenchido quando a
          composição montou a lista; quando a árvore veio de um modelo ou foi
          digitada à mão, fica em branco — nem o modelo de campanha nem o
          workflow sabem se "Feed/Story site" é estático ou carrossel, e
          adivinhar pelo nome é a classe de palpite que esta casa não dá. */}
      <Select value={valor.tipo} onValueChange={(v) => aoMudar({ tipo: v })}>
        <SelectTrigger aria-label={`Tipo de ${nome}`} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* "Sem tipo" É UMA OPÇÃO e fica no topo, pela razão de "Sem
              responsável": a peça que ninguém classificou é um balde de
              verdade no relatório, e inventar um valor afirmaria um material
              que ninguém escolheu. */}
          <SelectItem value={SEM_TIPO}>Sem tipo</SelectItem>
          {TIPOS_DE_MATERIAL.map((t) => (
            <SelectItem key={t} value={t}>
              {ROTULO_DO_TIPO[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
