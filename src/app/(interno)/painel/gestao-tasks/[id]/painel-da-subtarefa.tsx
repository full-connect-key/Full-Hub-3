"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { JSONContent } from "@tiptap/react";

import { EditorRico, VisualizadorRico } from "@/components/shared/editor-rico";
import { EnviarArquivos } from "@/components/shared/enviar-arquivos";
import { FaixaDeDisponibilidade } from "@/components/shared/faixa-de-disponibilidade";
import { SeletorDeResponsavel } from "@/components/shared/seletor-de-responsavel";
import { SeletorDeStatusDaSubtarefa } from "@/components/shared/seletor-de-status";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NomeEditavel } from "@/components/shared/nome-editavel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { chamarAcao } from "@/lib/acoes/cliente";
import { FAMILIAS } from "@/lib/dominio/arquivos";
import {
  fazASubtarefa,
  PRIORIDADES,
  ROTULOS_DE_PRIORIDADE,
} from "@/lib/dominio/tasks";
import {
  AJUDA_DE_TEMPO,
  formatarMinutos,
  tempoParaCampo,
} from "@/lib/dominio/tempo";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { Pessoa, SubtarefaDetalhada } from "@/lib/dados/tasks";
import { HistoricoDeAprovacoes } from "@/components/shared/historico-de-aprovacoes";
import { comoHistorico, daSubtarefa } from "@/lib/aprovacoes/conteudo";
import type { SubtaskStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  anexarEntrega,
  atualizarSubtarefa,
  mudarResponsavelExtra,
  buscarDisponibilidade,
  desvincularDependencia,
  moverSubtarefa,
  removerEntrega,
  vincularDependencia,
} from "../acoes-de-itens";

const SEM_VALOR = "__sem__";

/**
 * O painel da subtarefa.
 *
 * Abre por cima do detalhe da Task, sem trocar de página: quem está olhando a
 * demanda inteira não perde o contexto ao conferir uma etapa.
 *
 * Ver é aberto, agir é restrito — qualquer pessoa da equipe abre e lê; os
 * campos só ficam editáveis para quem gerencia a demanda ou é responsável por
 * esta etapa, e o botão de ação sai da máquina de estados.
 */
export function PainelDaSubtarefa({
  subtarefa,
  taskId,
  equipe,
  irmas,
  podeGerenciar,
  usuarioId,
  aoFechar,
}: {
  subtarefa: SubtarefaDetalhada;
  taskId: string;
  equipe: Pessoa[];
  /** As outras subtarefas da mesma Task, para montar dependência. */
  irmas: SubtarefaDetalhada[];
  podeGerenciar: boolean;
  usuarioId: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [link, setLink] = useState("");

  // AS DUAS PESSOAS DA ETAPA, e não só a primeira (0114 + 0121).
  //
  // Era `subtarefa.responsavel_id === usuarioId`, que é a COLUNA — e desde a
  // 0114 ela é apenas a primeira pessoa. A segunda via a etapa em Minhas
  // Tasks, contava na carga dela, e esta tela desligava os campos para ela.
  // É a mesma pergunta que `subtask_entregas_insert` faz no banco.
  const souOResponsavel = fazASubtarefa(subtarefa, usuarioId);
  const podeMexer = podeGerenciar || souOResponsavel;

  function trocarStatus(destino: SubtaskStatus) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        moverSubtarefa(subtarefa.id, taskId, destino),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  /* --------------------------------------------------------------------------
     O RASCUNHO DAS PROPRIEDADES, e o botão que o oficializa.

     Decisão do usuário: *"quero que na subtarefas, quando a pessoa edite algo,
     ela tenho o botão de salvar para oficializar as alterações"*.

     **ISTO DESFAZ METADE DE UMA DECISÃO ESCRITA, e o recorte é a outra
     metade.** A 0028 pôs a tela de task a salvar sozinha, campo a campo, com a
     razão registrada: *"a demanda nasce como rascunho no instante do clique e
     a pessoa cai na tela completa"* — ali não há botão porque não há momento
     de confirmar: a linha já existe no banco e cada campo é um fato isolado.

     **A etapa não é aquilo.** Ela tem cinco propriedades que se leem juntas e
     se decidem juntas — quem faz, com que prioridade, de quando a quando, em
     quantas horas —, e o período tem duas pontas que o `check subtasks_periodo`
     compara entre si: gravar uma ponta por vez é gravar metade de uma decisão.
     Um botão aqui não é cerimônia, é a transação que o campo a campo não
     tinha.

     **O QUE O BOTÃO NÃO OWNA, e cada ausência tem motivo:**

       * o **nome**, que é `NomeEditavel` — ele salva com 600 ms de pausa mais
         o `blur` desde a 0028, é compartilhado com a tela da demanda, e dois
         jeitos de gravar o mesmo campo em duas telas é a divergência que
         aquele componente existe para não ter;
       * o **status**, que é AÇÃO e não propriedade: ele passa por
         `moverSubtarefa`, cujas travas recusam transições e cuja recusa diz o
         caminho — um Salvar por cima disso esconderia a recusa atrás de um
         segundo clique;
       * as **dependências**, as **entregas** e a **segunda pessoa**, que são
         acrescentar e tirar, cada uma com a ação dela. Um "Salvar" acima de um
         botão que acabou de remover uma dependência prometeria que a remoção
         ainda não aconteceu.

     **O rascunho guarda SÓ o que foi tocado** — `undefined` quer dizer "não
     mexi" —, então salvar manda ao banco exatamente os campos que mudaram, e
     a trilha de auditoria não registra alteração em campo que ninguém editou.
     É a razão pela qual `NomeEditavel` compara antes de gravar.
     -------------------------------------------------------------------------- */
  type Rascunho = {
    responsavel_id?: string | null;
    prioridade?: string;
    data_inicio?: string;
    prazo?: string;
    estimativa?: string;
  };
  const [rascunho, setRascunho] = useState<Rascunho>({});

  /* --------------------------------------------------------------------------
     O BRIEFING ENTRA NO MESMO SALVAR, e não ganha um botão próprio.

     Decisão do usuário: *"quando abro uma subetapa, na subtarefa, preciso
     poder escrever um briefing, escrever texto, como na etapa normal"*.

     **ELE PEDE O EDITOR E NÃO O BOTÃO**, e a diferença decide o desenho: o
     briefing da DEMANDA tem botão próprio porque aquela tela não tem nenhum —
     ela salva campo a campo desde a 0028, e ali o botão do briefing é o único
     momento de confirmar que existe. **Este modal já tem um**, e um segundo
     faria a barra do pé contar "2 alterações por salvar" sobre um briefing que
     ela não grava: uma alteração pendente que o aviso de alteração pendente
     não conhece é pior que aviso nenhum, e o custo escrito deste modal —
     *fechar com alteração pendente DESCARTA, sem perguntar* — passaria a valer
     para duas coisas e a ser explicado por uma.

     **O VALOR MORA NUM `ref` E O AVISO NUM ESTADO**, que é a forma do briefing
     da demanda: o `onChange` do TipTap dispara a cada tecla, e pô-lo no
     `useState` do rascunho re-renderizaria o modal inteiro — com a faixa de
     disponibilidade e o histórico de rodadas dentro — a cada letra digitada. O
     booleano vira UMA vez, na primeira tecla, e é ele que a barra conta.

     **E AS DUAS COLUNAS ANDAM JUNTAS.** `descricao_texto` é o que a busca lê e
     `descricao_rica` é o que a tela desenha; gravar uma sem a outra deixaria o
     briefing invisível para um dos dois lados — e `atualizarSubtarefa` aceita
     as duas desde o Sprint 3B, sem nunca ter recebido nenhuma. É a ponte
     construída e não atravessada pela vigésima primeira vez: nenhuma migration
     nesta entrega, nenhuma coluna nova, nenhuma linha em `lib/dados/`.
     -------------------------------------------------------------------------- */
  const briefing = useRef<{ json: JSONContent; texto: string } | null>(null);
  const [briefingMexido, setBriefingMexido] = useState(false);

  const mexidos = Object.keys(rascunho).length + (briefingMexido ? 1 : 0);

  function mexer(campos: Rascunho) {
    setRascunho((atual) => ({ ...atual, ...campos }));
  }

  function descartar() {
    setRascunho({});
    setBriefingMexido(false);
    briefing.current = null;
  }

  function oficializar() {
    if (mexidos === 0) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        atualizarSubtarefa(subtarefa.id, taskId, {
          ...rascunho,
          ...(briefingMexido && briefing.current
            ? {
                descricao_rica: briefing.current.json,
                // O TEXTO VAZIO VIRA NULO, e o rico não: um documento do
                // TipTap sem nada dentro ainda é um parágrafo vazio, e
                // guardá-lo é guardar o formato do nada. O que decide se há
                // briefing é o texto.
                descricao_texto: briefing.current.texto.trim() || null,
              }
            : {}),
        }),
      );
      if (!resultado.ok) {
        // O RASCUNHO FICA NA TELA quando o banco recusa, e é a regra desta
        // casa: o valor que falhou continua à vista para ser corrigido, em vez
        // de a tela voltar ao antigo e a pessoa redigitar o que ela já havia
        // escrito. É a decisão de `NomeEditavel`.
        toast.error(resultado.error);
        return;
      }
      descartar();
      toast.success(resultado.mensagem);
      router.refresh();
    });
  }

  /** O valor que o campo mostra: o rascunho quando há, o do banco quando não. */
  const valor = {
    responsavel_id:
      rascunho.responsavel_id !== undefined
        ? rascunho.responsavel_id
        : subtarefa.responsavel_id,
    prioridade: rascunho.prioridade ?? subtarefa.prioridade,
    data_inicio: rascunho.data_inicio ?? subtarefa.data_inicio ?? "",
    prazo: rascunho.prazo ?? subtarefa.prazo ?? "",
    estimativa:
      rascunho.estimativa ?? tempoParaCampo(subtarefa.estimativa_minutos),
  };

  /**
   * Põe ou tira a segunda pessoa (0114).
   *
   * Ela não passa por `salvar()` porque a escrita é em OUTRA tabela: `salvar`
   * manda campos para `atualizarSubtarefa`, e um `responsaveis` ali passaria a
   * escrever nos dois lugares pela mesma ação — com o gatilho que mantém a
   * coluna em dia escrevendo de volta, a ordem entre os dois viraria a coisa
   * que decide o resultado.
   */
  function mudarExtra(usuarioId: string, entra: boolean) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        mudarResponsavelExtra(subtarefa.id, taskId, usuarioId, entra),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      {/* ------------------------------------------------------------------
          MODAL CENTRALIZADO, e não mais a gaveta da direita.

          A gaveta tinha 512px e a etapa tem doze campos: metade deles vivia
          abaixo da dobra, e os dois que mais se mexem — o período e a faixa
          de disponibilidade — eram justamente os que pediam rolagem. No
          centro a caixa chega a 768px e a grade abre em duas colunas, então o
          que se edita cabe junto.

          **E ELA ABRE POR CIMA, inclusive do painel de Minhas Tasks.** Lá a
          linha abre a DEMANDA inteira — decisão escrita, *"clicar abre o
          painel com ela inteira, onde se vê o que as outras pessoas estão
          fazendo nela"* —, e a etapa de dentro abria uma segunda gaveta por
          cima da primeira: duas gavetas do mesmo lado, uma comendo a outra.
          Um modal centralizado por cima de uma gaveta se lê como o que é.

          A altura é limitada em 85vh com rolagem PRÓPRIA: sem isso, numa
          etapa com seis rodadas a caixa passa da janela e o topo — que é onde
          está o nome — sai da tela. */}
      <DialogContent
        className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        // O FOCO NÃO VAI PARA O NOME. O Radix foca o primeiro elemento
        // focável ao abrir, e aqui ele é o campo do nome — com o texto
        // selecionado, então a primeira tecla apagaria o nome da etapa. O
        // foco fica na própria caixa (ela é `tabIndex={-1}`), que é o que o
        // leitor de tela anuncia e de onde o Tab começa.
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          (evento.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="px-4 pt-4 pr-12">
          {/* O NOME SE EDITA AQUI. Ele era um `SheetTitle` — texto morto —,
              e a única forma de corrigir uma etapa com o nome errado era
              apagar e criar outra, o que levava junto o tempo medido, as
              dependências e as rodadas.

              O `DialogTitle` continua existindo, `sr-only`: sem ele o Radix
              acusa um diálogo sem nome acessível, e o `<input>` abaixo não
              serve de título — ele é um campo, e o leitor de tela anuncia o
              valor dele, não o nome da janela. */}
          <DialogTitle className="sr-only">
            {subtarefa.titulo || "Etapa sem nome"}
          </DialogTitle>
          <NomeEditavel
            valor={subtarefa.titulo}
            podeEditar={podeMexer}
            rotulo="Nome da etapa"
            placeholder="Nome da etapa"
            className="text-lg font-semibold md:text-lg"
            comoTexto={(texto) => (
              <p className="px-2 py-1 text-lg font-semibold text-balance">
                {texto}
              </p>
            )}
            aoGravar={async (novo) => {
              const resultado = await chamarAcao(() =>
                atualizarSubtarefa(subtarefa.id, taskId, { titulo: novo }),
              );
              if (!resultado.ok) {
                toast.error(resultado.error);
                return resultado.error;
              }
              router.refresh();
              return null;
            }}
          />
          <DialogDescription className="flex flex-wrap items-center gap-2 px-2">
            {/* O SELO É O SELETOR, como na linha do detalhe da Task. Era um
                selo morto com um botão "Iniciar" logo abaixo dizendo a mesma
                coisa por outro caminho — dois controles para um andamento só,
                um deles ocupando uma linha inteira do painel. */}
            <SeletorDeStatusDaSubtarefa
              status={subtarefa.status}
              podeEditar={podeMexer}
              aoMudar={trocarStatus}
              compacto
            />
            {subtarefa.requer_aprovacao ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" aria-hidden />
                Requer aprovação:{" "}
                {ROTULO_DA_APROVACAO[subtarefa.tipo_aprovacao ?? "interna"]}
              </Badge>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-4 pb-6">
          {subtarefa.dependenciasAbertas.length > 0 ? (
            <p className="bg-warning-soft text-warning border-transparent rounded-md border px-3 py-2 text-sm">
              Aguardando: {subtarefa.dependenciasAbertas.join(", ")}. Enquanto
              isso, ela não inicia.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Responsável">
              {/* O MESMO SELETOR DA LINHA DA LISTA, e o que muda é quando ele
                  grava: aqui ele só marca a escolha, e quem oficializa é o
                  Salvar — é a assimetria escrita no próprio componente, a
                  mesma de `FaixaDeDisponibilidade`. Duas cópias divergiriam, e
                  a que divergiria é a da linha, que se relê menos. */}
              <SeletorDeResponsavel
                valor={valor.responsavel_id}
                /* Como na linha: `equipe` é quem está ativo, e quem responde
                   por esta etapa pode não estar nela. */
                atual={subtarefa.responsavel}
                equipe={equipe}
                aoMudar={(quem) => mexer({ responsavel_id: quem })}
                podeEditar={podeGerenciar}
              />

              {/* ----------------------------------------------------------
                  QUEM MAIS FAZ ESTA ETAPA (0114).

                  **Ela mora DENTRO do campo Responsável, e não ao lado**: é a
                  mesma pergunta — quem faz isto —, e um segundo campo chamado
                  "Outros responsáveis" na grade faria a etapa parecer ter dois
                  conceitos de dono. O seletor de cima continua significando o
                  que sempre significou: trocar nele TROCA a pessoa, e o
                  gatilho da 0114 tira a antiga.

                  **E a linha some quando não há ninguém a mais**, em vez de
                  um "nenhum" permanente: a segunda pessoa é a exceção, e um
                  rótulo que aparece sempre para dizer que não há nada é o que
                  gasta a linha de toda etapa da agência.
                  ---------------------------------------------------------- */}
              {subtarefa.outrosResponsaveis.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {subtarefa.outrosResponsaveis.map((pessoa) => (
                    <li
                      key={pessoa.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <UserAvatar
                        name={pessoa.nome}
                        src={pessoa.avatar_url}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {pessoa.nome}
                      </span>
                      {podeGerenciar ? (
                        <button
                          type="button"
                          onClick={() => mudarExtra(pessoa.id, false)}
                          className="text-text-muted hover:text-danger shrink-0 transition-colors"
                          aria-label={`Tirar ${pessoa.nome} desta etapa`}
                        >
                          <X aria-hidden className="size-4" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {podeGerenciar && subtarefa.responsavel_id ? (
                <Select
                  value={SEM_VALOR}
                  onValueChange={(valor) => mudarExtra(valor, true)}
                >
                  <SelectTrigger
                    aria-label="Acrescentar outra pessoa a esta etapa"
                    className="mt-2 w-full"
                  >
                    <span className="text-text-muted inline-flex items-center gap-1.5 text-sm">
                      <Plus aria-hidden className="size-4" />
                      Mais alguém nesta etapa
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {/* QUEM JÁ ESTÁ FICA FORA DA LISTA, e não aparece
                        desabilitado: a chave de `subtask_responsaveis` é
                        composta, então o banco recusaria — e oferecer um
                        caminho que termina em recusa é o que a tela existe
                        para não fazer. */}
                    {equipe
                      .filter(
                        (pessoa) =>
                          pessoa.id !== subtarefa.responsavel_id &&
                          !subtarefa.outrosResponsaveis.some(
                            (o) => o.id === pessoa.id,
                          ),
                      )
                      .map((pessoa) => (
                        <SelectItem key={pessoa.id} value={pessoa.id}>
                          {pessoa.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : null}
            </Campo>

            <Campo rotulo="Prioridade">
              {podeGerenciar ? (
                <Select
                  value={valor.prioridade}
                  onValueChange={(escolhida) =>
                    mexer({ prioridade: escolhida })
                  }
                >
                  <SelectTrigger aria-label="Prioridade" className="w-full">
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
              ) : (
                <span className="text-sm">
                  {ROTULOS_DE_PRIORIDADE[subtarefa.prioridade]}
                </span>
              )}
            </Campo>

            {/* O PERÍODO da etapa (migration 0027), e não só o prazo. Duas etapas
                com o mesmo prazo podem ser uma de três dias e uma de três
                horas — sem o início, quem monta a agenda da semana tem
                metade da informação.

                Os dois continuam opcionais: quem abre a demanda costuma
                saber a data de entrega e ainda não saber quando cada etapa
                começa, e exigir as duas faria a pessoa inventar uma. */}
            <Campo rotulo="Início">
              {podeGerenciar ? (
                /* CONTROLADO e não `defaultValue`: com o rascunho, Descartar
                   precisa devolver o campo ao valor do banco — e um input
                   não controlado ficaria mostrando o que a pessoa digitou
                   depois de a tela já ter desistido dele. */
                <Input
                  type="date"
                  aria-label="Data de início da etapa"
                  value={valor.data_inicio}
                  onChange={(evento) =>
                    mexer({ data_inicio: evento.target.value })
                  }
                />
              ) : (
                <span className="text-sm">
                  {subtarefa.data_inicio
                    ? format(parseISO(subtarefa.data_inicio), "dd/MM/yyyy", {
                        locale: ptBR,
                      })
                    : "—"}
                </span>
              )}
            </Campo>

            <Campo rotulo="Prazo">
              {podeGerenciar ? (
                <Input
                  type="date"
                  aria-label="Prazo da etapa"
                  value={valor.prazo}
                  onChange={(evento) => mexer({ prazo: evento.target.value })}
                />
              ) : (
                <span className="text-sm">
                  {subtarefa.prazo
                    ? format(parseISO(subtarefa.prazo), "dd/MM/yyyy", {
                        locale: ptBR,
                      })
                    : "—"}
                </span>
              )}
            </Campo>
          </div>

          {/* OS DIAS DE QUEM VAI RECEBER O TRABALHO (migration 0081).

              Ela nasce no instante em que há responsável, e só para quem pode
              gerenciar: para quem não pode, os campos de data são texto e um
              calendário que não escreve nada seria a agenda de um colega
              exposta sem motivo.

              ELA ENTRA LOGO DEPOIS DO INÍCIO E DO PRAZO, e a grade de campos
              se parte em duas por causa disso. É a ordem da decisão: escolher
              a pessoa, ver os dias dela, escrever a data — e os dois campos
              que o clique no dia preenche ficam encostados nela. Acima dos
              campos ela responderia sobre um responsável que ainda não
              existe; lá embaixo, depois da estimativa e das dependências,
              ninguém a veria ao datar. */}
          {podeGerenciar && subtarefa.responsavel ? (
            <FaixaDeDisponibilidade
              userId={subtarefa.responsavel.id}
              nome={subtarefa.responsavel.nome}
              /* ELA MOSTRA O RASCUNHO, e não o que está no banco: quem
                 acabou de escrever uma data no campo ao lado precisa ver a
                 faixa pintada nela, senão as duas metades da mesma decisão
                 discordariam a dois centímetros de distância. */
              inicio={valor.data_inicio || null}
              fim={valor.prazo || null}
              /*
               * O CLIQUE PREENCHE OS DOIS CAMPOS, e quem grava é o Salvar.
               *
               * Isto é a decisão da faixa cumprida ao pé da letra — *"ELA NÃO
               * DECIDE O QUE FAZER COM AS DUAS PONTAS"* —, e desfaz pela
               * metade a nota que estava aqui: ela dizia que *"neste painel o
               * clique É o salvamento (0028), e meio período gravado é um
               * período que o `check subtasks_periodo` pode recusar"*.
               *
               * **O argumento era bom e virou desnecessário:** com o botão,
               * as duas pontas vão ao banco na MESMA escrita, então não existe
               * mais o estado de meio período gravado que o `check` recusaria.
               * O primeiro clique continua fechando um período de um dia,
               * porque a faixa devolve `fim` nulo na primeira ponta e um
               * `prazo` em branco ao lado de um início não é uma data: é um
               * campo pela metade esperando o segundo clique.
               */
              aoEscolher={(de: string, ate: string | null) =>
                mexer({ data_inicio: de, prazo: ate ?? de })
              }
              rotuloDoClique="Clique num dia para abrir o período e noutro para fechar. O Salvar grava."
              buscar={buscarDisponibilidade}
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Estimativa">
              {podeMexer ? (
                <Input
                  value={valor.estimativa}
                  placeholder="2h30"
                  // O rotulo do Campo e texto solto, nao um <label for>: sem isto o
                  // unico nome do campo seria o title, que so existe para quem
                  // tem mouse e paira sobre ele.
                  aria-label="Estimativa"
                  title={AJUDA_DE_TEMPO}
                  onChange={(evento) =>
                    mexer({ estimativa: evento.target.value })
                  }
                />
              ) : (
                <span className="text-sm">
                  {formatarMinutos(subtarefa.estimativa_minutos)}
                </span>
              )}
            </Campo>
          </div>

          {subtarefa.tempo_real_minutos !== null ? (
            <p className="text-muted-foreground text-xs">
              Tempo real registrado:{" "}
              {formatarMinutos(subtarefa.tempo_real_minutos)}.
            </p>
          ) : null}

          <Separator />

          {/* Briefing ---------------------------------------------------
              ELE VEM ANTES DAS LISTAS, e a ordem é a da demanda um nível
              acima: o que a etapa É antes do que ela depende, entrega e já
              decidiu. Lido depois das rodadas, o briefing seria a última
              coisa da tela — e é a primeira que quem vai produzir procura.

              **E ELE NÃO SOME QUANDO ESTÁ VAZIO**, ao contrário do briefing
              da campanha: ali a seção some porque a campanha anterior à 0125
              não tem nenhum dos sete campos e sete rótulos com um travessão
              embaixo ocupariam a tela toda; aqui o campo vazio é onde se
              escreve, e escondê-lo esconderia o pedido inteiro. Para quem não
              edita, a ausência vira a frase — que é o que a tela sabe. */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Briefing</h3>
            {podeMexer ? (
              <EditorRico
                conteudo={
                  (subtarefa.descricao_rica as JSONContent | null) ?? null
                }
                placeholder="O que precisa ser feito nesta etapa…"
                onChange={(dados) => {
                  briefing.current = dados;
                  if (!briefingMexido) setBriefingMexido(true);
                }}
              />
            ) : subtarefa.descricao_rica ? (
              <div className="rounded-lg border p-4">
                <VisualizadorRico
                  conteudo={subtarefa.descricao_rica as JSONContent}
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sem briefing.</p>
            )}
          </section>

          {/* ----------------------------------------------------------------
              O BOTÃO QUE OFICIALIZA, e ele fica AQUI e não no pé do modal.

              Ele governa as seis coisas acima e mais nada — e no fim da
              caixa, depois das dependências, das entregas e do histórico, ele
              pareceria salvar aquilo também.

              **E O BRIEFING FICA ACIMA DELE, e não abaixo.** Ele é a sexta
              coisa que este botão grava, e a imagem mostrou o preço de pô-lo
              do outro lado: com o rascunho vazio a barra não gruda, então ela
              saía no meio do modal com o editor embaixo — a tela dizendo que
              o briefing não é do Salvar. É o uploader do Acervo palavra por
              palavra: *"o botão morava na linha do seletor de arquivo, e as
              duas coisas que ele grava ficavam ABAIXO dele"*. Tudo o que a
              barra grava fica acima dela. É a decisão do detalhe da Task
              palavra por palavra: *"excluir e 'salvar como workflow' não são
              propriedades, são ações sobre a demanda: no meio dos campos
              pareciam mais dois campos"* — vista do avesso, uma ação que É
              sobre os campos fica junto deles.

              **ELE APARECE SEMPRE, desligado quando não há o que salvar.** A
              regra desta casa é pintar a exceção, e aqui ela não vale: uma
              barra que só nasce depois da primeira edição é uma barra que a
              pessoa descobre DEPOIS de ter editado — e até lá ela não sabe que
              o modal passou a ter um momento de confirmar. Desligado, ele
              ensina que existe; e o rótulo conta quantos campos vão junto, que
              é a diferença entre um botão e uma instrução.

              **E ELE GRUDA NO PÉ ENQUANTO HÁ RASCUNHO.** A caixa rola dentro
              de si (85vh), e a etapa tem doze campos: sem isto, editar o
              responsável e rolar até o histórico tiraria o Salvar da tela —
              e fechar o modal perderia a edição sem nada ter avisado. Grudado,
              fechar com alteração pendente passa a ser um ato deliberado.

              *O que isto custa, e é dito em vez de escondido:* fechar o modal
              com o rascunho aberto DESCARTA a edição, sem perguntar. Não há
              guarda de saída — e a razão é que uma pergunta "tem certeza?" num
              diálogo que já mostra o que não foi salvo é a cerimônia que o
              nome digitado do `ConfirmDialog` já custou uma vez.
              ---------------------------------------------------------------- */}
          {podeGerenciar ? (
            <div
              className={cn(
                "flex flex-wrap items-center justify-end gap-2",
                mexidos > 0 &&
                  "bg-card/95 sticky bottom-0 -mx-4 border-t px-4 py-3 backdrop-blur",
              )}
            >
              {mexidos > 0 ? (
                <p className="text-warning mr-auto text-xs">
                  {mexidos} alteraç{mexidos === 1 ? "ão" : "ões"} por salvar.
                </p>
              ) : null}
              {mexidos > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={salvando}
                  onClick={descartar}
                >
                  Descartar
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={salvando || mexidos === 0}
                onClick={oficializar}
              >
                {salvando ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                Salvar
              </Button>
            </div>
          ) : null}

          <Separator />

          {/* Dependências ---------------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Depende de</h3>
            {subtarefa.dependeDe.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nada. Ela pode começar quando quiserem.
              </p>
            ) : (
              <ul className="space-y-1">
                {subtarefa.dependeDe.map((dep) => (
                  <li key={dep.id} className="flex items-center gap-2 text-sm">
                    <Link2
                      className="text-muted-foreground size-3.5"
                      aria-hidden
                    />
                    <span
                      className={
                        dep.status === "concluida"
                          ? "text-muted-foreground"
                          : ""
                      }
                    >
                      {dep.titulo}
                    </span>
                    <StatusBadge status={dep.status} />
                    {podeGerenciar ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Desvincular ${dep.titulo}`}
                        onClick={() =>
                          iniciar(async () => {
                            const r = await chamarAcao(() =>
                              desvincularDependencia(
                                taskId,
                                subtarefa.id,
                                dep.id,
                              ),
                            );
                            if (!r.ok) toast.error(r.error);
                            else router.refresh();
                          })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {podeGerenciar ? (
              <Select
                value={SEM_VALOR}
                onValueChange={(valor) =>
                  iniciar(async () => {
                    const r = await chamarAcao(() =>
                      vincularDependencia(taskId, subtarefa.id, valor),
                    );
                    if (!r.ok) toast.error(r.error);
                    else router.refresh();
                  })
                }
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Adicionar dependência"
                >
                  <SelectValue placeholder="Adicionar dependência…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VALOR} disabled>
                    Adicionar dependência…
                  </SelectItem>
                  {irmas
                    .filter(
                      (i) =>
                        i.id !== subtarefa.id &&
                        !subtarefa.dependeDe.some((d) => d.id === i.id),
                    )
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.titulo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : null}
          </section>

          <Separator />

          {/* Entregas -------------------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Entregas</h3>
            {subtarefa.entregas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nada anexado ainda. É o que quem aprova vai olhar.
              </p>
            ) : (
              <ul className="space-y-1">
                {subtarefa.entregas.map((entrega) => (
                  <li
                    key={entrega.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Paperclip
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-hidden
                    />
                    {/* O ENDEREÇO É O ASSINADO, e não o `url` cru (0121): um
                        arquivo do bucket tem como `url` o CAMINHO, e pô-lo
                        num `href` é um link que não leva a lugar nenhum. O
                        link do Drive atravessa a mesma função sem assinatura.

                        Sem `assinado`, a assinatura falhou — e aí o nome fica
                        como texto, em vez de virar um link quebrado. */}
                    {entrega.assinado ? (
                      <a
                        href={entrega.assinado}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-accent-strong min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                      >
                        {entrega.nome ?? entrega.url}
                      </a>
                    ) : (
                      <span className="text-muted-foreground min-w-0 flex-1 truncate">
                        {entrega.nome ?? entrega.url}
                      </span>
                    )}
                    <ExternalLink
                      className="text-muted-foreground size-3 shrink-0"
                      aria-hidden
                    />
                    {/* O BOTÃO SOME NO ARQUIVO QUE JÁ SAIU, em vez de aparecer
                        desligado: a razão não é um passo que falta, é uma
                        porta que fechou — a mesma distinção do "cancelar" do
                        Day Off. Quem recusa de verdade é o gatilho
                        `subtask_entregas_nao_apaga_enviada` (0121), e a
                        recusa dele nomeia a rodada. */}
                    {podeMexer && entrega.approval_round_id === null ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Remover entrega"
                        onClick={() =>
                          iniciar(async () => {
                            const r = await chamarAcao(() =>
                              removerEntrega(entrega.id, taskId),
                            );
                            if (!r.ok) toast.error(r.error);
                            else router.refresh();
                          })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {podeMexer ? (
              <div className="space-y-2">
                {/* O ARQUIVO VEM PRIMEIRO, E O LINK DEPOIS.
                    `subtask_entregas.tipo` aceita os dois desde a 0007 e, até
                    aqui, SÓ O LINK tinha tela — o valor `'arquivo'` estava no
                    `check` e nenhum caminho do produto o produzia. A ordem é a
                    do uso: o normal é subir o que se acabou de produzir; o
                    link é o material que mora no Drive do cliente.

                    AS CINCO FAMÍLIAS, como na peça de campanha e pela mesma
                    razão escrita lá: a entrega de uma etapa é PDF, PSD, AI,
                    ZIP, INDD — e uma lista fechada erraria na primeira
                    extensão que a agência passasse a usar. */}
                <EnviarArquivos
                  bucket="task-arquivos"
                  caminho={(arquivo, i) =>
                    // `entregas/<subtask_id>/...` É A CONVENÇÃO DA 0007, e ela
                    // é o que deixa a policy do Storage decidir por etapa sem
                    // tabela intermediária: `"task-arquivos: cliente le
                    // entrega"` compara `(storage.foldername(name))[2]` com
                    // `subtask_visivel_ao_cliente()`. Fora dessa pasta, o
                    // arquivo fica invisível para o cliente — e a Biblioteca
                    // dele mostraria um cartão sem nada para baixar.
                    //
                    // O nome do arquivo fica inteiro no fim, como nas
                    // referências: é ele que o cliente lê no "Baixar".
                    `entregas/${subtarefa.id}/${Date.now()}-${i}-${arquivo.name}`
                  }
                  familias={FAMILIAS}
                  varios
                  rotulo="Anexar arquivos"
                  rotuloDoCampo="Arquivos da entrega"
                  desabilitado={salvando}
                  onPronto={(arquivos) => {
                    iniciar(async () => {
                      for (const arquivo of arquivos) {
                        const r = await chamarAcao(() =>
                          anexarEntrega(taskId, subtarefa.id, {
                            tipo: "arquivo",
                            url: arquivo.url,
                            nome: arquivo.nome,
                          }),
                        );
                        if (!r.ok) {
                          toast.error(r.error);
                          return;
                        }
                      }
                      router.refresh();
                    });
                  }}
                />

                <form
                  className="flex gap-2"
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    if (!link.trim()) return;
                    iniciar(async () => {
                      const r = await chamarAcao(() =>
                        anexarEntrega(taskId, subtarefa.id, {
                          tipo: "link",
                          url: link,
                        }),
                      );
                      if (!r.ok) toast.error(r.error);
                      else {
                        setLink("");
                        router.refresh();
                      }
                    });
                  }}
                >
                  <Input
                    value={link}
                    onChange={(evento) => setLink(evento.target.value)}
                    placeholder="https://…"
                    aria-label="Link da entrega"
                  />
                  <Button type="submit" variant="outline" disabled={salvando}>
                    {salvando ? <Loader2 className="animate-spin" /> : null}
                    Anexar
                  </Button>
                </form>
              </div>
            ) : null}
          </section>

          <Separator />

          {/* Rodadas de aprovação -------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Rodadas de aprovação</h3>
            <HistoricoDeAprovacoes
              conteudo={daSubtarefa(subtarefa.id)}
              rodadas={comoHistorico(subtarefa.rodadas)}
              vazio={
                subtarefa.requer_aprovacao
                  ? "Nenhuma rodada ainda."
                  : "Esta subtarefa não passa por aprovação."
              }
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{rotulo}</Label>
      {children}
    </div>
  );
}
