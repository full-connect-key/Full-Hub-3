"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
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

import { removerAcessoDoUsuario } from "../acoes";

export type UsuarioComAcesso = {
  vinculoId: string;
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  ultimoAcesso: string | null;
};

const esquema = z.object({
  nome: z.string().min(2, "Informe o nome de quem vai acessar."),
  email: z.string().email("Esse e-mail não parece válido."),
});

type Dados = z.infer<typeof esquema>;

function DialogoDeConvite({ clientId, nomeDaEmpresa }: { clientId: string; nomeDaEmpresa: string }) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: { nome: "", email: "" } });

  const enviar = handleSubmit(async (dados) => {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/usuarios/cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...dados }),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        toast.error(corpo.erro ?? "Não foi possível convidar.");
        return;
      }
      toast.success(corpo.mensagem ?? "Convite enviado.");
      setAberto(false);
      reset();
      router.refresh();
    } catch {
      toast.error("Não foi possível falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden />
          Convidar usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar para o portal</DialogTitle>
          <DialogDescription>
            A pessoa recebe um e-mail para definir a senha e passa a enxergar {nomeDaEmpresa} no
            portal. Todos os acessos de um cliente são iguais — não há níveis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="convite-nome">Nome</Label>
            <Input id="convite-nome" aria-invalid={!!errors.nome} autoFocus {...register("nome")} />
            {errors.nome ? <p className="text-destructive text-xs">{errors.nome.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="convite-email">E-mail</Label>
            <Input
              id="convite-email"
              type="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email ? <p className="text-destructive text-xs">{errors.email.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsuariosDoCliente({
  clientId,
  nomeDaEmpresa,
  usuarios,
}: {
  clientId: string;
  nomeDaEmpresa: string;
  usuarios: UsuarioComAcesso[];
}) {
  const [, iniciar] = useTransition();
  const router = useRouter();

  function remover(vinculoId: string) {
    iniciar(async () => {
      const resultado = await removerAcessoDoUsuario(vinculoId, clientId);
      if (resultado.erro) toast.error(resultado.erro);
      else {
        toast.success(resultado.ok ?? "Acesso removido.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Quem do lado do cliente enxerga {nomeDaEmpresa} no portal.
        </p>
        <DialogoDeConvite clientId={clientId} nomeDaEmpresa={nomeDaEmpresa} />
      </div>

      {usuarios.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Ninguém tem acesso ainda"
          description="Convide o contato da empresa para ele acompanhar os conteúdos e as campanhas pelo portal."
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {usuarios.map((usuario) => (
            <li key={usuario.vinculoId} className="flex flex-wrap items-center gap-3 p-3">
              <UserAvatar name={usuario.nome} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{usuario.nome}</p>
                <p className="text-muted-foreground truncate text-xs">{usuario.email}</p>
              </div>
              <p className="text-muted-foreground text-xs">
                {usuario.ultimoAcesso
                  ? `Último acesso em ${format(parseISO(usuario.ultimoAcesso), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}`
                  : "Nunca acessou"}
              </p>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Remover acesso de ${usuario.nome}`}>
                    <Trash2 aria-hidden />
                  </Button>
                }
                title={`Remover o acesso de ${usuario.nome}?`}
                description="A conta continua existindo, mas a pessoa deixa de enxergar esta empresa no portal."
                confirmLabel="Remover acesso"
                destructive
                onConfirm={() => remover(usuario.vinculoId)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
