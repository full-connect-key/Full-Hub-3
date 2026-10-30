import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, ExternalLink, FolderOpen, Lock } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatoDoArquivo } from "@/lib/dominio/arquivos";
import { folhas } from "@/lib/dominio/tasks";
import type { SubtarefaDetalhada } from "@/lib/dados/tasks";

/**
 * A ÁREA DE ARQUIVOS FINAIS DA DEMANDA (item 31).
 *
 * "Cada task passa a ter uma área de arquivos finais" é o pedido, e esta
 * seção é ela: tudo o que foi entregue na demanda inteira, numa lista só,
 * agrupado pela etapa que produziu cada arquivo.
 *
 * ===========================================================================
 * ELA NÃO CUSTA CONSULTA NENHUMA, e é por isso que ela é pequena
 *
 * `obterTask` já traz `subtarefas[].entregas[]` com o autor e o endereço
 * assinado desde sempre — o que faltava era um lugar que lesse aquilo POR
 * DEMANDA em vez de por etapa. Até aqui os arquivos de uma demanda só
 * existiam dentro do painel lateral de cada etapa, um de cada vez: quem
 * queria o material inteiro antes de mandar ao cliente abria e fechava o
 * painel seis vezes.
 *
 * ===========================================================================
 * O QUE "VINCULAR À TASK, À VERTENTE, AO CLIENTE E AO RESPONSÁVEL" QUER DIZER
 *
 * As quatro já têm resposta pelo caminho que existe, e **nenhuma delas virou
 * coluna** — a razão inteira está no cabeçalho da 0121. A task é esta tela; o
 * cliente e a vertente estão no cabeçalho dela, uma vez só, porque são da
 * demanda e não de cada arquivo; e o responsável aparece em DOIS fatos que
 * não se confundem: a etapa diz de quem é o trabalho, e a linha diz quem
 * mandou o arquivo. O Atendimento anexando o que o cliente mandou por e-mail
 * numa etapa do Design é o caso em que os dois divergem, e os dois continuam
 * verdadeiros.
 *
 * ===========================================================================
 * SÓ AS FOLHAS, como toda conta deste produto
 *
 * Uma agrupadora não é unidade de trabalho (0022) e não recebe entrega; se
 * recebesse por um caminho montado à mão, contá-la aqui mostraria o mesmo
 * arquivo duas vezes — na mãe e na filha.
 */
export function ArquivosDaEntrega({
  subtarefas,
}: {
  subtarefas: SubtarefaDetalhada[];
}) {
  const comArquivo = folhas(subtarefas).filter((s) => s.entregas.length > 0);
  const quantos = comArquivo.reduce((soma, s) => soma + s.entregas.length, 0);

  return (
    <section className="space-y-3" id="arquivos-da-entrega">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Arquivos da entrega</h2>
        {/* A CONTAGEM FICA NO CABEÇALHO e não num ladrilho: a lista logo
            abaixo É esse número, item por item — é o cartão de "11 entregues"
            com sete na lista embaixo, que o Resumo da Agência já pagou. */}
        {quantos > 0 ? (
          <span className="text-text-muted text-xs tabular-nums">
            {quantos} {quantos === 1 ? "arquivo" : "arquivos"} em{" "}
            {comArquivo.length} {comArquivo.length === 1 ? "etapa" : "etapas"}
          </span>
        ) : null}
      </div>

      {comArquivo.length === 0 ? (
        /* O VAZIO DIZ ONDE SE ANEXA, em vez de só dizer que não há nada.
           Anexar mora no painel da etapa, que é onde o trabalho está — e sem
           esta frase a pessoa procura um botão nesta seção e não acha. */
        <EmptyState
          icon={FolderOpen}
          title="Nada entregue ainda"
          description="Os arquivos são anexados dentro de cada etapa, em Subtarefas — e aparecem aqui, todos juntos."
          className="bg-card rounded-card shadow-cartao border-solid"
        />
      ) : (
        <ul className="space-y-3">
          {comArquivo.map((sub) => (
            <li
              key={sub.id}
              className="bg-surface-card rounded-card shadow-cartao space-y-2 border p-3.5"
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{sub.titulo}</p>
                {sub.responsavel ? (
                  <span className="text-text-muted flex shrink-0 items-center gap-1.5 text-xs">
                    <UserAvatar
                      name={sub.responsavel.nome}
                      src={sub.responsavel.avatar_url}
                      size="xs"
                      tooltip={false}
                    />
                    {sub.responsavel.nome}
                  </span>
                ) : null}
              </div>

              <ul className="divide-y">
                {sub.entregas.map((entrega) => {
                  const formato = formatoDoArquivo(entrega.nome ?? entrega.url);
                  return (
                    <li
                      key={entrega.id}
                      className="flex min-w-0 items-center gap-2 py-1.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{entrega.nome ?? entrega.url}</p>
                        {/* QUEM MANDOU E QUANDO, que é o "registrar data e
                            hora automaticamente" do pedido — e ele nunca foi
                            uma coluna nova: `created_at` e `enviado_por` estão
                            em `subtask_entregas` desde a 0007. O que faltava
                            era alguém mostrar. */}
                        <p className="text-text-muted text-xs">
                          {entrega.autor?.nome ?? "Alguém"} ·{" "}
                          {format(parseISO(entrega.created_at), "dd/MM/yy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                          {/* A RODADA É A VERSÃO (0121), e não uma coluna ao
                              lado: a rodada 1 leva os arquivos que existiam
                              quando ela abriu, a 2 leva os que vieram depois
                              dos ajustes. Sem carimbo quer dizer que o
                              arquivo ainda não saiu da agência. */}
                          {entrega.approval_round_id ? (
                            <>
                              {" · "}
                              <span className="inline-flex items-center gap-1">
                                <Lock aria-hidden className="size-3" />
                                enviado ao cliente
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>

                      {formato ? (
                        <span className="text-text-muted shrink-0 text-[11px] font-semibold">
                          {formato}
                        </span>
                      ) : null}

                      {entrega.assinado ? (
                        <a
                          href={entrega.assinado}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:bg-accent inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors"
                        >
                          {entrega.tipo === "arquivo" ? (
                            <>
                              <Download aria-hidden className="size-3.5" />
                              Baixar
                            </>
                          ) : (
                            <>
                              Abrir
                              <ExternalLink aria-hidden className="size-3.5" />
                            </>
                          )}
                        </a>
                      ) : (
                        /* A ASSINATURA FALHOU, e a frase diz isso em vez de
                           um botão que não leva a lugar nenhum. O erro já foi
                           para o log do servidor, em `assinarArquivos`. */
                        <span className="text-text-muted shrink-0 text-xs italic">
                          endereço indisponível
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
