import Link from "next/link";
import { FileEdit } from "lucide-react";

import { rascunhosAExpirar } from "@/lib/dados/tasks";

/**
 * O rascunho que ficou parado.
 *
 * ---------------------------------------------------------------------------
 * **ELE NÃO SOME MAIS, E O TEXTO PRECISOU MUDAR POR ISSO.**
 *
 * A 0028 desenhou este bloco como o aviso do sexto dia: `publicada_em is
 * null` sem alteração há 7 dias, e `limpar_rascunhos_abandonados()` apagando
 * na madrugada seguinte. **A rotina nunca foi agendada** — a parte do sprint
 * que ia agendá-la saiu do produto com a VPS —, então o texto antigo ("um
 * rascunho seu some amanhã") afirmava na primeira tela de todo dia uma coisa
 * que não acontece.
 *
 * Prometer um apagamento que não vem é pior que não avisar nada: a pessoa
 * confia que o Full Hub limpa por ela, para de olhar, e um ano depois o
 * "Minhas Tasks" dela tem trinta pensamentos pela metade que ela acha que já
 * foram embora. Então o bloco continua, dizendo o que é verdade — aquele
 * rascunho está parado — e quem apaga é quem clica.
 *
 * A função do banco fica de pé e funciona; ela só não tem quem a chame. Está
 * registrado na seção "O que o Sprint 16 NÃO vai entregar" do CLAUDE.md.
 * ---------------------------------------------------------------------------
 *
 * **Não aparece quando não há nada a dizer**, e é o normal: um bloco fixo
 * dizendo "nenhum rascunho parado" ocuparia todo dia o lugar de uma
 * informação que interessa em raríssimos dias.
 */
export async function RascunhosAExpirar() {
  const rascunhos = await rascunhosAExpirar();
  if (rascunhos.length === 0) return null;

  return (
    <section className="bg-warning-soft rounded-card border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FileEdit aria-hidden className="size-4" />
        {rascunhos.length === 1
          ? "Um rascunho seu está parado há uma semana"
          : `${rascunhos.length} rascunhos seus estão parados há uma semana`}
      </h2>

      <p className="text-text-secondary mt-1 text-sm">
        Ninguém mais vê um rascunho além de você, e o Full Hub não apaga sozinho. Termine e clique
        em Criar task, ou apague pelo fim da página.
      </p>

      <ul className="mt-3 space-y-1">
        {rascunhos.map((r) => (
          <li key={r.id}>
            <Link
              href={`/painel/gestao-tasks/${r.id}`}
              className="text-accent-strong text-sm hover:underline"
            >
              {r.titulo || "Sem título"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
