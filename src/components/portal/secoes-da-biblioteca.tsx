"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, LayoutGrid } from "lucide-react";

import {
  ROTULO_DA_SECAO,
  SECOES_DA_BIBLIOTECA,
  type SecaoDaBiblioteca,
} from "@/lib/dominio/biblioteca-de-marca";
import { cn } from "@/lib/utils";

/**
 * AS DUAS SEÇÕES DA BIBLIOTECA — e a barra existe porque agora são duas.
 *
 * ---------------------------------------------------------------------------
 * **A regra do produto é "menos de duas seções não vira barra"**, e era ela
 * que mantinha esta tela sem barra nenhuma: `lib/dominio/biblioteca.ts`
 * registra, desde a 0119, que *"das cinco abas do roteiro, quatro não têm
 * tabela, bucket nem tela de upload por trás"*. Com o acervo de marca
 * (migration 0139) ela passa a ter duas, e a barra nasce cumprindo a regra em
 * vez de a contrariando.
 *
 * **"Materiais aprovados" é a primeira e o padrão**, porque é o que o cliente
 * abre toda semana: a peça que ele aprovou. O acervo de marca é o que ele
 * busca de vez em quando — o logo para o fornecedor, o banner para o evento.
 *
 * ---------------------------------------------------------------------------
 * **TROCAR DE SEÇÃO LIMPA OS FILTROS, e é a única coisa que ela faz com a
 * URL.** Os quatro controles da grade — busca, vertente, frente, mês, formato
 * — são da seção de materiais, e sobreviver à troca deixaria na URL um
 * recorte que o acervo de marca não aplica: a pessoa voltaria para os
 * materiais com um filtro que ela não escolheu ali. É a decisão de cada aba
 * de Gestão de Tasks carregar os filtros dela.
 *
 * **É BOTÃO E NÃO `<Link>`**, pela razão do seletor de visão: com `<Link>`
 * cada troca viraria uma entrada no histórico, e o "voltar" do navegador
 * andaria entre as duas seções em vez de sair da tela. `replace` e
 * `scroll: false`.
 * ---------------------------------------------------------------------------
 */
const ICONE_DA_SECAO = {
  materiais: LayoutGrid,
  marca: FolderOpen,
} as const satisfies Record<SecaoDaBiblioteca, unknown>;

export function SecoesDaBiblioteca({ atual }: { atual: SecaoDaBiblioteca }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();

  function ir(secao: SecaoDaBiblioteca) {
    const novos = new URLSearchParams();
    // A EMPRESA SOBREVIVE e o resto não: ela diz de QUEM é a biblioteca, e as
    // duas seções respondem pela mesma conta. Perdê-la na troca devolveria
    // quem responde por duas contas para a escolha de empresa.
    const empresa = params.get("empresa");
    if (empresa) novos.set("empresa", empresa);
    if (secao !== "materiais") novos.set("secao", secao);

    const consulta = novos.toString();
    router.replace(consulta ? `${caminho}?${consulta}` : caminho, {
      scroll: false,
    });
  }

  return (
    <nav aria-label="Seções da biblioteca">
      <ul className="flex flex-wrap gap-2">
        {SECOES_DA_BIBLIOTECA.map((secao) => {
          const Icone = ICONE_DA_SECAO[secao];
          const ativo = secao === atual;
          return (
            <li key={secao}>
              <button
                type="button"
                onClick={() => ir(secao)}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
                  ativo
                    ? "border-accent-strong bg-accent text-accent-foreground font-medium"
                    : "hover:bg-accent",
                )}
              >
                <Icone aria-hidden className="size-4" />
                {ROTULO_DA_SECAO[secao]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
