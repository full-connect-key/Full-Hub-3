"use client";

import { useState } from "react";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DiaDeTrabalho } from "@/components/shared/dia-de-trabalho";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { CargaDaEquipe } from "@/lib/dados/pauta-da-equipe";
import type { DiaDeDisponibilidade } from "@/lib/dominio/disponibilidade";
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
  diaEscolhido,
  prazos,
  usuarioId,
  souGestor,
  assumeAoMexer,
}: {
  /** Nulo quando a leitura da carga falhou — a grade diz isso em vez de mentir. */
  carga: CargaDaEquipe | null;
  /** Quem está escolhido, e o nome dela para o cabeçalho da pauta. */
  pessoa: { id: string; nome: string } | null;
  /** A pauta de quem está escolhido. Vazia quando ninguém está. */
  linhas: LinhaPessoal[];
  /**
   * O DIA ESCOLHIDO NA GRADE, com as etapas que o ocupam.
   *
   * Nulo quando ninguém clicou numa célula — e aí não há seção nenhuma, em vez
   * de uma caixa vazia dizendo que não há dia escolhido. É a regra dos blocos
   * de exceção do Início.
   *
   * **ELE VEM DE FORA e não de uma busca aqui**, pela razão de `prazos` e de
   * `linhas`: esta tela é desenhada por um componente de servidor que já
   * resolveu a pessoa, e uma Server Action no clique custaria uma volta ao
   * servidor para responder o que a navegação já responde.
   */
  diaEscolhido: DiaDeDisponibilidade | null;
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  /**
   * QUEM MEXE NUMA ETAPA DAQUI PASSA A SER O DONO DELA? É a GUARDA 3 da 0144
   * do lado de cá: o gatilho `quem_mexe_na_pauta_assume` não faz a passagem
   * para a gestão nem para o Atendimento — eles alteram e a alteração fica
   * registrada, que é o pedido em quantas palavras. A tela só escreve a frase
   * que o banco vai cumprir.
   */
  assumeAoMexer: boolean;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [taskAberta, setTaskAberta] = useState<string | null>(null);

  const linhaAberta = taskAberta
    ? linhas.find((l) => l.taskId === taskAberta)
    : undefined;
  const destinoDaTaskAberta = linhaAberta ? destinoDaEtapa(linhaAberta) : null;

  /**
   * A PESSOA E O DIA MORAM NA URL, os dois, e por isso eles entram e saem
   * juntos: *"olha a quarta da Marina"* precisa ser um link.
   *
   * **O NOME SEMPRE LIMPA O DIA**, e é a assimetria que separa as duas
   * perguntas: a célula responde *o que é esse número?* e o nome responde *o
   * que ela tem?*. Mantendo o dia ao trocar de nome, a pauta de uma pessoa
   * abriria com o detalhe de um dia que a outra tinha cheio.
   */
  function escolher(id: string | null, dia: string | null) {
    const proximos = new URLSearchParams(parametros.toString());
    if (id === null) proximos.delete("pessoa");
    else proximos.set("pessoa", id);
    if (dia === null) proximos.delete("dia");
    else proximos.set("dia", dia);
    router.replace(`${caminho}?${proximos.toString()}`, { scroll: false });
  }

  // O DIA MARCADO SAI DO QUE O SERVIDOR RESOLVEU, nunca do parâmetro cru: é a
  // mesma régua da pessoa, que se resolve pela lista da grade. Um `?dia=` de
  // outra semana não marca célula nenhuma, porque não existe célula dele.
  const diaAtual = diaEscolhido?.data ?? null;

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
          {/* A LEGENDA É A DA FAIXA DE DISPONIBILIDADE, pelos mesmos
              degraus — e ela é a amostra de verdade, nunca um quadradinho de
              outra cor: uma legenda que mostra outra coisa que a tela é uma
              legenda que ensina errado.

              E "FORA" ENTRA NELA, o que só a imagem pegou. A grade desenhava
              QUATRO coisas e a legenda nomeava três: a célula de quem está
              fora é tracejada — o sinal de FORMA, o único que sobrevive ao
              daltonismo — e ela não tinha nome em lugar nenhum visível. Quem
              visse a quinta-feira da Marina não tinha como distingui-la de um
              dia sem etapa, que é a célula vazia ao lado. O `sr-only` de cada
              célula dizia; a tela, não.

              O DIA SEM ETAPA FICA DE FORA, e a ausência é decisão: ele é "com
              folga" levado ao limite, e uma quarta linha dizendo isso seria a
              mesma informação com outro nome. Estar FORA é outro fato. */}
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
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="border-text-muted size-3 rounded-sm border border-dashed"
              />
              fora
            </li>
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
          /* ROLA DENTRO DE SI, nunca a página: cinco colunas de dia mais a
             de nomes passam da largura num celular, e a regra desta casa é que
             o corpo da página não rola para o lado.

             E ELA É UMA REGIÃO FOCÁVEL, que é a decisão da tabela de
             composição da campanha palavra por palavra — e a legenda do
             Calendário Full é o contrário dela, pela diferença do que está
             dentro: lá a saída foi NÃO ROLAR, porque a fileira era estática e
             cabia quebrando de linha, e um `tabIndex` numa lista que não
             decide nada é uma parada de teclado para ler o que já estava à
             vista. Aqui o conteúdo é a COMPARAÇÃO entre cinco colunas de
             número, e empilhá-la por pessoa destruiria a coluna — que é
             justamente o que faz esta grade responder *a equipe aguenta?* de
             relance. Quando rolar é o conteúdo, a resposta do axe é dar ao
             teclado como chegar nele, com NOME: sem ele o leitor de tela
             anuncia uma região sem dizer de quê. */
          <div
            className="focus-visible:ring-ring overflow-x-auto rounded-md focus-visible:ring-2 focus-visible:outline-none"
            tabIndex={0}
            role="region"
            aria-label="A carga da equipe nos cinco dias úteis desta semana"
          >
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
                        onClick={() =>
                          escolher(p.id === pessoa?.id ? null : p.id, null)
                        }
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
                          {/* A CÉLULA É O BOTÃO QUE ABRE O DIA — decisão do
                              usuário: *"eu não quero ver só, se a pessoa tem
                              uma task, quero poder ver, qual task aquela
                              pessoa tem"*.

                              **ELA ERA UM `<span>` MORTO**, e é a quarta vez
                              que este produto encontra um: o número dizia que
                              há trabalho ali e não dizia qual, e o único
                              clique da linha era o NOME — que abre a pauta
                              inteira, e não o dia. Quem olhava "8h" na quarta
                              da Marina clicava na célula, nada acontecia, e a
                              resposta estava a uma consulta de distância.

                              **E TODA CÉLULA ABRE, inclusive a vazia e a de
                              quem está fora.** O painel sempre tem o que
                              dizer — a capacidade, o motivo da ausência, ou
                              "nenhuma etapa neste dia" —, e numa grade de
                              cinco colunas por pessoa um alvo inerte no meio
                              de alvos vivos faz a pessoa adivinhar quais
                              respondem.

                              O rótulo acessível diz a frase: quem usa leitor
                              de tela não tem a cor, e "4h 30min" sozinho não
                              diz se aquilo é folga ou estouro. */}
                          <button
                            type="button"
                            onClick={() =>
                              escolher(
                                p.id,
                                p.id === pessoa?.id && d.dia === diaAtual
                                  ? null
                                  : d.dia,
                              )
                            }
                            aria-pressed={p.id === pessoa?.id && d.dia === diaAtual}
                            title={`${p.nome} · ${format(parseISO(d.dia), "d 'de' MMMM", { locale: ptBR })} · ${d.etapas} etapa(s), ${ROTULOS_DE_NIVEL[nivel]}`}
                            className={cn(
                              "text-text-primary focus-visible:ring-ring inline-flex min-w-11 justify-center rounded-md px-1.5 py-1 text-xs tabular-nums transition-shadow focus-visible:ring-2 focus-visible:outline-none",
                              COR_DO_NIVEL[nivel],
                              /* FORA É FORMA E NÃO COR: a ausência vem do
                                 Day Off e não da carga, e pintá-la com um
                                 quinto tom poria na grade um significado que
                                 a legenda não explica. O tracejado é a mesma
                                 distinção que a célula de "sem alocação" da
                                 matriz faz. */
                              d.ausente && "border-text-muted border border-dashed",
                              /* O ESCOLHIDO É UM ANEL E NUNCA UM FUNDO: o
                                 fundo da célula É a carga, e trocá-lo
                                 apagaria a única informação que ela tem. E a
                                 cor não é o único sinal — o painel logo
                                 abaixo nomeia o dia por extenso. */
                              p.id === pessoa?.id &&
                                d.dia === diaAtual &&
                                "ring-accent-strong ring-offset-card ring-2 ring-offset-1",
                            )}
                          >
                            <span className="sr-only">
                              {p.nome}, {format(parseISO(d.dia), "EEEE", { locale: ptBR })}:{" "}
                              {d.ausente ? "fora, " : ""}
                              {d.etapas} etapa{d.etapas === 1 ? "" : "s"},{" "}
                              {ROTULOS_DE_NIVEL[nivel]}. Abrir o dia.{" "}
                            </span>
                            <span aria-hidden>
                              {d.etapas === 0 ? "—" : formatarMinutos(d.minutos)}
                            </span>
                          </button>
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
          O DIA ESCOLHIDO: o que ocupa aquele número

          ELE VEM ANTES DA PAUTA, encostado na grade que o abriu: ele é o
          detalhe de uma célula, e a pauta é outra pergunta — tudo o que a
          pessoa tem. Depois da lista, ele seria o detalhe de uma coisa que
          saiu do campo de visão.

          E É O MESMO `DiaDeTrabalho` DA FAIXA DE DISPONIBILIDADE, com o mesmo
          desenho: as duas telas respondem *o que é esse número?*, e uma
          segunda cópia divergiria na linha que diz "e mais N etapas" — sem
          ela, um dia com oito etapas parece ter cinco.
         ------------------------------------------------------------------ */}
      {pessoa !== null && diaEscolhido !== null ? (
        <section aria-labelledby="pauta-do-dia" className="space-y-2">
          <h2
            id="pauta-do-dia"
            className="text-text-primary text-sm font-semibold"
          >
            O dia de {pessoa.nome}
          </h2>
          <DiaDeTrabalho dia={diaEscolhido} />
        </section>
      ) : null}

      {/* ------------------------------------------------------------------
          A PAUTA DE QUEM FOI ESCOLHIDO
         ------------------------------------------------------------------ */}
      {pessoa === null ? (
        <EmptyState
          className="bg-card rounded-card shadow-cartao border-solid"
          icon={Users}
          title="Escolha uma pessoa"
          description="Clique num nome da grade acima para ver a pauta dela, etapa por etapa — ou num dia, para ver o que ocupa aquele dia."
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
                desceu da caixa do topo para a coluna ao lado do botão.

                E SÃO DUAS FRASES PORQUE SÃO DUAS CONSEQUÊNCIAS, o que só a
                imagem pegou: a GUARDA 3 do gatilho da 0144 diz que a gestão e
                o Atendimento alteram **sem** assumir — é o pedido em quantas
                palavras —, e a frase única estava prometendo a eles uma
                passagem de responsabilidade que o banco não faz. Numa tela que
                a pessoa do Atendimento abre todo dia, ela era a tela
                afirmando o que não vai acontecer.

                A OUTRA NÃO É "nada acontece": a alteração deles FICA
                REGISTRADA, por `editou_a_etapa`, e é isso que ela diz. Uma
                linha a menos aqui faria a seção prometer silêncio onde há
                rastro. */}
            <p className="text-text-secondary text-xs">
              {assumeAoMexer
                ? "Mexer numa etapa daqui faz a responsabilidade dela passar a ser sua."
                : "Mexer numa etapa daqui fica registrado no seu nome, sem trocar o responsável."}
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
