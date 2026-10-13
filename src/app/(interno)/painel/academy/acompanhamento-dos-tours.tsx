import { AlertTriangle } from "lucide-react";

import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import type { LinhaDoAcompanhamentoDeTour } from "@/lib/dados/tour";
import { ROTULO_DO_MICRO_TOUR } from "@/lib/tour/micro-tours";
import { TOUR_DO_PAINEL, TOUR_DO_PORTAL } from "@/lib/tour/passos";

/**
 * O ACOMPANHAMENTO DOS TOURS, para a gestão.
 *
 * ---------------------------------------------------------------------------
 * **ELE MORA NA GESTÃO DO ACADEMY, e é onde o sprint o pede.** A proximidade é
 * o argumento: aquela aba responde "quem leu o que a agência escreveu", e esta
 * seção responde "quem se ambientou na interface". As duas são a mesma
 * pergunta a dois níveis, e numa rota própria a segunda seria uma tela que
 * ninguém abre por hábito.
 *
 * **SÃO TRÊS PERGUNTAS, e as três saem das MESMAS linhas:**
 *
 *   1. quem concluiu, quem pulou, quem está no meio e quem nunca começou;
 *   2. **em qual passo as pessoas desistem** — *"se metade abandona no passo
 *      4, o problema é o passo 4, não as pessoas"*;
 *   3. **os passos pulados por elemento ausente, agregados** — o ALARME DE
 *      TOUR QUEBRADO.
 *
 * Uma segunda função agregando no banco daria dois lugares onde a conta pode
 * divergir da lista que esta tela desenha, que é o cartão de "11 entregues"
 * com sete na lista embaixo. A agregação acontece aqui.
 * ---------------------------------------------------------------------------
 *
 * **O ALARME VEM PRIMEIRO, e é a única coisa desta tela que pede ação.** As
 * outras duas são leitura: saber quem não se ambientou é conversa, saber onde
 * as pessoas desistem é desenho. Um seletor que envelheceu junto com a tela é
 * um conserto, e ele tem nome e número.
 */
export function AcompanhamentoDosTours({
  linhas,
}: {
  linhas: LinhaDoAcompanhamentoDeTour[];
}) {
  const semAncora = new Map<string, number>();
  for (const l of linhas) {
    for (const passo of l.semAncora) {
      const chave = `${l.tourId ?? "?"} · ${passo}`;
      semAncora.set(chave, (semAncora.get(chave) ?? 0) + 1);
    }
  }
  const alarme = [...semAncora.entries()].sort((a, b) => b[1] - a[1]);

  // ONDE AS PESSOAS PARAM: só quem está `em_andamento` conta. Quem concluiu
  // passou por todos, e quem pulou não parou num passo — ela decidiu antes.
  const desistencias = new Map<string, number>();
  for (const l of linhas) {
    if (l.status !== "em_andamento" || l.passoAtual === null) continue;
    const chave = `${l.tourId ?? "?"} · passo ${l.passoAtual + 1}`;
    desistencias.set(chave, (desistencias.get(chave) ?? 0) + 1);
  }
  const paradas = [...desistencias.entries()].sort((a, b) => b[1] - a[1]);

  const porPessoa = agrupar(linhas);

  return (
    <section className="space-y-4" aria-labelledby="tours-da-equipe">
      <div>
        <h2 id="tours-da-equipe" className="font-semibold">
          Tours de primeiro acesso
        </h2>
        <p className="text-text-muted mt-1 text-sm">
          Quem se ambientou, onde as pessoas param, e os passos que o sistema
          não conseguiu apontar.
        </p>
      </div>

      {/* O ALARME DE TOUR QUEBRADO. `--warning` e nunca `--danger`: um seletor
          que envelheceu é um conserto, não um incidente — e vermelho numa tela
          que se abre uma vez por mês treina o hábito de ignorar vermelho.

          E ele SOME quando está vazio, que é o resultado bom: um quadro
          dizendo "nenhum passo quebrado" ocupa a tela todo mês para informar
          em alguns. */}
      {alarme.length > 0 ? (
        <div className="bg-warning-soft rounded-card shadow-cartao flex items-start gap-3 border border-transparent p-4">
          <AlertTriangle
            aria-hidden
            className="text-warning mt-0.5 size-5 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-medium">
              {alarme.length === 1
                ? "Um passo não encontrou o elemento na tela."
                : `${alarme.length} passos não encontraram o elemento na tela.`}
            </p>
            <p className="text-text-secondary mt-1 text-sm">
              O tour pulou em silêncio, como ele deve — mas o seletor
              envelheceu junto com o layout e precisa de conserto.
            </p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {alarme.map(([chave, quantas]) => (
                <li key={chave} className="tabular-nums">
                  <span className="font-medium">{rotulo(chave)}</span> ·{" "}
                  {quantas}{" "}
                  {quantas === 1 ? "vez" : "vezes"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {paradas.length > 0 ? (
        <div className="bg-card rounded-card shadow-cartao border p-4">
          <h3 className="text-sm font-semibold">Onde as pessoas pararam</h3>
          <ul className="text-text-secondary mt-2 space-y-0.5 text-sm">
            {paradas.map(([chave, quantas]) => (
              <li key={chave} className="tabular-nums">
                {rotulo(chave)} · {quantas}{" "}
                {quantas === 1 ? "pessoa" : "pessoas"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-text-muted border-b text-left text-xs uppercase">
              <th className="py-2 pr-4 font-semibold">Pessoa</th>
              <th className="py-2 pr-4 font-semibold">Perfil</th>
              <th className="py-2 pr-4 font-semibold">Boas-vindas</th>
              <th className="py-2 font-semibold">Micro-tours</th>
            </tr>
          </thead>
          <tbody>
            {porPessoa.map((p) => (
              <tr key={p.userId} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{p.pessoa}</td>
                <td className="text-text-muted py-2 pr-4">
                  {ROTULOS_DE_ROLE[p.role]}
                </td>
                <td className="py-2 pr-4">{p.boasVindas}</td>
                <td className="text-text-muted py-2 tabular-nums">
                  {p.microTours === 0 ? "—" : `${p.microTours} feito(s)`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-text-muted text-xs">
        Quem <strong>nunca começou</strong> aparece aqui do mesmo jeito — é
        justamente ela que esta tabela existe para encontrar. O cliente entra na
        conta do tour do portal, que é o único que quebraria sem ninguém notar.
      </p>
    </section>
  );
}

/** "painel · passo 4" → "Boas-vindas do painel · passo 4". */
function rotulo(chave: string): string {
  const [tourId, ...resto] = chave.split(" · ");
  const sufixo = resto.join(" · ");
  const nome =
    tourId === TOUR_DO_PAINEL
      ? "Boas-vindas do painel"
      : tourId === TOUR_DO_PORTAL
        ? "Boas-vindas do portal"
        : (ROTULO_DO_MICRO_TOUR[tourId] ?? tourId);
  return sufixo ? `${nome} · ${sufixo}` : nome;
}

type Pessoa = {
  userId: string;
  pessoa: string;
  role: LinhaDoAcompanhamentoDeTour["role"];
  boasVindas: string;
  microTours: number;
};

/**
 * UMA LINHA POR PESSOA, e não por tour: a função devolve o produto das duas
 * coisas, e uma tabela com doze linhas da mesma pessoa é uma tabela em que
 * ninguém acha ninguém. O que a coluna de boas-vindas diz é o estado do tour
 * grande; os micro-tours viram contagem.
 */
function agrupar(linhas: LinhaDoAcompanhamentoDeTour[]): Pessoa[] {
  const mapa = new Map<string, Pessoa>();

  for (const l of linhas) {
    const atual =
      mapa.get(l.userId) ??
      ({
        userId: l.userId,
        pessoa: l.pessoa,
        role: l.role,
        boasVindas: "nunca começou",
        microTours: 0,
      } satisfies Pessoa);

    if (l.tourId === TOUR_DO_PAINEL || l.tourId === TOUR_DO_PORTAL) {
      atual.boasVindas =
        l.status === "concluido"
          ? "concluído"
          : l.status === "pulado"
            ? "pulou"
            : `no passo ${(l.passoAtual ?? 0) + 1}`;
    } else if (l.tourId && l.status === "concluido") {
      atual.microTours += 1;
    }

    mapa.set(l.userId, atual);
  }

  return [...mapa.values()];
}
