import type { Metadata } from "next";

import { Aviso } from "@/components/ui/aviso";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitulo } from "@/components/ui/card";
import { exigirSessao } from "@/lib/auth/dal";

import { FormularioDePerfil } from "./formulario";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaDeConfiguracoes() {
  const { usuario, perfil } = await exigirSessao();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-texto-suave">Seus dados dentro do painel.</p>
      </header>

      <Card>
        <CardTitulo
          acao={<Badge tom={perfil?.papel === "admin" ? "brand" : "neutro"}>{perfil?.papel ?? "sem perfil"}</Badge>}
        >
          Meu perfil
        </CardTitulo>

        {perfil ? (
          <FormularioDePerfil
            email={usuario.email ?? ""}
            nomeCompleto={perfil.nome_completo ?? ""}
            cargo={perfil.cargo ?? ""}
          />
        ) : (
          <Aviso tipo="erro">
            Não encontramos um registro em <code className="font-mono">public.perfis</code> para
            este usuario. Aplique a migration <code className="font-mono">0001_perfis.sql</code> no
            SQL Editor do Supabase — ela cria a tabela e preenche os usuários que já existiam.
          </Aviso>
        )}
      </Card>
    </div>
  );
}
