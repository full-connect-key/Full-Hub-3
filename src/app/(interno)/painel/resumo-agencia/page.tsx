import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarOff, CheckCircle2, ChevronLeft, ChevronRight, Clock, Hourglass } from "lucide-react";

import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { horasEMinutos, taxaNoPrazo } from "@/lib/dominio/metricas";
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
  const hoje = new Date().toISOString().slice(0, 10);
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
      <p className="text-text-secondary mt-1 text-sm">
        Material enviado e ainda sem decisão. A bola não é da agência — mas a cobrança é.
      </p>

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
