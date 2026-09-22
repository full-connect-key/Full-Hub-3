"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, MessageSquareQuote, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { MinhaSkill } from "@/lib/dados/skills";
import { OPACIDADE_DO_NIVEL, ROTULOS_DE_NIVEL } from "@/lib/dominio/skills";
import type { SkillAvaliacao } from "@/lib/supabase/database.types";

import { registrarAvaliacao } from "../../meu-desenvolvimento/acoes";

/**
 * As skills de alguém, vistas pela gestão.
 *
 * **Somente leitura, e isso é a regra, não uma etapa.** Nível é autoavaliação:
 * se a gestão pudesse editar aqui, o número passaria a dizer duas coisas ao
 * mesmo tempo. O RLS recusa de qualquer forma — a tela não oferece.
 *
 * O que a gestão escreve é a observação, que é outra voz e tem lugar próprio.
 * E a pessoa lê: o aviso acima da caixa diz isso antes de alguém começar a
 * escrever, porque quem sabe que vai ser lido escreve melhor.
 */
export function SkillsDaPessoa({
  pessoaId,
  nome,
  skills,
  avaliacoes,
}: {
  pessoaId: string;
  nome: string;
  skills: MinhaSkill[];
  avaliacoes: (SkillAvaliacao & { autor: { id: string; nome: string } | null })[];
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [texto, setTexto] = useState("");

  const porCategoria = new Map<string, MinhaSkill[]>();
  for (const skill of skills) {
    const atual = porCategoria.get(skill.categoria) ?? [];
    atual.push(skill);
    porCategoria.set(skill.categoria, atual);
  }

  const querDesenvolver = skills.filter((s) => s.querDesenvolver);

  function registrar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => registrarAvaliacao(pessoaId, texto));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setTexto("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {skills.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={`${nome.split(" ")[0]} ainda não preencheu o perfil`}
          description="Só a própria pessoa registra as habilidades dela — o nível é autoavaliação. Vale combinar numa conversa."
        />
      ) : (
        <div className="space-y-5">
          {[...porCategoria.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
            .map(([categoria, lista]) => (
              <section key={categoria} className="space-y-2">
                <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
                  {categoria}
                </h3>
                <ul className="bg-surface-card rounded-card divide-y border">
                  {lista.map((skill) => (
                    <li key={skill.skillId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                      <span className="min-w-40 flex-1 text-sm font-medium">{skill.nome}</span>

                      <span
                        aria-hidden
                        className="bg-accent-strong size-4 rounded-sm"
                        style={{ opacity: OPACIDADE_DO_NIVEL[skill.nivel] }}
                      />
                      <span className="text-text-secondary w-28 text-xs">
                        {ROTULOS_DE_NIVEL[skill.nivel]}
                      </span>

                      {skill.anosExperiencia !== null ? (
                        <span className="text-text-muted text-xs tabular-nums">
                          {skill.anosExperiencia} ano{skill.anosExperiencia === 1 ? "" : "s"}
                        </span>
                      ) : null}

                      {skill.querDesenvolver ? (
                        <Star aria-label="Quer desenvolver" className="text-warning size-3.5 fill-current" />
                      ) : null}

                      {skill.observacao ? (
                        <span className="text-text-muted w-full text-xs">{skill.observacao}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

          {querDesenvolver.length > 0 ? (
            <p className="text-text-secondary flex flex-wrap items-center gap-2 text-sm">
              <Star aria-hidden className="text-warning size-3.5 fill-current" />
              Quer desenvolver:
              {querDesenvolver.map((s) => (
                <Badge key={s.skillId} variant="secondary">
                  {s.nome}
                </Badge>
              ))}
            </p>
          ) : null}
        </div>
      )}

      <section className="space-y-3 border-t pt-5">
        <div>
          <h3 className="text-text-primary flex items-center gap-2 text-sm font-semibold">
            <MessageSquareQuote aria-hidden className="size-4" />
            Observação sobre o desenvolvimento
          </h3>
          <p className="text-text-secondary text-sm">
            <strong>{nome.split(" ")[0]} lê o que você escrever aqui.</strong> Avaliação que o
            avaliado não pode ler é feedback pelas costas — e quem escreve sabendo que vai ser lido
            escreve melhor.
          </p>
        </div>

        <Textarea
          rows={3}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Evoluiu muito em motion no último trimestre. Vale puxar o próximo projeto de abertura."
        />

        <Button size="sm" disabled={salvando || texto.trim().length < 3} onClick={registrar}>
          {salvando ? <Loader2 className="animate-spin" /> : null}
          Registrar observação
        </Button>

        {avaliacoes.length > 0 ? (
          <ul className="space-y-2 pt-2">
            {avaliacoes.map((avaliacao) => (
              <li key={avaliacao.id} className="bg-surface-card rounded-card border p-3">
                <p className="text-sm">{avaliacao.texto}</p>
                <p className="text-text-muted mt-1 text-xs">
                  {avaliacao.autor?.nome ?? "Gestão"} ·{" "}
                  {format(parseISO(avaliacao.created_at), "d 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
