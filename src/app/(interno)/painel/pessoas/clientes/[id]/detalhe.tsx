"use client";

import { Activity, Pencil } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Client } from "@/lib/supabase/database.types";

import { FormularioDeCliente } from "../formulario-de-cliente";
import { ConfiguracoesDoFluxo, type PessoaDaEquipe } from "./configuracoes-do-fluxo";
import { UsuariosDoCliente, type UsuarioComAcesso } from "./usuarios";
import { ZonaDePerigoDoCliente } from "./zona-de-perigo";

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="mt-0.5 text-sm">{valor?.trim() ? valor : "—"}</dd>
    </div>
  );
}

export function DetalheDoCliente({
  cliente,
  responsavel,
  equipe,
  usuarios,
  vinculos,
  ehSocio,
  ehGestor,
  fluxo,
}: {
  cliente: Client;
  responsavel: string | null;
  equipe: PessoaDaEquipe[];
  usuarios: UsuarioComAcesso[];
  vinculos: React.ComponentProps<typeof ZonaDePerigoDoCliente>["vinculos"];
  ehSocio: boolean;
  ehGestor: boolean;
  /** O que a aba Configurações do fluxo desenha (migration 0064). */
  fluxo: Omit<
    React.ComponentProps<typeof ConfiguracoesDoFluxo>,
    "clienteId" | "equipe" | "atendimento" | "observacoes" | "ehGestor"
  >;
}) {
  return (
    <Tabs defaultValue="dados">
      <TabsList>
        <TabsTrigger value="dados">Dados</TabsTrigger>
        <TabsTrigger value="usuarios">Usuários com acesso</TabsTrigger>
        <TabsTrigger value="fluxo">Configurações do fluxo</TabsTrigger>
        <TabsTrigger value="atividade">Atividade</TabsTrigger>
      </TabsList>

      <TabsContent value="dados" className="space-y-6">
        <div className="rounded-xl border p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Dados da empresa</h2>
            <FormularioDeCliente
              cliente={cliente}
              equipe={equipe}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil aria-hidden />
                  Editar
                </Button>
              }
            />
          </div>

          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Campo rotulo="Nome da empresa" valor={cliente.nome_empresa} />
            <Campo rotulo="Segmento" valor={cliente.segmento} />
            <Campo rotulo="Responsável de atendimento" valor={responsavel} />
            <Campo rotulo="Nome do contato" valor={cliente.nome_contato} />
            <Campo rotulo="E-mail de contato" valor={cliente.email_contato} />
            <Campo rotulo="Telefone" valor={cliente.telefone} />
            <Campo rotulo="ID da pasta no Drive" valor={cliente.drive_folder_id} />
          </dl>

          {cliente.observacoes ? (
            /* <dl> e nao <div>: um <dt> solto fora de uma lista de definicao nao
               descreve coisa nenhuma para quem le por leitor de tela — o par
               rotulo/valor perde o vinculo e sobram dois textos soltos. */
            <dl className="mt-5 border-t pt-5">
              <dt className="text-muted-foreground text-xs">Observações</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap">{cliente.observacoes}</dd>
            </dl>
          ) : null}
        </div>

        <ZonaDePerigoDoCliente
          clienteId={cliente.id}
          nomeDaEmpresa={cliente.nome_empresa}
          ativo={cliente.ativo}
          ehSocio={ehSocio}
          vinculos={vinculos}
        />
      </TabsContent>

      <TabsContent value="usuarios">
        <UsuariosDoCliente
          clientId={cliente.id}
          nomeDaEmpresa={cliente.nome_empresa}
          usuarios={usuarios}
        />
      </TabsContent>

      <TabsContent value="fluxo">
        <ConfiguracoesDoFluxo
          {...fluxo}
          clienteId={cliente.id}
          equipe={equipe}
          atendimento={responsavel}
          observacoes={cliente.observacoes}
          ehGestor={ehGestor}
        />
      </TabsContent>

      <TabsContent value="atividade">
        <EmptyState
          icon={Activity}
          title="Ainda não há histórico para mostrar"
          description="O histórico de envios, aprovações e comentários deste cliente aparecerá aqui."
        />
      </TabsContent>
    </Tabs>
  );
}
