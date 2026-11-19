"use client";

import { useState } from "react";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { CargaDaEquipe } from "@/lib/dados/pauta-da-equipe";
import {
  COR_DO_NIVEL,
  ROTULOS_DE_NIVEL,
  nivelDaCarga,
} from "@/lib/dominio/calendario";
import type { Prazos } from "@/lib/dados/minhas-tasks";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { cn } from "@/lib/utils";

import { destinoDaEtapa, type LinhaPessoal } from "./linhas";
import { MinhaLista } from "./minha-lista";
import { PainelLateralDaTask } from "./painel-lateral";

/**
 * A PAUTA DA EQUIPE: quem está com o quê nesta semana, e a pauta de quem for
 * escolhido.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário, item 22: *"todos os colaboradores devem poder visualizar
 * as pautas de todos"*.
 *
 * **O BANCO JÁ RESPONDIA, e é por isso que o item 22 é tela.** `subtasks_select`
 * é `is_staff()` desde a 0007, `profiles_select` passou a ser
 * `is_staff() and role <> 'cliente'` na 0132, e `minhasTasks(userId, …)` é
 * parametrizada por pessoa desde o Sprint 4 — a pauta de outra pessoa nunca
 * precisou de leitura nova, precisou de uma tela que a pedisse. O único SQL do
 * item 22 é o PASSO 1 da 0144, que tira `carga_da_equipe()` do alcance da
 * chave anon.
 * ---------------------------------------------------------------------------
 *
 * **SÃO DUAS PERGUNTAS, E A GRADE VEM PRIMEIRO.** *Quem está sobrecarregado
 * nesta semana?* se responde de relance, varrendo uma coluna; *o que exatamente
 * a Marina tem?* se responde abrindo a pauta dela. Na ordem contrária a pessoa
 * escolheria um nome antes de ter visto de quem é o problema — e é a grade que
 * diz isso.
 *
 * **A GRADE É A PERGUNTA QUE A LINHA DO TEMPO LEVOU EMBORA.** Ela era a única
 * tela que respondia *"a equipe aguenta?"* — a cor da célula dela era OCUPAÇÃO
 * e não camada —, e saiu do Calendário Full por decisão do usuário; o que ficou
 * responde por UMA pessoa (a faixa de disponibilidade) ou por um mês que passou
 * (os alertas do Feedback). **E a escala é a MESMA**, pelos mesmos quatro
 * degraus de `lib/dominio/calendario.ts`: duas escalas para a mesma pergunta
 * seriam descobertas no dia em que uma tela pintasse de verde o dia que a outra
 * pintou de âmbar.
 *
 * **A PESSOA ESCOLHIDA MORA NA URL**, como todo filtro de listagem: *"olha a
 * semana da Marina"* precisa ser um link. E `router.replace` com
 * `scroll: false`, senão escolher um nome no fim da grade joga a página para o
 * topo.
 *
 * **E A LISTA É A MESMA `MinhaLista`**, com as linhas da outra pessoa. Uma
 * segunda lista parecida divergiria no lugar mais caro — o botão que move o
 * status de uma etapa —, e é a decisão de `Cronometro` e de `MeuDia`, que a
 * Home e esta tela compartilham desde o Sprint 15.
 */
export function PautaDaEquipe({
  carga,
  pessoa,
  linhas,
  prazos,
  usuarioId,
  souGestor,
}: {
  /** Nulo quando a leitura da carga falhou — a grade diz isso em vez de mentir. */
  carga: CargaDaEquipe | null;
  /** Quem está escolhido, e o nome dela para o cabeçalho da pauta. */
  pessoa: { id: string; nome: string } | null;
  /** A pauta de quem está escolhido. Vazia quando ninguém está. */
  linhas: LinhaPessoal[];
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [taskAberta, setTaskAberta] = useState<string | null>(null);

  const linhaAberta = taskAberta
    ? linhas.find((l) => l.taskId === taskAberta)
    : undefined;
  const destinoDaTaskAberta = linhaAberta ? destinoDaEtapa(linhaAberta) : null;

  function escolher(id: string | null) {
    const proximos = new URLSearchParams(parametros.toString());
    if (id === null) proximos.delete("pessoa");
    else proximos.set("pessoa", id);
    router.replace(`${caminho}?${proximos.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------
          A GRADE DA SEMANA

          O cartão BRANCO e não um contêiner sem chão, que é o achado dos
          três contêineres desta tela: sem `bg-card` o que aparece entre as
          células é a PÁGINA, e a grade inteira se lê como um bloco cinza.
         ------------------------------------------------------------------ */}
      <section
        aria-labelledby="pauta-semana"
        className="bg-card rounded-card shadow-cartao border-input overflow-hidden border"
      >
        <header className="border-input flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2
            id="pauta-semana"
            className="text-text-primary flex items-center gap-2 text-sm font-semibold"
          >
            <CalendarClock aria-hidden className="text-text-secondary size-4" />
            A semana da equipe
          </h2>
          {/* A LEGENDA É A DA FAIXA DE DISPONIBILIDADE, pelos mesmos quatro
              degraus — e ela é a amostra de verdade, nunca um quadradinho de
              outra cor: uma legenda que mostra outra coisa que a tela é uma
              legenda que ensina errado. */}
          <ul className="text-text-secondary flex flex-wrap items-center gap-3 text-[11px]">
            {(["folgado", "cheio", "estourado"] as const).map((nivel) => (
              <li key={nivel} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("size-3 rounded-sm", COR_DO_NIVEL[nivel])}
                />
                {ROTULOS_DE_NIVEL[nivel]}
              </li>
            ))}
          </ul>
        </header>

        {carga === null ? (
          /* A LEITURA FALHOU, e a grade diz isso. Desenhá-la vazia afirmaria
             que ninguém tem nada nesta semana, que é o pior jeito de uma
             leitura falhar — é a decisão de `--warning` e nunca `--danger`:
             não há erro de ninguém aqui. */
          <p className="text-warning px-4 py-6 text-sm">
            Não foi possível ler a carga da equipe agora. A pauta de cada
            pessoa continua abrindo pelo nome.
          </p>
        ) : carga.pessoas.length === 0 ? (
          <p className="text-text-secondary px-4 py-6 text-sm">
            Ninguém com ficha ativa na equipe.
          </p>
        ) : (
          /* ROLA DENTRO DE SI, nunca a página: seis colunas mais a de nomes
             passam da largura num celular, e a regra desta casa é que o corpo
             da página não rola para o lado. */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">
                Minutos comprometidos de cada pessoa da equipe em cada dia útil
                desta semana.
              </caption>
              <thead>
                <tr className="text-text-secondary text-[11px] uppercase">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Pessoa
                  </th>
                  {carga.dias.map((dia) => (
                    <th
                      key={dia}
                      scope="col"
                      className={cn(
                        "px-2 py-2 text-center font-medium",
                        /* HOJE FICA MARCADO, e é a única coluna que recebe
                           peso: numa grade de cinco dias iguais a pessoa
                           conta no dedo qual é o de hoje. */
                        dia === carga.hoje && "text-text-primary font-semibold",
                      )}
                    >
                      {format(parseISO(dia), "EEE d", { locale: ptBR })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carga.pessoas.map((p) => (
                  <tr key={p.id} className="border-input border-t">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {/* O NOME É O BOTÃO, e não uma seta ao lado: numa lista
                          de quinze linhas, quinze setas são quinze alvos
                          gritando — é a decisão do chevron do seletor de
                          responsável, pelo outro lado. */}
                      <button
                        type="button"
                        onClick={() => escolher(p.id === pessoa?.id ? null : p.id)}
                        aria-pressed={p.id === pessoa?.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
                          p.id === pessoa?.id
                            ? "bg-action-soft text-action-text font-semibold"
                            : "text-text-primary hover:bg-muted",
                        )}
                      >
                        <UserAvatar
                          name={p.nome}
                          src={p.avatar_url}
                          size="xs"
                          tooltip={false}
                        />
                        <span className="truncate">{p.nome}</span>
                      </button>
                    </th>
                    {p.dias.map((d) => {
                      const nivel = nivelDaCarga(d, p.capacidadeMinutos);
                      return (
                        <td key={d.dia} className="px-1.5 py-2 text-center">
                          {/* A CÉLULA DIZ O NÚMERO E A COR, e o rótulo
                              acessível diz a frase: quem usa leitor de tela
                              não tem a cor, e "4h 30min" sozinho não diz se
                              aquilo é folga ou estouro. */}
                          <span
                            title={`${p.nome} · ${format(parseISO(d.dia), "d 'de' MMMM", { locale: ptBR })} · ${d.etapas} etapa(s), ${ROTULOS_DE_NIVEL[nivel]}`}
                            className={cn(
                              "text-text-primary inline-flex min-w-11 justify-center rounded-md px-1.5 py-1 text-xs tabular-nums",
                              COR_DO_NIVEL[nivel],
                              /* FORA É FORMA E NÃO COR: a ausência vem do
                                 Day Off e não da carga, e pintá-la com um
                                 quinto tom poria na grade um significado que
                                 a legenda não explica. O tracejado é a mesma
                                 distinção que a célula de "sem alocação" da
                                 matriz faz. */
                              d.ausente && "border-text-muted border border-dashed",
                            )}
                          >
                            <span className="sr-only">
                              {p.nome}, {format(parseISO(d.dia), "EEEE", { locale: ptBR })}:{" "}
                              {d.ausente ? "fora, " : ""}
                              {d.etapas} etapa{d.etapas === 1 ? "" : "s"},{" "}
                              {ROTULOS_DE_NIVEL[nivel]}.{" "}
                            </span>
                            <span aria-hidden>
                              {d.etapas === 0 ? "—" : formatarMinutos(d.minutos)}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------
          A PAUTA DE QUEM FOI ESCOLHIDO
         ------------------------------------------------------------------ */}
      {pessoa === null ? (
        <EmptyState
          className="bg-card rounded-card shadow-cartao border-solid"
          icon={Users}
          title="Escolha uma pessoa"
          description="Clique num nome da grade acima para ver a pauta dela, etapa por etapa."
        />
      ) : (
        <section aria-labelledby="pauta-da-pessoa" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="pauta-da-pessoa"
              className="text-text-primary text-sm font-semibold"
            >
              A pauta de {pessoa.nome}
            </h2>
            {/* A FRASE DO ITEM 23, e ela fica AQUI e não num aviso no topo:
                quem lê isto está a um clique de mexer numa etapa que não é
                dele, e a consequência precisa estar encostada no lugar onde
                ela acontece. É a decisão da linha de saldo do Day Off, que
                desceu da caixa do topo para a coluna ao lado do botão. */}
            <p className="text-text-secondary text-xs">
              Mexer numa etapa daqui faz a responsabilidade dela passar a ser
              sua.
            </p>
          </div>

          <MinhaLista
            linhas={linhas}
            prazos={prazos}
            usuarioId={usuarioId}
            souGestor={souGestor}
            /* `souDaEquipe` é o terceiro termo da 0144 (item 23): com
               `subtasks_update` em `is_staff()`, quem move a etapa de outra
               pessoa é aceito pelo banco e PASSA A SER a dona dela. Sem ele a
               tela ficaria mais apertada que o Postgres — a lista abriria sem
               botão nenhum, numa seção que existe para a pauta ser
               compartilhada. */
            souDaEquipe
            aoAbrir={setTaskAberta}
          />
        </section>
      )}

      <PainelLateralDaTask
        taskId={taskAberta}
        destino={destinoDaTaskAberta}
        aoFechar={() => setTaskAberta(null)}
      />
    </div>
  );
}
