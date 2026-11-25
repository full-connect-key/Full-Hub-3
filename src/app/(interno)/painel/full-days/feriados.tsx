"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  emendasSugeridas,
  rotuloDaOrigem,
  type EmendaSugerida,
} from "@/lib/dominio/feriados";
import { cn } from "@/lib/utils";

import { apagarFeriado, salvarFeriado } from "./acoes";

type Feriado = { data: string; nome: string; origem: string };

/**
 * Os feriados da agência: os que o Full Hub calcula e os que a casa decide.
 *
 * Decisão do usuário, item 3: *"no calendário, quero que você puxe sozinho os
 * feriados, e que permita que eu salve feriados pontuais, no caso de algum
 * cliente tiver algum feriado específico, ou emendas de feriado"*.
 *
 * **ESTA TELA EXISTIA NO BANCO E NÃO EXISTIA NO PRODUTO.** `holidays` nasceu
 * na 0011 com `holidays_write` em `is_gestor()`, e **nenhuma tela jamais a
 * escreveu**: o único caminho para acrescentar um feriado era colar SQL no
 * SQL Editor. É a ponte construída e nunca atravessada, e o preço dela estava
 * medido — das 78 linhas da tabela, **todas** eram nacionais escritas por
 * migration, e nenhuma era uma decisão da agência.
 *
 * **ELA É A SEXTA SEÇÃO DO DAY OFF, e não um módulo novo.** Um feriado é um
 * dia em que a equipe não trabalha, que é a pergunta inteira deste módulo — a
 * matriz o pinta, o relatório o desconta, `dias_uteis()` o tira da conta. E
 * ela não entra em Gestão de Pessoas, que é cadastro de GENTE, nem no
 * Calendário Full, que a 0105 fechou em eventos lançados (*"nada de outros
 * abas"*): um feriado nacional não é lançado por ninguém.
 *
 * **É `is_gestor()` e não `is_socio()`**, que é a separação da aba de
 * lançamentos: decidir que a casa fecha numa sexta é combinado de operação, e
 * travá-lo numa pessoa só é parar o trabalho no dia em que ela estiver fora.
 *
 * **A ORDEM DAS TRÊS SEÇÕES É A DA DECISÃO:** o que já está na lista (porque
 * a resposta mais comum é *"já está lá"*), as emendas que o produto sugere, e
 * só então o campo de gravar um dia à mão. Invertida, a pessoa digitaria um
 * feriado que a seção de baixo já oferecia num clique.
 */
export function Feriados({
  feriados,
  hojeISO,
}: {
  feriados: Feriado[];
  hojeISO: string;
}) {
  const router = useRouter();
  const [salvando, iniciarSalvar] = useTransition();
  const [apagando, iniciarApagar] = useTransition();

  const [data, setData] = useState("");
  const [nome, setNome] = useState("");

  const anoCorrente = hojeISO.slice(0, 4);

  // POR ANO, e o ano corrente aberto. A janela do calendário vai de 2025 a
  // 2030: treze feriados por ano em seis anos são setenta e oito linhas, e uma
  // lista corrida delas é uma tela que ninguém varre. O ano é o recorte que a
  // pessoa tem na cabeça quando vem aqui.
  const porAno = useMemo(() => {
    const mapa = new Map<string, Feriado[]>();
    for (const feriado of feriados) {
      const ano = feriado.data.slice(0, 4);
      const lista = mapa.get(ano);
      if (lista) lista.push(feriado);
      else mapa.set(ano, [feriado]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [feriados]);

  // AS EMENDAS SÓ DO FUTURO. Uma emenda de um feriado que já passou é uma
  // sugestão para fechar a casa num dia que foi — ela não decide nada, e
  // encheria a seção com o passado de seis anos.
  const emendas = useMemo(
    () => emendasSugeridas(feriados.filter((f) => f.data >= hojeISO)),
    [feriados, hojeISO],
  );

  const naLista = feriados.find((f) => f.data === data);
  const faltaPreencher = !data || nome.trim().length < 2;

  function gravar(dia: string, comoSeChama: string, aoVoltar?: () => void) {
    iniciarSalvar(async () => {
      const r = await chamarAcao(() =>
        salvarFeriado({ data: dia, nome: comoSeChama }),
      );
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensagem ?? "Feriado gravado.");
      aoVoltar?.();
      router.refresh();
    });
  }

  function remover(dia: string) {
    iniciarApagar(async () => {
      const r = await chamarAcao(() => apagarFeriado(dia));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensagem ?? "Feriado apagado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="bg-surface-card rounded-card space-y-4 border p-4">
        <div>
          <h2 className="text-base font-semibold">Os feriados do calendário</h2>
          <p className="text-text-muted text-xs">
            O Full Hub calcula os feriados nacionais de qualquer ano, inclusive os
            que mudam de data — Carnaval, Sexta-feira Santa e Corpus Christi. Não
            é preciso cadastrar nenhum deles.
          </p>
        </div>

        {porAno.length === 0 ? (
          <EmptyState
            title="Nenhum feriado neste período"
            description="Abra um ano no seletor de mês para ver os feriados dele."
          />
        ) : (
          <div className="space-y-2">
            {porAno.map(([ano, lista]) => (
              <details
                key={ano}
                open={ano === anoCorrente}
                className="rounded-card bg-surface-card border"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                  <span>{ano}</span>
                  <span className="text-text-muted text-xs font-normal">
                    {lista.length} {lista.length === 1 ? "feriado" : "feriados"}
                  </span>
                </summary>
                <ul className="divide-y border-t">
                  {lista.map((feriado) => (
                    <li
                      key={feriado.data}
                      className="flex flex-wrap items-center gap-2 px-3 py-2"
                    >
                      <span className="text-text-muted w-20 shrink-0 text-xs tabular-nums">
                        {format(parseISO(feriado.data), "dd/MM", { locale: ptBR })}
                      </span>
                      <span className="min-w-[10rem] flex-1 text-sm">
                        {feriado.nome}
                      </span>
                      {/* A ORIGEM É PINTADA SÓ NA EXCEÇÃO: quase todo feriado
                          é nacional, e um selo em setenta e seis das setenta e
                          oito linhas é a mesma palavra setenta e seis vezes.
                          Quem lê a lista procura o que a agência decidiu. */}
                      {feriado.origem === "agencia" ? (
                        <Badge variant="secondary" className="shrink-0">
                          {rotuloDaOrigem(feriado.origem)}
                        </Badge>
                      ) : null}
                      <ConfirmDialog
                        title={`Apagar ${feriado.nome}?`}
                        description={
                          feriado.origem === "nacional"
                            ? "Este dia volta a contar como dia útil na matriz, no relatório e nos prazos. Ele não é recalculado depois: o Full Hub não o devolve sozinho."
                            : "Este dia volta a contar como dia útil na matriz, no relatório e nos prazos."
                        }
                        confirmLabel="Apagar"
                        destructive
                        onConfirm={() => remover(feriado.data)}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            disabled={apagando}
                            aria-label={`Apagar ${feriado.nome}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* AS EMENDAS SÃO SUGESTÃO E NÃO REGRA, e a seção some quando não há
          nenhuma a oferecer — pinta-se a exceção. Com o ano inteiro já
          decidido ela desaparece, em vez de oferecer para sempre o que a
          agência acabou de gravar. */}
      {emendas.length > 0 ? (
        <section className="bg-surface-card rounded-card space-y-3 border p-4">
          <div>
            <h2 className="text-base font-semibold">Emendas possíveis</h2>
            <p className="text-text-muted text-xs">
              Feriado na terça ou na quinta deixa um dia útil sozinho entre ele e
              o fim de semana. Nenhuma é gravada sozinha — a decisão de fechar a
              casa é da agência.
            </p>
          </div>
          <ul className="space-y-2">
            {emendas.map((emenda) => (
              <LinhaDaEmenda
                key={emenda.data}
                emenda={emenda}
                ocupado={salvando}
                onGravar={() => gravar(emenda.data, emenda.nome)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-surface-card rounded-card space-y-3 border p-4">
        <div>
          <h2 className="text-base font-semibold">Gravar um dia</h2>
          <p className="text-text-muted text-xs">
            Para o feriado municipal, a data comemorativa da casa ou a emenda que
            não está na lista acima.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="feriado-data">Dia</Label>
            <Input
              id="feriado-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feriado-nome">Nome</Label>
            <Input
              id="feriado-nome"
              value={nome}
              maxLength={120}
              placeholder="Aniversário da cidade"
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={faltaPreencher || salvando}
            onClick={() =>
              gravar(data, nome, () => {
                setData("");
                setNome("");
              })
            }
          >
            {salvando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarPlus className="size-4" />
            )}
            Gravar
          </Button>
        </div>

        {/* O DIA QUE JÁ ESTÁ NA LISTA É DITO ANTES DO CLIQUE, e a frase muda
            com a origem: a da agência se corrige por cima, e a nacional é
            recusada pela ação — nomeando o feriado, que é o que faz a pessoa
            perceber que errou o dia. Dizer isto aqui é a diferença entre uma
            recusa e uma instrução. */}
        {naLista ? (
          <p
            className={cn(
              "text-xs",
              naLista.origem === "nacional" ? "text-warning" : "text-text-muted",
            )}
          >
            {naLista.origem === "nacional"
              ? `Este dia já é feriado nacional: ${naLista.nome}. Para trocar o nome, apague-o na lista acima primeiro.`
              : `Este dia já está na lista como "${naLista.nome}" — gravar troca o nome.`}
          </p>
        ) : null}

        <p className="text-text-muted text-xs">
          O feriado de um cliente específico não se grava aqui: a agência
          trabalha nele. Ele é lançado no Calendário Full, com o tipo
          &ldquo;Feriado de cliente&rdquo;, e aparece como aviso ao datar uma
          etapa daquela conta.
        </p>
      </section>
    </div>
  );
}

/**
 * Uma emenda sugerida, com o feriado que a motivou.
 *
 * **O FERIADO VEM NA LINHA, e não só o dia sugerido.** "Sexta, 03/04" sozinho
 * não diz por que o produto o está oferecendo — e a resposta é a única coisa
 * que faz a pessoa decidir: ele é o único dia útil entre a Sexta-feira Santa e
 * o fim de semana.
 */
function LinhaDaEmenda({
  emenda,
  ocupado,
  onGravar,
}: {
  emenda: EmendaSugerida;
  ocupado: boolean;
  onGravar: () => void;
}) {
  const dia = parseISO(emenda.data);
  return (
    <li className="bg-card flex flex-wrap items-center gap-2 rounded-card border p-2">
      <span className="min-w-[10rem] flex-1 text-sm">
        {format(dia, "EEEE, dd/MM", { locale: ptBR })}
        <span className="text-text-muted block text-xs">
          entre {emenda.porCausaDe.nome} e o fim de semana
        </span>
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={ocupado}
        onClick={onGravar}
      >
        {ocupado ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CalendarPlus className="size-4" />
        )}
        Gravar a emenda
      </Button>
    </li>
  );
}
