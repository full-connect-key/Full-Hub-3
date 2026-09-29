"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CampoDaPorta } from "@/components/auth/campo-da-porta";
import { TituloDaPorta } from "@/components/auth/lema-da-agencia";
import { Button } from "@/components/ui/button";
import {
  enviarLinkDeRecuperacao,
  type EstadoFormulario,
} from "@/lib/auth/acoes";
import {
  esquemaDeRecuperacao,
  type DadosDeRecuperacao,
} from "@/lib/auth/esquemas";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeRecuperacao() {
  const [estado, acao, enviando] = useActionState(
    enviarLinkDeRecuperacao,
    ESTADO_INICIAL,
  );

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
    <div className="flex flex-col gap-[22px] sm:gap-[26px]">
      <div>
        <TituloDaPorta>Recuperar senha</TituloDaPorta>
        <p className="text-auth-apoio mt-[11px] text-sm leading-relaxed">
          Informe seu e-mail e enviaremos um link para criar uma senha nova.
        </p>
      </div>

      <form onSubmit={enviar} noValidate className="space-y-4">
        {estado.erro ? (
          <Alert variant="destructive" className="text-left">
            <AlertCircle />
            <AlertDescription>{estado.erro}</AlertDescription>
          </Alert>
        ) : null}
        {estado.sucesso ? (
          <Alert variant="success" className="text-left">
            <CheckCircle2 />
            <AlertDescription>{estado.sucesso}</AlertDescription>
          </Alert>
        ) : null}

        <CampoDaPorta
          id="email"
          rotulo="E-mail"
          tipo="email"
          icone={Mail}
          autoComplete="email"
          placeholder="seu@email.com"
          autoFocus
          erro={errors.email?.message}
          registro={register("email")}
        />

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : null}
          {enviando ? "Enviando..." : "Enviar link"}
        </Button>

        <p className="text-center">
          <Link
            href="/login"
            className="text-auth-apoio hover:text-auth-texto text-[13.5px] underline underline-offset-[3px]"
          >
            Voltar para o login
          </Link>
        </p>
      </form>
    </div>
  );
}
