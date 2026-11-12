"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chamarAcao } from "@/lib/acoes/cliente";

import { Comentarios } from "../gestao-tasks/[id]/comentarios";
import { PropriedadesDaTask } from "../gestao-tasks/[id]/propriedades";
import { PrincipalDaTask, TituloDaTask } from "../gestao-tasks/[id]/principal";
import { Referencias } from "../gestao-tasks/[id]/referencias";
import { Subtarefas } from "../gestao-tasks/[id]/subtarefas";
import { carregarDetalheDaTask, type DetalheParaOPainel } from "./acoes";

/**
 * Detalhe da task por cima da tela, sem trocar de página.
 *
 * É o que diferencia a visão do dia a dia da visão gerencial: quem está
 * tocando cinco entregas não quer perder o lugar na lista a cada abertura.
 * Os blocos aqui dentro são exatamente os do Sprint 3 — briefing, subtarefas,
 * referências, comentários e a coluna de campos. Nada foi copiado; o que mudou
 * foi só quem manda em quê, pelas props de permissão.
 */
export function PainelLateralDaTask({
  taskId,
  destino,
  aoFechar,
}: {
  taskId: string | null;
  /**
   * A PORTA DA ÁREA desta demanda, quando ela tem uma — o mês de social, a
   * campanha. Vem de `destinoDaEtapa()`, calculado por quem abriu o painel:
   * ele já tem as linhas em mãos, e perguntar aqui seria uma consulta a mais
   * por abertura para repetir o que a tela ao lado já sabe.
   */
  destino: { href: string; rotulo: string; titulo: string } | null;
  aoFechar: () => void;
}) {
  // Guarda o detalhe junto do id de quem ele é: assim "está carregando" é
  // deduzido (o painel aponta para uma task cujo detalhe ainda não chegou), e
  // não precisa de um setState dentro do efeito só para ligar o spinner.
  const [carregado, setCarregado] = useState<{ id: string; dados: DetalheParaOPainel } | null>(
    null,
  );

  const detalhe = carregado && carregado.id === taskId ? carregado.dados : null;
  const carregando = taskId !== null && detalhe === null;

  /**
   * Busca o detalhe quando o painel passa a apontar para outra task.
   *
   * É efeito, e não ajuste durante o render, porque isto fala com um sistema
   * de fora — buscar no servidor em pleno render dispararia duas vezes em modo
   * concorrente. O `cancelado` descarta a resposta que chega tarde, para uma
   * task aberta e fechada rápido não sobrescrever a seguinte.
   */
  useEffect(() => {
    if (!taskId) return;

    let cancelado = false;
    void chamarAcao(() => carregarDetalheDaTask(taskId)).then((resultado) => {
      if (cancelado) return;
      if (!resultado.ok) {
        toast.error(resultado.error);
        aoFechar();
        return;
      }
      if (resultado.dados) setCarregado({ id: taskId, dados: resultado.dados });
    });

    return () => {
      cancelado = true;
    };
  }, [taskId, aoFechar]);

  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(aberto) => {
        if (!aberto) aoFechar();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        aria-describedby={undefined}
      >
        {carregando || !detalhe ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 aria-hidden className="text-muted-foreground size-5 animate-spin" />
            <span className="sr-only">Carregando a task…</span>
          </div>
        ) : (
          <>
            <SheetHeader className="border-b">
              {/* O RESPIRO À DIREITA É PELO BOTÃO DE FECHAR, e isto é um
                  conserto anterior a esta entrega: o `X` do `SheetContent` é
                  `absolute top-4 right-4`, e o cabeçalho tem `p-4` — o último
                  botão da linha chegava embaixo dele, com o `X` desenhado em
                  cima do ícone. Foi a imagem que mostrou, e nenhuma
                  verificação pegaria: sobreposição não é tipo, não é cor e
                  não é árvore de acessibilidade. O respiro mora AQUI e não no
                  `SheetContent`, que é de vinte telas e onde nenhuma outra põe
                  botão nesta linha. */}
              <div className="flex flex-wrap items-center gap-2 pe-7">
                <StatusBadge status={detalhe.task.status} />
                {!detalhe.podeGerenciar ? (
                  <span className="text-muted-foreground text-xs">
                    Você vê a demanda inteira; edita as subtarefas que são suas.
                  </span>
                ) : null}
                {/* A PORTA DA ÁREA, e ela é o que substitui os três chips do
                    cabeçalho desta tela. Decisão do usuário: *"quando a pessoa
                    é marcada em um task de algum desses tipos, ela tenha
                    acesso a página referente"*.

                    **ELA VEM ANTES do link de página inteira**, e a ordem é a
                    da pergunta: quem abriu a fase de Layout de outubro quer o
                    MÊS — a grade das peças, as caixinhas —, e não a demanda do
                    mês numa segunda tela. */}
                {destino ? (
                  <Button asChild variant="outline" size="sm" className="ml-auto">
                    <Link href={destino.href} title={destino.titulo}>
                      {destino.rotulo}
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                ) : null}

                {/* "ABRIR EM PÁGINA INTEIRA" SÓ PARA A GESTÃO, e isto é um
                    conserto: `/painel/gestao-tasks` é `GESTAO` em
                    `lib/auth/permissions.ts`, então o colaborador — a pessoa
                    para quem Minhas Tasks existe — clicava neste botão e lia
                    *"Seu perfil não permite esta ação"*. `souGestor` é a MESMA
                    pergunta que a rota faz (`is_gestor()`), e não uma
                    parecida.

                    **O BOTÃO SOME em vez de aparecer desligado**, pela razão
                    escrita no "Enviar ao cliente" do Social Media virada do
                    avesso: ali o desligado ensina um passo que falta, e aqui
                    não falta passo nenhum — é uma porta que não é dela. O que
                    ela perde não é acesso: o painel mostra a demanda inteira,
                    e o que a página cheia acrescenta são as ações da demanda,
                    que são justamente de quem gerencia. */}
                {detalhe.souGestor ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className={destino ? undefined : "ml-auto"}
                  >
                    <Link href={`/painel/gestao-tasks/${detalhe.task.id}`}>
                      Abrir em página inteira
                      <ExternalLink aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </div>
              <SheetTitle className="sr-only">{detalhe.task.titulo}</SheetTitle>
              <SheetDescription className="sr-only">
                Detalhe da task, com briefing, subtarefas, referências e comentários.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-8 p-4 sm:p-6">
              <TituloDaTask task={detalhe.task} podeEditar={detalhe.podeGerenciar} />

              {/* Sem as ações da demanda inteira: excluir a task de dentro
                  de um painel que abriu por cima de uma lista deixa a pessoa
                  olhando para uma lista que ainda mostra o que acabou de
                  sumir. Quem quer excluir abre a página cheia — o link está
                  no cabeçalho deste painel. */}
              <PropriedadesDaTask
                task={detalhe.task}
                clientes={detalhe.clientes}
                tipos={detalhe.tipos}
                vertentes={detalhe.vertentes}
                podeEditar={detalhe.podeGerenciar}
                driveLigado={detalhe.driveLigado}
              />

              <PrincipalDaTask task={detalhe.task} podeEditar={detalhe.podeGerenciar} />

              <Subtarefas
                taskId={detalhe.task.id}
                subtarefas={detalhe.task.subtarefas}
                equipe={detalhe.equipe}
                podeGerenciar={detalhe.podeGerenciar}
                souGestor={detalhe.souGestor}
                usuarioId={detalhe.usuarioId}
                agoraDoServidor={detalhe.agora}
              />

              <Referencias
                taskId={detalhe.task.id}
                referencias={detalhe.task.referencias}
                urls={detalhe.urls}
                podeEditar={detalhe.podeGerenciar}
              />

              <Comentarios
                taskId={detalhe.task.id}
                comentarios={detalhe.task.comentarios}
                usuarioId={detalhe.usuarioId}
                podeModerar={detalhe.souGestor}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
