"use client";

import { useState } from "react";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Search, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DateBadge } from "@/components/shared/date-badge";
import { DiaDeTrabalho } from "@/components/shared/dia-de-trabalho";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import type { BuscaNaPauta, CargaDaEquipe } from "@/lib/dados/pauta-da-equipe";
import type { DiaDeDisponibilidade } from "@/lib/dominio/disponibilidade";
import { MINIMO_PARA_BUSCAR } from "@/lib/dominio/busca";
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
  busca,
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
   * O QUE A BUSCA ACHOU, ou nulo quando não há termo nenhum na URL.
   *
   * Ela vem de fora pela razão de `linhas` e de `diaEscolhido`: a leitura é
   * `server-only`, e esta tela é desenhada por um componente de servidor que já
   * a resolveu — uma Server Action no `onChange` custaria uma volta ao servidor
   * por tecla digitada.
   */
  busca: BuscaNaPauta | null;
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

  /**
   * O TERMO DA BUSCA MORA NA URL, como a pessoa e o dia — *"achei, olha quem
   * fez"* precisa ser um link.
   *
   * **E ele só vai para lá no Enter ou no `blur`**, que é a assimetria da
   * trilha de auditoria (0135): os outros controles desta tela são um clique, e
   * este é texto. Levando cada tecla à URL, cada letra seria uma navegação de
   * servidor e uma varredura nova sobre `subtasks` — e quem digita um termo
   * sabe quando acabou de digitar.
   *
   * **`replace` e `scroll: false`**, como `escolher()` e pela mesma razão: o
   * campo fica embaixo da grade, e o resultado aparece abaixo dele.
   */
  function buscar(valor: string) {
    const limpo = valor.trim();
    if (limpo === (busca?.termo ?? "")) return;

    const proximos = new URLSearchParams(parametros.toString());
    if (limpo === "") proximos.delete("busca");
    else proximos.set("busca", limpo);
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
          ACHAR A ETAPA PELO TÍTULO

          Decisão do usuário, item 1: *"poder pesquisar por titulo, para achar
          a task caso não lembre quem fez"*.

          ELA VARRE A EQUIPE E NÃO A PESSOA ESCOLHIDA, e a razão é a segunda
          metade da frase: uma busca que exige escolher o nome primeiro não
          responde nada a quem não sabe o nome. Por isso a resposta de cada
          linha é a PESSOA, e o clique nela é o que abre a pauta dela.

          E ELA FICA AQUI, entre a grade e as duas seções de detalhe, porque a
          grade e a busca são as duas PORTAS da mesma resposta e o dia e a
          pauta são os quartos. *O que isso custa, e é dito:* o dia escolhido
          desceu uma seção da grade que o abriu. São sessenta pixels de campo,
          e a alternativa — a busca aparecer em outro lugar conforme houver um
          dia escolhido — seria a tela se reorganizando debaixo de quem só
          clicou numa célula.
         ------------------------------------------------------------------ */}
      <section
        aria-labelledby="pauta-busca"
        className="bg-card rounded-card shadow-cartao border-input space-y-3 border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="pauta-busca"
            className="text-text-primary flex items-center gap-2 text-sm font-semibold"
          >
            <Search aria-hidden className="size-4" />
            Achar uma etapa pelo título
          </h2>
          <div className="relative">
            <Search
              aria-hidden
              className="text-text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            />
            <Input
              /* O CAMPO É SOLTO, COM `key` NA PALAVRA DA URL, e não um
                 `useState` ressincronizado por efeito: `setState` no corpo de
                 um efeito dispara renderização em cascata, e o `react-hooks`
                 do projeto reprova. É a decisão da busca da auditoria. */
              key={busca?.termo ?? ""}
              defaultValue={busca?.termo ?? ""}
              type="search"
              aria-label="Achar uma etapa pelo título"
              placeholder="Título da etapa ou da demanda…"
              className="h-9 w-64 pl-8"
              onBlur={(e) => buscar(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  buscar(e.currentTarget.value);
                }
              }}
            />
          </div>
        </div>

        {/* A LINHA DE AJUDA DIZ O QUE A BUSCA ALCANÇA, e ela é a metade do
            item 1 que não precisava de código: a pauta de cada pessoa é
            DESDE SEMPRE — `carregar()` não tem janela de data nem filtro de
            status —, e isso não se vê, porque a lista mora embaixo de uma
            grade da semana corrente. Quem lê a grade tem motivo para ler a
            lista de baixo como a semana daquele nome. */}
        {busca === null ? (
          <p className="text-text-secondary text-xs">
            Procura em toda a pauta da equipe, desde sempre — pelo nome da etapa
            ou da demanda. O resultado diz de quem ela é.
          </p>
        ) : busca.termo.length < MINIMO_PARA_BUSCAR ? (
          <p className="text-text-secondary text-xs">
            Escreva ao menos {MINIMO_PARA_BUSCAR} letras.
          </p>
        ) : busca.achadas.length === 0 ? (
          /* AS DUAS FRASES DO VAZIO SÃO DUAS, como na trilha de auditoria: o
             repouso diz o que a busca alcança, e esta diz que o termo não
             achou — sem ela, quem procura e não acha conclui que a pauta não
             guarda o trabalho antigo. */
          <p className="text-text-secondary text-xs">
            Nenhuma etapa com <strong>{busca.termo}</strong> no título, nem na
            demanda. Rascunho não entra: ele é de quem o criou.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-text-secondary text-xs">
              {busca.achadas.length === busca.total
                ? `${busca.total} ${busca.total === 1 ? "etapa" : "etapas"}`
                : /* O CORTE DIZ QUANTOS SOBRARAM, que é a regra do Resumo da
                     Agência: cortar calado faz a pessoa concluir que aquilo é
                     tudo. E o total conta ETAPAS e não linhas, porque uma
                     etapa com duas pessoas é uma etapa. */
                  `${busca.achadas.length} de ${busca.total} etapas — escreva mais para estreitar`}
            </p>
            <ul className="space-y-2">
              {busca.achadas.map((a) => (
                <li
                  key={a.subtaskId}
                  className="border-input bg-card rounded-card flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-2"
                >
                  {/* O TÍTULO TEM PISO E É O PRIMEIRO A NÃO CEDER LARGURA:
                      ele é a única coisa que a linha existe para dizer, e é a
                      terceira vez que esta casa paga isso. */}
                  <div className="min-w-[14rem] flex-1">
                    <p className="text-text-primary truncate text-sm font-medium">
                      {a.etapa}
                    </p>
                    <p className="text-text-muted truncate text-xs">
                      {a.cliente ? `${a.cliente} · ` : ""}
                      {a.demanda}
                    </p>
                  </div>

                  <StatusBadge status={a.status} />
                  {a.prazo ? <DateBadge date={a.prazo} /> : null}

                  {/* A RESPOSTA DA BUSCA É A PESSOA, e cada uma é um BOTÃO:
                      clicar nela escolhe aquele nome, e a pauta dela abre logo
                      abaixo — que é o caminho inteiro do pedido.

                      E O CLIQUE LIMPA O DIA, pela mesma razão de `escolher()`:
                      o detalhe de uma célula de outra pessoa não diz nada
                      sobre esta. */}
                  {a.pessoas.length === 0 ? (
                    /* SEM DONO A LINHA DIZ ISSO, em vez de sumir: "ninguém" é
                       a resposta mais cara de *quem fez*, porque etapa sem
                       responsável não está no "Minhas Tasks" de ninguém — o
                       pior tipo de trabalho, o que existe e ninguém sabe que é
                       seu. É `--warning` e nunca `--danger`: é um cadastro a
                       completar, não um erro. */
                    <span className="text-warning text-xs font-medium">
                      Sem responsável
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      {a.pessoas.map((pes) => (
                        <button
                          key={pes.id}
                          type="button"
                          onClick={() => escolher(pes.id, null)}
                          aria-pressed={pes.id === pessoa?.id}
                          /* O CHÃO DE REPOUSO É DA LINHA DE BASE e não de um
                             ramo do ternário: o `check:cores` varre
                             `rounded-full border` e cobra um `bg-` sem prefixo
                             de estado ali — um chip cuja cor sai do ramo é um
                             chip que toma o chão de quem o abriga quando
                             alguém mexe no ternário. O `tailwind-merge` do
                             `cn` deixa o ramo ativo ganhar. */
                          className={cn(
                            "border-input bg-card flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition",
                            pes.id === pessoa?.id
                              ? "bg-action-soft text-action-text border-transparent"
                              : "text-text-secondary hover:border-action-text",
                          )}
                        >
                          <UserAvatar
                            name={pes.nome}
                            src={pes.avatar_url}
                            size="xs"
                            tooltip={false}
                          />
                          {pes.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
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
            {/* "DESDE SEMPRE" É DITO, e é a metade do item 1 que não precisava
                de código: `carregar()` traz toda demanda publicada em que ela
                tem uma folha, sem janela de data e sem filtro de status, e a
                lista agrupa pelos seis status escondendo só grupo vazio.

                A FRASE EXISTE PORQUE A GRADE ACIMA É DA SEMANA CORRENTE: quem
                clica num nome ali tem motivo para ler esta lista como a semana
                daquele nome, e a ambiguidade é da composição da tela, não da
                consulta. Ela some junto com a lista vazia, porque aí não há o
                que qualificar. */}
            {linhas.length > 0 ? (
              <p className="text-text-muted text-xs">
                {linhas.length}{" "}
                {linhas.length === 1 ? "etapa" : "etapas"}, de todos os meses —
                não só desta semana.
              </p>
            ) : null}
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
