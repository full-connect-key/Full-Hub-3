"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hand, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { cn } from "@/lib/utils";

import { voltarACalcularStatus } from "./acoes";

/**
 * A MARCA DE QUE O STATUS DESTA DEMANDA ESTÁ PARADO NA MÃO DE ALGUÉM.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"preciso que esse movimento das tasks entre as etapas
 * seja automático também com base no andamento das pessoas. Se uma task tem 10
 * etapas, e a primeira pessoa colocou ela em andamento, ela já vai pra em
 * andamento na gestão de tasks, mas continua em a iniciar para as outras
 * pessoas que ainda não começaram suas partes"*.
 *
 * **O QUE ELE DESCREVE É O QUE O PRODUTO JÁ FAZ, e por isso esta entrega não
 * tem migration.** `recalcular_status_task()` roda por trigger a cada escrita
 * em `subtasks` desde a 0007, e a precedência põe `em_andamento` acima de
 * `nao_iniciada`: a primeira etapa que alguém começa move a Task sozinha, e as
 * outras nove continuam onde estão, cada uma com o status dela. Quem olha a
 * demanda vê o conjunto; quem olha a própria etapa vê a dela.
 *
 * **O QUE DESLIGA ISSO É `status_manual` (0025), E ELE É UMA PORTA DE UMA MÃO
 * SÓ.** Aquela migration existe por um pedido anterior dele — os sete status
 * passaram a ser marcáveis à mão — e a trava inteira do recálculo é o que faz
 * a escolha durar: *aceitar e desfazer calado é pior que recusar com
 * explicação*. O argumento continua inteiro. O que não estava escrito em lugar
 * nenhum é o preço: **arrastar um card no board chama `atualizarTask({status})`
 * e, com ele, congela o cálculo daquela demanda para sempre** — um gesto de
 * seis pixels desligando uma regra, sem nada na tela dizendo que ela foi
 * desligada.
 *
 * **E ISSO FOI MEDIDO: das demandas publicadas deste banco, TODAS estavam
 * paradas na mão.** Não é um caso de borda — é o estado normal de quem usa o
 * board, e é exatamente a queixa que abriu o pedido.
 *
 * ---------------------------------------------------------------------------
 * **ELA PINTA A EXCEÇÃO**, que é a decisão da matriz do Day Off: o normal é o
 * status sair do andamento das etapas, e uma linha dizendo isso em toda
 * demanda seria a mesma frase em dez cards. A marca só existe onde o cálculo
 * está desligado.
 *
 * **E ELA É O BOTÃO QUE DEVOLVE O VOLANTE, não um selo.** O caminho existia e
 * ficava a dois cliques e uma tela de distância — no rodapé do seletor de
 * status, dentro do detalhe da demanda. Quem trabalha no board não passa por
 * lá, e uma marca que nomeia um problema sem oferecer a saída é a recusa sem
 * instrução que a 0023 recusa. O trigger `tasks_volta_a_calcular` recalcula na
 * hora, então o card se move no `refresh` seguinte.
 *
 * **O PERFIL NÃO É PERGUNTADO AQUI**, e a ausência é medida: a rota inteira é
 * `GESTAO`, e `voltarACalcularStatus` exige gestão ou Atendimento — quem
 * enxerga esta marca já passa pela pergunta que o banco faz. Uma segunda
 * pergunta embaixo de uma primeira que já barra todo mundo não barra ninguém,
 * que é a lição da 0060.
 * ---------------------------------------------------------------------------
 */
export function MarcaDeStatusManual({
  taskId,
  className,
}: {
  taskId: string;
  className?: string;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={salvando}
          aria-label="Status marcado à mão. Clique para o Full Hub voltar a calculá-lo pelas etapas."
          // O CLIQUE NÃO SOBE, e é obrigatório nos dois chamadores: no board o
          // card inteiro abre a demanda e carrega os `listeners` do dnd-kit, e
          // na Lista a linha é um `<Link>`. Sem isto, devolver o volante abriria
          // a tela da demanda por cima — ou começaria um arrasto.
          onPointerDown={(evento) => evento.stopPropagation()}
          onClick={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            iniciar(async () => {
              const resultado = await chamarAcao(() =>
                voltarACalcularStatus(taskId),
              );
              if (!resultado.ok) toast.error(resultado.error);
              else {
                toast.success(resultado.mensagem);
                router.refresh();
              }
            });
          }}
          className={cn(
            "text-text-muted hover:text-text-primary inline-flex shrink-0 items-center gap-1 rounded text-[11px] transition-colors",
            className,
          )}
        >
          {salvando ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Hand className="size-3" aria-hidden />
          )}
          à mão
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Este status foi marcado à mão, então o Full Hub parou de calculá-lo pelo
        andamento das etapas. Clique para ele voltar a acompanhar as etapas.
      </TooltipContent>
    </Tooltip>
  );
}
