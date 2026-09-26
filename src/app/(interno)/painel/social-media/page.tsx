import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import {
  filaDaAgencia,
  obterPostDaAgencia,
  postsDoMesDaAgencia,
  postsSemData,
} from "@/lib/dados/social-media";

import { driveConfigurado } from "@/lib/drive/config";
import { SocialMedia } from "./social-media";

export const metadata: Metadata = { title: "Social Media" };

type Parametros = Record<string, string | string[] | undefined>;

function texto(p: Parametros, chave: string): string | undefined {
  const v = p[chave];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

async function Conteudo({ parametros }: { parametros: Parametros }) {
  const sessao = await exigirAcessoARota("/painel/social-media");
  const souGestor = ehGestor(sessao.profile.role);

  const visao = texto(parametros, "visao") === "calendario" ? "calendario" : "lista";
  const mes = texto(parametros, "mes") ?? new Date().toISOString().slice(0, 7);
  const clienteId = texto(parametros, "cliente");
  const foco = (texto(parametros, "foco") ?? "todos") as "todos" | "meus" | "sem_dono";
  const postId = texto(parametros, "post");

  const filtros = { clienteId, foco, usuarioId: sessao.usuarioId };

  const [posts, semData, clientes, equipe, aberto] = await Promise.all([
    // CADA VISÃO CARREGA SÓ A PRÓPRIA CONSULTA. O calendário quer um mês; a
    // lista quer a fila dos próximos três, porque quem abre a lista está
    // procurando trabalho e o que tem para fazer hoje quase sempre publica no
    // mês que vem.
    visao === "calendario"
      ? postsDoMesDaAgencia(mes, filtros)
      : filaDaAgencia(filtros),
    // A FAIXA "SEM DATA AINDA" É SÓ DO CALENDÁRIO. Na lista eles já vêm
    // misturados na fila, em ordem — e a lista é ordenada por data justamente
    // para quem não tem data aparecer primeiro.
    visao === "calendario" ? postsSemData(clienteId) : Promise.resolve([]),
    listarClientes(),
    listarEquipeAtiva(),
    postId ? obterPostDaAgencia(postId) : Promise.resolve(null),
  ]);

  return (
    <SocialMedia
      posts={posts}
      semData={semData}
      aberto={aberto?.post ?? null}
      versoes={aberto?.versoes ?? []}
      etapas={aberto?.etapas ?? []}
      referencias={aberto?.referencias ?? []}
      clientes={clientes
        .filter((c) => c.ativo)
        .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
      // `driveConfigurado()` é `server-only` e desce como prop: valor
      // exportado de arquivo cliente não vale no servidor, e o contrário
      // também não atravessa — a checagem mora aqui e o booleano viaja.
      driveLigado={driveConfigurado()}
      quemLe={{ id: sessao.usuarioId, ehGestor: souGestor }}
      mes={mes}
    />
  );
}

export default async function PaginaDeSocialMedia({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  await exigirAcessoARota("/painel/social-media");
  const parametros = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="Social Media" />

      <Suspense
        key={JSON.stringify(parametros)}
        fallback={<LoadingSkeleton variant="table" rows={6} />}
      >
        <Conteudo parametros={parametros} />
      </Suspense>
    </div>
  );
}
