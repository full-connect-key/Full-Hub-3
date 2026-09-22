"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { criarClienteNavegador } from "@/lib/supabase/client";

const MINUTO = 60 * 1000;
export const MINUTOS_ATE_O_AVISO = 28;
export const MINUTOS_ATE_SAIR = 30;

// Mousemove dispara dezenas de vezes por segundo. Reagendar os timers a cada
// evento seria desperdicio, entao so reagendamos uma vez por segundo.
const INTERVALO_MINIMO_ENTRE_RESETS = 1000;

const EVENTOS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

/**
 * Derruba a sessao depois de 30 minutos parado, avisando aos 28.
 *
 * Vale so para o perfil cliente: ele acessa de fora da agencia, as vezes de um
 * computador compartilhado, e uma sessao esquecida aberta expoe os dados da
 * empresa dele. A equipe interna fica o dia todo no sistema e seria atrapalhada
 * por isso.
 *
 * Isto e conforto e higiene de sessao, nao a protecao principal: quem protege
 * os dados e o RLS do Postgres, que continua valendo enquanto o token existir.
 */
export function useTimeoutDeInatividade(ativo: boolean) {
  const router = useRouter();
  const temporizadorDeAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temporizadorDeSaida = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoReset = useRef(0);

  useEffect(() => {
    if (!ativo) return;

    const limpar = () => {
      if (temporizadorDeAviso.current) clearTimeout(temporizadorDeAviso.current);
      if (temporizadorDeSaida.current) clearTimeout(temporizadorDeSaida.current);
    };

    const encerrarSessao = async () => {
      limpar();
      try {
        await criarClienteNavegador().auth.signOut();
      } catch {
        // Mesmo sem conseguir avisar o Supabase, tiramos a pessoa da tela.
      }
      // replace() em vez de push(): voltar para uma pagina de sessao expirada
      // nao faz sentido. refresh() descarta o cache de Server Components, que
      // ainda guarda o conteudo renderizado para a sessao que acabou.
      router.replace("/login?motivo=inatividade");
      router.refresh();
    };

    const reagendar = () => {
      limpar();
      temporizadorDeAviso.current = setTimeout(
        () =>
          toast.warning("Sua sessão vai expirar", {
            description: `Por segurança, você sai automaticamente em ${
              MINUTOS_ATE_SAIR - MINUTOS_ATE_O_AVISO
            } minutos sem uso. Mexa o mouse para continuar.`,
            duration: (MINUTOS_ATE_SAIR - MINUTOS_ATE_O_AVISO) * MINUTO,
          }),
        MINUTOS_ATE_O_AVISO * MINUTO,
      );
      temporizadorDeSaida.current = setTimeout(encerrarSessao, MINUTOS_ATE_SAIR * MINUTO);
    };

    const aoInteragir = () => {
      const agora = Date.now();
      if (agora - ultimoReset.current < INTERVALO_MINIMO_ENTRE_RESETS) return;
      ultimoReset.current = agora;
      reagendar();
    };

    reagendar();
    for (const evento of EVENTOS) {
      window.addEventListener(evento, aoInteragir, { passive: true });
    }

    return () => {
      limpar();
      for (const evento of EVENTOS) window.removeEventListener(evento, aoInteragir);
    };
  }, [ativo, router]);
}
