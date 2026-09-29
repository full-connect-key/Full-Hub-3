"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { chamarEMostrar } from "@/lib/acoes/cliente";

import { escolherReceberFeedback } from "../acoes";

/**
 * OPTAR POR NÃO RECEBER, e voltar quando quiser.
 *
 * **A ESCOLHA É REVERSÍVEL, e a frase diz isso do lado do interruptor.** Sem
 * ela, desligar parece uma porta de mão única, e quem está em dúvida não
 * desliga — ou desliga e não volta.
 *
 * **E ela passa por uma função do banco**, não por um `update` em
 * `team_members`: aquela tabela é `is_gestor()` no UPDATE desde o Sprint 2, e
 * abrir uma policy para a própria pessoa daria junto a capacidade diária, o
 * saldo de descanso e a função dela — policy não limita coluna. A função
 * escreve UMA coluna da própria linha, na forma de `confirmar_recebimento()`
 * na 0069.
 */
export function EscolhaDeFeedback({ recebe }: { recebe: boolean }) {
  const [ligado, setLigado] = useState(recebe);
  const [salvando, setSalvando] = useState(false);

  async function trocar(valor: boolean) {
    // OTIMISTA E COM VOLTA: o interruptor responde ao toque, e se o banco
    // recusar ele volta. Sem a volta, a tela mostraria uma escolha que não foi
    // gravada — que é a regra de "nenhuma escrita pode falhar em silêncio"
    // vista do lado do estado.
    setLigado(valor);
    setSalvando(true);
    const resultado = await chamarEMostrar(() =>
      escolherReceberFeedback({ receber: valor }),
    );
    setSalvando(false);
    if (!resultado.ok) setLigado(!valor);
  }

  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <label
          htmlFor="receber-feedback"
          className="text-text-primary text-sm font-medium"
        >
          Receber o feedback de desenvolvimento
        </label>
        <p className="text-text-muted text-xs">
          Dá para desligar e voltar a qualquer momento. Desligado, nenhum
          relatório sobre você é gerado — nem para a gestão ler.
        </p>
      </div>
      <Switch
        id="receber-feedback"
        checked={ligado}
        disabled={salvando}
        onCheckedChange={(v) => void trocar(v)}
      />
    </div>
  );
}
