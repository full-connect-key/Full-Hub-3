import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { obterSessao } from "@/lib/auth/dal";
import { ehEquipe } from "@/lib/auth/roles";
import { diagnosticarSupabase, type Situacao } from "@/lib/supabase/diagnostico";

export const metadata: Metadata = { title: "Status da conexão" };

// Diagnostico so faz sentido ao vivo: nunca servir uma versao em cache.
export const dynamic = "force-dynamic";

const aparencia: Record<Situacao, { Icone: typeof CheckCircle2; cor: string; rotulo: string }> = {
  ok: { Icone: CheckCircle2, cor: "text-success", rotulo: "Tudo certo" },
  alerta: { Icone: AlertTriangle, cor: "text-warning", rotulo: "Atenção" },
  falha: { Icone: XCircle, cor: "text-destructive", rotulo: "Com falha" },
};

export default async function PaginaDeStatus() {
  /**
   * A TELA CONTINUA PÚBLICA, e o que muda é o quanto ela conta.
   *
   * Travá-la atrás de um login travaria o diagnóstico no único momento em que
   * ele importa: o `proxy.ts` manda todo mundo para cá justamente quando não
   * há credenciais do Supabase — e nesse estado ninguém consegue entrar para
   * ver por quê.
   *
   * Então quem não é da equipe recebe o veredito e as duas checagens da porta,
   * que respondem "é o sistema ou sou eu". O host do projeto, a chave de
   * serviço, o Resend e o Google ficam para quem já provou ser da casa — e não
   * são escondidos na tela, **não são calculados**: eles não viajam pela rede
   * nem existem no HTML de quem não pode vê-los.
   *
   * `obterSessao()` e não `exigirSessao()`: aquela redireciona, e redirecionar
   * daqui devolveria a pessoa para a tela de login que talvez seja justamente
   * a que não funciona.
   */
  const sessao = await obterSessao();
  const completo = !!sessao && ehEquipe(sessao.profile.role);
  const diagnostico = await diagnosticarSupabase({ completo });
  const geral = aparencia[diagnostico.situacaoGeral];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Status da conexão</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Verificação ao vivo da ligação entre a plataforma e o Supabase.
        </p>
      </header>

      <Card className="mb-4">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <geral.Icone aria-hidden className={`size-6 ${geral.cor}`} />
            <div>
              <p className="text-sm font-semibold">{geral.rotulo}</p>
              <p className="text-muted-foreground text-xs">
                {diagnostico.host ? `Projeto: ${diagnostico.host}` : "Projeto ainda não configurado"}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/status">
              <RefreshCw aria-hidden />
              Verificar de novo
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* A AUSÊNCIA É DITA, e não escondida: quem é da equipe e abriu sem
          estar logado precisa saber que existe mais para ver, senão conclui
          que as outras checagens sumiram do produto. */}
      {completo ? null : (
        <p className="text-text-muted mb-4 text-xs">
          Esta é a versão pública: ela responde se a porta está de pé. As
          checagens de infraestrutura — chave de serviço, e-mail, Google Drive —
          aparecem para quem entra com uma conta da agência.
        </p>
      )}

      <ul className="space-y-3">
        {diagnostico.checagens.map((checagem) => {
          const { Icone, cor } = aparencia[checagem.situacao];
          return (
            <li key={checagem.nome}>
              <Card>
                <CardContent className="flex items-start gap-3">
                  <Icone aria-hidden className={`mt-0.5 size-5 shrink-0 ${cor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{checagem.nome}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">{checagem.detalhe}</p>
                    {checagem.comoResolver ? (
                      <p className="bg-muted text-muted-foreground mt-2 rounded-lg px-3 py-2 text-xs">
                        <strong className="text-foreground font-medium">Como resolver: </strong>
                        {checagem.comoResolver}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <footer className="text-muted-foreground mt-6 flex items-center justify-between gap-4 text-xs">
        <span>
          Verificado em{" "}
          {new Date(diagnostico.verificadoEm).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
        </span>
        <Link href="/" className="underline-offset-4 hover:underline">
          Ir para a plataforma
        </Link>
      </footer>
    </main>
  );
}
