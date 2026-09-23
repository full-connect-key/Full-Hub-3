import type { Metadata } from "next";
import { Suspense } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Info, Lock } from "lucide-react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import {
  obterClientePeloSlug,
  usuariosDoPortal,
} from "@/lib/dados/portais-de-clientes";
import type { Client } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Configurações do cliente" };

/**
 * As configurações do portal de um cliente, vistas pela equipe.
 *
 * **Aqui a tela NÃO é a mesma que o cliente vê, e é o único caso.** O bloco de
 * avisos é preferência PESSOAL de cada usuário do cliente —
 * `client_notification_prefs` fecha em `auth.uid()` nas quatro operações,
 * exatamente como o Resumo Semanal —, então ele não tem como aparecer aqui, e
 * inventar um valor de exemplo seria mentir sobre o que a pessoa escolheu. A
 * tela diz isso em uma frase em vez de mostrar campos vazios.
 *
 * O resto é o mesmo conteúdo, só leitura: os dados de contato e quem entra.
 * Editar cliente continua sendo em /painel/clientes, que é onde a gestão faz
 * isso — e não dentro de uma visualização que promete não mexer em nada.
 */
async function Conteudo({ cliente }: { cliente: Client | null }) {
  const usuarios = await usuariosDoPortal(cliente?.id ?? "");

  const contato: { rotulo: string; valor: string }[] = [
    { rotulo: "Pessoa de contato", valor: cliente?.nome_contato ?? "" },
    { rotulo: "E-mail", valor: cliente?.email_contato ?? "" },
    { rotulo: "Telefone", valor: cliente?.telefone ?? "" },
  ];

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Avisos</h2>
          <p className="text-text-muted mt-1 text-sm">
            O que cada pessoa do cliente quer receber, e com que frequência.
          </p>
        </div>

        <p className="text-text-muted bg-surface-card flex items-start gap-2 rounded-xl border p-4 text-sm">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />A preferência
          de avisos é de cada pessoa, e só ela lê. Nem a gestão enxerga — é a
          mesma regra do Resumo Semanal.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Dados da empresa</h2>
          <p className="text-text-muted mt-1 text-sm">
            O contato que a Full usa para falar com eles. O cliente edita estes
            três campos no portal dele; aqui é leitura.
          </p>
        </div>

        <dl className="bg-surface-card divide-y rounded-xl border">
          {contato.map((linha) => (
            <div
              key={linha.rotulo}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4"
            >
              <dt className="text-text-muted text-sm">{linha.rotulo}</dt>
              <dd className="min-w-0 truncate text-sm font-medium">
                {linha.valor || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Quem tem acesso</h2>
          <p className="text-text-muted mt-1 text-sm">
            As pessoas desta empresa que entram no portal.
          </p>
        </div>

        {usuarios.length === 0 ? (
          <p className="text-text-muted bg-surface-card rounded-xl border p-4 text-sm">
            Ninguém desta empresa tem acesso ao portal ainda.
          </p>
        ) : (
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
        )}

        <p className="text-text-muted flex items-start gap-2 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          Para incluir ou remover pessoas, use o cadastro do cliente no painel.
        </p>
      </section>
    </div>
  );
}

export default async function ConfiguracoesDoClienteVistasPelaEquipe({
  params,
}: PageProps<"/portal/[slug]/configuracoes">) {
  const { slug } = await params;
  const cliente = await obterClientePeloSlug(slug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-text-muted mt-1">
          Os avisos e os dados de contato de{" "}
          {cliente?.nome_empresa ?? "este cliente"}.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={5} />}>
        <Conteudo cliente={cliente} />
      </Suspense>
    </div>
  );
}
