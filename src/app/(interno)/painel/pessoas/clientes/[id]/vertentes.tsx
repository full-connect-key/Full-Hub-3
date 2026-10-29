"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, X } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { Resultado } from "@/lib/acoes/resultado";
import type { Vertente } from "@/lib/dominio/vertentes";
import { cn } from "@/lib/utils";

import {
  alternarVertente,
  criarVertente,
  renomearVertente,
  reordenarVertentes,
} from "./acoes-das-vertentes";

/**
 * As vertentes de uma conta (migration 0118).
 *
 * Decisão do usuário: *"permitir o cadastro de diferentes vertentes, áreas ou
 * unidades de negócio dentro de uma mesma conta (…) cadastradas e gerenciadas
 * diretamente na página de configuração do cliente (…) adicionar, editar,
 * reorganizar e desativar"*.
 *
 * ---------------------------------------------------------------------------
 * **É UMA ABA PRÓPRIA, e não um bloco dentro de "Configurações do fluxo".**
 * Aquela aba responde uma pergunta — quem aprova o quê nesta conta, e com que
 * prazo. A vertente é a estrutura da conta, que a task, a Biblioteca e o
 * relatório vão usar. Dentro da outra ela ficaria enterrada sob um título que
 * fala de aprovação.
 *
 * ---------------------------------------------------------------------------
 * **NÃO HÁ BOTÃO DE APAGAR**, e a ausência é o pedido lido ao pé da letra: os
 * quatro verbos são adicionar, editar, reorganizar e desativar. A tabela nasce
 * sem policy de DELETE, então nem o sócio apaga — e é o que mantém de pé o
 * relatório por vertente do que já foi entregue.
 *
 * ---------------------------------------------------------------------------
 * **REORDENAR É POR BOTÃO E NÃO POR ARRASTO.** O arrasto do board existe
 * porque lá a coluna de destino É a ação; aqui a lista tem meia dúzia de
 * linhas numa aba de configuração, e o par de setas vem com acesso de teclado
 * de graça — o `dnd-kit` precisaria do `role="button"` e do `tabIndex` dele, e
 * foi exatamente isso que o axe reprovou nos dois boards por
 * `nested-interactive`.
 */
export function VertentesDaConta({
  clienteId,
  nomeDaEmpresa,
  vertentes,
}: {
  clienteId: string;
  nomeDaEmpresa: string;
  vertentes: Vertente[];
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const ativas = vertentes.filter((v) => v.ativa).length;

  function acao(fn: () => Promise<Resultado>) {
    iniciar(async () => {
      const r = await chamarEMostrar(fn);
      if (r?.ok) router.refresh();
    });
  }

  /**
   * A ORDEM INTEIRA VAI DE UMA VEZ, e a troca acontece na lista COMPLETA —
   * desativadas inclusive. Reordenar só as ativas deixaria as outras
   * empatadas nas posições antigas, e a primeira reativação jogaria a linha
   * para um lugar que ninguém escolheu.
   */
  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= vertentes.length) return;
    const ids = vertentes.map((v) => v.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    acao(() => reordenarVertentes({ client_id: clienteId, ids }));
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-5 border p-5">
      <div>
        <h2 className="text-sm font-semibold">Vertentes da conta</h2>
        {/* A FRASE DIZ O QUE ELAS FAZEM FORA DESTA TELA, porque é fora dela
            que elas decidem alguma coisa: quem cadastra aqui precisa saber
            que a lista vai aparecer na abertura de toda demanda da conta. */}
        <p className="text-text-muted mt-1 text-xs">
          As áreas ou frentes de {nomeDaEmpresa}, dentro da mesma conta. Elas
          aparecem na abertura de cada demanda, nos filtros e nos relatórios —
          e o cliente vê a Biblioteca dele separada por elas.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nova.trim()) return;
          acao(async () => {
            const r = await criarVertente({ client_id: clienteId, nome: nova.trim() });
            if (r.ok) setNova("");
            return r;
          });
        }}
      >
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <Label htmlFor="vertente-nova">Nova vertente</Label>
          <Input
            id="vertente-nova"
            value={nova}
            maxLength={60}
            placeholder="Institucional, Lojas Próprias, E-commerce…"
            onChange={(e) => setNova(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!nova.trim() || salvando}>
          {salvando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden />}
          Acrescentar
        </Button>
      </form>

      {vertentes.length === 0 ? (
        /* O VAZIO DIZ O QUE ACONTECE SEM ELAS, e é informação e não consolo:
           conta sem vertente é um estado de verdade do produto — a demanda
           dela simplesmente não pede a classificação. */
        <EmptyState
          icon={Plus}
          title="Esta conta ainda não tem vertentes"
          description="Sem nenhuma cadastrada, as demandas desta conta não pedem área — e nada muda no que já existe. Acrescente a primeira acima."
          className="border-0"
        />
      ) : (
        <ul className="divide-y border-t">
          {vertentes.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="flex shrink-0 flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  aria-label={`Subir ${v.nome}`}
                  disabled={i === 0 || salvando}
                  onClick={() => mover(i, -1)}
                >
                  <ArrowUp aria-hidden className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  aria-label={`Descer ${v.nome}`}
                  disabled={i === vertentes.length - 1 || salvando}
                  onClick={() => mover(i, 1)}
                >
                  <ArrowDown aria-hidden className="size-3.5" />
                </Button>
              </div>

              {editando === v.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!rascunho.trim()) return;
                    acao(async () => {
                      const r = await renomearVertente({ id: v.id, nome: rascunho.trim() });
                      if (r.ok) setEditando(null);
                      return r;
                    });
                  }}
                >
                  <Input
                    autoFocus
                    value={rascunho}
                    maxLength={60}
                    aria-label={`Novo nome de ${v.nome}`}
                    onChange={(e) => setRascunho(e.target.value)}
                  />
                  <Button type="submit" size="icon" variant="ghost" aria-label="Salvar o nome" disabled={salvando}>
                    <Check aria-hidden className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Cancelar"
                    onClick={() => setEditando(null)}
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      // A DESATIVADA RECUA PELO TOM, nunca por opacidade:
                      // opacidade em texto dá uma cor que ninguém mediu, e no
                      // tema escuro dá outra. É a regra que o `DateBadge` já
                      // pagou uma vez.
                      v.ativa ? "font-medium" : "text-text-muted",
                    )}
                  >
                    {v.nome}
                  </span>
                  {!v.ativa ? <Badge variant="outline">Desativada</Badge> : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={salvando}
                    onClick={() => {
                      setEditando(v.id);
                      setRascunho(v.nome);
                    }}
                  >
                    <Pencil aria-hidden className="size-4" />
                    Renomear
                  </Button>
                </>
              )}

              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  id={`ativa-${v.id}`}
                  checked={v.ativa}
                  disabled={salvando}
                  onCheckedChange={(valor) => acao(() => alternarVertente({ id: v.id, ativa: valor }))}
                />
                <Label htmlFor={`ativa-${v.id}`} className="text-text-muted text-xs">
                  Ativa
                </Label>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* O QUE DESATIVAR FAZ, dito onde se desativa. Sem a frase, quem desliga
          a chave não sabe se perdeu as demandas que já estavam classificadas —
          e a resposta é não, que é justamente por que não há botão de apagar. */}
      {vertentes.length > 0 ? (
        <p className="text-text-muted border-t pt-3 text-xs">
          {ativas === 0
            ? "Com todas desativadas, as demandas desta conta voltam a não pedir área."
            : `${ativas} ${ativas === 1 ? "vertente ativa" : "vertentes ativas"}. `}
          Desativar tira do seletor da demanda e não mexe no que já foi
          classificado — por isso elas não se apagam.
        </p>
      ) : null}
    </div>
  );
}
