"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { Card } from "@/components/ui/card";
import { enviarLinkDeRecuperacao, type EstadoFormulario } from "@/lib/auth/acoes";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeRecuperacao() {
  const [estado, acao, enviando] = useActionState(enviarLinkDeRecuperacao, ESTADO_INICIAL);

  return (
    <Card>
      <form action={acao} className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-texto">Recuperar senha</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Informe seu e-mail e enviaremos um link para criar uma senha nova.
          </p>
        </div>

        {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
        {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}

        <Campo rotulo="E-mail">
          <Entrada
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@suaagencia.com.br"
            required
            autoFocus
          />
        </Campo>

        <Botao type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar link"}
        </Botao>

        <p className="text-center text-sm">
          <Link href="/login" className="text-brand hover:underline">
            Voltar para o login
          </Link>
        </p>
      </form>
    </Card>
  );
}
