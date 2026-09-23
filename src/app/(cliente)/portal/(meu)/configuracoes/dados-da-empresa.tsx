"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chamarAcao } from "@/lib/acoes/cliente";

import { salvarContatoDaMinhaEmpresa } from "../../_actions/empresa";

/**
 * Os dados que o cliente mantém.
 *
 * **Nome da empresa aparece, e não é editável.** Some-lo confundiria quem abre
 * a tela para conferir se está no lugar certo; deixá-lo editável prometeria
 * uma escrita que o trigger `protect_client_columns` desfaz em silêncio. Então
 * ele é texto, com a frase que diz a quem pedir.
 */

const esquema = z.object({
  nome_contato: z.string().max(120).optional(),
  email_contato: z
    .union([z.string().email("E-mail inválido."), z.literal("")])
    .optional(),
  telefone: z.string().max(40).optional(),
});

type Campos = z.infer<typeof esquema>;

export function DadosDaEmpresa({
  clienteId,
  nomeDaEmpresa,
  iniciais,
}: {
  clienteId: string;
  nomeDaEmpresa: string;
  iniciais: Campos;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  const form = useForm<Campos>({
    resolver: zodResolver(esquema),
    defaultValues: iniciais,
  });

  function enviar(valores: Campos) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        salvarContatoDaMinhaEmpresa({ client_id: clienteId, ...valores }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} className="space-y-5">
      <div className="bg-surface-card rounded-xl border p-4">
        <p className="text-text-muted text-sm">Empresa</p>
        <p className="mt-1 font-medium">{nomeDaEmpresa}</p>
        <p className="text-text-muted mt-2 text-sm">
          Para mudar o nome da empresa, fale com a sua equipe de atendimento.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nome_contato">Pessoa de contato</Label>
          <Input id="nome_contato" {...form.register("nome_contato")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" inputMode="tel" {...form.register("telefone")} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="email_contato">E-mail de contato</Label>
          <Input
            id="email_contato"
            type="email"
            {...form.register("email_contato")}
          />
          {form.formState.errors.email_contato ? (
            <p className="text-danger text-sm">
              {form.formState.errors.email_contato.message}
            </p>
          ) : null}
        </div>
      </div>

      <Button type="submit" disabled={salvando}>
        {salvando ? <Loader2 className="animate-spin" /> : null}
        Salvar
      </Button>
    </form>
  );
}
