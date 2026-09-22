import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquareQuote } from "lucide-react";

import type { SkillAvaliacao } from "@/lib/supabase/database.types";

/**
 * O que a gestão registrou sobre o desenvolvimento desta pessoa.
 *
 * Aparece aqui, para o avaliado, e não só na tela da gestão. Avaliação que o
 * avaliado não pode ler é feedback pelas costas — e quem escreve sabendo que
 * vai ser lido escreve melhor.
 *
 * Quando não há nenhuma, a seção some inteira: um "nenhuma observação ainda"
 * permanente faria a pessoa achar que está sendo esquecida.
 */
export function Avaliacoes({
  avaliacoes,
}: {
  avaliacoes: (SkillAvaliacao & { autor: { id: string; nome: string } | null })[];
}) {
  if (avaliacoes.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-text-muted flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <MessageSquareQuote aria-hidden className="size-3.5" />
        Observações da gestão
      </h2>

      <ul className="space-y-2">
        {avaliacoes.map((avaliacao) => (
          <li key={avaliacao.id} className="bg-surface-card rounded-card border p-4">
            <p className="text-text-primary text-sm">{avaliacao.texto}</p>
            <p className="text-text-muted mt-1.5 text-xs">
              {avaliacao.autor?.nome ?? "Gestão"} ·{" "}
              {format(parseISO(avaliacao.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
