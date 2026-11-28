"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CornerDownRight, Lock, PartyPopper } from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCliqueNoCartao } from "@/components/shared/clique-no-cartao";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatarGroup } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { ItemDoDia } from "@/lib/dados/minhas-tasks";
import { cn } from "@/lib/utils";

/**
 * Meu dia.
 *
 * A primeira coisa que a pessoa lê ao abrir a tela, e a resposta para "o que
 * eu entrego hoje?". Só o que vence hoje e o que já passou do prazo — nada de
 * "esta semana" aqui, senão a lista cresce e deixa de ser uma decisão rápida.
 *
 * São subtarefas, sempre: é a unidade de trabalho, e é o que a pessoa
 * efetivamente entrega. O botão de cada linha vem da máquina de estados — o
 * que exige aprovação mostra "Pedir aval interno", não "Concluir".
 *
 * Fica num componente separado de propósito, e a Home do Sprint 15 mostra o
 * MESMO bloco, alimentado pela mesma função `meuDia()`. Duas listas parecidas
 * divergiriam no pior lugar: o botão que muda o status de uma etapa.
 *
 * **`estaSemana` só existe na Home**, e é o que a diferencia sem duplicá-la.
 * Aqui a lista é curta de propósito — "esta semana" faria dela uma agenda em
 * vez de uma decisão —, e em Minhas Tasks o número já está nos contadores
 * logo acima. Na Home não há contador nenhum, e sem esta linha a pessoa leria
 * "dia limpo" sem saber que quarta-feira tem cinco entregas.
 */
export function MeuDia({
  itens,
  primeiroNome,
  usuarioId,
  souGestor,
  estaSemana,
}: {
  itens: ItemDoDia[];
  primeiroNome: string;
  usuarioId: string;
  souGestor: boolean;
  /** Quantas vencem ainda nesta semana. Só a Home passa. */
  estaSemana?: number;
}) {
  const atrasadas = itens.filter((item) => item.atrasada).length;

  return (
    // ---------------------------------------------------------------------
    // O BLOCO PINTA O FUNDO, e até aqui ele não pintava: era
    // `rounded-xl border` e mais nada, então o que aparecia dentro dele era a
    // PÁGINA. Numa tela sem entrega nenhuma isso é um retângulo cinza com uma
    // borda em volta, e foi o que o usuário viu: *"está toda chapada em
    // cinza"*.
    //
    // O par `bg-card rounded-card shadow-cartao` é o mesmo que a linha de
    // Minhas Tasks já usa desde a interface "Leve" — este bloco é que estava
    // fora da convenção, e não a convenção que estava faltando. **Nenhum
    // token muda**: `--surface-card` já era branco puro — o que faltava era
    // alguém pintá-lo aqui.
    // ---------------------------------------------------------------------
    <section className="bg-card rounded-card shadow-cartao border">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Meu dia</h2>
        {atrasadas > 0 ? (
          <Badge variant="destructive">
            {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
          </Badge>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {itens.length} entrega{itens.length === 1 ? "" : "s"}
        </span>
      </header>

      {itens.length === 0 ? (
        <div className="p-2">
          <EmptyState
            // SEM A MOLDURA TRACEJADA, porque aqui ela é cartão dentro de
            // cartão: a seção já é a superfície branca. O `className` é a
            // saída que o componente sempre teve, e é por ela que os outros
            // 38 lugares que o usam continuam como estão — onde ele cai
            // direto sobre a página, a moldura é o que diz que existe uma
            // região ali.
            className="border-0 py-10"
            icon={PartyPopper}
            title={`Dia limpo, ${primeiroNome}`}
            description="Nada vence hoje e nada está atrasado no seu nome. Bom momento para adiantar o que vem pela frente."
          />
        </div>
      ) : (
        <ul className="divide-y">
          {itens.map((item) => (
            <LinhaDoDia key={item.chave} taskId={item.taskId}>
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.atrasada ? "bg-destructive" : "bg-warning",
                )}
              />

              {/* `min-w-48` E NÃO SÓ `min-w-0`: com `min-w-0` o título é o
                  único que cede largura, e a linha inteira cabe em qualquer
                  tela — encolhendo o nome da etapa até "Re…" para o selo do
                  cliente, o prazo e o botão continuarem lado a lado. Em 390px
                  era o que sobrava do item, e quem abre a Home no celular via
                  duas linhas ilegíveis com um Concluir do lado.

                  Com um piso, o título para de ceder e o resto quebra para a
                  linha de baixo, que é o que `flex-wrap` no pai está ali para
                  fazer. Foi a imagem de 390px que mostrou; no 1600 as duas
                  entregas cabiam inteiras. */}
              <div className="min-w-48 flex-1">
                {/* A LINHAGEM E QUEM MAIS ESTÁ NELA, na mesma linha.

                    A pilha responde a pergunta seguinte à linhagem: a
                    linhagem diz por que estou fazendo isto, e a pilha diz
                    quem está com o resto — que é o que explica a etapa
                    parada esperando a arte de outra pessoa. Ela não custa
                    consulta: `carregar()` já trazia essas fichas.

                    Fica ao lado do título da demanda, e não no aglomerado da
                    direita, porque é sobre a DEMANDA e não sobre a etapa —
                    ali ela leria como "quem está nesta etapa", que é uma
                    pessoa só e é quem está olhando. */}
                <div className="flex min-w-0 items-center gap-2">
                  <p className="text-muted-foreground min-w-0 truncate text-xs">
                    {item.tituloDaMae}
                  </p>
                  {item.outrosNaDemanda.length > 0 ? (
                    <UserAvatarGroup
                      max={3}
                      users={item.outrosNaDemanda.map((p) => ({ name: p.nome, src: p.avatar_url }))}
                    />
                  ) : null}
                </div>
                <p className="flex items-center gap-1.5 truncate text-sm">
                  <CornerDownRight aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
                  <Link
                    href={hrefDaTask(item.taskId)}
                    className="truncate hover:underline"
                  >
                    {item.titulo}
                  </Link>
                  {item.requerAprovacao ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground inline-flex">
                          <Lock className="size-3.5" aria-label="Exige aprovação" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Exige aprovação {ROTULO_DA_APROVACAO[item.tipoAprovacao ?? "interna"]}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </p>
              </div>

              {item.cliente ? (
                <Badge variant="outline" className="max-w-40 truncate">
                  {item.cliente}
                </Badge>
              ) : null}

              <span
                className={cn(
                  "text-xs tabular-nums",
                  item.atrasada ? "text-destructive font-medium" : "text-muted-foreground",
                )}
              >
                {item.atrasada && item.prazo
                  ? `venceu ${format(parseISO(item.prazo), "dd/MM/yy", { locale: ptBR })}`
                  : "hoje"}
              </span>

              <AcoesDaSubtarefa
                subtarefa={{
                  id: item.id,
                  task_id: item.taskId,
                  titulo: item.titulo,
                  status: item.status,
                  responsavel_id: usuarioId,
                  requer_aprovacao: item.requerAprovacao,
                  tipo_aprovacao: item.tipoAprovacao,
                  estimativa_minutos: item.estimativaMinutos,
                  tempo_medido_segundos: item.tempoMedidoSegundos,
                  andando_desde: item.andandoDesde,
                  dependenciasAbertas: item.dependenciasAbertas,
                  social_papel: item.socialPapel,
                  rodadaPendente: false,
                  avalInterno: false,
                  avalFinal: false,
                  enviadaAoCliente: false,
                }}
                usuarioId={usuarioId}
                souGestor={souGestor}
              />
            </LinhaDoDia>
          ))}
        </ul>
      )}

      {estaSemana ? (
        <footer className="border-t px-4 py-2">
          <Link
            href="/painel/minhas-tasks?foco=semana"
            className="text-accent-strong text-xs hover:underline"
          >
            e mais {estaSemana} {estaSemana === 1 ? "etapa vence" : "etapas vencem"} até o fim da
            semana
          </Link>
        </footer>
      ) : null}
    </section>
  );
}

/** A demanda aberta no painel de Minhas Tasks — que todo perfil interno alcança. */
function hrefDaTask(taskId: string) {
  return `/painel/minhas-tasks?task=${taskId}`;
}

/**
 * A LINHA INTEIRA ABRE A DEMANDA, e o nome também.
 *
 * Decisão do usuário: *"na tela inicial quero que quando eu clique no bloco da
 * task, eu consiga entrar na task em si, ou quando eu clique no nome"*. A linha
 * só tinha o botão de ação: quem queria VER a etapa não tinha em que clicar.
 *
 * O clique é do contêiner e o foco continua no NOME, que é um link de verdade —
 * a decisão de `useCliqueNoCartao`: `role="button"` num contêiner que carrega
 * o botão de concluir seria `nested-interactive`. E a linha virou componente
 * porque o gancho guarda onde o ponteiro desceu, e gancho não se chama de
 * dentro de um `.map`.
 *
 * O destino é `?task=` em Minhas Tasks e não a página da demanda: aquela é
 * `GESTAO`, e esta lista é de todo perfil interno.
 */
function LinhaDoDia({
  taskId,
  children,
}: {
  taskId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const clique = useCliqueNoCartao(() => router.push(hrefDaTask(taskId)));

  return (
    <li
      {...clique}
      className="hover:bg-muted flex cursor-pointer flex-wrap items-center gap-3 px-4 py-2.5 transition-colors"
    >
      {children}
    </li>
  );
}
