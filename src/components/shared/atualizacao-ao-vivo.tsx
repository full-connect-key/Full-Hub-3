"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, WifiOff } from "lucide-react";

import { CANAL_DA_EQUIPE } from "@/lib/dominio/ao-vivo";
import { supabaseConfigurado } from "@/lib/env";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * A tela se atualiza quando outra pessoa mexe (Sprint 16, Parte A).
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO LÊ A MENSAGEM. Só pede a tela de novo.
 *
 * O aviso que chega é `{ motivo: "task" }` — uma palavra. Quem monta a tela
 * continua sendo o servidor, com o RLS valendo como em qualquer visita. É o
 * que permite pôr isto no layout inteiro do Painel sem abrir uma segunda
 * verdade sobre quem vê o quê: não existe dado no fio para divergir.
 *
 * `router.refresh()` **preserva o estado dos componentes de cliente** — o que
 * está digitado num campo, o diálogo aberto, a aba escolhida. Ele remonta os
 * Server Components e reaproveita o resto. Sem essa propriedade isto não
 * poderia morar no layout: o texto de um comentário sumiria porque outra
 * pessoa mudou o status de uma etapa do outro lado da agência.
 * ---------------------------------------------------------------------------
 *
 * **UM SINAL VISÍVEL QUANDO NÃO ESTÁ LIGADO, e esse é o ponto do componente.**
 * Uma inscrição que cai não avisa ninguém: a tela simplesmente para de se
 * atualizar sozinha, e "não mudou nada" é indistinguível de "parou de
 * chegar". É o mesmo modo de falha da leitura que devolve lista vazia — e a
 * resposta é a mesma, dizer em voz alta.
 *
 * Por isso o ponto aparece também quando **está** funcionando. Um indicador
 * que só nasce quando quebra ensina que a ausência dele é boa notícia — e aí
 * o dia em que o componente inteiro sumir de um layout por engano passa por
 * "está tudo bem".
 */

/** Quanto tempo juntar avisos antes de recarregar. */
const PAUSA_MS = 1200;

/**
 * São QUATRO e não três, e a diferença entre as duas primeiras importa.
 *
 * `desligado` é "este ambiente não tem Supabase" — o gerador de protótipo, que
 * troca a camada de dados por exemplos. Aí não existe atualização ao vivo para
 * estar de pé ou caída, e o certo é não desenhar nada: um aviso de conexão
 * numa tela de dados de exemplo afirma coisa errada sobre outra coisa.
 *
 * `caiu` é "as credenciais existem e a inscrição não ficou de pé" — este sim
 * precisa aparecer, porque a pessoa está olhando dados de verdade que pararam
 * de se atualizar.
 */
type Situacao = "desligado" | "ligando" | "ligado" | "caiu";

export function AtualizacaoAoVivo({ className }: { className?: string }) {
  const router = useRouter();
  // NO INICIALIZADOR, e não num efeito: `supabaseConfigurado()` só lê variável
  // embutida no build, então a resposta é a mesma no servidor e no navegador e
  // não há o que hidratar errado. Chamar `setSituacao` no corpo do efeito é o
  // que dispara renderização em cascata — a mesma armadilha do editor de post
  // que foi trocada por `key` no Sprint 14.
  const [situacao, setSituacao] = useState<Situacao>(() =>
    supabaseConfigurado() ? "ligando" : "desligado",
  );
  const [recarregando, setRecarregando] = useState(false);

  // Em ref e não em estado: mudar isto não precisa repintar nada, e pôr no
  // estado faria o efeito rodar de novo e reinscrever o canal.
  const pendente = useRef(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sem credenciais não há canal nenhum. Acontece no gerador de protótipo,
    // que troca a camada de dados por exemplos — e sem esta linha
    // `criarClienteNavegador()` estoura e derruba o layout inteiro, em todas
    // as telas de uma vez.
    if (situacao === "desligado") return;

    const supabase = criarClienteNavegador();

    function recarregar() {
      // ABA ESCONDIDA NÃO RECARREGA. Quem está noutra janela não vê nada, e
      // dez abas paradas num board recarregando a cada mexida da agência são
      // dez idas ao banco para desenhar o que ninguém está olhando. Fica
      // marcado, e sai quando a pessoa voltar.
      if (document.visibilityState !== "visible") {
        pendente.current = true;
        return;
      }
      pendente.current = false;
      setRecarregando(true);
      router.refresh();
      // O `refresh` não avisa quando termina. O pisca é só para a mudança não
      // aparecer do nada — não é barra de progresso e não finge ser.
      setTimeout(() => setRecarregando(false), 600);
    }

    // A PAUSA JUNTA OS AVISOS. Concluir uma etapa mexe em subtarefa, em task e
    // em rodada, e cada ação anuncia a sua: sem juntar, um clique de uma
    // pessoa viraria três recarregamentos na tela das outras oito.
    function agendar() {
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(recarregar, PAUSA_MS);
    }

    const canal = supabase
      .channel(CANAL_DA_EQUIPE, { config: { private: true } })
      .on("broadcast", { event: "mudou" }, agendar)
      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") setSituacao("ligado");
        // CHANNEL_ERROR é o que aparece quando a policy da 0057 não está
        // aplicada: o canal é privado, e sem ela ninguém tem permissão de
        // ouvir. Vale para os três — o que a pessoa precisa saber é a mesma
        // coisa, que a tela não vai se mexer sozinha.
        else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
          setSituacao("caiu");
        }
      });

    function aoVoltar() {
      if (document.visibilityState === "visible" && pendente.current) recarregar();
    }
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      if (relogio.current) clearTimeout(relogio.current);
      supabase.removeChannel(canal);
    };
  }, [router, situacao]);

  if (situacao === "desligado" || situacao === "ligando") return null;

  if (situacao === "caiu") {
    return (
      <span
        className={cn(
          "text-warning bg-warning-soft inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
          className,
        )}
        title="A tela não está recebendo as mudanças de outras pessoas. Recarregue a página para ver o estado de agora."
      >
        <WifiOff aria-hidden className="size-3.5" />
        <span className="hidden sm:inline">Sem atualização ao vivo</span>
        <span className="sr-only sm:hidden">Sem atualização ao vivo</span>
      </span>
    );
  }

  return (
    <span
      className={cn("text-muted-foreground inline-flex items-center", className)}
      title={
        recarregando
          ? "Alguém mexeu em alguma coisa: buscando o estado de agora."
          : "Esta tela se atualiza sozinha quando outra pessoa mexe."
      }
    >
      {recarregando ? (
        <RefreshCw aria-hidden className="size-3.5 animate-spin" />
      ) : (
        <span aria-hidden className="bg-success size-2 rounded-full" />
      )}
      <span className="sr-only">
        {recarregando ? "Atualizando" : "Atualização ao vivo ligada"}
      </span>
    </span>
  );
}
