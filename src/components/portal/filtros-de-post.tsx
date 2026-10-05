"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import {
  FASES_DO_MATERIAL,
  type FaseDoMaterial,
} from "@/lib/dominio/portal";
import {
  ROTULO_DA_PLATAFORMA,
  SIGLA_DA_PLATAFORMA,
  type FiltrosDePost,
} from "@/lib/dominio/posts";
import type { PlataformaSocial } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * Os filtros do Social no portal, numa LINHA SÓ.
 *
 * ---------------------------------------------------------------------------
 * **Eram CATORZE pílulas do mesmo peso, em duas fileiras** — sete redes e sete
 * status —, ocupando cerca de 130px antes do calendário, que é a peça que o
 * cliente veio ver. Proposta de layout escolhida entre três; as outras duas
 * ficam registradas porque a decisão pode voltar:
 *
 * - **B, a faixa de decisão:** "4 materiais esperando você" como bloco grande
 *   e o resto recolhido num "Filtrar". Recusada porque quem quer só o mês
 *   aprovado passa a precisar de dois cliques, e filtro recolhido é filtro que
 *   ninguém descobre.
 * - **C, controle segmentado:** mais arrumado e **exclusivo** — não dá para ver
 *   "aprovados + em ajustes" ao mesmo tempo, e não cabe a contagem sem apertar.
 *
 * **Três coisas mudaram, e as três são de conteúdo antes de serem de forma.**
 *
 * **1. Os sete status viraram QUATRO FASES.** O porquê está em
 * `FASES_DO_MATERIAL`: "Em produção", "Aguardando informações" e "Stand by"
 * dizem a mesma coisa para quem está do lado de fora. O selo de cada card
 * continua dizendo o status exato — a fase agrupa o filtro, não a linha.
 *
 * **2. Cada chip traz a CONTAGEM.** Sem ela a pessoa clica para descobrir que
 * está vazio; com ela o filtro responde antes de ser clicado. **E o zero
 * aparece**, que é a regra da faixa de áreas de Minhas Tasks: aqui a linha
 * RESPONDE o que existe no mês, e "nenhum" é resposta — diferente do selo da
 * fila de aprovações, que COBRA uma ação e por isso some no zero.
 *
 * **3. Só as redes que o mês TEM.** Um chip de TikTok numa conta que não posta
 * no TikTok não é uma resposta, é ruído — e a grade do Feed já sabe dizer
 * quais redes o mês tem desde que ela nasceu. Elas vêm na sigla de duas letras
 * que o calendário e o card já usam, e não por extenso: sete nomes inteiros
 * foram metade do problema que esta linha resolve.
 *
 * **As duas contagens saem do MÊS INTEIRO, e não do que sobrou do filtro.**
 * Filtrando por Instagram, "Aprovados 2" continua dizendo quantos o mês tem —
 * senão escolher um filtro faria os outros sumirem, e a pessoa perderia o
 * caminho de volta. É a decisão das abas de Pedidos: o recorte acontece na
 * tela, e o número vem da lista inteira.
 * ---------------------------------------------------------------------------
 *
 * Chip e não `<select>`: no celular — que é de onde o cliente aprova — um
 * select abre uma roda nativa por cima da tela inteira.
 *
 * Mexer no filtro NÃO mexe no mês nem no dia aberto: eles são outros
 * parâmetros, e perder o mês ao filtrar por Instagram jogaria a pessoa de
 * volta para hoje no meio da conferência.
 */
function Chip({
  ativo,
  cobra,
  children,
  rotulo,
  aoClicar,
}: {
  ativo: boolean;
  /** Em repouso, o chip que pede uma decisão — âmbar em vez de neutro. */
  cobra?: boolean;
  children: React.ReactNode;
  rotulo?: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      aria-label={rotulo}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
        ativo
          ? "border-accent-strong bg-accent text-accent-foreground font-medium"
          : cobra
            ? "border-warning bg-warning-soft text-warning font-medium"
            : "hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function FiltrosDePosts({
  filtros,
  contagens,
  redes,
  comoEquipe,
}: {
  filtros: FiltrosDePost;
  /** Quantos materiais o MÊS tem em cada fase — nunca o que sobrou do filtro. */
  contagens: Record<FaseDoMaterial, number>;
  /** As redes presentes no mês, na ordem do enum. */
  redes: PlataformaSocial[];
  /** Na visualização administrativa o dono da espera é o cliente, não quem lê. */
  comoEquipe: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function navegar(mudancas: Record<string, string | null>) {
    const proximos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") proximos.delete(chave);
      else proximos.set(chave, valor);
    }
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  const algumAtivo = filtros.plataforma !== null || filtros.fase !== null;

  // A quinta fase só desenha quando há material nela — a decisão da aba
  // "Recusado" dos Pedidos. Um chip permanente de recusados num mês em que
  // nada foi recusado é um lembrete diário de um problema que não existe.
  const fases = FASES_DO_MATERIAL.filter(
    (f) => !f.soComItem || contagens[f.fase] > 0,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {fases.map(({ fase, rotulo, rotuloParaEquipe }) => {
        const ativo = filtros.fase === fase;
        // A PRIMEIRA FASE É A ÚNICA QUE COBRA UMA AÇÃO, e por isso é a única
        // que se destaca em repouso. As outras três respondem onde o material
        // está; esta diz que alguém está esperando. Âmbar e nunca vermelho:
        // material esperando decisão é o estado normal do mês, não um erro —
        // a regra do alerta de 7 dias das campanhas.
        const cobra = fase === "esperando" && contagens[fase] > 0;
        return (
          <Chip
            key={fase}
            ativo={ativo}
            cobra={cobra}
            aoClicar={() => navegar({ fase: ativo ? null : fase })}
          >
            {comoEquipe ? (rotuloParaEquipe ?? rotulo) : rotulo}
            <span
              className={cn(
                "tabular-nums",
                ativo
                  ? "font-semibold"
                  : cobra
                    ? // A pílula cheia, com o par nomeado do âmbar. Em texto
                      // simples o número se perderia dentro de um chip que já
                      // é todo âmbar.
                      "bg-warning text-warning-foreground min-w-5 rounded-full px-1.5 text-center text-xs font-semibold"
                    : "text-text-muted",
              )}
            >
              {contagens[fase]}
            </span>
          </Chip>
        );
      })}

      {/* O SEPARADOR VIRA QUEBRA DE LINHA no celular, em vez de sumir.

          Num fio vertical as duas metades se distinguem porque estão lado a
          lado; empilhadas, sem ele, as redes continuavam a linha das fases e
          "PT" sobrava sozinha num quarto nível — a faixa lia como dez chips
          soltos em vez de dois grupos. `w-full` dentro de um `flex-wrap`
          força a quebra sem um segundo contêiner, que é o que daria dois
          `gap` diferentes entre os chips. */}
      {redes.length > 0 ? (
        <span
          aria-hidden
          className="bg-border h-0 w-full sm:mx-1 sm:h-6 sm:w-px"
        />
      ) : null}

      {redes.map((rede) => {
        const ativo = filtros.plataforma === rede;
        return (
          <Chip
            key={rede}
            ativo={ativo}
            rotulo={ROTULO_DA_PLATAFORMA[rede]}
            aoClicar={() => navegar({ plataforma: ativo ? null : rede })}
          >
            {/* A SIGLA entra como TEXTO do chip, e não como `SeloDaRede`.

                Aquele componente é um par nomeado — `bg-neutral-soft` com
                `text-neutral` —, e aqui o chip já tem o fundo dele: sobrepor
                os dois daria um segundo objeto mais apagado dentro do chip
                aceso, e apagar o fundo do selo com `bg-transparent` deixaria
                `text-neutral` sobre um fundo que ninguém mediu. Dentro do chip
                a sigla É o rótulo, então ela herda a cor dele — que é medida
                nos dois estados.

                `aria-hidden` porque o nome por extenso já vai no `aria-label`
                do botão: sem isso o leitor de tela ouviria "Instagram I G". */}
            <span aria-hidden className="font-semibold tracking-wide">
              {SIGLA_DA_PLATAFORMA[rede]}
            </span>
          </Chip>
        );
      })}

      {algumAtivo ? (
        <button
          type="button"
          onClick={() => navegar({ plataforma: null, fase: null })}
          className="text-text-muted hover:text-foreground ml-auto inline-flex min-h-9 items-center gap-1 text-sm transition-colors"
        >
          <X aria-hidden className="size-3.5" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}
