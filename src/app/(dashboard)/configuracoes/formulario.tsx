"use client";

import { useActionState } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campo";

import { salvarPerfil, type EstadoDoPerfil } from "./acoes";

const ESTADO_INICIAL: EstadoDoPerfil = {};

export function FormularioDePerfil({
  email,
  nomeCompleto,
  cargo,
}: {
  email: string;
  nomeCompleto: string;
  cargo: string;
}) {
  const [estado, acao, salvando] = useActionState(salvarPerfil, ESTADO_INICIAL);

  return (
    <form action={acao} className="space-y-4">
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}

      <Campo rotulo="E-mail" dica="O e-mail de acesso é alterado pelo painel do Supabase.">
        <Entrada value={email} disabled readOnly />
      </Campo>

      <Campo rotulo="Nome completo">
        <Entrada name="nome_completo" defaultValue={nomeCompleto} maxLength={120} placeholder="Como você quer ser chamado" />
      </Campo>

      <Campo rotulo="Cargo">
        <Entrada name="cargo" defaultValue={cargo} maxLength={120} placeholder="Ex.: Social media" />
      </Campo>

      <Botao type="submit" disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </Botao>
    </form>
  );
}
