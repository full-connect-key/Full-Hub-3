"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EnviarArquivos } from "@/components/shared/enviar-arquivos";
import { Button } from "@/components/ui/button";
import { ehImagem } from "@/lib/dominio/tasks";
import type { TaskReferencia } from "@/lib/supabase/database.types";

import { adicionarReferencia, removerReferencia, urlDoArquivo } from "../acoes-de-itens";
import { chamarAcao } from "@/lib/acoes/cliente";


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

  /**
   * O QUE FAZER COM O QUE SUBIU — uma referência por arquivo.
   *
   * **O laço de upload saiu daqui** com o teto de 15 MB escrito à mão, que era
   * o único dos três uploaders a ter um: ele valia para tudo, então um PSD de
   * peça impressa era recusado com uma frase sobre 15 MB. O teto agora é por
   * família (`TETO_DA_FAMILIA`), e quem o confere é `EnviarArquivos` — antes
   * de um byte subir, e não depois.
   */
  async function anexar(subidos: { url: string; nome: string }[]) {
    for (const arquivo of subidos) {
      const resultado = await chamarAcao(() =>
        adicionarReferencia(taskId, {
          tipo: "arquivo",
          url: arquivo.url,
          titulo: arquivo.nome,
          arquivo_nome: arquivo.nome,
        }),
      );
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
    }
    toast.success(
      subidos.length === 1 ? "Arquivo anexado." : `${subidos.length} arquivos anexados.`,
    );
    router.refresh();
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
            {/* AS CINCO FAMÍLIAS: referência de produção é a arte de
                inspiração, o PDF do briefing do cliente, o PSD que serve de
                base e o vídeo de exemplo. `outro` entra porque esta tela
                aceitava tudo e o item 30 é um piso — o que ela ganha é o teto
                por família e a barra de progresso. */}
            <EnviarArquivos
              bucket="task-arquivos"
              familias={["imagem", "documento", "criacao", "video", "outro"]}
              varios
              rotulo="Arquivo"
              rotuloDoCampo="Escolher arquivos para anexar como referência"
              caminho={(arquivo, i) =>
                `${taskId}/${Date.now()}-${i}-${arquivo.name}`
              }
              onPronto={anexar}
            />
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
