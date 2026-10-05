"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarRange, Loader2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { CalendarioRolavel } from "@/components/shared/calendario-rolavel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { DescansoDoCiclo } from "@/lib/dados/full-days";
import {
  ROTULOS_DE_STATUS,
  ROTULOS_DE_TIPO,
  bloqueiosNoIntervalo,
  contarDiasDoPedido,
  motivoDoBloqueio,
  rotuloDosDias,
} from "@/lib/dominio/full-days";
import type { HrRequest, HrTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { cancelarSolicitacao, solicitar } from "./acoes";

/**
 * A aba Solicitar: calendário rolável à esquerda, painel de confirmação à
 * direita.
 *
 * **A SELEÇÃO MORA AQUI, e é a correção do bug relatado.** Antes o mês vivia
 * na URL e entrava no `key` do `<Suspense>` da página: trocar de mês
 * desmontava a subárvore e o componente novo nascia com `de` e `ate` em null.
 * Pedir de 28/10 a 03/11 era impossível — a primeira ponta sumia ao virar o
 * mês. Agora não existe virar o mês: `CalendarioRolavel` empilha os meses e
 * rola, recebe a seleção por propriedade e devolve por callback, e nunca é
 * remontado.
 *
 * A conta aparece aqui para mostrar o número enquanto se escolhe — corrido no
 * descanso, dias úteis nos outros dois. O número GRAVADO sai do banco: se
 * viesse desta conta, bastaria alterar o corpo da requisição para pedir 15
 * dias dizendo que são 3.
 */
export function Solicitar({
  solicitacoes,
  feriados,
  bloqueados,
  hojeISO,
  diasPorCiclo,
  parcelasPorCiclo,
  descanso,
  minhaArea,
}: {
  solicitacoes: HrRequest[];
  feriados: { data: string; nome: string }[];
  bloqueados: Record<string, string[]>;
  hojeISO: string;
  /** O que o contrato dá a cada ciclo de 12 meses. */
  diasPorCiclo: number;
  parcelasPorCiclo: number;
  /** O saldo já calculado pelo banco, ou null se a ficha não respondeu. */
  descanso: DescansoDoCiclo | null;
  minhaArea: string;
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [de, setDe] = useState<string | null>(null);
  const [ate, setAte] = useState<string | null>(null);
  const [tipo, setTipo] = useState<HrTipo>("ferias");
  const [motivo, setMotivo] = useState("");

  const feriadoDe = useMemo(
    () => new Map(feriados.map((f) => [f.data, f.nome])),
    [feriados],
  );

  /**
   * QUEM DA MINHA ÁREA JÁ ESTÁ FORA, lido do mapa que o calendário já recebe.
   *
   * `bloqueados` é dia → nomes, que é a forma de que a grade precisa para
   * pintar cada célula. Aqui a pergunta é a outra metade — por PESSOA, com o
   * intervalo dela —, e a volta é uma leitura do mesmo objeto, não uma
   * consulta nova: pedir ao banco a mesma coisa de outro jeito é abrir a porta
   * para os dois números discordarem.
   *
   * A faixa é o primeiro e o último dia em que o nome aparece, e ela é
   * honesta sobre o que não sabe: dois períodos separados da mesma pessoa no
   * mesmo mês se leem como um só. Guardar cada bloco exigiria a data de
   * início e de fim de cada pedido alheio — informação que esta tela não tem e
   * não deve ter, porque ela é do calendário de quem propõe, não da matriz.
   */
  /**
   * O BOTÃO DE PÉ, derivado uma vez — e é ele que decide se a pílula aparece.
   *
   * Desabilitada, a pílula com degradê continuava parecendo clicável: o
   * `opacity-50` do botão a deixava num azul claro que se lê como "ação
   * principal em repouso", e não como "não dá". Quando não dá, ela volta a ser
   * um botão cinza chapado — que é a forma que o produto inteiro usa para
   * dizer isso, e a única que não promete nada.
   */
  const foraDaMinhaArea = useMemo(() => {
    const porPessoa = new Map<string, string[]>();
    for (const [dia, nomes] of Object.entries(bloqueados)) {
      for (const nome of nomes) {
        const dias = porPessoa.get(nome);
        if (dias) dias.push(dia);
        else porPessoa.set(nome, [dia]);
      }
    }
    return [...porPessoa.entries()]
      .map(([nome, dias]) => {
        const ordenados = [...dias].sort();
        const primeiro = ordenados[0];
        const ultimo = ordenados[ordenados.length - 1];
        return {
          nome,
          faixa:
            primeiro === ultimo
              ? format(parseISO(primeiro), "dd/MM")
              : `${format(parseISO(primeiro), "dd/MM")} a ${format(parseISO(ultimo), "dd/MM")}`,
          desde: primeiro,
        };
      })
      .sort((a, b) => a.desde.localeCompare(b.desde));
  }, [bloqueados]);
  const conjuntoDeFeriados = useMemo(
    () => new Set(feriados.map((f) => f.data)),
    [feriados],
  );

  const inicioSel = de;
  const fimSel = ate;

  // A conta MUDA COM O TIPO: o descanso é corrido, os outros dois contam dias
  // úteis. Trocar o tipo com um período já selecionado troca o número na hora,
  // que é onde a pessoa percebe a diferença sem ninguém precisar explicar.
  const diasSelecionados =
    inicioSel && fimSel
      ? contarDiasDoPedido(tipo, inicioSel, fimSel, conjuntoDeFeriados)
      : 0;

  // O SALDO NÃO É CALCULADO AQUI. Ele vem de `descanso_do_ciclo()`, que é a
  // mesma conta que a trava do `insert` usa — ver `lib/dados/full-days.ts`. O
  // fallback existe só para a ficha que não respondeu: mostrar um ciclo cheio
  // é melhor que mostrar zero, que pareceria uma pessoa sem direito nenhum.
  const concedidos = descanso?.diasConcedidos ?? diasPorCiclo;
  const usados = descanso?.diasUsados ?? 0;
  const parcelasConcedidas = descanso?.parcelasConcedidas ?? parcelasPorCiclo;
  const parcelasUsadas = descanso?.parcelasUsadas ?? 0;
  const ciclos = descanso?.ciclos ?? 1;

  const saldo = descanso?.saldo ?? diasPorCiclo;
  const saldoDepois = tipo === "ferias" ? saldo - diasSelecionados : saldo;

  // O PRIMEIRO CICLO É UM ESTADO PRÓPRIO, e não "saldo zero" (0074). Quem
  // entrou há três meses não gastou os dias dela: eles ainda não chegaram, e
  // as duas situações pedem frases opostas — uma manda escolher um período
  // menor, a outra manda esperar uma data.
  //
  // O fallback de `ciclos` continua sendo 1 e não 0, e é deliberado: quando a
  // consulta do saldo falha, cair em zero trancaria a equipe inteira fora do
  // pedido por causa de uma leitura que não respondeu. É a decisão do limite
  // de tentativas — falhar para o lado aberto, porque quem recusa quando
  // quebra recusa justamente na hora em que já há outro problema. Quem decide
  // de verdade é a trava do `insert`.
  const primeiroCiclo = tipo === "ferias" && ciclos === 0;

  const excedeSaldo =
    tipo === "ferias" && !primeiroCiclo && diasSelecionados > saldo;
  const semParcela =
    tipo === "ferias" && !primeiroCiclo && parcelasUsadas >= parcelasConcedidas;

  // A DATA POR EXTENSO, uma vez só: ela aparece na faixa do topo e no aviso do
  // resumo, e duas formatações da mesma data é o começo de duas datas.
  const chegamEm = descanso?.proximoEm
    ? format(parseISO(descanso.proximoEm), "dd/MM/yyyy")
    : null;
  const retroativo = Boolean(inicioSel && inicioSel < hojeISO);

  /**
   * Por que este dia não pode ser escolhido, ou null.
   *
   * **O PASSADO DEPENDE DO TIPO**, e essa é a regra que o calendário não tem
   * como saber sozinho: descanso e afastamento são combinados antes, então
   * para trás não faz sentido; ausência pontual é registrada DEPOIS de
   * acontecer — foi ontem que a pessoa faltou.
   */
  function recusaDoDia(dia: string): string | null {
    const fora = bloqueados[dia];
    if (fora?.length) {
      return `${fora.join(", ")} ${fora.length === 1 ? "está" : "estão"} fora neste dia, e ${
        fora.length === 1 ? "é" : "são"
      } da sua área.`;
    }
    if (dia < hojeISO && tipo !== "ausencia") {
      return `${ROTULOS_DE_TIPO[tipo]} se combina antes. Para registrar um dia que já passou, escolha Ausência pontual.`;
    }
    return null;
  }

  /**
   * A recusa por colega da área, ou string vazia.
   *
   * A PERGUNTA É SOBRE O INTERVALO. Antes a tela olhava dia a dia, e por isso
   * clicar no dia 8 não fazia nada enquanto escolher de 5 a 20 — que passa
   * por cima do 8 — era aceito. Eram duas respostas para a mesma situação,
   * conforme o caminho do clique.
   */
  function recusaDoIntervalo(inicio: string, fim: string): string {
    return motivoDoBloqueio(
      bloqueiosNoIntervalo(inicio, fim, bloqueados),
      minhaArea,
    );
  }

  function limpar() {
    setDe(null);
    setAte(null);
    setMotivo("");
  }

  function enviar() {
    if (!inicioSel || !fimSel) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        solicitar({ tipo, data_inicio: inicioSel, data_fim: fimSel, motivo }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        limpar();
        router.refresh();
      }
    });
  }

  const podeEnviar =
    !enviando &&
    Boolean(inicioSel) &&
    diasSelecionados > 0 &&
    !excedeSaldo &&
    !semParcela &&
    !primeiroCiclo;

  return (
    <div className="space-y-5">
      {/* O SALDO ABRE A TELA NUM BANNER, e não numa frase corrida.
          Ele já abria a tela — a decisão anterior foi tirá-lo da coluna
          lateral, porque era preciso varrer o olho até a direita para achar.
          O que muda agora é o peso: o número é a primeira coisa que quem
          entra aqui quer saber, e um parágrafo o escondia no meio de uma
          explicação sobre dias corridos. A barra dá a mesma resposta pelo
          formato, para quem não lê o número.

          Quem pede afastamento ou ausência pontual não vê saldo nenhum: não
          desconta, e mostrar um número que não muda ensina a ignorá-lo. */}
      {tipo === "ferias" ? (
        <section className="bg-action-soft rounded-card flex flex-wrap items-center justify-between gap-6 border p-6">
          <div className="min-w-0 space-y-1.5">
            <p className="text-accent-strong text-xs font-semibold tracking-widest uppercase">
              Saldo de descanso
            </p>
            <p className="text-text-primary text-[26px] leading-tight font-bold tracking-[-0.035em]">
              {primeiroCiclo
                ? chegamEm
                  ? `Seus primeiros ${diasPorCiclo} dias chegam em ${chegamEm}`
                  : `Seus primeiros ${diasPorCiclo} dias chegam ao completar 12 meses`
                : `Você tem ${saldo} de ${concedidos} dias disponíveis`}
            </p>
            {primeiroCiclo && !chegamEm ? (
              <p className="text-accent-strong text-sm">
                Esta ficha ainda não tem data de entrada — peça à gestão para
                preencher.
              </p>
            ) : null}

            {/* QUANDO OS DIAS VOLTAM É A METADE QUE FALTAVA (0085). O saldo
                deixou de correr: ele se restaura inteiro no aniversário da
                entrada, e o que sobrou do ciclo se perde ali. Sem esta linha a
                faixa diz "você tem 5 de 15" e não diz nem que os 5 vencem, nem
                que os 15 voltam — e as duas coisas decidem se a pessoa pede
                agora ou espera. É a razão pela qual a dica da recusa do banco
                carrega a mesma data. */}
            {!primeiroCiclo && chegamEm ? (
              <p className="text-accent-strong text-sm">
                O descanso não acumula: os {concedidos} dias voltam inteiros em{" "}
                {chegamEm}, e o que sobrar deste ciclo se perde.
              </p>
            ) : null}
          </div>

          {/* A BARRA SOME NO PRIMEIRO CICLO, e não vai a zero: "0% de 0 dias em
              0 de 0 parcelas" é uma linha de números que não decide nada, e
              uma barra vazia pede para ser lida como "você já usou tudo" —
              que é o contrário do que está acontecendo. A faixa ao lado já
              diz a única coisa que há para dizer, que é a data. */}
          {primeiroCiclo ? null : (
            <div className="bg-surface-card shadow-cartao w-full max-w-xs shrink-0 rounded-xl p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-text-secondary text-sm">Já usado</span>
                <span className="text-sm font-semibold tabular-nums">
                  {concedidos > 0 ? Math.round((usados / concedidos) * 100) : 0}%
                </span>
              </div>
              <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-action h-full rounded-full"
                  style={{
                    width: `${concedidos > 0 ? Math.min(100, Math.round((usados / concedidos) * 100)) : 0}%`,
                  }}
                />
              </div>
              <p className="text-text-muted mt-2 text-right text-xs tabular-nums">
                {usados} {usados === 1 ? "dia" : "dias"} em {parcelasUsadas} de{" "}
                {parcelasConcedidas}{" "}
                {parcelasConcedidas === 1 ? "parcela" : "parcelas"}
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-surface-card rounded-card shadow-cartao border p-5">
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary font-medium">
              {ROTULOS_DE_TIPO[tipo]}
            </strong>{" "}
            não desconta do seu saldo. Entra na matriz da equipe e no relatório.
          </p>
        </section>
      )}

      {/* O CALENDÁRIO À ESQUERDA, A CONFIGURAÇÃO NA COLUNA DE 306px — e a
          inversão desfaz uma decisão minha, com o argumento dela virado.

          A versão anterior punha o painel à esquerda porque *"o tipo de pedido
          muda o que o calendário significa"* — descanso conta corrido, os
          outros contam útil — e queria que a regra fosse lida antes das datas.
          O que ela não notou é que isso deixava o Full Days sendo o INVERSO
          das outras telas do produto: em Minhas Tasks e no Início a peça
          grande é a da esquerda e o resumo é a coluna estreita da direita, e
          aqui a peça grande é justamente o calendário.

          **E a regra não depende mais da posição para ser lida**, que é o que
          torna a inversão barata: o tipo de pedido é o primeiro bloco da
          coluna, os três cartões dizem por extenso se descontam, e a faixa de
          saldo acima das duas colunas já respondeu a pergunta antes de
          qualquer clique.

          As seções perderam a numeração que a tela tinha. Ela vinha do Nova
          Task, onde as seções são etapas de um formulário que se percorre de
          cima para baixo; aqui são duas colunas lado a lado, e numerar dois
          blocos simultâneos promete uma ordem que a tela não tem. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_306px]">
        <div className="min-w-0 space-y-3">
          {/* A instrução fica COLADA NO CALENDÁRIO, onde a mão está: seleção
            por intervalo não se explica sozinha, e quem nunca usou clica
            num dia, vê um quadrado azul e não descobre que falta o segundo
            clique. A segunda frase é nova e responde à pergunta que gerou
            este ajuste — sim, dá para atravessar o mês. */}
          <p className="text-text-muted mb-3 text-xs">
            Clique na data inicial e depois na final — ou arraste de uma até a
            outra. Role para alcançar os outros meses: a seleção não se perde.
          </p>

          <div className="bg-surface-card rounded-card shadow-cartao border p-3">
            <CalendarioRolavel
              de={de}
              ate={ate}
              aoSelecionar={(novoDe, novoAte) => {
                setDe(novoDe);
                setAte(novoAte);
              }}
              hojeISO={hojeISO}
              feriados={feriadoDe}
              bloqueados={bloqueados}
              recusaDoDia={recusaDoDia}
              recusaDoIntervalo={recusaDoIntervalo}
              aoRecusar={(frase) => toast.error(frase)}
            />
          </div>

          <ul className="text-text-secondary mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <li className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="bg-accent-strong size-3 rounded-sm"
              />
              Selecionado
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="bg-warning-soft border-warning size-3 rounded-sm border"
              />
              Alguém da sua área está fora
            </li>
          </ul>
        </div>

        {/* EMPILHADAS, A CONFIGURAÇÃO VEM PRIMEIRO — `order-first` no celular e
            a ordem natural no desktop. As duas metades da decisão são
            diferentes: em duas colunas o olho começa na esquerda, e lá a peça
            grande é o calendário; empilhadas não há esquerda, há em cima, e em
            cima tem que estar o que decide o que o calendário significa (o
            tipo muda de corrido para útil) mais o resumo do que já foi
            escolhido. Com o calendário em cima, ele rola dentro de si mesmo e
            o resumo fica longe do polegar — a decisão que a prévia da
            recorrência já tinha tomado, pelo mesmo motivo. */}
        <aside className="order-first lg:order-none flex flex-col gap-2.5">
          <section className="bg-surface-card rounded-card shadow-cartao space-y-4 border p-5">
          <h2 className="text-base font-semibold">Configurar pedido</h2>

          {/* TRÊS BOTÕES À VISTA, e não uma lista suspensa. São três opções e
              nunca mais, e cada uma carrega a informação que decide a escolha:
              se desconta do saldo ou não. Dentro de um `select` isso só
              aparecia depois de abrir — e a diferença entre descanso e
              ausência pontual é exatamente essa.

              **E ELES EMPILHAM, em vez de dividir a linha em três.** Numa
              coluna de 306px cada cartão ficaria com noventa pixels, e a linha
              que decide a escolha — "desconta (20d livres)" contra "não
              desconta" — sairia truncada nos três: sobraria a palavra do tipo,
              que é justamente a parte que não explica nada. Empilhados ela
              cabe por extenso, e o nome e a nota se leem na mesma linha.

              `radiogroup` e não três botões soltos: o leitor de tela anuncia
              "1 de 3" e a seta move entre eles, que é o comportamento certo
              para escolha única. */}
          <div className="space-y-2">
            <span className="text-text-muted text-xs font-semibold tracking-wider uppercase">
              Tipo de pedido
            </span>
            <div
              role="radiogroup"
              aria-label="Tipo de pedido"
              className="flex flex-col gap-2"
            >
              {(
                [
                  // "desconta (0d livres)" é a frase certa para quem gastou
                  // tudo e a errada para quem ainda não conquistou nada — e a
                  // imagem do protótipo mostrou as duas com o mesmo texto. No
                  // primeiro ciclo o cartão diz o que está acontecendo, que é
                  // a razão inteira desta linha existir: ela está aqui para a
                  // pessoa escolher entre os três tipos.
                  [
                    "ferias",
                    ciclos === 0 ? "ainda não conquistado" : `desconta (${saldo}d livres)`,
                  ],
                  ["licenca", "não desconta"],
                  ["ausencia", "não desconta"],
                ] as const
              ).map(([valor, nota]) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={tipo === valor}
                  onClick={() => setTipo(valor)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    tipo === valor
                      ? "border-action bg-action-soft"
                      : "hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[13px]",
                      tipo === valor ? "font-bold" : "font-semibold",
                    )}
                  >
                    {ROTULOS_DE_TIPO[valor]}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[11px] font-semibold",
                      tipo === valor ? "text-action-text" : "text-text-muted",
                    )}
                  >
                    {nota}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <dl className="space-y-1.5 border-t pt-3 text-sm">
            <Campo
              rotulo="De"
              valor={
                inicioSel ? format(parseISO(inicioSel), "dd/MM/yyyy") : "—"
              }
            />
            <Campo
              rotulo="Até"
              valor={fimSel ? format(parseISO(fimSel), "dd/MM/yyyy") : "—"}
            />
            <Campo
              rotulo={tipo === "ferias" ? "Dias corridos" : "Dias úteis"}
              valor={inicioSel ? String(diasSelecionados) : "—"}
              destaque
            />
            {tipo === "ferias" && !primeiroCiclo ? (
              <Campo
                rotulo="Saldo depois"
                valor={`${saldoDepois} de ${concedidos}`}
                destaque={saldoDepois < 0}
              />
            ) : null}
          </dl>

          {!inicioSel ? (
            <p className="text-text-muted text-xs">
              Nenhum período escolhido ainda. Use o calendário ao lado.
            </p>
          ) : null}

          {retroativo ? (
            <Aviso tom="atencao">
              Este período já começou. Registro do que passou é para ausência
              pontual — o sócio vai ver a data ao responder.
            </Aviso>
          ) : null}

          {/* UM AVISO SÓ, e ele é o do primeiro ciclo. Sem o `!primeiroCiclo`
              nos dois derivados acima, quem entrou este ano veria os três
              empilhados: "você tem 0 de saldo", "já usou as 0 parcelas que
              tem" e este. Três recusas para um motivo é a tela parecendo
              quebrada. A frase é a MESMA do banco, como as outras duas: quem
              lê aqui e quem levar a recusa do `insert` precisa ler o mesmo. */}
          {primeiroCiclo ? (
            <Aviso tom="erro">
              {chegamEm
                ? `O descanso é conquistado a cada 12 meses de casa. Os seus primeiros ${diasPorCiclo} dias chegam em ${chegamEm}.`
                : "O descanso é conquistado a cada 12 meses de casa, e esta ficha não tem data de entrada."}
            </Aviso>
          ) : null}

          {/* "NESTE CICLO" É A PALAVRA QUE A 0085 ACRESCENTOU, nos dois
              lados. Sem ela, quem tirou dez no ciclo passado e cinco neste
              leria "você tem 10 de saldo" e iria procurar os outros dez — e a
              frase do banco diz exatamente isto desde a 0085. */}
          {excedeSaldo ? (
            <Aviso tom="erro">
              São {diasSelecionados} dias corridos e neste ciclo você tem{" "}
              {saldo} de saldo. Escolha um período menor
              {chegamEm ? ` ou espere ${chegamEm}` : ""}.
            </Aviso>
          ) : null}

          {/* A FRASE É A MESMA DO BANCO, de propósito: quem vê o aviso aqui e
              quem levar a recusa do `insert` precisa ler a mesma coisa. A
              contagem é a do CICLO CORRENTE (0085) — as parcelas se restauram
              junto com os dias, e não somam. Com elas somando, quem tem três
              ciclos poderia partir quinze dias em seis vezes, o que esta
              própria frase já negava ao dizer "por ciclo". */}
          {semParcela ? (
            <Aviso tom="erro">
              O descanso pode ser partido em até {parcelasPorCiclo} vezes por
              ciclo de 12 meses, e você já usou as {parcelasConcedidas} deste
              ciclo.
            </Aviso>
          ) : null}

          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="fd-motivo" className="text-text-secondary text-xs">
              Observação (opcional)
            </Label>
            <Textarea
              id="fd-motivo"
              rows={3}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Algo que o sócio deva saber sobre este período?"
            />
          </div>

          <div className="flex gap-2">
            {inicioSel ? (
              <Button
                variant="outline"
                size="sm"
                onClick={limpar}
                disabled={enviando}
              >
                <X aria-hidden />
                Limpar
              </Button>
            ) : null}
            {/* A PÍLULA COM DEGRADÊ, porque aqui ela é a ação principal de
                uma coluna e não mais um botão numa linha de controles — a
                mesma decisão do "Nova task" de Minhas Tasks e do Início. As
                três paradas do degradê são medidas pelo `check:cores` contra o
                branco do rótulo. Desabilitada ela volta ao cinza: um degradê
                apagado continua parecendo clicável. */}
            <Button
              className={cn(
                "h-11 flex-1 rounded-full text-sm font-bold",
                podeEnviar
                  ? "pilula-de-acao text-action-foreground hover:brightness-105"
                  : "bg-muted text-text-muted opacity-100 shadow-none",
              )}
              disabled={!podeEnviar}
              onClick={enviar}
            >
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Enviar pedido
            </Button>
          </div>
          </section>

        {/* QUEM JÁ ESTÁ FORA DA MINHA ÁREA, e ele não custa consulta
            nenhuma: `bloqueados` é o mapa dia → nomes que o calendário já
            recebe para pintar de âmbar, e este cartão é o mesmo dado lido de
            outro jeito — por pessoa, com o intervalo dela.

            **Ele existe porque em 390px o nome não cabe na célula.** Lá cada
            dia tem cerca de 45px, "Marina" vira "Ma…" e truncar não
            identifica ninguém; o dia fica só em âmbar e o nome mora aqui. No
            desktop ele continua servindo: quem vai propor uma semana lê a
            lista antes de clicar, em vez de descobrir a recusa no arrasto. */}
        {foraDaMinhaArea.length > 0 ? (
          <section className="bg-surface-card rounded-card shadow-cartao border p-4">
            <h2 className="text-text-secondary flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <TriangleAlert aria-hidden className="size-4" />
              Quem já está fora
            </h2>
            <ul className="mt-3 space-y-2">
              {foraDaMinhaArea.map((pessoa) => (
                <li key={pessoa.nome} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {pessoa.nome}
                  </span>
                  <span className="bg-warning-soft text-warning shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums">
                    {pessoa.faixa}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-text-muted mt-3 text-xs">
              Da sua área, {minhaArea}. Os dias deles ficam em âmbar no
              calendário, e o pedido que passar por cima é recusado.
            </p>
          </section>
        ) : null}
        </aside>
      </div>

      <section className="space-y-2.5">
        <h2 className="text-text-secondary text-xs font-bold tracking-wider uppercase">
          Meus períodos
        </h2>

        {solicitacoes.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Você ainda não pediu nada"
            description="Escolha um período no calendário acima e envie. Os sócios são avisados na hora."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {solicitacoes.map((pedido) => (
              <li
                key={pedido.id}
                className="bg-surface-card rounded-card shadow-cartao flex flex-wrap items-center gap-3 border p-3.5"
              >
                <Badge variant="outline">{ROTULOS_DE_TIPO[pedido.tipo]}</Badge>

                <span className="text-sm tabular-nums">
                  {format(parseISO(pedido.data_inicio), "dd/MM/yy")} a{" "}
                  {format(parseISO(pedido.data_fim), "dd/MM/yy")}
                </span>

                <span className="text-text-muted text-xs">
                  {rotuloDosDias(pedido.tipo, pedido.dias_uteis)}
                </span>

                <SeloDeStatus status={pedido.status} />

                <span className="text-text-muted ml-auto text-xs tabular-nums">
                  pedido em {format(parseISO(pedido.created_at), "dd/MM/yy")}
                </span>

                {pedido.status === "pendente" ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        Cancelar
                      </Button>
                    }
                    title="Cancelar este pedido?"
                    description="Ele sai da fila dos sócios e o saldo volta para você."
                    confirmLabel="Cancelar pedido"
                    destructive
                    onConfirm={async () => {
                      const resultado = await chamarAcao(() =>
                        cancelarSolicitacao(pedido.id),
                      );
                      if (!resultado.ok) toast.error(resultado.error);
                      else {
                        toast.success(resultado.mensagem);
                        router.refresh();
                      }
                    }}
                  />
                ) : null}

                {pedido.status === "reprovada" && pedido.motivo_reprovacao ? (
                  <p className="text-text-secondary w-full text-sm">
                    Motivo: {pedido.motivo_reprovacao}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-text-muted text-xs">{rotulo}</dt>
      <dd className={cn("tabular-nums", destaque && "font-semibold")}>
        {valor}
      </dd>
    </div>
  );
}

function Aviso({
  tom,
  children,
}: {
  tom: "erro" | "atencao";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-md p-2.5 text-xs",
        tom === "erro"
          ? "bg-danger-soft text-danger"
          : "bg-warning-soft text-warning",
      )}
    >
      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function SeloDeStatus({ status }: { status: HrRequest["status"] }) {
  const classe =
    status === "aprovada"
      ? "bg-success-soft text-success"
      : status === "reprovada"
        ? "bg-danger-soft text-danger"
        : status === "cancelada"
          ? "bg-neutral-soft text-muted-foreground"
          : "bg-warning-soft text-warning";

  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", classe)}>
      {ROTULOS_DE_STATUS[status]}
    </span>
  );
}
