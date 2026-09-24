"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarLinkDeRecuperacao, type EstadoFormulario } from "@/lib/auth/acoes";
import { esquemaDeRecuperacao, type DadosDeRecuperacao } from "@/lib/auth/esquemas";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeRecuperacao() {
  const [estado, acao, enviando] = useActionState(enviarLinkDeRecuperacao, ESTADO_INICIAL);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosDeRecuperacao>({
    resolver: zodResolver(esquemaDeRecuperacao),
    defaultValues: { email: "" },
  });

  const enviar = handleSubmit((dados) => {
    const formData = new FormData();
    formData.set("email", dados.email);
    startTransition(() => acao(formData));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recuperar senha</CardTitle>
        <CardDescription>
          Informe seu e-mail e enviaremos um link para criar uma senha nova.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} noValidate className="space-y-4">
          {estado.erro ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}
          {estado.sucesso ? (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertDescription>{estado.sucesso}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              aria-invalid={!!errors.email}
              autoFocus
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? <Loader2 className="animate-spin" /> : null}
            {enviando ? "Enviando..." : "Enviar link"}
          </Button>

          <p className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
