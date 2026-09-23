import type { Metadata } from "next";
import { Suspense } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Info } from "lucide-react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import { minhasPreferencias, usuariosDoMeuCliente } from "@/lib/dados/portal";
import { criarClienteServidor } from "@/lib/supabase/server";

import { DadosDaEmpresa } from "./dados-da-empresa";
import { Preferencias } from "./preferencias";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Três blocos, e um deles é de propósito só leitura.
 *
 * **A aba Usuários não tem nenhum botão.** Quem entra e quem sai do portal é
 * decisão da agência: o vínculo mora em `client_users`, e um cliente que
 * convidasse outro criaria acesso a material que ninguém da Full autorizou.
 * A tela diz isso em uma frase, em vez de mostrar um botão que dá erro.
 */

async function Conteudo() {
  const supabase = await criarClienteServidor();

  const [empresas, preferencias, usuarios] = await Promise.all([
    obterMinhasEmpresas(),
    minhasPreferencias(),
    usuariosDoMeuCliente(),
  ]);

  const { data: dados } = await supabase
    .from("clients")
    .select("id, nome_empresa, nome_contato, email_contato, telefone")
    .in(
      "id",
      empresas.map((e) => e.id),
    )
    .order("nome_empresa");

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Avisos</h2>
          <p className="text-text-muted mt-1 text-sm">
            O que você quer receber, e com que frequência.
          </p>
        </div>
        <Preferencias iniciais={preferencias} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Dados da empresa</h2>
          <p className="text-text-muted mt-1 text-sm">
            O contato que a Full usa para falar com vocês.
          </p>
        </div>

        <div className="space-y-8">
          {(dados ?? []).map((cliente) => (
            <DadosDaEmpresa
              key={cliente.id}
              clienteId={cliente.id}
              nomeDaEmpresa={cliente.nome_empresa}
              iniciais={{
                nome_contato: cliente.nome_contato ?? "",
                email_contato: cliente.email_contato ?? "",
                telefone: cliente.telefone ?? "",
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Quem tem acesso</h2>
          <p className="text-text-muted mt-1 text-sm">
            As pessoas da sua empresa que entram neste portal.
          </p>
        </div>

        <div className="bg-surface-card divide-y rounded-xl border">
          {usuarios.map((pessoa) => (
            <div
              key={pessoa.user_id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{pessoa.nome}</p>
                <p className="text-text-muted truncate text-sm">
                  {pessoa.email}
                </p>
              </div>
              <p className="text-text-muted text-sm tabular-nums">
                {pessoa.ultimo_acesso
                  ? `Último acesso em ${format(parseISO(pessoa.ultimo_acesso), "dd/MM/yyyy", { locale: ptBR })}`
                  : "Ainda não entrou"}
              </p>
            </div>
          ))}
        </div>

        <p className="text-text-muted flex items-start gap-2 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          Para incluir ou remover pessoas, fale com a sua equipe de atendimento.
        </p>
      </section>
    </div>
  );
}

export default async function PaginaDeConfiguracoesDoPortal() {
  await exigirClienteNaTela();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-text-muted mt-1">
          Seus avisos e os dados da sua empresa.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
