"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Clock, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type EstadoFormulario } from "@/lib/auth/acoes";
import { esquemaDeLogin, type DadosDeLogin } from "@/lib/auth/esquemas";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeLogin({
  destino,
  saiuPorInatividade,
}: {
  destino: string;
  saiuPorInatividade: boolean;
}) {
  const [estado, acao, enviando] = useActionState(entrar, ESTADO_INICIAL);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosDeLogin>({
    resolver: zodResolver(esquemaDeLogin),
    defaultValues: { email: "", senha: "" },
  });

  // O react-hook-form valida primeiro, aqui no navegador, para o erro aparecer
  // na hora. So depois a action e chamada -- e ela valida de novo no servidor,
  // porque validacao de navegador nao protege nada.
  const enviar = handleSubmit((dados) => {
    const formData = new FormData();
    formData.set("email", dados.email);
    formData.set("senha", dados.senha);
    formData.set("redirecionar", destino);
    startTransition(() => acao(formData));
  });

  return (
    <Card>
      <CardContent>
        <form onSubmit={enviar} noValidate className="space-y-4">
          {saiuPorInatividade && !estado.erro ? (
            <Alert variant="warning">
              <Clock />
              <AlertDescription>
                Sua sessão foi encerrada por inatividade. Entre novamente para continuar.
              </AlertDescription>
            </Alert>
          ) : null}

          {estado.erro ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@fullconnectkey.com.br"
              aria-invalid={!!errors.email}
              autoFocus
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.senha}
              {...register("senha")}
            />
            {errors.senha ? (
              <p className="text-destructive text-xs">{errors.senha.message}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? <Loader2 className="animate-spin" /> : null}
            {enviando ? "Entrando..." : "Entrar"}
          </Button>

          <p className="text-center text-sm">
            <Link href="/esqueci-senha" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              Esqueci minha senha
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
