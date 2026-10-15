"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  ListPlus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { chamarAcao } from "@/lib/acoes/cliente";
import { FUNCOES } from "@/lib/dominio/equipe";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE } from "@/lib/dominio/tasks";
import type { TipoComFluxo } from "@/lib/dados/workflows";
import type { TaskPrioridade, TeamFuncao } from "@/lib/supabase/database.types";

import {
  arquivarWorkflow,
  duplicarWorkflow,
  excluirWorkflow,
  salvarWorkflow,
} from "./acoes";

const GLOBAL = "__todos__";
const SEM_VALOR = "__sem__";

type EtapaEmEdicao = {
  chave: string;
  nome: string;
  funcao: string;
  responsavel: string;
  prioridade: TaskPrioridade;
  offset: string;
  aprovacao: string;
  dependeDe: string;
  /**
   * A CHAVE da etapa de cima, ou null no topo (migration 0108).
   *
   * **É a chave da linha e não a posição**, ao contrário do que vai para o
   * banco: aqui a lista é reordenada com as setas, e uma posição guardada
   * apontaria para outra etapa depois do primeiro `mover()`. A tradução para
   * `parent_ordem` acontece uma vez, no salvamento, pelo mesmo mapa que a
   * dependência usa.
   */
  paiChave: string | null;
};

function novaChave() {
  return Math.random().toString(36).slice(2);
}

function etapaVazia(paiChave: string | null = null): EtapaEmEdicao {
  return {
    chave: novaChave(),
    nome: "",
    funcao: SEM_VALOR,
    responsavel: SEM_VALOR,
    prioridade: "normal",
    offset: "",
    aprovacao: SEM_VALOR,
    dependeDe: SEM_VALOR,
    paiChave,
  };
}

/**
 * O NÚMERO QUE A LINHA MOSTRA: "3" no topo, "3.2" na sub-etapa.
 *
 * Ele é derivado da lista e não guardado, porque muda a cada `mover()` — é
 * "atraso não é coluna" numa numeração de tela.
 */
function numeroNaTela(etapas: EtapaEmEdicao[], indice: number): string {
  const eu = etapas[indice];
  if (!eu.paiChave) {
    return String(etapas.filter((e, i) => i <= indice && e.paiChave === null).length);
  }
  const ondeEstaOPai = etapas.findIndex((e) => e.chave === eu.paiChave);
  const numeroDoPai =
    ondeEstaOPai < 0
      ? "?"
      : String(etapas.filter((e, i) => i <= ondeEstaOPai && e.paiChave === null).length);
  const entreIrmas = etapas.filter(
    (e, i) => i <= indice && e.paiChave === eu.paiChave,
  ).length;
  return `${numeroDoPai}.${entreIrmas}`;
}

/**
 * Se a seta faz alguma coisa: há vizinha do MESMO nível naquela direção.
 *
 * A regra antiga era `indice === 0` e `indice === length - 1`, e com a árvore
 * na mesma lista ela mentiria nos dois sentidos — a primeira sub-etapa de uma
 * mãe tem linha acima e não tem irmã acima, então a seta ficaria ligada sem
 * ter para onde ir.
 */
function podeAndar(etapas: EtapaEmEdicao[], indice: number, direcao: -1 | 1): boolean {
  const eu = etapas[indice];
  const mesmoNivel = etapas
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.paiChave === eu.paiChave);
  const ondeEstou = mesmoNivel.findIndex(({ i }) => i === indice);
  return mesmoNivel[ondeEstou + direcao] !== undefined;
}

/**
 * Workflows — uma tela só.
 *
 * Aqui cadastra-se "Post de feed" E as etapas de um post de feed, na mesma
 * caixa. Eram duas abas até o Sprint 3C — uma para o modelo, outra para a
 * cadeia de etapas —, e a divisão só fazia sentido para quem conhecia o banco:
 * na prática ninguém cadastra uma cadeia de etapas sem o modelo que a carrega,
 * nem o contrário.
 *
 * O NOME também era dois até o Sprint 9: o menu e a rota diziam Workflows, o
 * formulário de abertura e esta tela diziam outra coisa. Quem usava tinha que
 * descobrir sozinho que era a mesma coisa. Ficou Workflow, e `check:cores`
 * varre `src/` atrás do nome antigo para ele não voltar.
 *
 * Duas decisões de desenho que valem explicar:
 *
 *   **A etapa tem FUNÇÃO, e não só pessoa.** "Arte — Design" continua fazendo
 *   sentido quando o designer muda; "Arte — Bruno" vira um modelo errado no
 *   dia em que o Bruno sai. A pessoa entra como padrão opcional, e na hora de
 *   aplicar a tela sugere quem está naquela função hoje.
 *
 *   **O prazo é em DIAS a partir do início da Task**, nunca uma data. Data
 *   fixa num modelo reutilizável faria toda demanda nova nascer vencida.
 *
 * Editar um tipo não altera nenhuma Task já criada: a demanda guarda as
 * subtarefas materializadas e uma cópia do fluxo que as gerou.
 */
export function Workflows({
  tipos,
  clientes,
  equipe,
}: {
  tipos: TipoComFluxo[];
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [editando, setEditando] = useState<TipoComFluxo | "novo" | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cliente, setCliente] = useState(GLOBAL);
  const [etapas, setEtapas] = useState<EtapaEmEdicao[]>([]);

  function abrir(tipo: TipoComFluxo | "novo") {
    setEditando(tipo);
    if (tipo === "novo") {
      setNome("");
      setDescricao("");
      setCliente(GLOBAL);
      // Um tipo novo já nasce com uma etapa em branco: a caixa vazia não
      // deixava claro que é aqui dentro que o fluxo se monta.
      setEtapas([etapaVazia()]);
      return;
    }
    setNome(tipo.nome);
    setDescricao(tipo.descricao ?? "");
    setCliente(tipo.client_id ?? GLOBAL);
    const chaves = tipo.etapas.map(() => novaChave());
    setEtapas(
      tipo.etapas.map((etapa, indice) => ({
        chave: chaves[indice],
        nome: etapa.nome,
        funcao: etapa.funcao_padrao ?? SEM_VALOR,
        responsavel: etapa.responsavel_padrao_id ?? SEM_VALOR,
        prioridade: etapa.prioridade,
        offset: etapa.prazo_offset_dias === null ? "" : String(etapa.prazo_offset_dias),
        aprovacao: etapa.requer_aprovacao ? (etapa.tipo_aprovacao ?? "interna") : SEM_VALOR,
        dependeDe:
          etapa.depende_de_ordem === null
            ? SEM_VALOR
            : (chaves[tipo.etapas.findIndex((e) => e.ordem === etapa.depende_de_ordem)] ??
              SEM_VALOR),
        // A VOLTA DO PAI É PELA MESMA TRADUÇÃO da dependência: `parent_ordem`
        // é a `ordem` do pai, e aqui ela vira a chave da linha dele.
        paiChave:
          etapa.parent_ordem === null
            ? null
            : (chaves[tipo.etapas.findIndex((e) => e.ordem === etapa.parent_ordem)] ?? null),
      })),
    );
  }

  function mudar(chave: string, campos: Partial<EtapaEmEdicao>) {
    setEtapas((atual) => atual.map((e) => (e.chave === chave ? { ...e, ...campos } : e)));
  }

  /**
   * MOVER TROCA COM A VIZINHA DO MESMO NÍVEL, e não com a linha de cima
   * (migration 0108).
   *
   * Com a árvore na mesma lista, trocar com a linha vizinha moveria uma
   * sub-etapa para fora da mãe — ou a mãe para dentro de outra —, e a ordem da
   * tela deixaria de bater com a árvore que o `parent_ordem` descreve. Quem
   * tem pai só anda entre irmãs; quem é de topo só anda entre etapas de topo,
   * levando as filhas consigo.
   */
  function mover(chave: string, direcao: -1 | 1) {
    setEtapas((atual) => {
      const indice = atual.findIndex((e) => e.chave === chave);
      if (indice < 0) return atual;
      const eu = atual[indice];

      if (eu.paiChave) {
        // A VIZINHA É A IRMÃ MAIS PRÓXIMA na direção pedida.
        const irmas = atual
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => e.paiChave === eu.paiChave);
        const ondeEstou = irmas.findIndex(({ e }) => e.chave === chave);
        const vizinha = irmas[ondeEstou + direcao];
        if (!vizinha) return atual;
        const copia = [...atual];
        [copia[indice], copia[vizinha.i]] = [copia[vizinha.i], copia[indice]];
        return copia;
      }

      // ETAPA DE TOPO ANDA COM O BLOCO DELA. As filhas vêm imediatamente
      // depois dela na lista (é assim que `acrescentarFilha` as insere), então
      // o bloco é contíguo e se move inteiro.
      const blocoDe = (inicio: number) => {
        let fim = inicio + 1;
        while (fim < atual.length && atual[fim].paiChave === atual[inicio].chave) fim++;
        return { inicio, fim };
      };

      const meu = blocoDe(indice);
      if (direcao === -1) {
        const anterior = [...atual.keys()]
          .filter((i) => i < indice && atual[i].paiChave === null)
          .pop();
        if (anterior === undefined) return atual;
        const dele = blocoDe(anterior);
        return [
          ...atual.slice(0, dele.inicio),
          ...atual.slice(meu.inicio, meu.fim),
          ...atual.slice(dele.inicio, dele.fim),
          ...atual.slice(meu.fim),
        ];
      }

      const seguinte = atual.findIndex((e, i) => i >= meu.fim && e.paiChave === null);
      if (seguinte < 0) return atual;
      const dele = blocoDe(seguinte);
      return [
        ...atual.slice(0, meu.inicio),
        ...atual.slice(dele.inicio, dele.fim),
        ...atual.slice(meu.inicio, meu.fim),
        ...atual.slice(dele.fim),
      ];
    });
  }

  /**
   * ACRESCENTA UMA SUB-ETAPA, logo depois da última irmã.
   *
   * **A posição na lista não é só estética**: ela é o que torna o bloco de
   * cada mãe contíguo, e é desse bloco que `mover()` depende para andar com as
   * filhas. Jogada no fim da lista, a sub-etapa apareceria longe da mãe e a
   * seta de subir teria de procurá-la na lista inteira.
   */
  function acrescentarFilha(paiChave: string) {
    setEtapas((atual) => {
      const ondeEstaOPai = atual.findIndex((e) => e.chave === paiChave);
      if (ondeEstaOPai < 0) return atual;
      let depois = ondeEstaOPai + 1;
      while (depois < atual.length && atual[depois].paiChave === paiChave) depois++;
      return [
        ...atual.slice(0, depois),
        etapaVazia(paiChave),
        ...atual.slice(depois),
      ];
    });
  }

  /**
   * REMOVER UMA ETAPA LEVA AS SUB-ETAPAS DELA, e isso não é zelo: uma filha
   * sem mãe é recusada pelo banco (`parent_ordem` apontando para posição que
   * não existe), e a recusa chegaria no clique de Salvar falando de uma etapa
   * que a pessoa acabou de apagar.
   */
  function remover(chave: string) {
    setEtapas((atual) => atual.filter((e) => e.chave !== chave && e.paiChave !== chave));
  }

  /** Quem tem sub-etapa: não exige aprovação nem espera outra etapa (0108). */
  function temFilha(chave: string) {
    return etapas.some((e) => e.paiChave === chave);
  }

  function salvar() {
    const validas = etapas.filter((e) => e.nome.trim().length > 0);
    const ordemPorChave = new Map(validas.map((e, indice) => [e.chave, indice + 1]));

    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        salvarWorkflow(editando === "novo" || editando === null ? null : editando.id, {
          nome,
          descricao: descricao.trim() === "" ? null : descricao.trim(),
          client_id: cliente === GLOBAL ? null : cliente,
          ativo: editando === "novo" || editando === null ? true : editando.ativo,
          etapas: validas.map((etapa, indice) => ({
            nome: etapa.nome,
            ordem: indice + 1,
            funcao_padrao: etapa.funcao === SEM_VALOR ? null : (etapa.funcao as TeamFuncao),
            responsavel_padrao_id: etapa.responsavel === SEM_VALOR ? null : etapa.responsavel,
            prioridade: etapa.prioridade,
            prazo_offset_dias: etapa.offset === "" ? null : Number(etapa.offset),
            requer_aprovacao: etapa.aprovacao !== SEM_VALOR,
            tipo_aprovacao:
              etapa.aprovacao === SEM_VALOR ? null : (etapa.aprovacao as "interna" | "cliente"),
            depende_de_ordem: ordemPorChave.get(etapa.dependeDe) ?? null,
            parent_ordem: etapa.paiChave
              ? (ordemPorChave.get(etapa.paiChave) ?? null)
              : null,
          })),
        }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setEditando(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => abrir("novo")}>
          <Plus aria-hidden />
          Novo workflow
        </Button>
      </div>

      {tipos.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nenhum workflow cadastrado. Comece por um: &ldquo;Post de feed&rdquo;,
          &ldquo;Campanha&rdquo;, &ldquo;Vídeo&rdquo;.
        </p>
      ) : (
        <ul className="space-y-3">
          {tipos.map((tipo) => (
            <li
              key={tipo.id}
              // SEM `opacity-50` no arquivado: opacidade sobre um fundo
              // qualquer dá uma cor que ninguém mediu, e a 50% o nome do
              // workflow reprova o contraste. O selo "Arquivado" logo abaixo já
              // diz o mesmo, e diz por escrito.
              className="rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="hover:text-accent-strong text-sm font-semibold"
                  onClick={() => abrir(tipo)}
                >
                  {tipo.nome}
                </button>
                {tipo.cliente ? (
                  <Badge variant="outline">{tipo.cliente.nome_empresa}</Badge>
                ) : (
                  <Badge variant="secondary">Todos os clientes</Badge>
                )}
                {tipo.ativo ? null : <Badge variant="outline">Arquivado</Badge>}
                <span className="text-muted-foreground text-xs">
                  {tipo.etapas.length} etapa{tipo.etapas.length === 1 ? "" : "s"}
                </span>

                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicar ${tipo.nome}`}
                    disabled={salvando}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await chamarAcao(() => duplicarWorkflow(tipo.id, null));
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success(r.mensagem);
                          router.refresh();
                        }
                      })
                    }
                  >
                    <Copy aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tipo.ativo ? `Arquivar ${tipo.nome}` : `Reativar ${tipo.nome}`}
                    disabled={salvando}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await chamarAcao(() =>
                          arquivarWorkflow(tipo.id, !tipo.ativo),
                        );
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success(r.mensagem);
                          router.refresh();
                        }
                      })
                    }
                  >
                    {tipo.ativo ? <Archive aria-hidden /> : <RotateCcw aria-hidden />}
                  </Button>

                  {/* APAGAR FICA AO LADO DE ARQUIVAR, e o diálogo diz a
                      diferença. Arquivar é o caminho normal — o modelo sai da
                      lista de quem abre demanda e continua explicando as
                      antigas. Apagar é para o que nasceu errado.

                      A confirmação NOMEIA o que acontece com as demandas que
                      usaram o workflow, e o número vem junto: "tem certeza?"
                      sem dizer o que se perde é confirmação que ninguém lê. */}
                  <ConfirmDialog
                    destructive
                    title={`Apagar o workflow "${tipo.nome}"?`}
                    description={
                      tipo.demandas > 0 ? (
                        <>
                          {tipo.demandas === 1
                            ? "1 demanda usou este workflow, e ela "
                            : `${tipo.demandas} demandas usaram este workflow, e elas `}
                          <strong>não perdem nada</strong>: as etapas viraram
                          subtarefas de verdade e o fluxo ficou guardado em cada
                          uma. O que somem é o nome do modelo na ficha delas.
                          <br />
                          <br />
                          Se a ideia é só tirá-lo da lista de quem abre demanda,
                          arquivar faz isso e mantém a explicação.
                        </>
                      ) : (
                        "Nenhuma demanda usou este workflow ainda. Não há o que se perder."
                      )
                    }
                    confirmLabel="Apagar workflow"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Apagar ${tipo.nome}`}
                        disabled={salvando}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    onConfirm={async () => {
                      const r = await chamarAcao(() => excluirWorkflow(tipo.id));
                      if (!r.ok) toast.error(r.error);
                      else {
                        toast.success(r.mensagem);
                        router.refresh();
                      }
                    }}
                  />
                </div>
              </div>

              {tipo.descricao ? (
                <p className="text-muted-foreground mt-1 text-xs">{tipo.descricao}</p>
              ) : null}

              {/* A cadeia, em uma linha: é como as etapas se encaixam. */}
              {tipo.etapas.length > 0 ? (
                <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
                  {tipo.etapas.map((etapa, indice) => (
                    <span key={etapa.id} className="inline-flex items-center gap-1">
                      {indice > 0 ? <span aria-hidden>→</span> : null}
                      <span>{etapa.nome}</span>
                      {etapa.funcao_padrao ? (
                        <span>({etapa.funcao_padrao})</span>
                      ) : null}
                      {etapa.requer_aprovacao ? (
                        <Lock className="size-3" aria-label="Exige aprovação" />
                      ) : null}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  Sem etapas — uma task deste tipo nasce vazia.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editando === "novo" ? "Novo workflow" : "Editar workflow"}
            </DialogTitle>
            <DialogDescription>
              Cada etapa vira uma subtarefa quando alguém abre uma task deste tipo. O prazo da
              etapa é em dias depois do início da task — assim o modelo serve para qualquer
              demanda. Alterar aqui não muda nenhuma task já criada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo-nome">Nome</Label>
                <Input
                  id="tipo-nome"
                  value={nome}
                  autoFocus
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Post de feed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo-cliente">Vale para</Label>
                <Select value={cliente} onValueChange={setCliente}>
                  <SelectTrigger aria-label="Vale para" id="tipo-cliente" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL}>Todos os clientes</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-descricao">Descrição (opcional)</Label>
              <Input
                id="tipo-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Quando usar este tipo"
              />
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Etapas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEtapas((atual) => [...atual, etapaVazia()])}
                >
                  <Plus aria-hidden />
                  Etapa
                </Button>
              </div>

              {etapas.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Sem etapas ainda. Cada uma vira uma subtarefa da demanda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {etapas.map((etapa, indice) => (
                    <li
                      key={etapa.chave}
                      // O RECUO É A ÁRVORE, e vem com um fio à esquerda: sem
                      // ele, duas sub-etapas seguidas se leem como duas etapas
                      // de topo mais estreitas. É a decisão da árvore de
                      // entregáveis, onde o rótulo diz onde o grupo começa e o
                      // fio diz onde ele termina.
                      className={
                        etapa.paiChave
                          ? "border-border ml-6 space-y-2 rounded-md border border-l-2 p-3"
                          : "space-y-2 rounded-md border p-3"
                      }
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-5 shrink-0 pt-2 text-xs tabular-nums">
                          {/* A NUMERAÇÃO DA SUB-ETAPA É DENTRO DA MÃE, e não a
                              posição na lista: "3.2" diz de quem ela é, e "7"
                              não diria nada. */}
                          {numeroNaTela(etapas, indice)}
                        </span>
                        <Input
                          className="flex-1"
                          placeholder="Nome da etapa"
                          value={etapa.nome}
                          onChange={(e) => mudar(etapa.chave, { nome: e.target.value })}
                        />
                        {/* SÓ ETAPA DE TOPO RECEBE SUB-ETAPA (0108): são dois
                            níveis no modelo porque o workflow materializa
                            subtarefa, e `subtasks_agrupadora` (0022) recusa a
                            neta. Na sub-etapa o botão não aparece, em vez de
                            aparecer desligado: não é um passo que falta, é uma
                            porta que não existe naquele nível. */}
                        {etapa.paiChave === null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Acrescentar sub-etapa em ${etapa.nome || "esta etapa"}`}
                            title="Acrescentar sub-etapa"
                            onClick={() => acrescentarFilha(etapa.chave)}
                          >
                            <ListPlus aria-hidden />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Subir"
                          disabled={!podeAndar(etapas, indice, -1)}
                          onClick={() => mover(etapa.chave, -1)}
                        >
                          <ChevronUp aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Descer"
                          disabled={!podeAndar(etapas, indice, 1)}
                          onClick={() => mover(etapa.chave, 1)}
                        >
                          <ChevronDown aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remover etapa"
                          onClick={() => remover(etapa.chave)}
                        >
                          <X aria-hidden />
                        </Button>
                      </div>

                      <div className="grid gap-2 pl-7 sm:grid-cols-3">
                        <Select
                          value={etapa.funcao}
                          onValueChange={(v) => mudar(etapa.chave, { funcao: v })}
                        >
                          <SelectTrigger className="w-full" aria-label="Função">
                            <SelectValue placeholder="Função" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>Sem função definida</SelectItem>
                            {FUNCOES.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={etapa.responsavel}
                          onValueChange={(v) => mudar(etapa.chave, { responsavel: v })}
                        >
                          <SelectTrigger className="w-full" aria-label="Responsável padrão">
                            <SelectValue placeholder="Responsável padrão" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>Sem pessoa fixa</SelectItem>
                            {equipe.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            aria-label="Dias após o início"
                            value={etapa.offset}
                            onChange={(e) => mudar(etapa.chave, { offset: e.target.value })}
                            placeholder="0"
                          />
                          <span className="text-muted-foreground shrink-0 text-xs">
                            dias após o início
                          </span>
                        </div>

                        <Select
                          value={etapa.prioridade}
                          onValueChange={(v) =>
                            mudar(etapa.chave, { prioridade: v as TaskPrioridade })
                          }
                        >
                          <SelectTrigger className="w-full" aria-label="Prioridade">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORIDADES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {ROTULOS_DE_PRIORIDADE[p]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={etapa.aprovacao}
                          onValueChange={(v) => mudar(etapa.chave, { aprovacao: v })}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label="Aprovação"
                            disabled={temFilha(etapa.chave)}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>Sem aprovação</SelectItem>
                            <SelectItem value="interna">Aval interno</SelectItem>
                            <SelectItem value="cliente">Aprovação do cliente</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={etapa.dependeDe}
                          onValueChange={(v) => mudar(etapa.chave, { dependeDe: v })}
                          disabled={temFilha(etapa.chave)}
                        >
                          <SelectTrigger className="w-full" aria-label="Depende de">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>Não depende de nada</SelectItem>
                            {/* SÓ ETAPAS DO MESMO NÍVEL, e antes desta: uma
                                sub-etapa esperando a mãe de outra seria uma
                                dependência que atravessa a árvore, e o número
                                que o rótulo mostra ("Depende de 3.") não
                                existe fora do nível. */}
                            {etapas
                              .filter(
                                (outra, i) => i < indice && outra.paiChave === etapa.paiChave,
                              )
                              .map((outra) => (
                                <SelectItem key={outra.chave} value={outra.chave}>
                                  Depende de {numeroNaTela(etapas, etapas.indexOf(outra))}.{" "}
                                  {outra.nome || "(sem nome)"}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* A RAZÃO FICA ESCRITA, e os dois seletores desligados
                          em vez de sumirem: é a decisão do "Enviar ao cliente"
                          do Social Media — um botão que some ensina que não
                          existe; um desligado que diz por quê ensina a regra. E
                          a regra é do banco: `workflow_steps_confere_*` (0108)
                          recusa, porque `subtasks_agrupadora` (0022) recusaria
                          na hora de aplicar. */}
                      {temFilha(etapa.chave) ? (
                        <p className="text-text-muted pl-7 text-xs">
                          Esta etapa tem sub-etapas, então ela agrupa em vez de
                          ser trabalho: quem entrega e quem espera são as
                          sub-etapas. Marque a aprovação e a dependência nelas.
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || nome.trim().length < 2}>
              {salvando ? <Loader2 className="animate-spin" /> : null}
              Salvar workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
