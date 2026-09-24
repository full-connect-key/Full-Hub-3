import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";

import { DecisoesDoConteudo } from "@/components/portal/decisoes-do-conteudo";
import { HistoricoDeVersoes } from "@/components/portal/historico-de-versoes";
import { LegendaDoPost } from "@/components/portal/legenda-do-post";
import { ThreadDeComentarios } from "@/components/portal/thread-de-comentarios";
import { VisualizadorDeArte } from "@/components/portal/visualizador-de-arte";
import { StatusBadge } from "@/components/shared/status-badge";
import type {
  ComentarioDoConteudo,
  VersaoDoConteudo,
} from "@/lib/dados/conteudo";
import type { Conteudo } from "@/lib/aprovacoes/conteudo";
import type { ContentStatus } from "@/lib/supabase/database.types";

/**
 * A tela em que o cliente decide sobre UM material.
 *
 * **É uma só, e serve o post e o entregável de campanha.** A razão é a de
 * sempre neste produto: duas telas que fazem a mesma coisa divergem na
 * primeira mudança, e aqui a divergência apareceria no lugar mais caro, que é
 * o botão de aprovar.
 *
 * **O que é compartilhado é a CASCA; o que muda é o modelo.** Cada módulo lê
 * as tabelas dele — post e `posts`, entregável e `deliverables` — e monta este
 * objeto. Tentar compartilhar também a leitura levaria a um `if tipo ===` no
 * meio de cada consulta, que é a duplicação de volta com outro nome.
 *
 * A ordem é a ordem da decisão: arte grande, propriedades, texto, e só então
 * os botões. Botão antes da arte convida a aprovar sem olhar — e o material
 * que volta "aprovado sem ninguém ter visto" é o retrabalho mais caro.
 */
export type ModeloDoConteudo = {
  conteudo: Conteudo;
  titulo: string;
  /** A linha embaixo do título: data e hora, ou a linhagem na campanha. */
  linhaDeContexto: string | null;
  status: ContentStatus;
  /** Um selo antes do status — a rede social, no caso do post. */
  selo?: React.ReactNode;
  propriedades: { rotulo: string; valor: string }[];
  /** "Legenda" no post, "Descrição" no entregável. */
  texto: { titulo: string; corpo: string | null };
  arte: string | null;
  versaoAtual: number;
  rodadaPendenteId: string | null;
  decididoPor: string | null;
  decididoEm: string | null;
  /**
   * O arquivo para baixar, quando existe um.
   *
   * **A escolha de resolução não está aqui, e não é esquecimento** — ela é de
   * outro momento do produto. O que existe hoje é o arquivo como ele foi
   * enviado, que é o que resolve o caso mais comum: a pessoa quer mandar a
   * arte para alguém que não tem acesso ao portal.
   */
  download: { href: string; nome: string } | null;
  voltar: { href: string; rotulo: string };
  vizinhos: { anterior: string | null; proximo: string | null };
  /** O rótulo acessível da navegação entre irmãos. */
  rotuloDosVizinhos: string;
};

export function DetalheDoConteudo({
  modelo,
  versoes,
  comentarios,
  artes,
  agora,
  nomeDaEmpresa,
  comoEquipe,
}: {
  modelo: ModeloDoConteudo;
  versoes: VersaoDoConteudo[];
  comentarios: ComentarioDoConteudo[];
  /** Endereços já assinados, por caminho. */
  artes: Record<string, string>;
  agora: string;
  nomeDaEmpresa: string;
  comoEquipe: boolean;
}) {
  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------- cabeçalho -- */}
      <div className="space-y-4">
        <Link
          href={modelo.voltar.href}
          className="text-text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {modelo.voltar.rotulo}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {modelo.selo}
              <StatusBadge status={modelo.status} />
            </div>
            <h1 className="text-2xl font-semibold">{modelo.titulo}</h1>
            {modelo.linhaDeContexto ? (
              <p className="text-text-muted text-sm">
                {modelo.linhaDeContexto}
              </p>
            ) : null}
          </div>

          {/* NAVEGAÇÃO ENTRE IRMÃOS: quem entra para aprovar raramente aprova
              um só. Voltar à lista a cada peça é o atrito que faz a pessoa
              deixar os outros para depois. */}
          <nav aria-label={modelo.rotuloDosVizinhos} className="flex gap-2">
            <Vizinho href={modelo.vizinhos.anterior} rotulo="Material anterior">
              <ChevronLeft aria-hidden className="size-4" />
            </Vizinho>
            <Vizinho href={modelo.vizinhos.proximo} rotulo="Próximo material">
              <ChevronRight aria-hidden className="size-4" />
            </Vizinho>
          </nav>
        </div>
      </div>

      <VisualizadorDeArte
        imagens={modelo.arte ? [modelo.arte] : []}
        alt={`Arte de ${modelo.titulo}`}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Informações</h2>
        <dl className="bg-surface-card grid gap-x-8 gap-y-3 rounded-xl border p-4 sm:grid-cols-2">
          {modelo.propriedades.map((linha) => (
            <div
              key={linha.rotulo}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
            >
              <dt className="text-text-muted text-sm">{linha.rotulo}</dt>
              <dd className="min-w-0 text-sm font-medium">{linha.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{modelo.texto.titulo}</h2>
        <LegendaDoPost legenda={modelo.texto.corpo} />
      </section>

      <section className="space-y-4">
        <DecisoesDoConteudo
          rodadaPendenteId={modelo.rodadaPendenteId}
          status={modelo.status}
          decididoPor={modelo.decididoPor}
          decididoEm={modelo.decididoEm}
          somenteLeitura={comoEquipe}
        />
        {modelo.download ? (
          <a
            href={modelo.download.href}
            download={modelo.download.nome}
            className="hover:bg-accent inline-flex min-h-9 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors"
          >
            <Download aria-hidden className="size-4" />
            Baixar arquivo
          </a>
        ) : null}

        <HistoricoDeVersoes
          versoes={versoes}
          artes={artes}
          versaoAtual={modelo.versaoAtual}
          rotuloDoTexto={modelo.texto.titulo}
        />
      </section>

      <ThreadDeComentarios
        conteudo={modelo.conteudo}
        comentarios={comentarios}
        agora={agora}
        nomeDaEmpresa={nomeDaEmpresa}
        somenteLeitura={comoEquipe}
      />
    </div>
  );
}

function Vizinho({
  href,
  rotulo,
  children,
}: {
  href: string | null;
  rotulo: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span
        aria-hidden
        className="text-text-muted inline-flex size-9 items-center justify-center rounded-md border opacity-40"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={rotulo}
      className="hover:bg-accent inline-flex size-9 items-center justify-center rounded-md border transition-colors"
    >
      {children}
    </Link>
  );
}

/** Formata uma data ISO para a linha de contexto, ou devolve o traço. */
export function dataLonga(iso: string | null): string {
  if (!iso) return "—";
  return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}
