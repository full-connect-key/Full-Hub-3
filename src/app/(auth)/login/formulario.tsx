"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Clock, Loader2, Lock, Mail } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CampoDaPorta } from "@/components/auth/campo-da-porta";
import {
  FraseDoPublico,
  SeletorDePublico,
} from "@/components/auth/casca-de-autenticacao";
import { LemaDaAgencia } from "@/components/auth/lema-da-agencia";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-[22px] sm:gap-[26px]">
      <div>
        <LemaDaAgencia titulo="Entrar" />
        {/* A frase sai do contexto da casca, ao lado do seletor que a troca. */}
        <FraseDoPublico />
      </div>

      {/* O seletor fica ENTRE o cabeçalho e os campos: é a pergunta que a
          pessoa responde antes de digitar, e é onde ela olha depois de ler o
          título. Acima dele viraria uma barra solta no topo do cartão, sem nada
          explicando o que escolhe. */}
      <SeletorDePublico />

      <form onSubmit={enviar} noValidate className="space-y-4">
        {saiuPorInatividade && !estado.erro ? (
          <Alert variant="warning" className="text-left">
            <Clock />
            <AlertDescription>
              Sua sessão foi encerrada por inatividade. Entre novamente para
              continuar.
            </AlertDescription>
          </Alert>
        ) : null}

        {estado.erro ? (
          <Alert variant="destructive" className="text-left">
            <AlertCircle />
            <AlertDescription>{estado.erro}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-[15px]">
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

          <CampoDaPorta
            id="senha"
            rotulo="Senha"
            senha
            icone={Lock}
            autoComplete="current-password"
            placeholder="••••••••"
            erro={errors.senha?.message}
            registro={register("senha")}
          />
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : null}
          {enviando ? "Entrando..." : "Entrar"}
          {enviando ? null : <ArrowRight aria-hidden />}
        </Button>

        <p className="text-center">
          <Link
            href="/esqueci-senha"
            className="text-auth-apoio hover:text-auth-texto text-[13.5px] underline underline-offset-[3px]"
          >
            Esqueci minha senha
          </Link>
        </p>
      </form>
    </div>
  );
}
