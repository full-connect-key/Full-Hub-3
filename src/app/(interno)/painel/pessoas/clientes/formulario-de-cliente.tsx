"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/lib/supabase/database.types";

import { salvarCliente } from "./acoes";
import { chamarAcao } from "@/lib/acoes/cliente";

const SEM_RESPONSAVEL = "__sem__";

const esquema = z.object({
  nome_empresa: z.string().min(2, "Informe o nome da empresa."),
  nome_contato: z.string().optional(),
  email_contato: z.union([z.string().email("E-mail de contato inválido."), z.literal("")]).optional(),
  telefone: z.string().optional(),
  segmento: z.string().optional(),
  responsavel_atendimento_id: z.string().optional(),
  drive_folder_id: z.string().optional(),
  observacoes: z.string().optional(),
});

type Dados = z.infer<typeof esquema>;

export function FormularioDeCliente({
  cliente,
  equipe,
  trigger,
}: {
  cliente?: Client;
  equipe: { id: string; nome: string }[];
  trigger: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [salvando, iniciar] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nome_empresa: cliente?.nome_empresa ?? "",
      nome_contato: cliente?.nome_contato ?? "",
      email_contato: cliente?.email_contato ?? "",
      telefone: cliente?.telefone ?? "",
      segmento: cliente?.segmento ?? "",
      responsavel_atendimento_id: cliente?.responsavel_atendimento_id ?? SEM_RESPONSAVEL,
      drive_folder_id: cliente?.drive_folder_id ?? "",
      observacoes: cliente?.observacoes ?? "",
    },
  });

  // useWatch em vez de watch(): watch() devolve uma função nova a cada
  // render, que o compilador do React não consegue memoizar com segurança.
  const responsavel = useWatch({ control, name: "responsavel_atendimento_id" });

  const enviar = handleSubmit((dados) => {
    iniciar(async () => {
      const resultado = await chamarAcao(() => salvarCliente({
        id: cliente?.id,
        ...dados,
        responsavel_atendimento_id:
          dados.responsavel_atendimento_id === SEM_RESPONSAVEL
            ? null
            : dados.responsavel_atendimento_id,
      }));

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.mensagem);
      setAberto(false);
      if (!cliente) reset();
    });
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Só o nome da empresa é obrigatório. O resto pode ser preenchido depois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_empresa">Nome da empresa *</Label>
            <Input id="nome_empresa" aria-invalid={!!errors.nome_empresa} {...register("nome_empresa")} />
            {errors.nome_empresa ? (
              <p className="text-destructive text-xs">{errors.nome_empresa.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome_contato">Nome do contato</Label>
              <Input id="nome_contato" {...register("nome_contato")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_contato">E-mail de contato</Label>
              <Input
                id="email_contato"
                type="email"
                aria-invalid={!!errors.email_contato}
                {...register("email_contato")}
              />
              {errors.email_contato ? (
                <p className="text-destructive text-xs">{errors.email_contato.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" placeholder="(11) 90000-0000" {...register("telefone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento</Label>
              <Input id="segmento" placeholder="Varejo, saúde, educação…" {...register("segmento")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável de atendimento</Label>
            <Select
              value={responsavel}
              onValueChange={(valor) => setValue("responsavel_atendimento_id", valor)}
            >
              <SelectTrigger aria-label="Responsável de atendimento" id="responsavel" className="w-full">
                <SelectValue placeholder="Escolha alguém da equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_RESPONSAVEL}>Sem responsável definido</SelectItem>
                {equipe.map((pessoa) => (
                  <SelectItem key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="drive_folder_id">ID da pasta no Drive</Label>
            <Input id="drive_folder_id" {...register("drive_folder_id")} />
            <p className="text-muted-foreground text-xs">
              Opcional. Será usado quando a integração com o Drive entrar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" rows={3} {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" /> : null}
              {cliente ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
