"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import { criarRascunho } from "@/app/(interno)/painel/gestao-tasks/acoes";
import { cn } from "@/lib/utils";

/**
 * "+ Nova task" — que **cria a demanda** e abre a tela de detalhe.
 *
 * Era um diálogo com um formulário reduzido: quem abria uma demanda
 * preenchia título, cliente e período, salvava, e só então via briefing,
 * subtarefas, referências e pasta de entrega. Isso invertia o trabalho real —
 * quem abre uma task é o Atendimento montando o briefing inteiro de uma vez,
 * e ter que salvar algo pela metade para chegar ao que interessa não faz
 * sentido.
 *
 * Agora a task nasce como rascunho (migration 0028) e a pessoa cai na tela
 * completa, com o cursor no título. **Não existe mais um componente de
 * criação separado do de edição** — era o objetivo do sprint, e é o que faz a
 * tela de criar e a de editar nunca divergirem.
 *
 * O atalho continua sendo a tecla N, e ele chama este mesmo caminho.
 */
export function BotaoDeNovaTask({
  className,
  id,
  atalho,
}: {
  className?: string;
  id?: string;
  /** A tecla que faz a mesma coisa, mostrada dentro do botão. */
  atalho?: string;
}) {
  const router = useRouter();
  const [abrindo, iniciar] = useTransition();

  function abrir() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => criarRascunho());
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      router.push(`/painel/gestao-tasks/${resultado.dados}`);
    });
  }

  return (
    <Button id={id} className={cn(className)} onClick={abrir} disabled={abrindo}>
      {abrindo ? <Loader2 className="animate-spin" /> : <Plus aria-hidden />}
      Nova task
      {atalho ? (
        <kbd className="bg-primary-foreground/15 ml-1 hidden rounded px-1.5 py-0.5 text-[10px] sm:inline">
          {atalho}
        </kbd>
      ) : null}
    </Button>
  );
}
