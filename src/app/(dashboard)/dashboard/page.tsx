import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitulo } from "@/components/ui/card";
import { exigirSessao, nomeDeExibicao } from "@/lib/auth/dal";
import { diagnosticarSupabase, type Situacao } from "@/lib/supabase/diagnostico";

export const metadata: Metadata = { title: "Visao geral" };
export const dynamic = "force-dynamic";

const selo: Record<Situacao, { Icone: typeof CheckCircle2; tom: "positivo" | "atencao" | "negativo"; texto: string }> = {
  ok: { Icone: CheckCircle2, tom: "positivo", texto: "Conectado" },
  alerta: { Icone: AlertTriangle, tom: "atencao", texto: "Conectado com pendencias" },
  falha: { Icone: XCircle, tom: "negativo", texto: "Sem conexao" },
};

const PROXIMOS_PASSOS = [
  "Definir com a equipe quais indicadores entram no primeiro sprint",
  "Criar a migration das tabelas desse modulo em supabase/migrations/",
  "Adicionar a pagina em src/app/(dashboard)/ e o item em src/lib/navegacao.ts",
  "Contratar o dominio na Hostinger e apontar para a VPS",
];

export default async function PaginaDoDashboard() {
  const [{ usuario, perfil }, diagnostico] = await Promise.all([
    exigirSessao(),
    diagnosticarSupabase(),
  ]);

  const estado = selo[diagnostico.situacaoGeral];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Ola, {nomeDeExibicao(perfil, usuario.email)}
        </h1>
        <p className="mt-1 text-sm text-texto-suave">
          A base do dashboard esta no ar. Os modulos entram a cada sprint.
        </p>
      </header>

      <Card>
        <CardTitulo
          acao={
            <Link href="/status" className="text-xs text-brand hover:underline">
              Ver detalhes
            </Link>
          }
        >
          Supabase
        </CardTitulo>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tom={estado.tom}>
            <estado.Icone aria-hidden className="size-3.5" />
            {estado.texto}
          </Badge>
          {diagnostico.host ? (
            <span className="font-mono text-xs text-texto-tenue">{diagnostico.host}</span>
          ) : null}
        </div>

        <ul className="mt-4 divide-y divide-borda border-t border-borda">
          {diagnostico.checagens.map((checagem) => (
            <li key={checagem.nome} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm text-texto-suave">{checagem.nome}</span>
              <span
                className={`text-xs font-medium ${
                  checagem.situacao === "ok"
                    ? "text-positivo"
                    : checagem.situacao === "alerta"
                      ? "text-atencao"
                      : "text-negativo"
                }`}
              >
                {checagem.situacao === "ok" ? "ok" : checagem.situacao}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitulo>Proximos passos</CardTitulo>
        <ol className="space-y-2.5">
          {PROXIMOS_PASSOS.map((passo, indice) => (
            <li key={passo} className="flex items-start gap-3 text-sm text-texto-suave">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-superficie-suave text-xs font-medium text-texto-tenue">
                {indice + 1}
              </span>
              {passo}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitulo>Como adicionar um modulo</CardTitulo>
        <p className="text-sm text-texto-suave">
          Cada modulo novo segue sempre o mesmo caminho: migration com RLS no banco, pagina
          dentro de <code className="font-mono text-xs text-texto">src/app/(dashboard)/</code> e
          uma linha em <code className="font-mono text-xs text-texto">src/lib/navegacao.ts</code>.
          O passo a passo com exemplo de codigo esta no README do projeto.
        </p>
        <Link
          href="/configuracoes"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
        >
          Conferir meu perfil
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </Card>
    </div>
  );
}
