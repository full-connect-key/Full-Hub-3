"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  EXPLICACAO_DO_TIPO,
  ROTULOS_DE_TIPO,
  TIPOS_DO_ACERVO,
  slugDoTitulo,
} from "@/lib/dominio/academy";
import type { AcademyTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { salvarItem } from "../acoes";

export function FormularioDoItem() {
  const router = useRouter();
  const [enviando, começar] = useTransition();

  const [tipo, setTipo] = useState<AcademyTipo>("playbook");
  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tags, setTags] = useState("");

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    começar(async () => {
      const r = await chamarAcao(() =>
        salvarItem(null, {
          tipo,
          titulo,
          resumo: resumo || null,
          categoria: categoria || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      );
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensagem);
      router.push(`/painel/academy/${slugDoTitulo(titulo)}`);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <SecaoDoFormulario numero={1} titulo="Qual é o formato">
        <p className="text-text-secondary mb-3 text-xs">
          Ele não se troca depois: o conteúdo de cada formato mora em lugar diferente.
        </p>
        <div
          role="radiogroup"
          aria-label="Formato do item"
          className="grid gap-2 sm:grid-cols-3"
        >
          {TIPOS_DO_ACERVO.map((chave) => (
            <button
              key={chave}
              type="button"
              role="radio"
              aria-checked={tipo === chave}
              onClick={() => setTipo(chave)}
              className={cn(
                "rounded-card border p-3 text-left transition-colors",
                tipo === chave
                  ? "border-action bg-action-soft"
                  : "bg-card hover:border-action/40",
              )}
            >
              <span className="text-text-primary block text-sm font-medium">
                {ROTULOS_DE_TIPO[chave]}
              </span>
              <span className="text-text-secondary mt-0.5 block text-xs">
                {EXPLICACAO_DO_TIPO[chave]}
              </span>
            </button>
          ))}
        </div>
      </SecaoDoFormulario>

      <SecaoDoFormulario numero={2} titulo="Como ele se chama">
        <div className="space-y-4">
          <p className="text-text-secondary text-xs">
            O título vira o endereço, e o endereço não muda se o título mudar depois.
          </p>
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              placeholder="Briefing que não volta com dúvida"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resumo">Resumo</Label>
            <Textarea
              id="resumo"
              value={resumo}
              onChange={(evento) => setResumo(evento.target.value)}
              rows={2}
              placeholder="Uma linha. É ela que aparece no cartão do acervo."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
                placeholder="Atendimento, Produção, Cultura…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Etiquetas</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(evento) => setTags(evento.target.value)}
                placeholder="separadas por vírgula"
              />
            </div>
          </div>
        </div>
      </SecaoDoFormulario>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={enviando || titulo.trim().length < 2}>
          Criar rascunho
        </Button>
        <p className="text-text-muted text-xs">
          Ele nasce como rascunho: só você e a gestão enxergam até ser publicado.
        </p>
      </div>
    </form>
  );
}
