"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CapaDoCartao } from "@/components/shared/capa-do-cartao";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import { criarClienteNavegador } from "@/lib/supabase/client";

import { trocarCapaDaCampanha } from "./acoes-de-campanha";

const BUCKET = "campanhas-arquivos";

/**
 * A capa do cartão, e o botão que a troca (0050).
 *
 * **O arquivo sobe pela sessão de quem está clicando**, como no editor de
 * post: a policy `"campanhas: equipe escreve"` continua valendo, e o binário
 * não atravessa o servidor do Next para não ganhar checagem nenhuma no
 * caminho. Para a action vai só o caminho.
 *
 * **O CAMINHO COMEÇA PELA PASTA DO CLIENTE**, e isso não é arrumação: a
 * policy `"campanhas: cliente le"` compara `(storage.foldername(name))[1]`
 * com as empresas de quem pede. Uma capa na raiz a equipe vê e o cliente não
 * — e ela aparece quebrada justamente na tela para a qual foi feita.
 */
export function CapaDaCampanha({
  campanhaId,
  clienteId,
  nome,
  capaAssinada,
  temCapa,
  podeTrocar,
}: {
  campanhaId: string;
  clienteId: string;
  nome: string;
  capaAssinada: string | null;
  temCapa: boolean;
  podeTrocar: boolean;
}) {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [gravando, gravar] = useTransition();
  const ocupado = subindo || gravando;

  async function subir(arquivo: File | undefined) {
    if (!arquivo) return;
    setSubindo(true);
    try {
      const supabase = criarClienteNavegador();
      const extensao = arquivo.name.split(".").pop() ?? "png";
      const caminho = `${clienteId}/capas/${campanhaId}-${Date.now()}.${extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, { contentType: arquivo.type });

      if (error) {
        toast.error(`Não foi possível enviar a capa: ${error.message}`);
        return;
      }

      const r = await chamarAcao(() => trocarCapaDaCampanha(campanhaId, caminho));
      if (r.ok) {
        toast.success(r.mensagem);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSubindo(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  function tirar() {
    gravar(async () => {
      const r = await chamarAcao(() => trocarCapaDaCampanha(campanhaId, null));
      if (r.ok) {
        toast.success(r.mensagem);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <CapaDoCartao url={capaAssinada} alt={nome} vazia={podeTrocar} />

      {podeTrocar ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={arquivoRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => subir(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={ocupado}
            onClick={() => arquivoRef.current?.click()}
          >
            {subindo ? (
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus aria-hidden className="size-3.5" />
            )}
            {temCapa ? "Trocar capa" : "Pôr uma capa"}
          </Button>

          {/* TIRAR A CAPA NÃO APAGA O ARQUIVO, e o rótulo diz "Tirar" e não
              "Excluir" por isso: o cartão volta ao desenho de texto, o arquivo
              fica no bucket. */}
          {temCapa ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={ocupado}
              onClick={tirar}
              aria-label={`Tirar a capa de ${nome}`}
            >
              <Trash2 aria-hidden className="size-3.5" />
              Tirar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
