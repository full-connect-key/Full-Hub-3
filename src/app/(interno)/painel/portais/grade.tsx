"use client";

import { useState } from "react";
import { ExternalLink, Search } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PortalDeCliente } from "@/lib/dados/portais-de-clientes";

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
 *
 * ---------------------------------------------------------------------------
 * **ELE MORAVA EM `_blocos/` E ERA UMA SEÇÃO DO INÍCIO**, com um `<h2>`
 * próprio. Decisão do usuário: *"tire a lista de clientes da aba inicial e
 * crie uma aba na lateral com a lista dos clientes"*.
 *
 * O arquivo MUDOU DE PASTA em vez de ficar onde estava: `_blocos/` é a pasta
 * dos blocos do Início, e um componente ali que o Início não desenha é o que
 * alguém reaproveita três sprints depois achando que ele ainda é um bloco
 * daquela tela — a decisão da 0023 aplicada a um arquivo.
 *
 * **E O `<h2>` SAIU COM A MUDANÇA.** Ele existia para nomear a seção no meio
 * de nove blocos; aqui o nome do módulo já está no `PageHeader`, e repeti-lo
 * dois centímetros abaixo é a decisão do Sprint 9 — *o nome do módulo aparece
 * uma vez só*. O que ficou no lugar dele é a busca, que é o controle da tela.
 *
 * **A GRADE GANHOU A TERCEIRA COLUNA**, e é medida e não gosto: no Início ela
 * vivia na coluna de conteúdo ao lado de um `aside` de 306px, onde duas
 * colunas enchiam a linha; aqui o `main` é `max-w-6xl` inteiro, e em duas
 * colunas cada cartão passaria de 550px para dizer um nome de empresa e um
 * slug — meia linha vazia em toda fileira.
 * ---------------------------------------------------------------------------
 */
export function PortaisDeClientes({
  clientes,
}: {
  clientes: PortalDeCliente[];
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
      {clientes.length > LIMITE_PARA_BUSCA ? (
        <div className="relative max-w-sm">
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
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((cliente) => (
            <li
              key={cliente.id}
              className="bg-surface-card rounded-card shadow-cartao flex items-center gap-3 border p-4"
            >
              {/* O LOGO DA CONTA no lugar do ícone genérico, por decisão do
                  usuário: *"no ícone do lado do nome troque para a foto do
                  logo da conta"*. O endereço vem assinado de quem monta a tela
                  — `clients.logo_url` é um caminho do bucket PRIVADO
                  `campanhas-arquivos`, e pô-lo cru num `src` é o navegador
                  pedindo ao próprio site e levando 404.

                  **O CÍRCULO APARECE MESMO SEM LOGO, com as INICIAIS da
                  empresa**, que é a decisão do seletor de clientes de Gestão
                  de Tasks: numa grade de cartões, metade com marca e metade
                  sem deixaria a margem esquerda irregular — e é por ela que o
                  olho desce a lista. "MV" é um signo de verdade.

                  **E é `UserAvatar` e não um `Avatar` montado à mão**, porque
                  é este componente que carrega o `object-cover` do
                  `AvatarImage`: uma segunda forma de desenhar o círculo é onde
                  o conserto da foto achatada se perde. `tooltip={false}`
                  porque o nome está escrito ao lado — um `TooltipTrigger`
                  seria uma parada de Tab para ler o que já está à vista. */}
              <UserAvatar
                name={cliente.nome_empresa}
                src={cliente.fotoAssinada}
                size="lg"
                tooltip={false}
                className="shrink-0"
              />

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
