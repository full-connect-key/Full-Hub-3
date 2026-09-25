import Link from "next/link";
import { CalendarOff } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import type { ResumoDaHome } from "@/lib/dados/home";
import { CORES_DE_PRESENCA, ROTULOS_DE_PRESENCA } from "@/lib/dominio/full-days";
import type { PresencaStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * Quem está fora hoje.
 *
 * ---------------------------------------------------------------------------
 * O ESTADO PASSA PELO MAPA DE RÓTULOS, SEMPRE.
 *
 * O que vem do banco é o valor de enum — `ferias`, `licenca`, `ausente` —, e
 * eles ficaram com o nome antigo de propósito: renomear valor de enum em uso é
 * migration arriscada, e ninguém que usa o sistema vê esses nomes. **Desde
 * que passem por `ROTULOS_DE_PRESENCA`.** Desenhá-los crus poria o
 * vocabulário que a 0016 e a 0018 tiraram do produto na primeira tela que a
 * agência inteira abre todo dia — e a varredura de `check:cores` NÃO pegaria,
 * porque o texto não está em `src/`: ele vem do banco. Quem pega é só quem
 * olhar a tela.
 * ---------------------------------------------------------------------------
 *
 * **Remoto não aparece**, e é a mesma distinção da régua de cobertura: quem
 * trabalha de outro lugar está trabalhando. A lista que chega já vem filtrada
 * pelos três estados de ausência — este bloco não repete o filtro, porque o
 * segundo lugar é sempre o que esquece de acompanhar quando um estado novo
 * entra no enum.
 *
 * **Some quando não há ninguém fora**, que é a maioria dos dias.
 */
export function QuemEstaForaHoje({ pessoas }: { pessoas: ResumoDaHome["fora_hoje"] }) {
  if (!pessoas || pessoas.length === 0) return null;

  return (
    <section className="bg-surface-card rounded-card border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarOff aria-hidden className="size-4" />
        Quem está fora hoje
        <Link
          href="/painel/full-days"
          className="text-accent-strong ml-auto text-xs font-normal hover:underline"
        >
          ver a matriz
        </Link>
      </h2>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {pessoas.map((pessoa) => {
          const estado = pessoa.estado as PresencaStatus;
          return (
            <li key={`${pessoa.nome}-${pessoa.estado}`} className="flex items-center gap-2">
              <UserAvatar name={pessoa.nome} size="sm" />
              <span className="text-sm">{pessoa.nome}</span>
              <span className="text-text-muted flex items-center gap-1 text-xs">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", CORES_DE_PRESENCA[estado])}
                />
                {ROTULOS_DE_PRESENCA[estado]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
