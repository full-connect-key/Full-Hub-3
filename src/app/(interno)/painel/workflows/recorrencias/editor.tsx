"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CircleAlert,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  DIAS_DA_SEMANA,
  DIAS_UTEIS_PADRAO,
  EXPLICACAO_DO_MODO,
  FREQUENCIAS,
  MODOS,
  ROTULOS_DE_FREQUENCIA,
  ROTULOS_DE_MODO,
  VARIAVEIS_DO_TITULO,
  faltaParaSalvar,
  modeloVazio,
  proximasOcorrencias,
  type EtapaDoModelo,
  type ModeloDaRecorrencia,
} from "@/lib/dominio/recorrencias";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE } from "@/lib/dominio/tasks";
import type { TaskRecurrence } from "@/lib/supabase/database.types";
import type {
  RecorrenciaFrequencia,
  RecorrenciaModo,
  TaskPrioridade,
} from "@/lib/supabase/database.types";

import {
  atualizarRecorrencia,
  criarRecorrencia,
} from "../acoes-de-recorrencia";

const SEM_VALOR = "__sem__";
const VOLTAR = "/painel/workflows?aba=recorrencias";

function etapaVazia(): EtapaDoModelo {
  return {
    titulo: "",
    responsavel_id: null,
    prazo_offset_dias: 0,
    prioridade: "normal",
    estimativa_minutos: null,
    requer_aprovacao: false,
    tipo_aprovacao: null,
    depende_de_ordem: null,
  };
}

/**
 * O editor da regra de recorrência.
 *
 * **A PRÉVIA É A RAZÃO DESTA TELA TER ESTE FORMATO.** Uma recorrência é a
 * única coisa no produto que cria trabalho sozinha, de madrugada, sem ninguém
 * olhando — e quem a configura não tem outro jeito de conferir o que escolheu
 * antes de salvar. Sem as cinco próximas ocorrências à vista, o primeiro
 * retorno de uma regra torta chega no dia em que alguém abre o board e vê doze
 * demandas com o mesmo título.
 *
 * Por isso ela recalcula A CADA TECLA, no navegador, por `proximasOcorrencias()`
 * — e por isso essa função existe em TypeScript ao lado de
 * `datas_da_recorrencia()` no Postgres. Uma chamada por tecla não é
 * pré-visualização, é latência.
 *
 * **Não salva sozinho, ao contrário da tela de task.** Lá o rascunho é de quem
 * o criou e não existe para mais ninguém; aqui cada salvamento parcial mexe no
 * que a rotina vai gerar na madrugada seguinte. Salvar a cada tecla faria a
 * regra passar por dez configurações intermediárias, e uma delas pode ser a
 * que a rotina encontra.
 */
export function EditorDeRecorrencia({
  regra,
  clientes,
  equipe,
  workflows,
  partirDe,
  feriados,
  hojeISO,
}: {
  regra: TaskRecurrence | null;
  clientes: { id: string; nome_empresa: string; slug: string | null }[];
  equipe: { id: string; nome: string }[];
  workflows: { id: string; nome: string; etapas: number }[];
  /**
   * "Transformar em recorrente": o que uma task existente já respondia.
   *
   * Ele preenche e NÃO salva, e é obrigatório que seja assim — uma task não
   * sabe a cadência dela. Ela tem um período, não uma frequência, e "toda
   * segunda" é exatamente a informação que não está lá. Gravar direto faria a
   * regra passar a gerar sozinha no ritmo que o sistema chutou.
   */
  partirDe: {
    clienteId: string | null;
    modelo: ModeloDaRecorrencia;
  } | null;
  feriados: string[];
  /** O hoje do SERVIDOR. Se a prévia lesse o relógio do navegador, quem está
   *  noutro fuso veria a primeira ocorrência num dia e a rotina geraria noutro. */
  hojeISO: string;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  const modeloInicial =
    (regra?.modelo as unknown as ModeloDaRecorrencia) ??
    partirDe?.modelo ??
    modeloVazio();

  const [nome, setNome] = useState(regra?.nome ?? "");
  const [clienteId, setClienteId] = useState<string | null>(
    regra?.client_id ?? partirDe?.clienteId ?? null,
  );
  const [modo, setModo] = useState<RecorrenciaModo>(
    regra?.modo ??
      // VINDO DE UMA TASK COM ETAPAS, o modo certo é o outro: as etapas
      // copiadas só existem em "task por ocorrência". Abrir no padrão faria a
      // pessoa ver a seção das etapas sumir e concluir que a cópia se perdeu.
      (partirDe && partirDe.modelo.subtarefas.length > 0
        ? "task_por_ocorrencia"
        : "mensal_agrupada"),
  );
  const [frequencia, setFrequencia] = useState<RecorrenciaFrequencia>(
    regra?.frequencia ?? "diaria",
  );
  const [diasSemana, setDiasSemana] = useState<number[]>(
    regra?.dias_semana ?? DIAS_UTEIS_PADRAO,
  );
  const [diaMes, setDiaMes] = useState<string>(String(regra?.dia_mes ?? 5));
  const [pularFeriados, setPularFeriados] = useState(
    regra?.pular_feriados ?? true,
  );
  const [dataInicio, setDataInicio] = useState(regra?.data_inicio ?? hojeISO);
  const [dataFim, setDataFim] = useState(regra?.data_fim ?? "");
  const [antecedencia, setAntecedencia] = useState(
    String(regra?.antecedencia_dias ?? 3),
  );
  const [comoRascunho, setComoRascunho] = useState(
    regra?.gerar_como_rascunho ?? false,
  );
  const [workflowId, setWorkflowId] = useState<string | null>(
    regra?.task_type_id ?? null,
  );
  const [modelo, setModelo] = useState<ModeloDaRecorrencia>(modeloInicial);

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const conjuntoDeFeriados = useMemo(() => new Set(feriados), [feriados]);

  const regraAtual = {
    modo,
    frequencia,
    // NULO SIGNIFICA "TODOS OS DIAS", e não "nenhum". Numa regra mensal a
    // coluna não decide nada, e mandá-la preenchida deixaria na tabela um
    // valor que a próxima leitura teria que aprender a ignorar.
    diasSemana:
      frequencia === "mensal" || diasSemana.length === 0 ? null : diasSemana,
    diaMes: frequencia === "mensal" ? Number(diaMes) || null : null,
    pularFeriados,
    dataInicio,
    dataFim: dataFim || null,
  };

  const previa = useMemo(() => {
    if (!dataInicio) return [];
    try {
      return proximasOcorrencias(
        regraAtual,
        {
          cliente: cliente?.nome_empresa ?? "Cliente",
          sigla: cliente?.slug ?? "",
          titulo: modelo.titulo || "(sem título)",
          antecedenciaDias: Number(antecedencia) || 0,
          hoje: new Date(`${hojeISO}T12:00:00`),
          feriados: conjuntoDeFeriados,
          etapasDoModelo: workflowId
            ? (workflows.find((w) => w.id === workflowId)?.etapas ?? 0)
            : modelo.subtarefas.length,
        },
        5,
      );
    } catch {
      // Data digitada pela metade ("2026-1") passa pelo parse e sai inválida.
      // A prévia vazia é melhor que a tela quebrada no meio de uma digitação.
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modo,
    frequencia,
    diasSemana,
    diaMes,
    pularFeriados,
    dataInicio,
    dataFim,
    antecedencia,
    modelo.titulo,
    modelo.subtarefas.length,
    workflowId,
    cliente?.nome_empresa,
    cliente?.slug,
    hojeISO,
    conjuntoDeFeriados,
    workflows,
  ]);

  const faltam = faltaParaSalvar({ ...regraAtual, nome, clienteId }, modelo);

  function alternarDia(valor: number) {
    setDiasSemana((atual) =>
      atual.includes(valor)
        ? atual.filter((d) => d !== valor)
        : [...atual, valor].sort(),
    );
  }

  function trocarEtapa(indice: number, mudanca: Partial<EtapaDoModelo>) {
    setModelo((m) => ({
      ...m,
      subtarefas: m.subtarefas.map((e, i) =>
        i === indice ? { ...e, ...mudanca } : e,
      ),
    }));
  }

  function salvar() {
    if (faltam.length > 0) {
      toast.error(`Falta ${faltam.join(", ")}.`);
      return;
    }
    const dados = {
      nome: nome.trim(),
      client_id: clienteId,
      modo,
      frequencia,
      dias_semana: regraAtual.diasSemana,
      dia_mes: regraAtual.diaMes,
      pular_feriados: pularFeriados,
      data_inicio: dataInicio,
      data_fim: dataFim || null,
      antecedencia_dias: Number(antecedencia) || 0,
      gerar_como_rascunho: comoRascunho,
      task_type_id: workflowId,
      modelo,
    };

    iniciar(async () => {
      const r = await chamarAcao(() =>
        regra ? atualizarRecorrencia(regra.id, dados) : criarRecorrencia(dados),
      );
      if (r.ok) {
        toast.success(r.mensagem);
        router.push(VOLTAR);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={VOLTAR}>
              <ArrowLeft aria-hidden className="size-4" />
              Recorrências
            </Link>
          </Button>
          {regra ? <Badge variant="outline">Editando</Badge> : null}
          {!regra && partirDe ? (
            <Badge variant="outline">A partir de uma demanda</Badge>
          ) : null}
        </div>

        <SecaoDoFormulario numero={1} titulo="A regra">
          <p className="text-text-secondary text-sm">
            O nome é como ela aparece nesta lista — não é o título das demandas.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-nome">Nome da regra</Label>
              <Input
                id="rec-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Stories diários — Mundo Verde"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-cliente">Cliente</Label>
              <Select
                value={clienteId ?? SEM_VALOR}
                onValueChange={(v) => setClienteId(v === SEM_VALOR ? null : v)}
              >
                <SelectTrigger id="rec-cliente" className="w-full">
                  <SelectValue placeholder="Escolha o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_empresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SecaoDoFormulario>

        <SecaoDoFormulario numero={2} titulo="Como a demanda nasce">
          {/* RADIOGROUP DE CARTÕES, e não um select: a diferença entre os dois
              modos é o que a pessoa precisa ler para escolher, e um select a
              esconde atrás do clique. É a mesma decisão do tipo de pedido no
              Full Days. */}
          <div
            role="radiogroup"
            aria-label="Modo"
            className="grid gap-3 sm:grid-cols-2"
          >
            {MODOS.map((m) => {
              const ativo = m === modo;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setModo(m)}
                  className={
                    ativo
                      ? "border-primary bg-blue-soft rounded-xl border-2 p-3 text-left"
                      : "border-border hover:border-primary/40 rounded-xl border-2 p-3 text-left"
                  }
                >
                  <span className="text-text-primary block text-sm font-medium">
                    {ROTULOS_DE_MODO[m]}
                  </span>
                  <span className="text-text-secondary mt-1 block text-xs">
                    {EXPLICACAO_DO_MODO[m]}
                  </span>
                </button>
              );
            })}
          </div>
        </SecaoDoFormulario>

        <SecaoDoFormulario numero={3} titulo="Quando">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-frequencia">Frequência</Label>
              <Select
                value={frequencia}
                onValueChange={(v) => setFrequencia(v as RecorrenciaFrequencia)}
              >
                <SelectTrigger id="rec-frequencia" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIAS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {ROTULOS_DE_FREQUENCIA[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {frequencia === "mensal" ? (
              <div className="space-y-1.5">
                <Label htmlFor="rec-dia-mes">Dia do mês</Label>
                <Input
                  id="rec-dia-mes"
                  type="number"
                  min={1}
                  max={31}
                  value={diaMes}
                  onChange={(e) => setDiaMes(e.target.value)}
                />
                <p className="text-text-muted text-xs">
                  Dia 31 cai no último dia do mês curto — nunca pula para o mês
                  seguinte.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Dias da semana</Label>
                <div className="flex flex-wrap gap-1">
                  {DIAS_DA_SEMANA.map((d) => {
                    const ativo = diasSemana.includes(d.valor);
                    return (
                      <button
                        key={d.valor}
                        type="button"
                        aria-pressed={ativo}
                        aria-label={d.longo}
                        onClick={() => alternarDia(d.valor)}
                        className={
                          ativo
                            ? "bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 text-xs font-medium"
                            : "bg-muted text-text-secondary rounded-lg px-2.5 py-1.5 text-xs"
                        }
                      >
                        {d.curto}
                      </button>
                    );
                  })}
                </div>
                <p className="text-text-muted text-xs">
                  Nenhum dia marcado quer dizer todos os dias.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-inicio">Começa em</Label>
              <Input
                id="rec-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-fim">Termina em (opcional)</Label>
              <Input
                id="rec-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-antecedencia">
                Gerar com quantos dias de antecedência
              </Label>
              <Input
                id="rec-antecedencia"
                type="number"
                min={0}
                max={90}
                value={antecedencia}
                onChange={(e) => setAntecedencia(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            {/* Checkbox nativo, como no resto do produto. */}
            <input
              type="checkbox"
              className="accent-brand mt-0.5 size-4 shrink-0"
              checked={pularFeriados}
              onChange={(e) => setPularFeriados(e.target.checked)}
            />
            <span>
              Pular feriado
              <span className="text-text-muted block text-xs">
                Os feriados são os da tabela do Full Days, que vai até 2030.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-brand mt-0.5 size-4 shrink-0"
              checked={comoRascunho}
              onChange={(e) => setComoRascunho(e.target.checked)}
            />
            <span>
              Nascer como rascunho
              {/* O RASCUNHO É DE QUEM O CRIOU, e quem cria aqui é a rotina em
                  nome de quem configurou a regra. Marcar isto faz a demanda
                  esperar alguém abrir e publicar — útil quando o briefing muda
                  todo mês e a task gerada é só o esqueleto. */}
              <span className="text-text-muted block text-xs">
                Ela não entra no board da equipe até alguém abrir e clicar em
                Criar task.
              </span>
            </span>
          </label>
        </SecaoDoFormulario>

        <SecaoDoFormulario numero={4} titulo="A demanda que nasce">
          <div className="space-y-1.5">
            <Label htmlFor="rec-titulo">Título</Label>
            <Input
              id="rec-titulo"
              value={modelo.titulo}
              onChange={(e) =>
                setModelo((m) => ({ ...m, titulo: e.target.value }))
              }
              placeholder="Stories {MES}/{ANO} — {CLIENTE}"
            />
            {/* AS VARIÁVEIS FICAM AO LADO DO CAMPO, e não num texto de ajuda:
                uma variável que a pessoa não sabe que existe é uma variável que
                ninguém usa, e o título sai "Stories" repetido em doze meses
                iguais no board. */}
            <div className="flex flex-wrap gap-1 pt-1">
              {VARIAVEIS_DO_TITULO.map((v) => (
                <button
                  key={v.chave}
                  type="button"
                  title={`${v.explicacao} — ex.: ${v.exemplo}`}
                  onClick={() =>
                    setModelo((m) => ({
                      ...m,
                      titulo: `${m.titulo}${v.chave}`,
                    }))
                  }
                  className="bg-muted text-text-secondary hover:text-text-primary rounded px-1.5 py-0.5 font-mono text-xs"
                >
                  {v.chave}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rec-pasta">Pasta de entrega</Label>
              <Input
                id="rec-pasta"
                value={modelo.pasta_entrega}
                onChange={(e) =>
                  setModelo((m) => ({ ...m, pasta_entrega: e.target.value }))
                }
                placeholder="https://drive.google.com/..."
              />
              {/* OBRIGATÓRIA AQUI, e não só na task: a pasta é exigida desde a
                  0015, e uma regra sem ela erraria toda madrugada — em
                  silêncio, num histórico que ninguém abre. */}
              <p className="text-text-muted text-xs">
                Sem ela a geração falha todo dia, e o erro fica só no histórico
                da regra.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-responsavel">Responsável</Label>
              <Select
                value={modelo.responsavel_padrao ?? SEM_VALOR}
                onValueChange={(v) =>
                  setModelo((m) => ({
                    ...m,
                    responsavel_padrao: v === SEM_VALOR ? null : v,
                  }))
                }
              >
                <SelectTrigger id="rec-responsavel" className="w-full">
                  <SelectValue placeholder="Decidir etapa por etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VALOR}>
                    Decidir etapa por etapa
                  </SelectItem>
                  {equipe.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* FALLBACK, NUNCA SUBSTITUIÇÃO: quem escreveu o nome na etapa
                  mandou. O contrário faria preencher aqui apagar a
                  distribuição que alguém montou etapa por etapa. */}
              <p className="text-text-muted text-xs">
                Fica com as etapas que não tiverem dono. Onde você escolheu
                alguém, continua sendo essa pessoa.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rec-prioridade">Prioridade</Label>
              <Select
                value={modelo.prioridade}
                onValueChange={(v) =>
                  setModelo((m) => ({ ...m, prioridade: v as TaskPrioridade }))
                }
              >
                <SelectTrigger id="rec-prioridade" className="w-full">
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
            </div>
          </div>
        </SecaoDoFormulario>

        <SecaoDoFormulario
          numero={5}
          titulo={
            modo === "mensal_agrupada" ? "A etapa de cada dia" : "As etapas"
          }
          acao={
            modo === "task_por_ocorrencia" && !workflowId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setModelo((m) => ({
                    ...m,
                    subtarefas: [...m.subtarefas, etapaVazia()],
                  }))
                }
              >
                <Plus aria-hidden className="size-4" />
                Etapa
              </Button>
            ) : undefined
          }
        >
          {modo === "mensal_agrupada" ? (
            <>
              <p className="text-text-secondary text-sm">
                Uma task por mês, e dentro dela uma etapa por dia que a regra
                alcança. O título da etapa aceita as mesmas variáveis.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rec-diaria">Título da etapa</Label>
                  <Input
                    id="rec-diaria"
                    value={modelo.subtarefa_diaria?.titulo ?? ""}
                    onChange={(e) =>
                      setModelo((m) => ({
                        ...m,
                        subtarefa_diaria: {
                          ...(m.subtarefa_diaria ??
                            modeloVazio().subtarefa_diaria!),
                          titulo: e.target.value,
                        },
                      }))
                    }
                    placeholder="Entrega {DATA}"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-diaria-resp">Responsável</Label>
                  <Select
                    value={modelo.subtarefa_diaria?.responsavel_id ?? SEM_VALOR}
                    onValueChange={(v) =>
                      setModelo((m) => ({
                        ...m,
                        subtarefa_diaria: {
                          ...(m.subtarefa_diaria ??
                            modeloVazio().subtarefa_diaria!),
                          responsavel_id: v === SEM_VALOR ? null : v,
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="rec-diaria-resp" className="w-full">
                      <SelectValue placeholder="Sem responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VALOR}>Sem responsável</SelectItem>
                      {equipe.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rec-workflow">Partir de um workflow</Label>
                <Select
                  value={workflowId ?? SEM_VALOR}
                  onValueChange={(v) =>
                    setWorkflowId(v === SEM_VALOR ? null : v)
                  }
                >
                  <SelectTrigger id="rec-workflow" className="w-full">
                    <SelectValue placeholder="Montar as etapas à mão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>
                      Montar as etapas à mão
                    </SelectItem>
                    {workflows.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.nome} ({w.etapas} etapas)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* SNAPSHOT NA HORA DE GERAR, como toda aplicação de workflow:
                    editar o workflow depois muda as PRÓXIMAS demandas desta
                    regra, e nenhuma das que já saíram. */}
                <p className="text-text-muted text-xs">
                  O workflow é lido no momento de gerar. Editá-lo muda as
                  próximas demandas, nunca as que já saíram.
                </p>
              </div>

              {workflowId ? null : (
                <ul className="space-y-3">
                  {modelo.subtarefas.map((etapa, i) => (
                    <li
                      key={i}
                      className="border-border grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto]"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`etapa-${i}`}>Etapa {i + 1}</Label>
                        <Input
                          id={`etapa-${i}`}
                          value={etapa.titulo}
                          onChange={(e) =>
                            trocarEtapa(i, { titulo: e.target.value })
                          }
                          placeholder="Conceito"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`etapa-resp-${i}`}>Responsável</Label>
                        <Select
                          value={etapa.responsavel_id ?? SEM_VALOR}
                          onValueChange={(v) =>
                            trocarEtapa(i, {
                              responsavel_id: v === SEM_VALOR ? null : v,
                            })
                          }
                        >
                          <SelectTrigger
                            id={`etapa-resp-${i}`}
                            className="w-full"
                          >
                            <SelectValue placeholder="Sem responsável" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>
                              Sem responsável
                            </SelectItem>
                            {equipe.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`etapa-off-${i}`}>+ dias</Label>
                          <Input
                            id={`etapa-off-${i}`}
                            type="number"
                            className="w-20"
                            value={etapa.prazo_offset_dias}
                            onChange={(e) =>
                              trocarEtapa(i, {
                                prazo_offset_dias: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remover etapa ${i + 1}`}
                          onClick={() =>
                            setModelo((m) => ({
                              ...m,
                              subtarefas: m.subtarefas.filter(
                                (_, j) => j !== i,
                              ),
                            }))
                          }
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                  {modelo.subtarefas.length === 0 ? (
                    <li className="text-text-muted text-sm">
                      Nenhuma etapa ainda. Uma task por ocorrência precisa de
                      pelo menos uma.
                    </li>
                  ) : null}
                </ul>
              )}
            </>
          )}
        </SecaoDoFormulario>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="border-border bg-surface-card space-y-3 rounded-xl border p-4">
          <div>
            <h2 className="text-text-primary text-sm font-medium">
              As 5 próximas
            </h2>
            <p className="text-text-muted text-xs">
              Nada é gerado para trás: a primeira sai da próxima data que a
              regra alcançar.
            </p>
          </div>

          {previa.length === 0 ? (
            <p className="text-text-secondary flex items-start gap-2 text-sm">
              <CircleAlert
                aria-hidden
                className="text-warning mt-0.5 size-4 shrink-0"
              />
              Com esta configuração nenhuma demanda nasce. Confira a frequência,
              os dias e o período.
            </p>
          ) : (
            <ol className="space-y-2">
              {previa.map((o) => (
                <li
                  key={o.chave}
                  className="border-border border-t pt-2 first:border-t-0 first:pt-0"
                >
                  <p className="text-text-primary text-sm font-medium">
                    {o.titulo}
                  </p>
                  <p className="text-text-secondary text-xs">
                    {o.rotulo} ·{" "}
                    {o.subtarefas === 1 ? "1 etapa" : `${o.subtarefas} etapas`}
                  </p>
                  <p className="text-text-muted text-xs tabular-nums">
                    nasce em {format(o.geradaEm, "dd/MM", { locale: ptBR })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>

      {/* AS AÇÕES SÃO O TERCEIRO FILHO DA GRADE, e não o fim da coluna do
        formulário. Em 375px a grade vira uma pilha, e com as ações dentro da
        coluna o botão "Criar recorrência" ficava ACIMA da prévia — dava para
        salvar sem nunca ver as cinco próximas, que é a razão desta tela ter
        este formato. Foi a imagem de 375px que mostrou; no 1440 as duas
        colunas escondiam o problema. */}
      <div className="flex flex-wrap items-center gap-3 lg:col-start-1">
        <Button onClick={salvar} disabled={salvando || faltam.length > 0}>
          {salvando ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden className="size-4" />
          )}
          {regra ? "Salvar alterações" : "Criar recorrência"}
        </Button>
        <Button variant="ghost" asChild>
          <Link href={VOLTAR}>Cancelar</Link>
        </Button>
        {faltam.length > 0 ? (
          <p className="text-text-secondary text-sm">
            Falta {faltam.join(", ")}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
