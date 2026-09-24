"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { esquemaDeNovaSenha, type DadosDeNovaSenha } from "@/lib/auth/esquemas";

import { trocarSenhaDoPrimeiroAcesso, type EstadoDaTroca } from "./acoes";

const ESTADO_INICIAL: EstadoDaTroca = {};

/**
 * O primeiro acesso.
 *
 * A tela DIZ por que está pedindo isso. Um formulário de senha que aparece do
 * nada, logo depois de a pessoa ter acabado de entrar com uma senha que
 * funcionou, parece erro do sistema — e quem acha que é erro tenta de novo em
 * vez de trocar.
 *
 * Não tem "pular" nem "depois", e é o desenho: a senha provisória passou pela
 * mão de outra pessoa, num chat ou por telefone. Enquanto ela valer, o acesso
 * não é só de quem está logado.
 */
export function FormularioDeTroca({ nome }: { nome: string }) {
  const [estado, acao, enviando] = useActionState(
    trocarSenhaDoPrimeiroAcesso,
    ESTADO_INICIAL,
  );

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

  const primeiroNome = nome.trim().split(/\s+/)[0] ?? nome;

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck
            aria-hidden
            className="text-accent-strong size-5 shrink-0"
          />
          Olá, {primeiroNome}
        </h1>
        <p className="text-text-muted text-sm">
          Você entrou com uma senha provisória, que alguém da equipe passou para
          você. Escolha agora uma senha que só você conhece — a provisória deixa
          de valer.
        </p>
      </div>

      <form onSubmit={enviar} noValidate className="space-y-4">
        {estado.erro ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{estado.erro}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="senha">Sua nova senha</Label>
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
          ) : (
            <p className="text-text-muted text-xs">Pelo menos 8 caracteres.</p>
          )}
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
            <p className="text-destructive text-xs">
              {errors.confirmacao.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : null}
          {enviando ? "Salvando..." : "Salvar e entrar"}
        </Button>
      </form>
    </div>
  );
}
