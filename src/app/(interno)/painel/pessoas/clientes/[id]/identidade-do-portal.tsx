"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { toast } from "sonner";

import { trocarIdentidadeDoPortal } from "../acoes";

const BUCKET = "campanhas-arquivos";

type Campo = "capa_url" | "logo_url";

/**
 * A capa e a foto de perfil do portal daquele cliente (0063).
 *
 * ---------------------------------------------------------------------------
 * **A PRÉVIA É O DESENHO REAL, e não dois quadrados lado a lado.**
 *
 * Quem sobe a capa está escolhendo uma imagem para um lugar específico: uma
 * faixa larga com um círculo de 96px cobrindo o canto inferior esquerdo. Numa
 * prévia de dois quadrados, a pessoa só descobre que a foto tapou o rosto da
 * modelo depois de abrir o portal do cliente — e ela raramente abre.
 *
 * É a mesma razão pela qual `CapaDoCartao` é o mesmo componente nos dois
 * lados desde a 0050: duas proporções fariam a mesma imagem parecer outra em
 * cada tela.
 * ---------------------------------------------------------------------------
 *
 * **O arquivo sobe pela sessão de quem está clicando**, como no editor de post
 * e na capa da campanha: o binário não atravessa o servidor do Next, e a
 * policy do bucket continua valendo. Para a action vai só o caminho.
 *
 * **O caminho começa pela pasta do cliente** — a policy do bucket compara
 * `(storage.foldername(name))[1]` com as empresas de quem pede. Uma imagem na
 * raiz a equipe vê e o cliente não, e ela aparece quebrada justamente na tela
 * para a qual foi feita.
 */
export function IdentidadeDoPortal({
  clienteId,
  nome,
  capaAssinada,
  fotoAssinada,
  temCapa,
  temFoto,
}: {
  clienteId: string;
  nome: string;
  capaAssinada: string | null;
  fotoAssinada: string | null;
  temCapa: boolean;
  temFoto: boolean;
}) {
  const router = useRouter();
  const capaRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState<Campo | null>(null);
  const [tirando, tirar] = useTransition();
  const ocupado = subindo !== null || tirando;

  async function subir(campo: Campo, arquivo: File | undefined) {
    if (!arquivo) return;
    setSubindo(campo);
    try {
      const supabase = criarClienteNavegador();
      const extensao = arquivo.name.split(".").pop() ?? "png";
      const pasta = campo === "capa_url" ? "portal/capa" : "portal/foto";
      const caminho = `${clienteId}/${pasta}-${Date.now()}.${extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, { contentType: arquivo.type });

      if (error) {
        toast.error(`Não foi possível enviar a imagem: ${error.message}`);
        return;
      }

      const r = await chamarEMostrar(() =>
        trocarIdentidadeDoPortal({ id: clienteId, campo, caminho }),
      );
      if (r.ok) router.refresh();
    } finally {
      setSubindo(null);
      const ref = campo === "capa_url" ? capaRef : fotoRef;
      if (ref.current) ref.current.value = "";
    }
  }

  function remover(campo: Campo) {
    tirar(async () => {
      const r = await chamarEMostrar(() =>
        trocarIdentidadeDoPortal({ id: clienteId, campo, caminho: null }),
      );
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="bg-surface-card space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-base font-semibold">Identidade do portal</h2>
        <p className="text-text-secondary text-sm">
          É o que {nome} vê ao entrar. As duas são da agência — o cliente não
          troca nenhuma das duas por lá.
        </p>
      </div>

      {/* A PRÉVIA, no desenho de verdade. */}
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-brand-navy h-28 w-full overflow-hidden sm:h-36">
          {capaAssinada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capaAssinada} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="bg-surface-page flex items-end gap-3 px-4 pb-3">
          <div className="ring-surface-page bg-surface-card -mt-8 size-16 shrink-0 overflow-hidden rounded-full ring-4">
            {fotoAssinada ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoAssinada}
                alt={`Logo de ${nome}`}
                className="size-full object-cover"
              />
            ) : (
              <div className="text-text-secondary flex size-full items-center justify-center">
                <Building2 aria-hidden className="size-6" />
              </div>
            )}
          </div>
          <p className="min-w-0 truncate pb-1 text-sm font-medium">{nome}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={capaRef}
          type="file"
          aria-label="Escolher a imagem de capa do portal"
          accept="image/*"
          className="sr-only"
          onChange={(e) => subir("capa_url", e.target.files?.[0])}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => capaRef.current?.click()}
        >
          {subindo === "capa_url" ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
          ) : (
            <ImagePlus aria-hidden className="size-3.5" />
          )}
          {temCapa ? "Trocar capa" : "Pôr uma capa"}
        </Button>

        <input
          ref={fotoRef}
          type="file"
          aria-label="Escolher a foto de perfil do portal"
          accept="image/*"
          className="sr-only"
          onChange={(e) => subir("logo_url", e.target.files?.[0])}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => fotoRef.current?.click()}
        >
          {subindo === "logo_url" ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
          ) : (
            <ImagePlus aria-hidden className="size-3.5" />
          )}
          {temFoto ? "Trocar foto" : "Pôr uma foto"}
        </Button>

        {/* TIRAR NÃO APAGA O ARQUIVO, e o rótulo diz "Tirar" e não "Excluir":
            o objeto continua no bucket, como na capa da campanha. Apagar não é
            desfazer — quem tirou a imagem errada não teria como pô-la de
            volta. */}
        {temCapa ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={ocupado}
            onClick={() => remover("capa_url")}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Tirar capa
          </Button>
        ) : null}
        {temFoto ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={ocupado}
            onClick={() => remover("logo_url")}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Tirar foto
          </Button>
        ) : null}
      </div>
    </section>
  );
}
