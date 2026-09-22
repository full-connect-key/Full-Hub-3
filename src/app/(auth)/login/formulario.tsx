"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { Card } from "@/components/ui/card";
import { entrar, type EstadoFormulario } from "@/lib/auth/acoes";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeLogin({ destino }: { destino: string }) {
  const [estado, acao, enviando] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <Card>
      <form action={acao} className="space-y-4">
        <input type="hidden" name="redirecionar" value={destino} />

        {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}

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

        <Campo rotulo="Senha">
          <Entrada
            name="senha"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            required
          />
        </Campo>

        <Botao type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </Botao>

        <p className="text-center text-sm">
          <Link href="/recuperar-senha" className="text-brand hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      </form>
    </Card>
  );
}
