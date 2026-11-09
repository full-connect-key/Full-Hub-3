"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SeletorDeAprovadores } from "@/components/shared/seletor-de-aprovadores";
import {
  quemPodeAprovar,
  reenviarAviso,
  trocarAprovadores,
  type AprovadorDaConta,
} from "@/app/(interno)/painel/_actions/aprovadores";
import { chamarAcao, chamarEMostrar } from "@/lib/acoes/cliente";
import { DESFECHO_DA_RODADA } from "@/lib/aprovacoes/decisoes";
import type { Conteudo, RodadaDoHistorico } from "@/lib/aprovacoes/conteudo";
import { ROTULO_DO_ESCOPO } from "@/lib/tasks/state-machine";

/**
 * O HISTÓRICO DE APROVAÇÕES DE UM MATERIAL (item 17).
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"histórico completo de aprovações"*. A mais recente vem
 * aberta; as anteriores ficam recolhidas e continuam ali com o que foi pedido,
 * quem recebeu e o que foi decidido. **Rodada fechada nunca é reescrita nem
 * apagada** — e depois da 0129 isso deixou de ser só uma frase: o trigger
 * `proteger_rodada_fechada` congela a identidade da rodada sempre e as cinco
 * colunas da decisão quando ela fecha. É esta pilha que responde *"por que
 * refizemos isso três vezes"* seis meses depois.
 *
 * **ELE ERA PRIVADO DE UMA TELA, e essa é a mudança.** O acordeão vivia dentro
 * de `painel-da-subtarefa.tsx`; o editor do post **não tinha histórico nenhum**
 * e a árvore da campanha mostrava só a rodada interna da versão corrente. Três
 * materiais passam pelo MESMO motor de aprovação desde a 0030 — e duas das três
 * telas não mostravam o que ele registrou. É a história das sete cópias de
 * `abas.tsx` virada do avesso: aqui não havia três desenhos, havia um desenho e
 * duas ausências.
 *
 * **O QUE ELE CENTRALIZA É O DESENHO E A AÇÃO, nunca a leitura.** Quem lê é
 * `historicoDeAprovacoes()`, uma por tela, porque cada uma já tem o conteúdo em
 * mãos — é a decisão de `BarraDeContexto` palavra por palavra.
 *
 * **A MENSAGEM VEM ANTES DO COMENTÁRIO**, e a ordem é informação: a primeira é
 * o que a agência disse ao MANDAR (0128) e o segundo é o motivo da DECISÃO, que
 * a 0127 tornou obrigatório nos dois desfechos negativos. Na ordem contrária,
 * quem abre para ler o motivo do ajuste encontra primeiro a frase de quem
 * enviou.
 *
 * **E A SUBSTITUIÇÃO MORA AQUI, e não numa tela própria** (item 15): trocar
 * quem aprova é uma coisa que se faz olhando o envio que já aconteceu — quem
 * pediu, quando, e quem está esperando. Num diálogo à parte a pessoa decidiria
 * sem o envio à vista.
 * ---------------------------------------------------------------------------
 */
export function HistoricoDeAprovacoes({
  conteudo,
  rodadas,
  vazio = "Nenhuma rodada ainda.",
}: {
  conteudo: Conteudo;
  rodadas: RodadaDoHistorico[];
  /** O que dizer quando não há rodada — cada tela sabe por quê. */
  vazio?: string;
}) {
  const [abertas, setAbertas] = useState<Set<string>>(
    new Set([rodadas[0]?.id]),
  );

  if (rodadas.length === 0) {
    return <p className="text-text-muted text-sm">{vazio}</p>;
  }

  return (
    <ul className="space-y-2">
      {rodadas.map((rodada) => {
        const aberta = abertas.has(rodada.id);
        const quando = rodada.decidido_em ?? rodada.solicitado_em;
        const desfecho = DESFECHO_DA_RODADA[rodada.status];

        return (
          <li key={rodada.id} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              onClick={() =>
                setAbertas((atual) => {
                  const proximo = new Set(atual);
                  if (proximo.has(rodada.id)) proximo.delete(rodada.id);
                  else proximo.add(rodada.id);
                  return proximo;
                })
              }
            >
              <ChevronRight
                aria-hidden
                className={`size-4 shrink-0 transition-transform ${aberta ? "rotate-90" : ""}`}
              />
              <span className="font-medium">Rodada {rodada.numero_rodada}</span>
              <span className="text-text-muted">
                {ROTULO_DO_ESCOPO[rodada.escopo]}
              </span>
              <span className={`text-xs font-medium ${desfecho.classeDeTexto}`}>
                {desfecho.rotulo}
              </span>
              <span className="text-text-muted ml-auto text-xs tabular-nums">
                {format(parseISO(quando), "dd/MM", { locale: ptBR })}
              </span>
            </button>

            {aberta ? (
              <div className="space-y-2 border-t px-3 py-2 text-sm">
                <p className="text-text-muted text-xs">
                  Pedida por {rodada.solicitante ?? "—"} em{" "}
                  {format(
                    parseISO(rodada.solicitado_em),
                    "dd/MM/yyyy 'às' HH:mm",
                    { locale: ptBR },
                  )}
                  {rodada.decidido_em
                    ? ` · decidida por ${rodada.decisor ?? "—"} em ${format(
                        parseISO(rodada.decidido_em),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR },
                      )}`
                    : null}
                </p>

                {/* QUEM RECEBEU — e ela só existe na rodada de CLIENTE: a
                    interna é decidida por `is_gestor()` e mais ninguém (0029),
                    então não há a quem nomear. Uma linha vazia ali afirmaria
                    que alguém deixou de preencher um campo. */}
                {rodada.escopo === "cliente" ? (
                  <QuemRecebeu conteudo={conteudo} rodada={rodada} />
                ) : null}

                {rodada.mensagem ? (
                  <p className="text-text-secondary">
                    <span className="text-text-muted">Enviada com: </span>
                    {rodada.mensagem}
                  </p>
                ) : null}
                {rodada.comentario ? <p>{rodada.comentario}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * QUEM RECEBEU O ENVIO, e — na rodada pendente — os dois botões que mexem nisso.
 *
 * ---------------------------------------------------------------------------
 * **OS BOTÕES SÓ EXISTEM NA RODADA PENDENTE**, e não aparecem desligados: numa
 * rodada fechada a razão não é um passo que falta, é uma porta que fechou — o
 * banco congela `aprovador_id` depois da decisão (0129), e um botão
 * permanentemente desligado em cada rodada antiga é ruído. É a distinção que o
 * "Enviar ao cliente" do Social Media faz do outro lado.
 *
 * **A LISTA DA CONTA É LIDA NO CLIQUE, nunca na montagem.** O histórico abre em
 * toda visita ao material e a troca é raríssima — uma consulta por abertura de
 * painel para alimentar um seletor que quase ninguém abre é a conta que o
 * diálogo de apagar o mês de social já recusou.
 *
 * **E A PESSOA ESCOLHIDA NÃO É RECARREGADA DA LISTA**: o rascunho começa de
 * quem já está nomeado, na ordem do histórico, porque é essa ordem que decide
 * qual nome vai para a coluna.
 */
function QuemRecebeu({
  conteudo,
  rodada,
}: {
  conteudo: Conteudo;
  rodada: RodadaDoHistorico;
}) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  const [pessoas, setPessoas] = useState<AprovadorDaConta[] | null>(null);
  const [rascunho, setRascunho] = useState<string[]>([]);
  const [salvando, salvar] = useTransition();
  const [reenviando, reenviar] = useTransition();

  const pendente = rodada.status === "pendente";

  const nomes =
    rodada.aprovadores.length === 0
      ? null
      : rodada.aprovadores.map((p) => p.nome).join(", ");

  function abrirTroca() {
    setTrocando(true);
    setRascunho(rodada.aprovadores.map((p) => p.id));
    if (pessoas) return;
    void (async () => {
      const r = await chamarAcao(() => quemPodeAprovar(conteudo));
      // A FALHA NÃO DERRUBA O HISTÓRICO: o resto da linha já está na tela, e
      // o que se perde é a troca. O toast diz o que não deu, que é a regra de
      // nenhuma leitura falhar calada.
      if (r.ok && r.dados) setPessoas(r.dados.aprovadores);
      else toast.error(r.ok ? "Não foi possível ler quem aprova." : r.error);
    })();
  }

  return (
    <div className="space-y-2">
      <p className="text-text-muted text-xs">
        {nomes ? (
          <>
            <span>{pendente ? "Esperando " : "Recebido por "}</span>
            <span className="text-text-secondary font-medium">{nomes}</span>
          </>
        ) : pendente ? (
          "Esperando a decisão do cliente."
        ) : (
          // ANTERIOR À 0128: ninguém foi nomeado, e dizer isso é melhor que
          // inventar um nome ou deixar a linha em branco.
          "Enviada antes de o produto nomear quem recebe."
        )}
      </p>

      {pendente && !trocando ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={abrirTroca}
          >
            Trocar quem aprova
          </Button>
          {/* REENVIAR NÃO RECRIA A RODADA, e é o pedido em quantas palavras:
              *"reenviar sem recriar a task"*. O número da rodada é a VERSÃO da
              peça desde a 0033, então abrir outra afirmaria que existe uma
              versão nova do material — o que se repete é o toque no sino. */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={reenviando || rodada.aprovadores.length === 0}
            onClick={() =>
              reenviar(async () => {
                // SEM `refresh` AQUI, de propósito: o reenvio não muda linha
                // nenhuma — ele toca o sino de quem já está nomeado, e
                // `solicitado_em` fica como estava, porque ele é o instante do
                // ENVIO e não o do último toque. Recarregar a tela afirmaria
                // que algo nela mudou.
                await chamarEMostrar(() => reenviarAviso(rodada.id));
              })
            }
          >
            {reenviando ? (
              <Loader2 aria-hidden className="size-3 animate-spin" />
            ) : null}
            Reenviar o aviso
          </Button>
        </div>
      ) : null}

      {pendente && trocando ? (
        <div className="space-y-2">
          {pessoas === null ? (
            <p className="text-text-muted flex items-center gap-2 text-xs">
              <Loader2 aria-hidden className="size-3 animate-spin" />
              Lendo quem aprova por esta conta…
            </p>
          ) : pessoas.length === 0 ? (
            <p className="text-warning text-xs">
              Esta conta não tem ninguém com acesso ao portal.
            </p>
          ) : (
            <SeletorDeAprovadores
              pessoas={pessoas}
              valor={rascunho}
              aoMudar={setRascunho}
              desabilitado={salvando}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={salvando || rascunho.length === 0}
              onClick={() =>
                salvar(async () => {
                  const r = await chamarEMostrar(() =>
                    trocarAprovadores(rodada.id, rascunho),
                  );
                  if (!r.ok) return;
                  setTrocando(false);
                  // O `refresh` É DAQUI E NÃO DA ACTION, e a razão é que são
                  // TRÊS telas: `revalidatePath` casa por caminho, e a action
                  // não sabe de qual das três ela foi chamada — o painel da
                  // etapa, o editor do post ou a árvore da campanha. Um
                  // `revalidatePath` por tela seria a quarta esquecida.
                  router.refresh();
                })
              }
            >
              {salvando ? (
                <Loader2 aria-hidden className="size-3 animate-spin" />
              ) : null}
              Salvar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={salvando}
              onClick={() => setTrocando(false)}
            >
              Cancelar
            </Button>
            {/* NOMEAR NÃO É TRANCAR, e a frase é a mesma do modal de envio:
                quem é nomeado recebe o AVISO, e qualquer pessoa da empresa
                continua podendo responder — não há hierarquia do lado do
                cliente desde o Sprint 12. */}
            <span className="text-text-muted text-xs">
              Quem entrar recebe o aviso agora.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
