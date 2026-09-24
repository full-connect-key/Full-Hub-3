"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  contagemDoGrupo,
  ehGrupo,
  linhaDoEntregavel,
  progresso,
  statusDoNo,
  type EntregavelDoPortal,
  type NoDaArvore,
} from "@/lib/dominio/campanhas";
import { cn } from "@/lib/utils";

/**
 * A árvore de materiais da campanha, em dois níveis.
 *
 * **O grupo abre por padrão quando tem pendência**, e só então. Abrir tudo
 * transforma a Wave em uma lista de quarenta linhas, onde o que precisa de
 * decisão fica no meio; abrir nada esconde exatamente o que a pessoa veio
 * ver. O critério é o mesmo que decide o destaque do cartão: o que espera
 * ELA.
 *
 * **Este é o único componente de navegador desta tela**, e o motivo é só o
 * recolher. Tudo o mais — a árvore, os contadores, o alerta — vem montado do
 * servidor, como em toda listagem do produto.
 *
 * **Grupo não é link.** Ele não tem arquivo, não tem versão e não tem decisão:
 * o que ele tem são os filhos, que já estão logo abaixo. Um clique que
 * levasse a uma página só para repetir a mesma lista seria um passo a mais
 * para chegar ao mesmo lugar.
 */
export function ArvoreDeEntregaveis({
  arvore,
  base,
  hoje,
  miniaturas,
}: {
  arvore: NoDaArvore[];
  /** O prefixo do link de cada item: `${base}/${id}`. */
  base: string;
  hoje: string;
  /** Endereços já assinados, por caminho. */
  miniaturas: Record<string, string>;
}) {
  return (
    <ul className="space-y-2">
      {arvore.map((no) =>
        ehGrupo(no) ? (
          <Grupo
            key={no.item.id}
            no={no}
            base={base}
            hoje={hoje}
            miniaturas={miniaturas}
          />
        ) : (
          <li key={no.item.id}>
            <Item
              item={no.item}
              base={base}
              hoje={hoje}
              miniaturas={miniaturas}
            />
          </li>
        ),
      )}
    </ul>
  );
}

function Grupo({
  no,
  base,
  hoje,
  miniaturas,
}: {
  no: NoDaArvore;
  base: string;
  hoje: string;
  miniaturas: Record<string, string>;
}) {
  const conta = progresso(no.filhos);
  const temPendencia = no.filhos.some(
    (f) =>
      f.status === "em_aprovacao" ||
      f.status === "ajustes" ||
      f.status === "rejeitado",
  );
  const [aberto, setAberto] = useState(temPendencia);

  return (
    <li className="bg-surface-card overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="hover:bg-accent flex w-full items-center gap-3 p-3 text-left transition-colors"
      >
        {aberto ? (
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        ) : (
          <ChevronRight aria-hidden className="size-4 shrink-0" />
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-medium">
            {no.item.nome}{" "}
            <span className="text-text-muted font-normal tabular-nums">
              ({contagemDoGrupo(no.filhos)})
            </span>
          </p>
          <BarraDeProgresso
            valor={conta.aprovados}
            total={conta.total}
            tom={conta.aprovados === conta.total ? "sucesso" : "marca"}
            rotulo={`${conta.percentual}% aprovado`}
          />
        </div>

        {/* O selo do grupo é CALCULADO pelos filhos — não existe coluna para
            ele. Quem tem filho para de ser unidade de trabalho, e o status
            escrito à mão num grupo é descartado pelo banco. */}
        <StatusBadge status={statusDoNo(no)} />
      </button>

      {aberto ? (
        <ul className="space-y-2 border-t p-3 pl-6 sm:pl-10">
          {no.filhos.map((filho) => (
            <li key={filho.id}>
              <Item
                item={filho}
                base={base}
                hoje={hoje}
                miniaturas={miniaturas}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Item({
  item,
  base,
  hoje,
  miniaturas,
}: {
  item: EntregavelDoPortal;
  base: string;
  hoje: string;
  miniaturas: Record<string, string>;
}) {
  const linha = linhaDoEntregavel(item, hoje);
  const miniatura = item.thumbnailUrl
    ? (miniaturas[item.thumbnailUrl] ?? item.thumbnailUrl)
    : null;

  return (
    <Link
      href={`${base}/${item.id}`}
      className={cn(
        "bg-surface-card hover:border-accent-strong flex items-center gap-3 rounded-xl border p-3 transition-colors",
      )}
    >
      <div className="bg-neutral-soft size-12 shrink-0 overflow-hidden rounded-lg border">
        {miniatura ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={miniatura}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium">{item.nome}</p>
        {/* A LINHA MUDA POR STATUS: quem aprovou e quando, há quantos dias
            espera, o motivo da recusa, o prazo previsto. Um selo sozinho não
            responde "e daí?", que é a pergunta de quem olha a árvore. */}
        {linha ? <p className="text-text-muted text-sm">{linha}</p> : null}
      </div>

      <StatusBadge status={item.status} />
    </Link>
  );
}
