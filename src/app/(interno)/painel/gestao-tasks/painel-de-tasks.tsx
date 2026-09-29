"use client";

import { useEffect } from "react";

import Link from "next/link";
import { Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BotaoDeNovaTask } from "@/components/shared/botao-de-nova-task";
import { GrupoDeRascunhos } from "./rascunhos";
import type { RascunhoDaLista } from "@/lib/dados/tasks";
import { COLUNAS_POR_STATUS } from "@/lib/dominio/tasks";
import type { ItemDeCalendario, TaskDaLista } from "@/lib/dados/tasks";
import type { TeamFuncao } from "@/lib/supabase/database.types";

import { BoardDeTasks } from "./board";
import { CalendarioDeTasks } from "./calendario";
import { SeletorDeVisao } from "@/components/shared/seletor-de-visao";

import { BarraDeFiltrosDeTask, useFiltros } from "./filtros";
import { ListaDeTasks } from "./lista";

/**
 * Container das três visualizações.
 *
 * A visualização escolhida também mora na URL, junto com os filtros — trocar
 * de Board para Lista não perde o que já estava filtrado, e o link continua
 * levando a outra pessoa exatamente para o que você está vendo.
 */
export function PainelDeTasks({
  tasks,
  rascunhos,
  itensDeCalendario,
  clientes,
  equipe,
  prazos,
  podeConfigurarRecorrencia,
}: {
  rascunhos: RascunhoDaLista[];
  tasks: TaskDaLista[];
  itensDeCalendario: ItemDeCalendario[];
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string; avatar_url: string | null; funcao: TeamFuncao | null }[];
  prazos: { hoje: string; fimDaSemana: string };
  /** `is_atendimento()` — quem abre demanda é quem configura a rotina. */
  podeConfigurarRecorrencia: boolean;
}) {
  const { filtros, definir } = useFiltros();

  /**
   * Atalhos no estilo das ferramentas de produtividade: N abre nova task e /
   * foca a busca. Esc é o Radix que resolve, fechando o diálogo aberto.
   *
   * Os atalhos são ignorados enquanto se digita em qualquer campo — senão
   * escrever "não" num comentário abriria uma task nova no meio da frase.
   */
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      const alvo = evento.target as HTMLElement | null;
      const digitando =
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.tagName === "SELECT" ||
        alvo?.isContentEditable;
      if (digitando) return;

      // O ATALHO N ABRE O RASCUNHO, e não mais um diálogo: ele clica o mesmo
      // botão, para os dois caminhos nunca fazerem coisas diferentes.
      if (evento.key === "n" || evento.key === "N") {
        evento.preventDefault();
        document.getElementById("nova-task")?.click();
        return;
      }

      if (evento.key === "/") {
        const busca = document.getElementById("busca-de-tasks");
        if (busca) {
          evento.preventDefault();
          (busca as HTMLInputElement).focus();
        }
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorDeVisao atual={filtros.visao} aoTrocar={(v) => definir({ visao: v })} />

        <div className="ml-auto flex items-center gap-2">
          {/* "NOVA RECORRENTE" AO LADO DE "NOVA TASK", e não escondida em
              Workflows: quem abre a demanda de hoje é quem percebe que ela se
              repete, e é aqui que ele está quando percebe. O botão leva para
              a configuração — uma recorrência não é uma task, e criá-la a
              partir deste botão sem cadência seria criar a regra que gera no
              ritmo errado. */}
          {podeConfigurarRecorrencia ? (
            <Button variant="outline" asChild>
              <Link href="/painel/gestao-tasks?aba=recorrencias&regra=nova">
                <Repeat aria-hidden />
                Nova recorrente
              </Link>
            </Button>
          ) : null}
          <BotaoDeNovaTask id="nova-task" atalho="N" />
        </div>
      </div>

      <BarraDeFiltrosDeTask clientes={clientes} equipe={equipe} />

      {filtros.visao === "board" ? (
        <BoardDeTasks tasks={tasks} colunas={COLUNAS_POR_STATUS} />
      ) : null}
      {filtros.visao === "lista" ? (
        <div className="space-y-3">
          {/* O grupo dos MEUS rascunhos, no topo e recolhido. Só na Lista: no
              board ele viraria uma coluna que a equipe não tem, e no
              calendário uma barra numa data que ninguém combinou. */}
          <GrupoDeRascunhos rascunhos={rascunhos} />
          <ListaDeTasks tasks={tasks} />
        </div>
      ) : null}
      {filtros.visao === "calendario" ? (
        <CalendarioDeTasks itens={itensDeCalendario} equipe={equipe} prazos={prazos} />
      ) : null}

    </div>
  );
}
