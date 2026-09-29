"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Lock, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CampoDaPorta } from "@/components/auth/campo-da-porta";
import { TituloDaPorta } from "@/components/auth/lema-da-agencia";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-[22px] sm:gap-[26px]">
      <div>
        <TituloDaPorta>
          <ShieldCheck
            aria-hidden
            className="text-brand-blue mr-2 inline size-5 shrink-0 align-[-2px]"
          />
          Olá, {primeiroNome}
        </TituloDaPorta>
        <p className="text-auth-apoio mt-[11px] text-sm leading-relaxed">
          Você entrou com uma senha provisória, que alguém da equipe passou para
          você. Escolha agora uma senha que só você conhece — a provisória deixa
          de valer.
        </p>
      </div>

      <form onSubmit={enviar} noValidate className="space-y-4">
        {estado.erro ? (
          <Alert variant="destructive" className="text-left">
            <AlertCircle />
            <AlertDescription>{estado.erro}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-[15px]">
          <CampoDaPorta
            id="senha"
            rotulo="Sua nova senha"
            senha
            icone={Lock}
            autoComplete="new-password"
            autoFocus
            erro={errors.senha?.message}
            dica="Pelo menos 8 caracteres."
            registro={register("senha")}
          />

          <CampoDaPorta
            id="confirmacao"
            rotulo="Confirme a nova senha"
            senha
            icone={Lock}
            autoComplete="new-password"
            erro={errors.confirmacao?.message}
            registro={register("confirmacao")}
          />
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : null}
          {enviando ? "Salvando..." : "Salvar e entrar"}
        </Button>
      </form>
    </div>
  );
}
