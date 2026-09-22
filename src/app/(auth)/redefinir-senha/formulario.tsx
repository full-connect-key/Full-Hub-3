"use client";

import { useActionState } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";
import { Card } from "@/components/ui/card";
import { definirNovaSenha, type EstadoFormulario } from "@/lib/auth/acoes";

const ESTADO_INICIAL: EstadoFormulario = {};

export function FormularioDeNovaSenha() {
  const [estado, acao, enviando] = useActionState(definirNovaSenha, ESTADO_INICIAL);

  return (
    <Card>
      <form action={acao} className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-texto">Criar nova senha</h2>
          <p className="mt-1 text-sm text-texto-suave">Use pelo menos 8 caracteres.</p>
        </div>

        {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}

        <Campo rotulo="Nova senha">
          <Entrada
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
          />
        </Campo>

        <Campo rotulo="Confirme a nova senha">
          <Entrada
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Campo>

        <Botao type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar senha"}
        </Botao>
      </form>
    </Card>
  );
}
