import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarOff, CheckCircle2, ChevronLeft, ChevronRight, Clock, Hourglass, Inbox } from "lucide-react";

import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { horasEMinutos, taxaNoPrazo } from "@/lib/dominio/metricas";
import { rotuloDaFrente } from "@/lib/dominio/solicitacoes";
import { hojeNaAgencia } from "@/lib/dominio/datas";
import {
  lerSemana,
  resumoDaAgencia,
  somarDias,
  type EsperandoCliente,
  type ItemDoResumo,
} from "@/lib/reports/weekly";

export const metadata: Metadata = { title: "Resumo da Agência" };

/**
 * O panorama da semana, para a gestão.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM É A DA CONVERSA DE SEGUNDA-FEIRA: o que saiu, o que não saiu, o que
 * está parado do lado de fora, o que vem, e quem não vai estar.
 *
 * Os números vêm primeiro porque é o que se lê de relance; as listas vêm
 * depois porque é onde se decide alguma coisa. E a lista de atrasadas vem
 * ANTES da de entregues seria a leitura oposta — começar pelo que deu errado
 * transforma a reunião de segunda num inquérito. O que saiu vem primeiro.
 * ---------------------------------------------------------------------------
 *
 * **A semana está na URL** (`?semana=`), como em toda listagem: "olha a semana
 * passada" precisa ser um link. E ela é sempre a segunda-feira, qualquer que
 * seja o dia colado ali — `lerSemana()` normaliza, senão dois links da mesma
 * semana mostrariam recortes deslocados.
 *
 * **Não existe exportação aqui**, e a ausência é escolha: este resumo é para
 * ler e decidir, não para arquivar. Quem precisa da planilha tem as Métricas,
 * com o período livre e o CSV de cada ângulo. Dois caminhos para o mesmo
 * arquivo seriam dois formatos do mesmo dado.
 */
export default async function PaginaDoResumoDaAgencia({
  searchParams,
}: PageProps<"/painel/resumo-agencia">) {
  await exigirAcessoARota("/painel/resumo-agencia");
  const parametros = await searchParams;

  // HOJE VEM DO SERVIDOR e desce pronto, como em Minhas Tasks e no Full Days.
  // "Atrasada" é medida contra ele; se o navegador noutro fuso recalculasse,
  // a lista teria um item a mais ou a menos que o número acima dela.
  const hoje = hojeNaAgencia();
  const semana = lerSemana(parametros.semana, hoje);

  const resumo = await resumoDaAgencia(semana, hoje);
  const taxa = taxaNoPrazo(resumo.numeros.no_prazo, resumo.numeros.fora_do_prazo);
  const estaSemana = semana === lerSemana(hoje, hoje);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumo da Agência"
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/painel/resumo-agencia?semana=${somarDias(semana, -7)}`}
              aria-label="Semana anterior"
              className="hover:bg-muted rounded-lg border p-2"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </Link>
            <span className="px-2 text-sm font-medium">
              {format(parseISO(resumo.de), "d 'de' MMM", { locale: ptBR })} —{" "}
              {format(parseISO(resumo.ate), "d 'de' MMM", { locale: ptBR })}
            </span>
            <Link
              href={`/painel/resumo-agencia?semana=${somarDias(semana, 7)}`}
              aria-label="Semana seguinte"
              className="hover:bg-muted rounded-lg border p-2"
            >
              <ChevronRight aria-hidden className="size-4" />
            </Link>
            {/* "ESTA SEMANA" SOME QUANDO JÁ SE ESTÁ NELA, como o botão "Hoje"
                do calendário do Full Days: um botão que não faz nada é pior
                que um botão a menos. */}
            {estaSemana ? null : (
              <Link
                href="/painel/resumo-agencia"
                className="hover:bg-muted ml-1 rounded-lg border px-3 py-2 text-sm"
              >
                Esta semana
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoDeNumero
          rotulo="Entregues na semana"
          valor={resumo.numeros.concluidas}
          apoio="etapas concluídas"
          tom={resumo.numeros.concluidas > 0 ? "bom" : "neutro"}
        />
        <CartaoDeNumero
          rotulo="Abertas na semana"
          valor={resumo.numeros.criadas}
          apoio="etapas novas"
        />
        <CartaoDeNumero
          rotulo="Entrega no prazo"
          valor={taxa === null ? "—" : `${taxa}%`}
          apoio={taxa === null ? "nenhuma tinha prazo" : "das que tinham prazo"}
          tom={taxa === null ? "neutro" : taxa >= 80 ? "bom" : taxa >= 60 ? "atencao" : "alerta"}
        />
        <CartaoDeNumero
          rotulo="Tempo lançado"
          valor={horasEMinutos(resumo.numeros.minutos_reais)}
          apoio="nas etapas concluídas"
        />
      </div>

      <Bloco
        icone={CheckCircle2}
        titulo="O que saiu"
        vazio="Nenhuma etapa foi concluída nesta semana."
        sobraram={resumo.sobraram.entregues}
        itens={resumo.entregues}
      />

      <Bloco
        icone={AlertTriangle}
        titulo="O que ficou para trás"
        /* A FRASE DIZ "HOJE" porque o número é o estado de agora e não um
           evento da semana escolhida: sem ela, quem abre a semana passada
           acharia que aquelas etapas venceram naquela semana. */
        descricao="Etapas em aberto que já passaram do prazo — medido hoje, não dentro da semana."
        vazio="Nada em aberto passou do prazo. É a resposta boa."
        tom="atencao"
        sobraram={resumo.sobraram.atrasadas}
        itens={resumo.atrasadas}
      />

      <EsperandoOCliente itens={resumo.esperandoCliente} />

      <Bloco
        icone={Clock}
        titulo="O que vence na próxima semana"
        descricao={`${format(parseISO(resumo.proximaDe), "d 'de' MMMM", { locale: ptBR })} a ${format(parseISO(resumo.proximaAte), "d 'de' MMMM", { locale: ptBR })}.`}
        vazio="Nenhuma etapa vence na próxima semana."
        sobraram={resumo.sobraram.proximaSemana}
        itens={resumo.proximaSemana}
      />

      {/* ------------------------------------------------------------------
          O QUE OS CLIENTES PEDIRAM — a classificação da 0124 virando número.

          **ELE VEM DEPOIS DO QUE A AGÊNCIA FEZ, e antes de quem não estará.**
          A ordem deste resumo é a da conversa de segunda: o que saiu, o que
          ficou para trás, o que espera o cliente, o que vence — e só então o
          que ENTROU, que é a pauta da semana que começa. Acima das entregas
          ele abriria o resumo pela caixa de entrada, que é outra tela.

          **AS TRÊS CONTAGENS SÃO UMA LINHA e não três ladrilhos**, e é a
          decisão do Início: a lista logo abaixo É esses números, item por
          item. Três cartões com número grande em cima de uma lista que soma o
          mesmo é o cartão de "11 entregues" com sete na lista embaixo, que
          este arquivo já pagou uma vez.

          **E "sem classificação" só aparece quando existe.** O argumento
          escrito aqui era que *num banco classificado ele é zero para
          sempre*, e **essa premissa caiu com a 0137**: a frente deixou de ser
          exigida na abertura por decisão do usuário, então o pedido sem
          classificação virou um estado comum e esta linha passou a aparecer
          toda semana. O `> 0` fica, e por outra razão: ele some quando não há
          nenhum, que é a semana em que a frase seria a mesma linha com um
          número a mais. Pinta-se a exceção — ela é que deixou de ser rara.
          ------------------------------------------------------------------ */}
      <section className="bg-surface-card rounded-card border p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Inbox aria-hidden className="size-4" />O que os clientes pediram
        </h2>
        <p className="text-text-muted mt-1 text-sm">
          {resumo.pedidos.social + resumo.pedidos.campanha + resumo.pedidos.semClassificacao === 0
            ? "Nenhum pedido novo pelo Portal nesta semana."
            : [
                `${resumo.pedidos.social} de social`,
                `${resumo.pedidos.campanha} de campanha`,
                ...(resumo.pedidos.semClassificacao > 0
                  ? [`${resumo.pedidos.semClassificacao} sem classificação`]
                  : []),
              ].join(" · ")}
        </p>

        {resumo.pedidos.lista.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {resumo.pedidos.lista.map((pedido) => (
              <li key={pedido.id}>
                <Link
                  href={pedido.link}
                  className="hover:bg-accent -mx-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 text-sm transition-colors"
                >
                  {/* O CONTEXTO EM CIMA E O TÍTULO EMBAIXO, com piso de 12rem
                      — a forma do Bloco que as outras quatro seções desta
                      página usam. Numa linha só, o título era o único a ceder
                      largura: em 375px ele saiu "Arte par…", e ele é a única
                      coisa que a linha existe para dizer. Foi a imagem que
                      mostrou, como em "Meu dia" e na lista de etapas do
                      detalhe da Task. */}
                  <span className="min-w-48 flex-1">
                    <span className="text-text-muted block truncate text-xs">
                      {[pedido.cliente, pedido.vertente].filter(Boolean).join(" · ")}
                    </span>
                    <span className="font-medium">{pedido.titulo}</span>
                  </span>
                  {/* O RÓTULO DA FRENTE EM CADA LINHA, e é o que faz as
                      contagens de cima serem conferíveis: um "3 de campanha"
                      cuja lista não diz quais é um número que a pessoa não
                      tem como verificar. */}
                  <span
                    className={
                      pedido.frente
                        ? "bg-neutral-soft text-neutral shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        : "bg-warning-soft text-warning shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    }
                  >
                    {rotuloDaFrente(pedido.frente)}
                  </span>
                </Link>
              </li>
            ))}
            {resumo.pedidos.sobraram > 0 ? (
              <li className="text-text-muted text-xs">
                e mais {resumo.pedidos.sobraram} nesta semana.
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {resumo.foraNaProxima.length > 0 ? (
        <section className="bg-surface-card rounded-card border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarOff aria-hidden className="size-4" />
            Quem não estará na próxima semana
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {resumo.foraNaProxima.map((pessoa) => (
              <li key={pessoa.nome} className="flex items-baseline gap-2">
                <span>{pessoa.nome}</span>
                <span className="text-text-muted text-xs tabular-nums">
                  {pessoa.dias} {pessoa.dias === 1 ? "dia" : "dias"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Bloco({
  icone: Icone,
  titulo,
  descricao,
  vazio,
  itens,
  sobraram,
  tom,
}: {
  icone: typeof CheckCircle2;
  titulo: string;
  descricao?: string;
  vazio: string;
  itens: ItemDoResumo[];
  sobraram: number;
  tom?: "atencao";
}) {
  return (
    <section
      className={
        tom === "atencao" && itens.length > 0
          ? "bg-warning-soft rounded-card border p-4"
          : "bg-surface-card rounded-card border p-4"
      }
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Icone aria-hidden className="size-4" />
        {titulo}
        <span className="text-text-muted ml-auto text-xs tabular-nums">
          {itens.length + sobraram}
        </span>
      </h2>
      {descricao ? <p className="text-text-secondary mt-1 text-sm">{descricao}</p> : null}

      {itens.length === 0 ? (
        <p className="text-text-muted mt-3 text-sm">{vazio}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y">
            {itens.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.link}
                  className="hover:text-accent-strong flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm"
                >
                  <span className="min-w-48 flex-1">
                    {item.contexto ? (
                      <span className="text-text-muted block truncate text-xs">
                        {item.contexto}
                      </span>
                    ) : null}
                    {item.titulo}
                  </span>
                  {item.pessoa ? (
                    <span className="text-text-secondary text-xs">{item.pessoa}</span>
                  ) : (
                    /* ETAPA SEM DONO APARECE DIZENDO ISSO, e não como espaço
                       em branco: ela não está no "Minhas Tasks" de ninguém,
                       que é o pior tipo de trabalho — o que existe e ninguém
                       sabe que é seu. */
                    <span className="text-warning text-xs">sem responsável</span>
                  )}
                  {item.data ? (
                    <span className="text-text-muted w-20 text-right text-xs tabular-nums">
                      {format(parseISO(item.data.slice(0, 10)), "dd/MM", { locale: ptBR })}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {sobraram > 0 ? (
            <p className="text-text-muted mt-2 text-xs">
              e mais {sobraram} — a lista mostra as primeiras para caber numa leitura.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * O que está parado do lado de fora.
 *
 * **É bloco próprio e não mais um `Bloco`**, porque o que ele carrega é outra
 * coisa: aqui não há responsável nem prazo — há há quantos dias a decisão está
 * esperando, que é o único número que importa quando a bola não é da agência.
 */
function EsperandoOCliente({ itens }: { itens: EsperandoCliente[] }) {
  return (
    <section className="bg-surface-card rounded-card border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Hourglass aria-hidden className="size-4" />
        Esperando o cliente
        <span className="text-text-muted ml-auto text-xs tabular-nums">{itens.length}</span>
      </h2>

      {itens.length === 0 ? (
        <p className="text-text-muted mt-3 text-sm">Nada esperando decisão de cliente.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {itens.map((item) => (
            <li key={item.id}>
              <Link
                href={item.link}
                className="hover:text-accent-strong flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm"
              >
                <span className="min-w-48 flex-1">
                  {item.cliente ? (
                    <span className="text-text-muted block truncate text-xs">{item.cliente}</span>
                  ) : null}
                  {item.titulo}
                </span>
                <span
                  className={
                    item.desdeEmDias >= 7
                      ? "text-warning text-xs font-medium tabular-nums"
                      : "text-text-muted text-xs tabular-nums"
                  }
                >
                  {item.desdeEmDias === 0
                    ? "enviado hoje"
                    : `há ${item.desdeEmDias} ${item.desdeEmDias === 1 ? "dia" : "dias"}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
