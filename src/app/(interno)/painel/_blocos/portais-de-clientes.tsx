"use client";

import { useState } from "react";
import { Building2, ExternalLink, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Acima disto, procurar é mais rápido que percorrer a grade com os olhos. */
const LIMITE_PARA_BUSCA = 8;

/**
 * Os portais dos clientes ativos.
 *
 * Abre em aba nova — e isso não é detalhe de conforto: a pessoa está no meio
 * de um trabalho no painel, e o portal do cliente é consulta. Trocar a aba
 * faria ela perder o que estava fazendo para conferir uma tela.
 *
 * Não é login como cliente. A sessão continua sendo a dela, e a tela do outro
 * lado diz isso numa faixa que não dá para não ver.
 */
export function PortaisDeClientes({
  clientes,
}: {
  clientes: { id: string; nome_empresa: string; slug: string }[];
}) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? clientes.filter(
        (c) =>
          c.nome_empresa.toLowerCase().includes(termo) || c.slug.includes(termo.replace(/\s+/g, "-")),
      )
    : clientes;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Portais de Clientes
        </h2>
        <p className="text-text-secondary text-sm">
          Acesse administrativamente o portal de qualquer cliente ativo mantendo sua identidade
          interna.
        </p>
      </div>

      {clientes.length > LIMITE_PARA_BUSCA ? (
        <div className="relative">
          <Search
            aria-hidden
            className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            className="pl-9"
          />
        </div>
      ) : null}

      {clientes.length === 0 ? (
        <p className="text-text-secondary rounded-card border border-dashed p-6 text-center text-sm">
          Nenhum cliente ativo cadastrado.
        </p>
      ) : visiveis.length === 0 ? (
        <p className="text-text-secondary rounded-card border border-dashed p-6 text-center text-sm">
          Nenhum cliente com “{busca.trim()}”.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visiveis.map((cliente) => (
            <li
              key={cliente.id}
              className="bg-surface-card rounded-card flex items-center gap-3 border p-4"
            >
              <span
                aria-hidden
                className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <Building2 className="size-5" />
              </span>

              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-text-primary truncate text-sm font-medium">
                  {cliente.nome_empresa}
                </span>
                <span className="text-text-muted truncate text-xs">/{cliente.slug}</span>
              </span>

              <Button asChild size="sm" className="ml-auto shrink-0">
                <a
                  href={`/portal/${cliente.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir o portal de ${cliente.nome_empresa} em uma nova aba`}
                >
                  Abrir Portal
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
