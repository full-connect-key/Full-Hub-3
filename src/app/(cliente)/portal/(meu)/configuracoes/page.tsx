import type { Metadata } from "next";
import { Suspense } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Info } from "lucide-react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import {
  contatosDasMinhasEmpresas,
  obterMinhasEmpresas,
} from "@/lib/dados/clientes";
import { minhasPreferencias, usuariosDoMeuCliente } from "@/lib/dados/portal";

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
  const [empresas, preferencias, usuarios] = await Promise.all([
    obterMinhasEmpresas(),
    minhasPreferencias(),
    usuariosDoMeuCliente(),
  ]);

  // A segunda consulta depende da primeira: são as empresas desta pessoa, e
  // quais são elas só se sabe depois de perguntar.
  const dados = await contatosDasMinhasEmpresas(empresas.map((e) => e.id));

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em]">Avisos</h2>
          <p className="text-text-muted mt-1 text-sm">
            O que você quer receber, e com que frequência.
          </p>
        </div>
        <Preferencias iniciais={preferencias} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em]">
            Dados da empresa
          </h2>
          <p className="text-text-muted mt-1 text-sm">
            O contato que a Full usa para falar com vocês.
          </p>
        </div>

        <div className="space-y-8">
          {dados.map((cliente) => (
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
          <h2 className="text-xl font-bold tracking-[-0.02em]">
            Quem tem acesso
          </h2>
          <p className="text-text-muted mt-1 text-sm">
            As pessoas da sua empresa que entram neste portal.
          </p>
        </div>

        <div className="bg-surface-card rounded-card shadow-cartao divide-y border">
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
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          Configurações
        </h1>
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
