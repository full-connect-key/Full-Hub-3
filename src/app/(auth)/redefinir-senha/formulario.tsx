"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Lock } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CampoDaPorta } from "@/components/auth/campo-da-porta";
import { TituloDaPorta } from "@/components/auth/lema-da-agencia";
import { Button } from "@/components/ui/button";
import { definirNovaSenha, type EstadoFormulario } from "@/lib/auth/acoes";
import { esquemaDeNovaSenha, type DadosDeNovaSenha } from "@/lib/auth/esquemas";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeNovaSenha() {
  const [estado, acao, enviando] = useActionState(
    definirNovaSenha,
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

  return (
    <div className="flex flex-col gap-[22px] sm:gap-[26px]">
      <div>
        <TituloDaPorta>Criar nova senha</TituloDaPorta>
        <p className="text-auth-apoio mt-[11px] text-sm leading-relaxed">
          Use pelo menos 8 caracteres.
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
            rotulo="Nova senha"
            senha
            icone={Lock}
            autoComplete="new-password"
            autoFocus
            erro={errors.senha?.message}
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
          {enviando ? "Salvando..." : "Salvar senha"}
        </Button>
      </form>
    </div>
  );
}
