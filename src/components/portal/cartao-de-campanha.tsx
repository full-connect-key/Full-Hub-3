import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { CapaDoCartao } from "@/components/shared/capa-do-cartao";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  periodoCurto,
  ROTULO_DA_CAMPANHA,
  type CampanhaDoPortal,
  type ContagemPorFase,
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
  fases,
  href,
}: {
  campanha: CampanhaDoPortal;
  progresso: Progresso;
  /** Quantos materiais esperam a decisão do cliente agora. */
  esperando: number;
  /** Os três grupos que somam o total, para os chips. */
  fases: ContagemPorFase;
  href: string;
}) {
  const completa =
    progresso.total > 0 && progresso.aprovados === progresso.total;

  return (
    <Link
      href={href}
      className={cn(
        "bg-surface-card rounded-card shadow-cartao hover:border-accent-strong block space-y-3 border p-4 transition-colors",
        esperando > 0 && "border-warning",
      )}
    >
      {/* A CAPA VEM ANTES DO NOME (0050). O cliente abre esta lista uma vez
          por semana e tem três ou quatro campanhas do mesmo período: a imagem
          é o que ele reconhece antes de ler.

          **E A FAIXA FICA MESMO SEM CAPA**, na cor da marca, o que desfaz o
          que estava escrito aqui. A regra antiga era "moldura vazia numa
          grade é uma lista de buracos" — e a imagem do protótipo mostrou o
          contrário: com uns cartões carregando imagem e outros não, a grade
          fica com alturas desiguais e um vão no fim da linha, que é a única
          das três saídas que parece defeito. Um buraco é um retângulo cinza;
          `--brand-navy` é um fundo escolhido, o mesmo da identidade do
          cliente, e ele dá ritmo à grade em vez de tirá-lo. */}
      <CapaDoCartao
        url={campanha.capaAssinada}
        alt={campanha.nome}
        semCapa="fundo"
      />

      {/* O SELO DE "ESPERANDO VOCÊ" SAIU DAQUI, e foi a imagem que mostrou:
          com os chips embaixo, o cartão dizia "3 materiais esperando você" ao
          lado do título e "3 esperando você" quatro linhas abaixo — o mesmo
          fato duas vezes no mesmo cartão, que é o erro do "11 entregues" com
          sete na lista logo abaixo.

          **O destaque não se perde: quem o faz é a BORDA âmbar do cartão**,
          que já estava aqui e que é o sinal de relance numa grade de três. O
          número exato mora no chip, junto dos outros dois, onde ele responde
          *quantos de quantos*. */}
      <h3 className="min-w-0 font-bold tracking-[-0.015em]">{campanha.nome}</h3>

      <p className="text-text-muted flex items-center gap-1.5 text-sm tabular-nums">
        <CalendarRange aria-hidden className="size-4 shrink-0" />
        {periodoCurto(campanha.dataInicio, campanha.dataFim)}
        <span aria-hidden>·</span>
        <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
        {/* A CONTAGEM ENTRA NESTA LINHA e sai do rótulo da barra, que passou a
            dizer só o percentual: "9 de 12 materiais aprovados" ali e "12
            materiais" aqui seriam o total duas vezes, uma do lado da outra. */}
        {progresso.total > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>
              {progresso.total}{" "}
              {progresso.total === 1 ? "material" : "materiais"}
            </span>
          </>
        ) : null}
      </p>

      {progresso.total > 0 ? (
        <div className="space-y-2.5">
          <BarraDeProgresso
            nome="Materiais aprovados"
            valor={progresso.aprovados}
            total={progresso.total}
            tom={completa ? "sucesso" : "marca"}
            rotulo={`${progresso.percentual}% aprovado`}
          />

          {/* ----------------------------------------------------------------
              OS CHIPS DIZEM ONDE ESTÃO OS OUTROS, e é isso que a barra não
              diz: ela responde "quanto falta", e três materiais esperando a
              decisão dele e nove em produção dão a mesma barra que doze em
              produção. São TRÊS e não sete, pela razão de `FASES_DO_MATERIAL`
              — do lado de fora, "em produção", "aguardando informações" e
              "stand by" são a mesma frase.

              **O ZERO NÃO VIRA CHIP.** A linha responde o que a campanha tem,
              e um "Esperando você 0" é a mesma linha com um número a mais —
              a decisão do selo da fila de aprovações.

              **PAR NOMEADO, nunca opacidade:** `bg-warning-soft text-warning`
              e `bg-success-soft text-success` são medidos. A alternativa
              preguiçosa — o token de estado com uma fração de opacidade — daria
              uma cor que ninguém mediu, e outra no tema escuro.
              ---------------------------------------------------------------- */}
          <div className="flex flex-wrap gap-1.5 text-xs font-medium tabular-nums">
            {fases.producao > 0 ? (
              <span className="bg-neutral-soft text-neutral rounded-md px-2 py-0.5">
                {fases.producao} em produção
              </span>
            ) : null}
            {fases.esperando > 0 ? (
              <span className="bg-warning-soft text-warning rounded-md px-2 py-0.5">
                {fases.esperando} esperando você
              </span>
            ) : null}
            {fases.aprovados > 0 ? (
              <span className="bg-success-soft text-success rounded-md px-2 py-0.5">
                {fases.aprovados} aprovado{fases.aprovados === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
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
