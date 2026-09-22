"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { definirNovaSenha, type EstadoFormulario } from "@/lib/auth/acoes";
import { esquemaDeNovaSenha, type DadosDeNovaSenha } from "@/lib/auth/esquemas";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeNovaSenha() {
  const [estado, acao, enviando] = useActionState(definirNovaSenha, ESTADO_INICIAL);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosDeNovaSenha>({
    resolver: zodResolver(esquemaDeNovaSenha),
    defaultValues: { senha: "", confirmacao: "" },
  });

  const enviar = handleSubmit((dados) => {
    const formData = new FormData();
    formData.set("senha", dados.senha);
    formData.set("confirmacao", dados.confirmacao);
    startTransition(() => acao(formData));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Criar nova senha</CardTitle>
        <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} noValidate className="space-y-4">
          {estado.erro ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.senha}
              autoFocus
              {...register("senha")}
            />
            {errors.senha ? (
              <p className="text-destructive text-xs">{errors.senha.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacao">Confirme a nova senha</Label>
            <Input
              id="confirmacao"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmacao}
              {...register("confirmacao")}
            />
            {errors.confirmacao ? (
              <p className="text-destructive text-xs">{errors.confirmacao.message}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? <Loader2 className="animate-spin" /> : null}
            {enviando ? "Salvando..." : "Salvar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
