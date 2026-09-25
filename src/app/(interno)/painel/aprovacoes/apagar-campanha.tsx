"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";

import { apagarCampanha } from "./acoes-de-campanha";

/**
 * Apagar a campanha, com o nome digitado.
 *
 * **É o modo de digitação do `ConfirmDialog`, e não um "tem certeza?".**
 * Apagar leva a árvore inteira — entregáveis, versões, comentários e as
 * rodadas de aprovação, inclusive as que o cliente já decidiu. Um clique
 * distraído não pode alcançar isso, e o teclado que digita "Wave Outubro
 * Rosa" é o que obriga a pessoa a ler qual campanha está na frente dela.
 *
 * **A contagem vai na descrição**, e é ela que faz alguém parar: "apagar esta
 * campanha" não informa nada; "vão junto 13 materiais, 9 deles já aprovados
 * pelo cliente" informa.
 */
export function ApagarCampanha({
  campanhaId,
  nome,
  materiais,
  aprovados,
}: {
  campanhaId: string;
  nome: string;
  materiais: number;
  aprovados: number;
}) {
  const router = useRouter();
  const [apagando, apagar] = useTransition();

  function confirmar() {
    apagar(async () => {
      const r = await chamarAcao(() => apagarCampanha(campanhaId));
      if (r.ok) {
        toast.success(r.mensagem);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          disabled={apagando}
          aria-label={`Apagar a campanha ${nome}`}
          className="text-text-muted hover:text-danger"
        >
          <Trash2 aria-hidden className="size-3.5" />
          Apagar
        </Button>
      }
      title={`Apagar "${nome}"?`}
      destructive
      confirmLabel="Apagar campanha"
      confirmationText={nome}
      description={
        <>
          <span className="block">
            {materiais === 0
              ? "Esta campanha ainda não tem material."
              : aprovados === 0
                ? `Vão junto ${materiais} ${materiais === 1 ? "material" : "materiais"}, com as versões e os comentários.`
                : `Vão junto ${materiais} ${materiais === 1 ? "material" : "materiais"} — ${aprovados} ${aprovados === 1 ? "já aprovado" : "já aprovados"} pelo cliente —, com as versões, os comentários e o registro de cada aprovação.`}
          </span>
          <span className="mt-2 block">
            Não há como desfazer. Para confirmar, digite o nome da campanha.
          </span>
        </>
      }
      onConfirm={confirmar}
    />
  );
}
