"use client";

import { DESCRICAO_DO_NIVEL, NIVEIS, PESO_DO_NIVEL, ROTULOS_DE_NIVEL } from "@/lib/dominio/skills";
import type { SkillNivel } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * O nível, em quatro segmentos.
 *
 * Quatro botões e não um `<select>`: o nível é uma escala, e uma escala se lê
 * de relance quando tem forma. Numa lista de vinte skills, vinte caixas de
 * seleção fechadas não deixam ninguém ver o próprio perfil.
 *
 * Cada segmento carrega a descrição no `title` e no rótulo acessível.
 * Autoavaliação sem régua vira escala pessoal — sem isso, o "avançado" de uma
 * pessoa é o "intermediário" de outra e a matriz deixa de comparar.
 *
 * É um grupo de rádio de verdade, não uma fila de botões: quem navega pelo
 * teclado espera as setas, e quem usa leitor de tela precisa ouvir "3 de 4".
 */
export function SeletorDeNivel({
  valor,
  aoEscolher,
  rotulo,
  desabilitado,
}: {
  valor: SkillNivel;
  aoEscolher: (nivel: SkillNivel) => void;
  rotulo: string;
  desabilitado?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`Nível em ${rotulo}`}
      className="flex items-center gap-1"
    >
      {NIVEIS.map((nivel) => {
        const ativo = PESO_DO_NIVEL[nivel] <= PESO_DO_NIVEL[valor];
        const escolhido = nivel === valor;

        return (
          <button
            key={nivel}
            type="button"
            role="radio"
            aria-checked={escolhido}
            aria-label={`${ROTULOS_DE_NIVEL[nivel]} — ${DESCRICAO_DO_NIVEL[nivel]}`}
            title={`${ROTULOS_DE_NIVEL[nivel]}: ${DESCRICAO_DO_NIVEL[nivel]}`}
            disabled={desabilitado}
            onClick={() => aoEscolher(nivel)}
            className={cn(
              "focus-visible:ring-ring/50 h-2 w-7 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
              ativo ? "bg-accent-strong" : "bg-neutral-soft hover:bg-blue-muted",
            )}
          />
        );
      })}
      <span className="text-text-muted ml-1.5 w-24 shrink-0 text-xs">
        {ROTULOS_DE_NIVEL[valor]}
      </span>
    </div>
  );
}
