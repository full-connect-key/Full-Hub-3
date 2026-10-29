"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Rocket, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";

import { publicarTask } from "../acoes";

export type EstadoDoSalvamento = "parado" | "salvando" | "salvo" | { erro: string };

/**
 * A barra do rascunho: o que ainda falta, e o botão que publica.
 *
 * **A DEMANDA JÁ ESTÁ SALVA.** Tudo que a pessoa preenche grava sozinho, campo
 * a campo — o botão não salva nada. Ele muda uma coisa só: a demanda passa a
 * existir para a equipe. Por isso ele se chama "Criar task" e não "Salvar", e
 * por isso fechar a aba no meio não perde nada.
 *
 * **SEM ETAPA, AVISA E DEIXA SEGUIR.** Uma demanda pode nascer antes de
 * alguém saber como ela se divide; travar aqui obrigaria a inventar uma etapa
 * para poder criar. Quem trava de verdade — título, cliente e pasta — é o
 * banco, e a mensagem dele já diz qual dos três falta.
 *
 * **E A VERTENTE ENTROU NA MESMA LISTA, pela mesma razão** (migration 0118).
 * O pedido do usuário é *"exigir a seleção antes de salvar quando o cliente
 * possuir vertentes"*, e a trava de banco que a cobraria é
 * `tasks_publicar_exige_minimo`, que dispara em `before insert or update of
 * publicada_em` — ou seja, **também no INSERT**. Três caminhos deste produto
 * inserem task JÁ PUBLICADA sem passar por tela nenhuma — `abrir_campanha()`
 * (0051), `abrir_mes_de_social()` (0061) e `gerar_ocorrencia()` (0040), que é
 * a rotina das três da manhã —, e nenhum dos três sabe passar a vertente:
 * ligar a exigência agora pararia de gerar o social e a recorrência de toda
 * conta com vertente cadastrada, **em silêncio**, num histórico que ninguém
 * abre.
 *
 * Então ela é aviso até os três aprenderem a passá-la, e isso é decisão
 * declarada e não esquecimento: o que o produto já faz com a subtarefa, feito
 * aqui pelo mesmo argumento. Quando a trava entrar, esta tela perde o aviso e
 * a recusa passa a vir do banco, com a dica dizendo o que falta — que é onde
 * ela é verdade para todos os caminhos.
 */
export function BarraDoRascunho({
  taskId,
  temEtapas,
  faltaVertente,
  estado,
}: {
  taskId: string;
  temEtapas: boolean;
  /**
   * A conta tem vertente cadastrada e esta demanda não aponta para nenhuma.
   *
   * Duas condições num booleano porque a pergunta é uma: a conta sem vertente
   * nenhuma não tem o que escolher, e aí o aviso cobraria uma decisão que não
   * existe.
   */
  faltaVertente: boolean;
  estado: EstadoDoSalvamento;
}) {
  const router = useRouter();
  const [publicando, iniciar] = useTransition();

  function publicar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => publicarTask(taskId));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  // A ORDEM É A DO ESTRAGO: etapa primeiro, porque sem ela ninguém é
  // responsável por nada; a vertente é classificação, e dá para acertar
  // depois sem o trabalho ficar parado.
  const avisos = [
    temEtapas
      ? null
      : {
          titulo: "Esta task não tem subtarefas",
          consequencia: "Ninguém vai ser responsável por nada.",
        },
    faltaVertente
      ? {
          titulo: "Esta task não tem vertente",
          consequencia: "Ela não vai aparecer nos recortes por vertente desta conta.",
        }
      : null,
  ].filter((a): a is { titulo: string; consequencia: string } => a !== null);

  return (
    <div className="bg-warning-soft flex flex-wrap items-center gap-3 rounded-card border px-4 py-3">
      <Badge variant="outline" className="shrink-0 uppercase">
        Rascunho
      </Badge>

      <p className="text-text-secondary min-w-0 flex-1 text-sm">
        Só você enxerga esta demanda. Ninguém é avisado enquanto ela for um rascunho.
      </p>

      <EstadoDoSalvamentoNaTela estado={estado} />

      {avisos.length === 0 ? (
        <Button onClick={publicar} disabled={publicando} className="shrink-0">
          {publicando ? <Loader2 className="animate-spin" /> : <Rocket aria-hidden />}
          Criar task
        </Button>
      ) : (
        // O AVISO VEM ANTES, e não é bloqueio: o diálogo diz o que vai
        // acontecer e a pessoa decide. Travar obrigaria a inventar uma etapa,
        // ou uma vertente, só para conseguir criar a demanda.
        //
        // **E ELE CONTA OS DOIS DE UMA VEZ.** Um diálogo por falta faria
        // quem não tem nenhum dos dois confirmar duas vezes seguidas — e o
        // segundo apareceria depois de a pessoa já ter dito que sim, que lê
        // como o clique não ter funcionado.
        <ConfirmDialog
          trigger={
            <Button disabled={publicando} className="shrink-0">
              {publicando ? <Loader2 className="animate-spin" /> : <Rocket aria-hidden />}
              Criar task
            </Button>
          }
          title={avisos.length === 1 ? avisos[0].titulo : "Dois campos ficaram em branco"}
          description={`${avisos.map((a) => a.consequencia).join(" ")} Criar assim mesmo?`}
          confirmLabel="Criar assim mesmo"
          onConfirm={async () => publicar()}
        />
      )}
    </div>
  );
}

/**
 * "Salvando…" → "Salvo".
 *
 * Discreto de propósito: um spinner grande a cada tecla faria a tela parecer
 * instável justamente quando ela está fazendo o certo. O que precisa ficar
 * visível é o ERRO — e ele fica, porque é o único caso em que a pessoa
 * precisa agir.
 */
export function EstadoDoSalvamentoNaTela({ estado }: { estado: EstadoDoSalvamento }) {
  if (estado === "parado") return null;

  if (estado === "salvando") {
    return (
      <span className="text-text-muted inline-flex shrink-0 items-center gap-1.5 text-xs">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        Salvando…
      </span>
    );
  }

  if (estado === "salvo") {
    return (
      <span className="text-success inline-flex shrink-0 items-center gap-1.5 text-xs">
        <Check aria-hidden className="size-3" />
        Salvo
      </span>
    );
  }

  return (
    <span className="text-danger inline-flex shrink-0 items-center gap-1.5 text-xs">
      <TriangleAlert aria-hidden className="size-3" />
      {estado.erro}
    </span>
  );
}
