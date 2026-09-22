"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ehImagem } from "@/lib/dominio/tasks";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { TaskReferencia } from "@/lib/supabase/database.types";

import { adicionarReferencia, removerReferencia, urlDoArquivo } from "../acoes-de-itens";
import { chamarAcao } from "@/lib/acoes/cliente";

const TAMANHO_MAXIMO = 15 * 1024 * 1024;

/**
 * Referências da task: links e arquivos.
 *
 * Imagem vira miniatura; o resto vira lista. As URLs das imagens chegam já
 * assinadas do servidor — o bucket é privado, então caminho cru não abre.
 */
export function Referencias({
  taskId,
  referencias,
  urls,
  podeEditar,
}: {
  taskId: string;
  referencias: TaskReferencia[];
  urls: Record<string, string>;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [enviando, setEnviando] = useState(false);

  const imagens = referencias.filter((r) => r.tipo === "arquivo" && ehImagem(r.arquivo_nome));
  const outras = referencias.filter((r) => !(r.tipo === "arquivo" && ehImagem(r.arquivo_nome)));

  function remover(id: string) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => removerReferencia(id, taskId));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  async function abrirArquivo(caminho: string) {
    const resultado = await chamarAcao(() => urlDoArquivo(caminho));
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    if (!resultado.dados) {
      toast.error("O Storage não devolveu o endereço do arquivo.");
      return;
    }
    window.open(resultado.dados, "_blank", "noopener,noreferrer");
  }

  function adicionarLink() {
    const endereco = window.prompt("Endereço do link", "https://");
    if (!endereco?.trim()) return;
    const nome = window.prompt("Como chamar este link? (opcional)", "") ?? "";
    iniciar(async () => {
      const resultado = await chamarAcao(() => adicionarReferencia(taskId, {
        tipo: "link",
        url: endereco.trim(),
        titulo: nome.trim(),
      }));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  async function enviarArquivo(arquivo: File) {
    if (arquivo.size > TAMANHO_MAXIMO) {
      toast.error("O arquivo precisa ter no máximo 15 MB.");
      return;
    }
    setEnviando(true);
    try {
      const supabase = criarClienteNavegador();
      const caminho = `${taskId}/${Date.now()}-${arquivo.name}`;
      const { error } = await supabase.storage
        .from("task-arquivos")
        .upload(caminho, arquivo, { contentType: arquivo.type });

      if (error) {
        toast.error(`Não foi possível enviar: ${error.message}`);
        return;
      }

      const resultado = await chamarAcao(() => adicionarReferencia(taskId, {
        tipo: "arquivo",
        url: caminho,
        titulo: arquivo.name,
        arquivo_nome: arquivo.name,
      }));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success("Arquivo anexado.");
        router.refresh();
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Referências</h2>
        {podeEditar ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={adicionarLink}>
              <Link2 aria-hidden />
              Link
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                {enviando ? <Loader2 className="animate-spin" /> : <Paperclip aria-hidden />}
                Arquivo
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (arquivo) void enviarArquivo(arquivo);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
        ) : null}
      </div>

      {referencias.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma referência. Anexe o material visual ou os links que orientam a produção.
        </p>
      ) : null}

      {imagens.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {imagens.map((referencia) => (
            <li key={referencia.id} className="group relative">
              <button
                type="button"
                onClick={() => abrirArquivo(referencia.url)}
                className="block w-full overflow-hidden rounded-lg border"
                title={referencia.arquivo_nome ?? "Abrir"}
              >
                {urls[referencia.url] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[referencia.url]}
                    alt={referencia.titulo ?? referencia.arquivo_nome ?? "Referência"}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <span className="bg-muted flex aspect-square items-center justify-center">
                    <Paperclip aria-hidden className="text-muted-foreground size-5" />
                  </span>
                )}
              </button>
              {podeEditar ? (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-1.5 right-1.5 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Remover referência"
                  onClick={() => remover(referencia.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {outras.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {outras.map((referencia) => (
            <li key={referencia.id} className="flex items-center gap-2 p-2.5 text-sm">
              {referencia.tipo === "link" ? (
                <Link2 aria-hidden className="text-muted-foreground size-4 shrink-0" />
              ) : (
                <Paperclip aria-hidden className="text-muted-foreground size-4 shrink-0" />
              )}

              {referencia.tipo === "link" ? (
                <a
                  href={referencia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {referencia.titulo || referencia.url}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => abrirArquivo(referencia.url)}
                  className="min-w-0 flex-1 truncate text-left hover:underline"
                >
                  {referencia.titulo || referencia.arquivo_nome}
                </button>
              )}

              <ExternalLink aria-hidden className="text-muted-foreground size-3.5 shrink-0" />

              {podeEditar ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Remover referência"
                  onClick={() => remover(referencia.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
