import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye } from "lucide-react";

import type { VisitaAoPortal } from "@/lib/dados/acessos";

/**
 * Quem da agência abriu o portal deste cliente (0009, lida desde agora).
 *
 * ---------------------------------------------------------------------------
 * **O BLOCO SÓ EXISTE PARA A GESTÃO, e não porque o dado seja secreto.**
 *
 * `client_portal_views_select` fecha em `is_gestor()` desde a 0009 — quem não
 * é recebe lista vazia pelo RLS. Desenhar o bloco assim mesmo mostraria
 * "ninguém abriu o portal deste cliente" para o colaborador, que é uma
 * afirmação falsa dita com a maior confiança: lista vazia é indistinguível da
 * verdade, e é o modo de falha que este produto já pagou caro.
 *
 * A trava continua sendo a policy; isto é só não mentir na tela.
 * ---------------------------------------------------------------------------
 *
 * **E ele some quando ainda não houve visita nenhuma**, como os blocos de
 * exceção da Home: um quadro dizendo "nenhuma" ocupa altura numa ficha que já
 * é longa, e a ausência de visitas não é notícia — é o primeiro dia de todo
 * cliente.
 */
export function VisitasAoPortal({ visitas }: { visitas: VisitaAoPortal[] }) {
  if (visitas.length === 0) return null;

  return (
    <section className="bg-surface-card space-y-3 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Eye aria-hidden className="text-text-secondary size-4" />
        <h2 className="text-base font-semibold">Quem da agência abriu o portal</h2>
      </div>

      <p className="text-text-secondary text-sm">
        A visualização administrativa é só leitura — nenhuma decisão do cliente
        sai daqui. Estas são as últimas aberturas.
      </p>

      <ul className="divide-y text-sm">
        {visitas.map((visita) => (
          <li
            key={visita.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 py-2"
          >
            <span>{visita.quem}</span>
            {/* `date-fns` e NÃO `DateBadge`: esta data registra quando algo
                aconteceu, e não um prazo a vencer. O selo pintaria de vermelho
                toda visita da semana passada, como se fosse atraso. */}
            <span className="text-text-muted text-xs tabular-nums">
              {format(parseISO(visita.quando), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
