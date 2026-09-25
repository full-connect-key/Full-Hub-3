import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { CapaDoCartao } from "@/components/shared/capa-do-cartao";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  periodoCurto,
  ROTULO_DA_CAMPANHA,
  type CampanhaDoPortal,
  type Progresso,
} from "@/lib/dominio/campanhas";
import { cn } from "@/lib/utils";

/**
 * Uma campanha na listagem.
 *
 * **O destaque é para quem espera a decisão DELE**, e não para quem tem
 * qualquer pendência. Uma campanha parada na produção da agência não é
 * trabalho do cliente, e destacá-la faria o realce perder o significado logo
 * na primeira semana — que é o que acontece com todo realce que aparece
 * sempre.
 *
 * O selo de status fica em texto ao lado do período, e não como `StatusBadge`
 * colorido: a cor do cartão já está reservada para o destaque de pendência, e
 * dois sinais de cor disputando o mesmo cartão não dizem nada.
 */
export function CartaoDeCampanha({
  campanha,
  progresso,
  esperando,
  href,
}: {
  campanha: CampanhaDoPortal;
  progresso: Progresso;
  /** Quantos materiais esperam a decisão do cliente agora. */
  esperando: number;
  href: string;
}) {
  const completa = progresso.total > 0 && progresso.aprovados === progresso.total;

  return (
    <Link
      href={href}
      className={cn(
        "bg-surface-card hover:border-accent-strong block space-y-3 rounded-xl border p-4 transition-colors",
        esperando > 0 && "border-warning",
      )}
    >
      {/* A CAPA VEM ANTES DO NOME, e só quando existe (0050). O cliente abre
          esta lista uma vez por semana e tem três ou quatro campanhas do mesmo
          período: a imagem é o que ele reconhece antes de ler. Sem capa o
          cartão fica como sempre foi — moldura vazia numa grade em que quase
          nenhuma tem imagem é uma lista de buracos. */}
      <CapaDoCartao url={campanha.capaAssinada} alt={campanha.nome} />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-medium">{campanha.nome}</h3>
        {esperando > 0 ? (
          <span className="bg-warning-soft text-warning rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap">
            {esperando === 1
              ? "1 material esperando você"
              : `${esperando} materiais esperando você`}
          </span>
        ) : null}
      </div>

      <p className="text-text-muted flex items-center gap-1.5 text-sm tabular-nums">
        <CalendarRange aria-hidden className="size-4 shrink-0" />
        {periodoCurto(campanha.dataInicio, campanha.dataFim)}
        <span aria-hidden>·</span>
        <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
      </p>

      {progresso.total > 0 ? (
        <BarraDeProgresso
          valor={progresso.aprovados}
          total={progresso.total}
          tom={completa ? "sucesso" : "marca"}
          rotulo={`${progresso.aprovados} de ${progresso.total} ${
            progresso.total === 1 ? "material aprovado" : "materiais aprovados"
          }`}
        />
      ) : (
        // Campanha sem material ENVIADO não mostra "0 de 0", que parece uma
        // conta errada: ela ainda está sendo montada pela agência, e é isso
        // que a frase diz.
        <p className="text-text-muted text-sm">
          Os materiais desta campanha ainda estão em produção.
        </p>
      )}
    </Link>
  );
}

/** O selo de status, para onde ele couber sozinho. */
export function SeloDaCampanha({ campanha }: { campanha: CampanhaDoPortal }) {
  return <StatusBadge status={statusEquivalente(campanha.status)} />;
}

/**
 * O `campaign_status` não tem selo próprio, e não vai ter.
 *
 * `StatusBadge` já cobre os estados do PRODUTO, e criar um segundo mapa de
 * cor para quatro valores a mais é criar o lugar onde as duas paletas
 * divergem. O de-para é aqui, num lugar só, e é explícito.
 */
function statusEquivalente(
  status: CampanhaDoPortal["status"],
): "em_producao" | "aprovado" | "aguardando_informacoes" | "stand_by" {
  if (status === "ativa") return "em_producao";
  if (status === "finalizada") return "aprovado";
  if (status === "planejamento") return "aguardando_informacoes";
  return "stand_by";
}
