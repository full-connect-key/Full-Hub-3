"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CircleAlert,
  Loader2,
  Lock,
  Repeat,
  Save,
  TriangleAlert,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
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
import { chamarEMostrar } from "@/lib/acoes/cliente";
import { FUNCOES, ROTULOS_DE_FUNCAO } from "@/lib/dominio/equipe";
import { PRAZO_DE_APROVACAO_PADRAO } from "@/lib/dominio/fluxo-do-cliente";
import type { FluxoDaConta, PadroesDaConta, RecorrenciaDaConta } from "@/lib/dados/fluxo-do-cliente";
import type { TeamFuncao, UserRole } from "@/lib/supabase/database.types";

import { definirFuncaoDaConta, duplicarFluxoParaAConta, salvarPadroesDaConta } from "./acoes-do-fluxo";

/**
 * Configurações do fluxo de uma conta (migration 0064).
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTA ABA RESOLVE, e é o pedido inteiro em uma frase: abrir uma demanda
 * para a Mundo Verde e ter que escolher à mão, toda vez, a mesma social media e
 * o mesmo redator.
 *
 * Ela guarda os **padrões da conta**, e padrão é a palavra exata: a pessoa
 * escrita na etapa do workflow continua vencendo, e o que está aqui só preenche
 * o que ficou em branco. A ordem é a mesma nos dois lados —
 * `etapas_resolvidas_do_workflow()` no Postgres, `fluxosDaConta()` aqui —,
 * porque a tela precisa dizer qual fluxo vai nascer com etapa órfã ANTES de
 * alguém aplicá-lo.
 *
 * **O editor de fluxo NÃO mora aqui**, e a seção 2 é uma lista com link para
 * `/painel/gestao-tasks?aba=workflows`. Dois editores da mesma cadeia divergiriam na primeira
 * mudança, e a divergência apareceria no que a demanda nasce fazendo.
 *
 * **Nada aqui bloqueia a abertura de demanda.** Função sem dono é aviso, não
 * recusa: a etapa nasce sem responsável, que é visível, e quem abre resolve na
 * hora. Travar deixaria o cliente sem entrega por causa de um cadastro.
 *
 * **E NÃO EXISTE AQUI UM ESTADO "SÓ LEITURA", porque ele não teria a quem
 * recusar.** A primeira versão tinha: uma faixa dizendo "isto é configurado
 * pelo Atendimento" e os campos desligados. Só que a ficha do cliente mora em
 * `/painel/pessoas`, que é `GESTAO` desde o Sprint 3C — e gestão passa em
 * `is_atendimento()`. Quem consegue abrir esta aba pode, sempre, configurá-la.
 *
 * É a lição da 0060 no mesmo dia: uma segunda pergunta embaixo de uma primeira
 * que já barra todo mundo não barra ninguém, e um botão desligado que nunca
 * aparece é pior que nenhum — ele dá a impressão de que a trava existe. A trava
 * é a policy da 0064 e a guarda da action; a tela não precisa fingir uma.
 *
 * *O que fica em aberto, e é dito em vez de escondido:* o banco aceita o
 * colaborador do Atendimento escrevendo estes padrões, e nenhuma tela o leva
 * até aqui. A porta existe, e a próxima tela que a use não precisa de migration.
 * ---------------------------------------------------------------------------
 */

const SEM_NINGUEM = "__sem__";

export type PessoaDaEquipe = {
  id: string;
  nome: string;
  funcao: TeamFuncao | null;
  role: UserRole;
};

export function ConfiguracoesDoFluxo({
  clienteId,
  padroes,
  fluxos,
  recorrencias,
  equipe,
  atendimento,
  observacoes,
  ehGestor,
}: {
  clienteId: string;
  padroes: PadroesDaConta;
  fluxos: FluxoDaConta[];
  recorrencias: RecorrenciaDaConta[];
  equipe: PessoaDaEquipe[];
  /** O nome de `clients.responsavel_atendimento_id`, que não mora nesta tabela. */
  atendimento: string | null;
  observacoes: string | null;
  ehGestor: boolean;
}) {
  const router = useRouter();
  const [salvando, salvar] = useTransition();

  const [aprovador, setAprovador] = useState(padroes.linha?.aprovador_interno_id ?? SEM_NINGUEM);
  const [pasta, setPasta] = useState(padroes.linha?.pasta_entrega_url ?? "");
  const [prazo, setPrazo] = useState(
    String(padroes.linha?.prazo_aprovacao_cliente_dias ?? PRAZO_DE_APROVACAO_PADRAO),
  );

  const porFuncao = new Map(padroes.porFuncao.map((p) => [p.funcao, p.pessoa.id]));

  // A gestão é quem decide rodada interna desde a 0029. Oferecer colaborador
  // aqui seria oferecer um aprovador que o banco recusa depois.
  const daGestao = equipe.filter((p) => p.role === "desenvolvedor" || p.role === "socio");

  function salvarEntrega() {
    salvar(async () => {
      const resultado = await chamarEMostrar(() =>
        salvarPadroesDaConta({
          client_id: clienteId,
          aprovador_interno_id: aprovador === SEM_NINGUEM ? null : aprovador,
          pasta_entrega_url: pasta.trim() || null,
          prazo_aprovacao_cliente_dias: Number(prazo) || PRAZO_DE_APROVACAO_PADRAO,
        }),
      );
      if (resultado?.ok) router.refresh();
    });
  }

  function trocarFuncao(funcao: TeamFuncao, valor: string) {
    salvar(async () => {
      const resultado = await chamarEMostrar(() =>
        definirFuncaoDaConta({
          client_id: clienteId,
          funcao,
          user_id: valor === SEM_NINGUEM ? null : valor,
        }),
      );
      if (resultado?.ok) router.refresh();
    });
  }

  function duplicar(tipoId: string) {
    salvar(async () => {
      const resultado = await chamarEMostrar(() => duplicarFluxoParaAConta(tipoId, clienteId));
      if (resultado?.ok) router.refresh();
    });
  }

  const funcoesSemDono = new Set<TeamFuncao>();
  for (const fluxo of fluxos) {
    for (const etapa of fluxo.etapas) {
      if (etapa.semDono && etapa.funcao) funcoesSemDono.add(etapa.funcao);
    }
  }

  return (
    <div className="space-y-8">
      <SecaoDoFormulario numero={1} titulo="Responsáveis da conta">
        <div className="space-y-4 rounded-xl border p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* O ATENDIMENTO NÃO É CAMPO DESTA ABA, e é de propósito: ele é
                `clients.responsavel_atendimento_id`, a pessoa que o Portal avisa
                quando o cliente comenta ou decide. Uma segunda coluna com o
                mesmo papel divergiria em silêncio da que o aviso usa. */}
            <div>
              <p className="text-muted-foreground text-xs">Atendimento desta conta</p>
              <p className="mt-0.5 text-sm">{atendimento ?? "—"}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Trocado na aba Dados. É quem recebe os avisos do portal deste cliente.
              </p>
            </div>

            <div>
              <Label htmlFor="aprovador-da-conta">Aprovador interno padrão</Label>
              <Select
                value={aprovador}
                onValueChange={(valor) => {
                  setAprovador(valor);
                }}
                disabled={salvando}
              >
                <SelectTrigger
                  id="aprovador-da-conta"
                  aria-label="Aprovador interno padrão desta conta"
                  className="mt-1.5 w-full"
                >
                  <SelectValue placeholder="Sem preferência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_NINGUEM}>Sem preferência</SelectItem>
                  {daGestao.map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                Só aparece quem pode decidir uma aprovação interna. Salvo junto com a
                seção 3.
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium">Quem faz cada coisa nesta conta</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              A etapa que já tem uma pessoa escrita continua com ela. Isto preenche
              o que ficaria em branco.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {FUNCOES.map((funcao) => {
                const escolhido = porFuncao.get(funcao) ?? SEM_NINGUEM;
                // Quem exerce a função na agência primeiro, o resto depois: é
                // sugestão e não trava — um designer escreve legenda no dia em
                // que precisar, e uma lista fechada obrigaria a mexer na ficha
                // da pessoa para resolver uma conta.
                const ordenada = [...equipe].sort((a, b) => {
                  const pesoA = a.funcao === funcao ? 0 : 1;
                  const pesoB = b.funcao === funcao ? 0 : 1;
                  return pesoA - pesoB || a.nome.localeCompare(b.nome, "pt-BR");
                });

                return (
                  <div key={funcao}>
                    <Label htmlFor={`funcao-${funcao}`} className="text-xs">
                      {ROTULOS_DE_FUNCAO[funcao]}
                      {/* A FRASE DIZ O QUE ACONTECE, e não que falta alguém:
                          "um fluxo pede" sozinho manda a pessoa procurar qual
                          é o problema; "a etapa nasce sem responsável" é a
                          consequência, e é ela que decide se isto importa
                          agora. */}
                      {funcoesSemDono.has(funcao) ? (
                        <span className="text-warning ml-1.5 inline-flex items-center gap-1 font-normal">
                          <TriangleAlert aria-hidden className="size-3" />
                          um fluxo pede, e a etapa nasce sem responsável
                        </span>
                      ) : null}
                    </Label>
                    <Select
                      value={escolhido}
                      onValueChange={(valor) => trocarFuncao(funcao, valor)}
                      disabled={salvando}
                    >
                      <SelectTrigger
                        id={`funcao-${funcao}`}
                        aria-label={`Quem faz ${ROTULOS_DE_FUNCAO[funcao]} nesta conta`}
                        className="mt-1 w-full"
                      >
                        <SelectValue placeholder="Ninguém definido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_NINGUEM}>Ninguém definido</SelectItem>
                        {ordenada.map((pessoa) => (
                          <SelectItem key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome}
                            {pessoa.funcao && pessoa.funcao !== funcao
                              ? ` · ${ROTULOS_DE_FUNCAO[pessoa.funcao]}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SecaoDoFormulario>

      <SecaoDoFormulario
        numero={2}
        titulo="Fluxos desta conta"
        acao={
          <Button asChild variant="outline" size="sm">
            <Link href="/painel/gestao-tasks?aba=workflows">
              Editar fluxos
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        }
      >
        {fluxos.length === 0 ? (
          <EmptyState
            title="Nenhum fluxo disponível"
            description="Os fluxos são as cadeias de etapas que uma demanda percorre. Eles são cadastrados em Workflows."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {fluxos.map((fluxo) => (
              <li key={fluxo.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{fluxo.nome}</p>
                    <Badge variant={fluxo.clientId ? "default" : "secondary"}>
                      {fluxo.clientId ? "Só desta conta" : "Vale para todos"}
                    </Badge>
                  </div>

                  {fluxo.etapas.length === 0 ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Sem etapas cadastradas: uma demanda deste fluxo nasce vazia.
                    </p>
                  ) : (
                    <ol className="mt-2 flex flex-wrap items-center gap-1.5">
                      {fluxo.etapas.map((etapa, indice) => (
                        <li
                          key={`${fluxo.id}-${indice}`}
                          className={
                            etapa.semDono
                              ? "bg-warning-soft text-warning inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
                              : "bg-muted text-text-secondary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
                          }
                          title={
                            etapa.semDono && etapa.funcao
                              ? `Ninguém em ${ROTULOS_DE_FUNCAO[etapa.funcao]} nesta conta: esta etapa nasce sem responsável.`
                              : undefined
                          }
                        >
                          {etapa.semDono ? <CircleAlert aria-hidden className="size-3" /> : null}
                          {etapa.nome}
                          {etapa.requerAprovacao ? <Lock aria-hidden className="size-3" /> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {ehGestor && !fluxo.clientId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={salvando}
                    onClick={() => duplicar(fluxo.id)}
                  >
                    {salvando ? <Loader2 aria-hidden className="animate-spin" /> : null}
                    Duplicar para esta conta
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SecaoDoFormulario>

      <SecaoDoFormulario numero={3} titulo="Entrega e prazos">
        <div className="space-y-4 rounded-xl border p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pasta-da-conta">Pasta de entrega padrão</Label>
              <Input
                id="pasta-da-conta"
                value={pasta}
                onChange={(evento) => setPasta(evento.target.value)}
                placeholder="https://drive.google.com/…"
                disabled={salvando}
                className="mt-1.5"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Sugerida na abertura de toda demanda desta conta. A pasta de cada
                demanda continua sendo obrigatória e editável.
              </p>
            </div>

            <div>
              <Label htmlFor="prazo-da-conta">Prazo de resposta do cliente</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="prazo-da-conta"
                  type="number"
                  min={1}
                  max={365}
                  value={prazo}
                  onChange={(evento) => setPrazo(evento.target.value)}
                  disabled={salvando}
                  className="w-24 tabular-nums"
                />
                <span className="text-muted-foreground text-sm">dias</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Passado esse prazo, o material enviado a este cliente aparece como
                atrasado na fila de aprovações.
              </p>
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={salvarEntrega} disabled={salvando}>
              {salvando ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
              Salvar
            </Button>
          </div>
        </div>
      </SecaoDoFormulario>

      <SecaoDoFormulario
        numero={4}
        titulo="Demandas recorrentes"
        acao={
          <Button asChild variant="outline" size="sm">
            <Link href="/painel/gestao-tasks?aba=recorrencias">
              Editar recorrências
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        }
      >
        {recorrencias.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Esta conta não gera demanda sozinha"
            description="Uma recorrência é a regra que abre a mesma demanda todo mês, toda segunda ou todo dia 5."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {recorrencias.map((regra) => (
              <li key={regra.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{regra.nome}</p>
                  <p className="text-muted-foreground text-xs">{regra.frequencia}</p>
                </div>
                <Badge variant={regra.ativo ? "success" : "secondary"}>
                  {regra.ativo ? "Ativa" : "Pausada"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </SecaoDoFormulario>

      <SecaoDoFormulario numero={5} titulo="Particularidades da conta">
        <div className="rounded-xl border p-5">
          {observacoes?.trim() ? (
            <p className="text-sm whitespace-pre-wrap">{observacoes}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nada anotado ainda. O que estiver aqui aparece para quem abre uma
              demanda desta conta.
            </p>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Escrito na aba Dados, no campo Observações: um segundo campo com o
            mesmo papel acabaria com duas versões da mesma combinação.
          </p>
        </div>
      </SecaoDoFormulario>
    </div>
  );
}
