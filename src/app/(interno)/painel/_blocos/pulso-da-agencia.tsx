import Link from "next/link";
import { Gauge } from "lucide-react";

import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import type { ResumoDaHome } from "@/lib/dados/home";

/**
 * O panorama da agência, só para a gestão.
 *
 * ---------------------------------------------------------------------------
 * CINCO NÚMEROS, E TODOS CONTAM SÓ AS FOLHAS
 *
 * A agrupadora fica de fora de "etapas abertas" e de "atrasadas" pela mesma
 * razão de sempre: quem tem filha para de ser unidade de trabalho, e contá-la
 * faria a agência parecer ter mais trabalho aberto do que tem. Quem aplica o
 * filtro é `home_summary()`, num lugar só — este bloco desenha o que recebe.
 *
 * **E rascunho não entra em nenhum deles.** Um rascunho é um pensamento pela
 * metade, e se ele contasse aqui o número mudaria quando alguém desistisse de
 * uma demanda que nunca existiu para a equipe.
 * ---------------------------------------------------------------------------
 *
 * **"Concluídas na semana" sai do histórico de status, e não de `updated_at`.**
 * Aquele carimbo muda com qualquer save, então corrigir o título de uma etapa
 * concluída em janeiro a traria para a conta de hoje. O histórico grava a
 * transição, que é o fato que a pergunta quer.
 *
 * **O bloco não some quando os números são zero**, ao contrário de "Precisa de
 * mim". Aqui zero é informação: zero atrasada é a resposta boa, e um bloco que
 * desaparece nos dias bons ensina que ele só aparece quando há problema — e aí
 * ninguém mais o lê nos outros dias.
 */
export function PulsoDaAgencia({ dados }: { dados: ResumoDaHome["pulso"] }) {
  if (!dados) return null;

  const atrasadas = dados.atrasadas ?? 0;

  return (
    <section className="space-y-3">
      <h2 className="text-text-primary flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
        <Gauge aria-hidden className="size-4" />
        Pulso da agência
        <Link
          href="/painel/gestao-tasks"
          className="text-accent-strong ml-auto text-xs font-normal normal-case tracking-normal hover:underline"
        >
          ver as demandas
        </Link>
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CartaoDeNumero
          rotulo="Etapas abertas"
          valor={dados.etapas_abertas ?? 0}
          apoio="em demandas publicadas"
          href="/painel/gestao-tasks"
        />
        <CartaoDeNumero
          rotulo="Atrasadas"
          valor={atrasadas}
          apoio={atrasadas === 0 ? "nenhuma passou do prazo" : "passaram do prazo da etapa"}
          tom={atrasadas > 0 ? "alerta" : "bom"}
          href="/painel/gestao-tasks"
        />
        <CartaoDeNumero
          rotulo="Concluídas na semana"
          valor={dados.concluidas_semana ?? 0}
          apoio="nos últimos 7 dias"
        />
        <CartaoDeNumero
          rotulo="Posts com o cliente"
          valor={dados.posts_com_cliente ?? 0}
          apoio="enviados, esperando decisão"
          href="/painel/social-media"
        />
        <CartaoDeNumero
          rotulo="Campanhas ativas"
          valor={dados.campanhas_ativas ?? 0}
          apoio="em produção agora"
          href="/painel/aprovacoes"
        />
      </div>
    </section>
  );
}
