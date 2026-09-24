import type { Metadata } from "next";

import { exigirAcessoARota, primeiroNome } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { obterMinhaFicha } from "@/lib/dados/equipe";
import { listarPortaisDeClientes } from "@/lib/dados/portais-de-clientes";

import { AcessoRapido } from "./_blocos/acesso-rapido";
import { BoasVindas } from "./_blocos/boas-vindas";
import { PortaisDeClientes } from "./_blocos/portais-de-clientes";
import { RascunhosAExpirar } from "./_blocos/rascunhos-a-expirar";

export const metadata: Metadata = { title: "Início" };

/**
 * A tela inicial do Painel Interno.
 *
 * Três blocos, nesta ordem: quem você é, para onde você vai todo dia, e — se
 * você é da gestão — os portais dos clientes.
 *
 * O QUE ELA NÃO FAZ, de propósito: buscar números. Os blocos de panorama (Meu
 * dia, Precisa de mim, Pulso da agência, Quem está fora hoje) estão criados em
 * _blocos/reservados-sprint-15.tsx, vazios e sem consulta nenhuma. Esta é a
 * primeira tela que todo mundo abre, todo dia; uma tela inicial lenta custa
 * mais do que uma tela inicial incompleta.
 */
export default async function PaginaInicialDoPainel() {
  const { profile } = await exigirAcessoARota("/painel");
  const ficha = await obterMinhaFicha();

  // Só a gestão enxerga a seção. A rota /portal/{slug} recusa colaborador no
  // servidor de qualquer forma — esconder aqui é cortesia, não é a trava.
  const portais = ehGestor(profile.role) ? await listarPortaisDeClientes() : [];

  return (
    <div className="space-y-8">
      <RascunhosAExpirar />

      <BoasVindas
        primeiroNome={primeiroNome(profile.nome)}
        role={profile.role}
        cargo={ficha?.cargo ?? null}
      />

      <AcessoRapido />

      {ehGestor(profile.role) ? <PortaisDeClientes clientes={portais} /> : null}
    </div>
  );
}
