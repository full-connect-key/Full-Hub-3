import { Check } from "lucide-react";

import {
  andamentoDoMaterial,
  quandoDoPasso,
  type PassoDoAndamento,
} from "@/lib/dominio/portal";
import type { ContentStatus } from "@/lib/supabase/database.types";

/**
 * ONDE O MATERIAL ESTÁ, e quando cada coisa aconteceu.
 *
 * ---------------------------------------------------------------------------
 * **O cartão tem DUAS metades, e a de baixo era a seção "Informações".** Ela
 * vivia numa faixa de largura inteira abaixo da arte — campanha, frente,
 * arquivo, versão, prazo —, e quem está decidindo um material consulta aquelas
 * cinco linhas junto com o andamento, não depois dele: "esperando desde o dia
 * 12" e "prazo dia 14" são a mesma pergunta partida em dois lugares da página.
 *
 * **Quais passos existem, e por que não são os cinco que o roteiro pedia, está
 * escrito em `andamentoDoMaterial()`** — é lá que mora a regra, porque a
 * pergunta é de domínio e não de desenho.
 * ---------------------------------------------------------------------------
 *
 * **A COR NUNCA É O ÚNICO SINAL.** Cada passo carrega o estado por extenso num
 * `sr-only`, e não só no verde ou no azul do círculo: quem usa leitor de tela
 * não tem a cor, e quem não distingue verde de cinza também não. É a regra do
 * selo de status do calendário do social.
 *
 * **Os três pares de cor são os medidos da casa** — `--success` com
 * `--success-foreground`, `--accent` com `--accent-foreground`, e o cinza
 * `--neutral-soft` sem nada escrito dentro. Nenhuma opacidade: opacidade sobre
 * um fundo qualquer dá uma cor que ninguém mediu, e no tema escuro dá outra.
 */
export function AndamentoDoMaterial({
  status,
  recebidoEm,
  decisaoPedidaEm,
  decididoEm,
  decididoPor,
  propriedades,
  agora,
}: {
  status: ContentStatus;
  recebidoEm: string | null;
  decisaoPedidaEm: string | null;
  decididoEm: string | null;
  decididoPor: string | null;
  propriedades: { rotulo: string; valor: string }[];
  agora: string;
}) {
  const passos = andamentoDoMaterial({
    status,
    recebidoEm,
    decisaoPedidaEm,
    decididoEm,
    decididoPor,
  });

  return (
    <section
      aria-labelledby="andamento-do-material"
      className="bg-surface-card rounded-card shadow-cartao border p-4"
    >
      <h2
        id="andamento-do-material"
        className="text-text-secondary text-[11px] font-semibold tracking-wide uppercase"
      >
        Andamento
      </h2>

      <ol className="mt-3.5">
        {passos.map((passo, indice) => (
          <Passo
            key={passo.rotulo}
            passo={passo}
            ultimo={indice === passos.length - 1}
            agora={agora}
          />
        ))}
      </ol>

      {propriedades.length > 0 ? (
        <dl className="mt-1 grid gap-y-2.5 border-t pt-4">
          {propriedades.map((linha) => (
            <div
              key={linha.rotulo}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
            >
              <dt className="text-text-muted text-sm">{linha.rotulo}</dt>
              <dd className="min-w-0 text-sm font-medium">{linha.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

const ESTADO_POR_EXTENSO: Record<PassoDoAndamento["estado"], string> = {
  concluido: "Concluído:",
  atual: "Agora:",
  futuro: "Ainda não aconteceu:",
};

function Passo({
  passo,
  ultimo,
  agora,
}: {
  passo: PassoDoAndamento;
  ultimo: boolean;
  agora: string;
}) {
  return (
    <li className="flex gap-3">
      {/* O FIO CRESCE COM A LINHA, e por isso ele é um irmão do círculo numa
          coluna `flex-col` em vez de uma linha posicionada por cima: um passo
          cujo rótulo quebra em duas linhas deixaria o fio curto, com um vão
          entre ele e o círculo de baixo. O último passo não tem fio — ele não
          liga a nada. */}
      <div className="flex flex-col items-center">
        <Marcador estado={passo.estado} />
        {ultimo ? null : <span aria-hidden className="bg-border w-px flex-1" />}
      </div>

      <div className={ultimo ? "min-w-0 pt-0.5" : "min-w-0 pt-0.5 pb-4"}>
        <p
          className={
            passo.estado === "futuro"
              ? "text-text-muted text-sm"
              : "text-sm font-semibold"
          }
        >
          <span className="sr-only">{ESTADO_POR_EXTENSO[passo.estado]} </span>
          {passo.rotulo}
        </p>
        {/* A DATA SÓ APARECE QUANDO EXISTE UMA, e o traço é só do passo que
            ainda não aconteceu. São dois fatos diferentes: "aconteceu e o
            produto não guarda a hora" não é "não aconteceu", e escrever o
            mesmo traço nos dois juntaria os dois num só. */}
        {passo.quando ? (
          <p className="text-text-muted text-xs tabular-nums">
            {quandoDoPasso(passo.quando, agora)}
          </p>
        ) : passo.estado === "futuro" ? (
          <p aria-hidden className="text-text-muted text-xs">
            —
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Marcador({ estado }: { estado: PassoDoAndamento["estado"] }) {
  if (estado === "concluido") {
    return (
      <span className="bg-success text-success-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
        <Check aria-hidden className="size-3" strokeWidth={3} />
      </span>
    );
  }

  if (estado === "atual") {
    return (
      <span className="bg-accent text-accent-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
        <span aria-hidden className="size-2 rounded-full bg-current" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="bg-neutral-soft size-5 shrink-0 rounded-full border"
    />
  );
}
