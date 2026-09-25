"use client";

import { Download } from "lucide-react";

import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { EmptyState } from "@/components/shared/empty-state";
import { GraficoDeBarras } from "@/components/shared/grafico-de-barras";
import { Button } from "@/components/ui/button";
import type {
  DesvioDaPessoa,
  Producao,
  QualidadeDoCliente,
  RentabilidadeDoCliente,
  TempoDeAprovacao,
  TempoEmStatus,
} from "@/lib/dados/metricas";
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import { formatarDinheiro } from "@/lib/dominio/financeiro";
import { horasEMinutos, rotuloDeStatusDoHistorico, taxaNoPrazo } from "@/lib/dominio/metricas";
import { cn } from "@/lib/utils";

/**
 * As cinco abas das Métricas.
 *
 * ---------------------------------------------------------------------------
 * O CSV SAI DO QUE ESTÁ NA TELA, sempre — mesmas linhas, mesma ordem, mesmo
 * recorte. Ele é a resposta de "manda isso para mim", e um arquivo diferente
 * do que a pessoa acabou de olhar é a pior forma de errar, porque ninguém
 * confere linha a linha uma planilha que pediu.
 *
 * O nome do arquivo carrega as duas datas pelo mesmo motivo: a planilha sai da
 * tela e vira anexo, e três meses depois "metricas.csv" não diz de quando é.
 * ---------------------------------------------------------------------------
 */

function BotaoDeCsv({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Download aria-hidden className="size-4" />
      Exportar CSV
    </Button>
  );
}

function Vazio({ frase }: { frase: string }) {
  return (
    <p className="text-text-muted rounded-card border border-dashed p-8 text-center text-sm">
      {frase}
    </p>
  );
}

function Tabela({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card overflow-x-auto border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

const TH = "text-text-muted px-3 py-2 text-left text-xs font-medium";
const TD = "px-3 py-2";
const NUM = "px-3 py-2 text-right tabular-nums";

// ---------------------------------------------------------------------------
// PRODUÇÃO
// ---------------------------------------------------------------------------

export function PainelDeProducao({
  dados,
  de,
  ate,
}: {
  dados: Producao;
  de: string;
  ate: string;
}) {
  const taxa = taxaNoPrazo(dados.no_prazo, dados.fora_do_prazo);

  function exportar() {
    baixarCSV(
      montarCSV(
        ["Indicador", "Valor"],
        [
          ["Etapas criadas", dados.criadas],
          ["Etapas concluídas", dados.concluidas],
          ["Em aberto e vencidas (hoje)", dados.atrasadas],
          ["Concluídas no prazo", dados.no_prazo],
          ["Concluídas fora do prazo", dados.fora_do_prazo],
          ["Concluídas sem prazo combinado", dados.sem_prazo],
          ["Taxa de entrega no prazo (%)", taxa ?? "sem etapa com prazo"],
          ["Tempo real lançado", horasEMinutos(dados.minutos_reais)],
        ],
      ),
      `metricas-producao-${de}-a-${ate}.csv`,
    );
  }

  return (
    <div className="space-y-4">
      {/* A FRASE E O BOTÃO DIVIDEM A LINHA, nas cinco abas. O botão sozinho
          numa faixa vazia logo abaixo do seletor de período lia como se
          pertencesse ao seletor — e o que ele exporta é a tabela, não o
          recorte. Com a frase ao lado, a linha vira o cabeçalho da aba. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-text-muted max-w-2xl text-sm">
          Tudo por etapa, nunca por demanda: a Task não tem responsável nem prazo desde o Sprint
          3B, e um indicador de entrega montado sobre ela mediria o agrupador em vez do trabalho.
        </p>
        <BotaoDeCsv onClick={exportar} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoDeNumero rotulo="Etapas criadas" valor={dados.criadas} apoio="abertas no período" />
        <CartaoDeNumero
          rotulo="Etapas concluídas"
          valor={dados.concluidas}
          apoio="terminadas no período"
        />
        <CartaoDeNumero
          rotulo="Entrega no prazo"
          /* NULA E NÃO ZERO quando nenhuma etapa concluída tinha prazo: zero
             por cento é uma afirmação sobre a agência, e o que se quer dizer
             é que não há o que medir. */
          valor={taxa === null ? "—" : `${taxa}%`}
          apoio={
            taxa === null
              ? "nenhuma etapa concluída tinha prazo"
              : `${dados.no_prazo} de ${dados.no_prazo + dados.fora_do_prazo} com prazo`
          }
          tom={taxa === null ? "neutro" : taxa >= 80 ? "bom" : taxa >= 60 ? "atencao" : "alerta"}
        />
        <CartaoDeNumero
          rotulo="Vencidas em aberto"
          valor={dados.atrasadas}
          /* "HOJE" E NÃO "NO PERÍODO", e a frase diz isso: atraso é o estado
             de agora, como a situação do lançamento no Financeiro. Trocar o
             período não muda este número, e sem a frase isso pareceria um
             bug. */
          apoio="passaram do prazo — medido hoje"
          tom={dados.atrasadas > 0 ? "alerta" : "bom"}
          href="/painel/gestao-tasks"
        />
      </div>

      <Tabela>
        <tbody className="divide-y">
          <tr>
            <td className={TD}>Concluídas no prazo</td>
            <td className={NUM}>{dados.no_prazo}</td>
          </tr>
          <tr>
            <td className={TD}>Concluídas fora do prazo</td>
            <td className={NUM}>{dados.fora_do_prazo}</td>
          </tr>
          <tr>
            <td className={TD}>
              Concluídas sem prazo combinado
              <span className="text-text-muted block text-xs">
                fora da taxa: não estão no prazo nem fora dele
              </span>
            </td>
            <td className={NUM}>{dados.sem_prazo}</td>
          </tr>
          <tr>
            <td className={TD}>Tempo real lançado nas concluídas</td>
            <td className={NUM}>{horasEMinutos(dados.minutos_reais)}</td>
          </tr>
        </tbody>
      </Tabela>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ONDE O TEMPO VAI
// ---------------------------------------------------------------------------

export function PainelDeTempo({
  porStatus,
  aprovacoes,
  de,
  ate,
}: {
  porStatus: TempoEmStatus[];
  aprovacoes: TempoDeAprovacao[];
  de: string;
  ate: string;
}) {
  const interno = aprovacoes.filter((a) => a.escopo === "interna");
  const cliente = aprovacoes.filter((a) => a.escopo === "cliente");

  const media = (lista: TempoDeAprovacao[]) => {
    const rodadas = lista.reduce((t, l) => t + l.rodadas, 0);
    if (rodadas === 0) return null;
    return lista.reduce((t, l) => t + l.horasMedia * l.rodadas, 0) / rodadas;
  };

  function exportar() {
    baixarCSV(
      montarCSV(
        ["Bloco", "Chave", "Escopo", "Valor", "Ocorrências", "Pendentes"],
        [
          ...porStatus.map((l) => [
            "Tempo por status",
            rotuloDeStatusDoHistorico(l.status),
            "",
            horasEMinutos(l.minutos),
            l.ocorrencias,
            "",
          ]),
          ...aprovacoes.map((l) => [
            "Tempo de aprovação",
            l.cliente ?? "Sem cliente",
            l.escopo === "interna" ? "interna" : "cliente",
            `${l.horasMedia.toFixed(1)}h`,
            l.rodadas,
            l.pendentes,
          ]),
        ],
      ),
      `metricas-tempo-${de}-a-${ate}.csv`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-text-muted max-w-2xl text-sm">
          Onde a etapa fica parada, e quanto a aprovação segura. Os dois blocos respondem a
          perguntas diferentes sobre o mesmo atraso.
        </p>
        <BotaoDeCsv onClick={exportar} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Onde o tempo da etapa fica</h2>
          <p className="text-text-muted text-sm">
            Quanto tempo somado as etapas passaram em cada status. Etapa que ainda está num
            status conta até agora — a parada há duas semanas em &ldquo;aguardando
            informações&rdquo; é justamente o que isto existe para mostrar.
          </p>
        </div>

        {porStatus.length === 0 ? (
          /* O HISTÓRICO COMEÇA NA 0035, e a frase diz isso em vez de mostrar
             um gráfico vazio. Nada registrou transição antes dela, e uma tela
             em branco aqui pareceria agência parada em vez de medição que
             ainda não tem o que medir. */
          <Vazio frase="Nenhuma transição de status registrada no período. O histórico começou a ser gravado na migration 0035 — as etapas que passaram por produção antes dela não deixaram rastro, e nenhuma conta inventa o que não foi medido." />
        ) : (
          <GraficoDeBarras
            barras={porStatus.map((l) => ({
              nome: rotuloDeStatusDoHistorico(l.status),
              valor: l.minutos,
            }))}
            formatarValor={horasEMinutos}
          />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Quanto a aprovação segura</h2>
          <p className="text-text-muted text-sm">
            Os dois números separados de propósito: se o interno for alto, o gargalo é da casa, e
            nenhuma cobrança ao cliente resolve.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CartaoDeNumero
            rotulo="Aval interno"
            valor={media(interno) === null ? "—" : `${media(interno)!.toFixed(1)}h`}
            apoio={`${interno.reduce((t, l) => t + l.rodadas, 0)} rodadas, ${interno.reduce((t, l) => t + l.pendentes, 0)} ainda abertas`}
          />
          <CartaoDeNumero
            rotulo="Decisão do cliente"
            valor={media(cliente) === null ? "—" : `${media(cliente)!.toFixed(1)}h`}
            apoio={`${cliente.reduce((t, l) => t + l.rodadas, 0)} rodadas, ${cliente.reduce((t, l) => t + l.pendentes, 0)} ainda abertas`}
          />
        </div>

        {aprovacoes.length === 0 ? (
          <Vazio frase="Nenhuma rodada de aprovação aberta no período." />
        ) : (
          <Tabela>
            <thead className="bg-muted">
              <tr>
                <th className={TH}>Cliente</th>
                <th className={TH}>Escopo</th>
                <th className={cn(TH, "text-right")}>Média</th>
                <th className={cn(TH, "text-right")}>Rodadas</th>
                <th className={cn(TH, "text-right")}>Abertas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {aprovacoes.map((linha) => (
                <tr key={`${linha.escopo}-${linha.cliente ?? "sem"}`}>
                  <td className={TD}>{linha.cliente ?? "Sem cliente"}</td>
                  <td className={TD}>{linha.escopo === "interna" ? "Aval interno" : "Cliente"}</td>
                  <td className={NUM}>{linha.horasMedia.toFixed(1)}h</td>
                  <td className={NUM}>{linha.rodadas}</td>
                  <td className={NUM}>{linha.pendentes}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ESTIMATIVA × REAL
// ---------------------------------------------------------------------------

export function PainelDaEquipe({
  linhas,
  de,
  ate,
}: {
  linhas: DesvioDaPessoa[];
  de: string;
  ate: string;
}) {
  function exportar() {
    baixarCSV(
      montarCSV(
        ["Pessoa", "Etapas", "Estimado", "Real", "Desvio (%)"],
        linhas.map((l) => [
          l.nome,
          l.etapas,
          horasEMinutos(l.minutosEstimados),
          horasEMinutos(l.minutosReais),
          l.desvioPercentual,
        ]),
      ),
      `metricas-estimativa-${de}-a-${ate}.csv`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-text-muted max-w-2xl text-sm">
          O desvio é em pontos percentuais sobre a estimativa — &ldquo;leva 40% a mais do que
          estima&rdquo; diz mais que &ldquo;leva 32 minutos a mais&rdquo;, que depende do tamanho
          da etapa. Só entra quem tem os dois números lançados: sem estimativa ou sem tempo real
          não há desvio para calcular.
        </p>
        <BotaoDeCsv onClick={exportar} />
      </div>

      {linhas.length === 0 ? (
        <EmptyState
          title="Ainda não dá para comparar"
          description="Nenhuma etapa concluída no período tem estimativa e tempo real lançados. O número aparece quando os dois existem — inventar um dos dois daria um desvio que não mede nada."
        />
      ) : (
        <Tabela>
          <thead className="bg-muted">
            <tr>
              <th className={TH}>Pessoa</th>
              <th className={cn(TH, "text-right")}>Etapas</th>
              <th className={cn(TH, "text-right")}>Estimado</th>
              <th className={cn(TH, "text-right")}>Real</th>
              <th className={cn(TH, "text-right")}>Desvio</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map((linha) => (
              <tr key={linha.responsavelId}>
                <td className={TD}>{linha.nome}</td>
                <td className={NUM}>{linha.etapas}</td>
                <td className={NUM}>{horasEMinutos(linha.minutosEstimados)}</td>
                <td className={NUM}>{horasEMinutos(linha.minutosReais)}</td>
                <td
                  className={cn(
                    NUM,
                    "font-medium",
                    // SUBESTIMAR E SUPERESTIMAR SÃO OS DOIS ERROS, e a cor
                    // não diz qual é "bom": quem entrega em metade do tempo
                    // estimado enche a própria agenda tanto quanto quem leva
                    // o dobro. O tom de atenção é para o módulo grande, nos
                    // dois sentidos.
                    Math.abs(linha.desvioPercentual) >= 50
                      ? "text-danger"
                      : Math.abs(linha.desvioPercentual) >= 20
                        ? "text-warning"
                        : "text-text-secondary",
                  )}
                >
                  {linha.desvioPercentual > 0 ? "+" : ""}
                  {linha.desvioPercentual}%
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QUALIDADE DA ENTREGA
// ---------------------------------------------------------------------------

export function PainelDeQualidade({
  linhas,
  de,
  ate,
}: {
  linhas: QualidadeDoCliente[];
  de: string;
  ate: string;
}) {
  function exportar() {
    baixarCSV(
      montarCSV(
        ["Cliente", "Conteúdos decididos", "Aprovados de primeira", "Rodadas (média)", "Recusados"],
        linhas.map((l) => [
          l.cliente,
          l.conteudos,
          l.aprovadosDePrima,
          l.rodadasMedia,
          l.rejeitados,
        ]),
      ),
      `metricas-qualidade-${de}-a-${ate}.csv`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-text-muted max-w-2xl text-sm">
          Quanto a entrega volta, por cliente. Só entra o que o cliente JÁ decidiu — contar o que
          ainda está em aprovação baixaria a média com ciclos que não terminaram.
        </p>
        <BotaoDeCsv onClick={exportar} />
      </div>

      {linhas.length === 0 ? (
        <Vazio frase="Nenhum material decidido pelo cliente no período." />
      ) : (
        <Tabela>
          <thead className="bg-muted">
            <tr>
              <th className={TH}>Cliente</th>
              <th className={cn(TH, "text-right")}>Decididos</th>
              <th className={cn(TH, "text-right")}>De primeira</th>
              <th className={cn(TH, "text-right")}>Rodadas (média)</th>
              <th className={cn(TH, "text-right")}>Recusados</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map((linha) => {
              const dePrima = Math.round((linha.aprovadosDePrima / linha.conteudos) * 100);
              return (
                <tr key={linha.clienteId ?? "sem"}>
                  <td className={TD}>{linha.cliente}</td>
                  <td className={NUM}>{linha.conteudos}</td>
                  <td className={NUM}>
                    {linha.aprovadosDePrima}
                    <span className="text-text-muted ml-1 text-xs">({dePrima}%)</span>
                  </td>
                  <td className={NUM}>{linha.rodadasMedia.toFixed(1)}</td>
                  <td className={cn(NUM, linha.rejeitados > 0 && "text-danger font-medium")}>
                    {linha.rejeitados}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RENTABILIDADE — SÓ O SÓCIO
// ---------------------------------------------------------------------------

export function PainelDeRentabilidade({
  linhas,
  de,
  ate,
}: {
  linhas: RentabilidadeDoCliente[];
  de: string;
  ate: string;
}) {
  function exportar() {
    baixarCSV(
      montarCSV(
        ["Cliente", "Receita", "Despesa", "Horas lançadas", "Receita por hora"],
        linhas.map((l) => [
          l.cliente,
          l.receita,
          l.despesa,
          l.horas.toFixed(1),
          l.receitaPorHora ?? "sem hora registrada",
        ]),
      ),
      `metricas-rentabilidade-${de}-a-${ate}.csv`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-text-muted max-w-2xl text-sm">
          Receita cruzada com o tempo das etapas. Quem tem hora lançada tem receita por hora; quem
          não tem aparece como <strong>sem hora registrada</strong> e nunca como zero — zero é uma
          afirmação sobre a conta, e o que se quer dizer é que ninguém mediu.
        </p>
        <BotaoDeCsv onClick={exportar} />
      </div>

      {linhas.length === 0 ? (
        <Vazio frase="Nenhuma receita, despesa ou hora lançada no período." />
      ) : (
        <Tabela>
          <thead className="bg-muted">
            <tr>
              <th className={TH}>Cliente</th>
              <th className={cn(TH, "text-right")}>Receita</th>
              <th className={cn(TH, "text-right")}>Despesa</th>
              <th className={cn(TH, "text-right")}>Horas</th>
              <th className={cn(TH, "text-right")}>Receita / hora</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map((linha) => (
              <tr key={linha.clienteId ?? "sem"}>
                <td className={TD}>{linha.cliente}</td>
                <td className={NUM}>{formatarDinheiro(linha.receita)}</td>
                <td className={NUM}>{formatarDinheiro(linha.despesa)}</td>
                <td className={NUM}>{linha.horas > 0 ? linha.horas.toFixed(1) : "—"}</td>
                <td className={cn(NUM, "font-medium")}>
                  {linha.receitaPorHora === null ? (
                    <span className="text-text-muted text-xs font-normal">
                      sem hora registrada
                    </span>
                  ) : (
                    formatarDinheiro(linha.receitaPorHora)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </div>
  );
}
