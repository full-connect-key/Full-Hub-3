"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type {
  ConfigDoFeedback,
  Pessoa,
} from "@/lib/dominio/feedback";
import type { FeedbackPeriodicidade } from "@/lib/supabase/database.types";

import { salvarConfigDoFeedback } from "../acoes";

const SEM_REVISOR = "qualquer";

/**
 * As quatro escolhas do módulo.
 *
 * ---------------------------------------------------------------------------
 * **"ENVIAR SEM REVISÃO HUMANA" VEM DESMARCADO, e o aviso fica ao lado dele.**
 * O default de `exige_revisao` é `true` no banco, e a frase aqui existe porque
 * um interruptor sem consequência escrita é um interruptor que se desliga por
 * curiosidade: sem revisão, o texto que a IA escreveu vai direto para a pessoa
 * sobre quem ele é.
 *
 * O tom é `--warning` e nasce apenas quando o interruptor está desligado. Um
 * aviso âmbar permanente sobre algo que está certo é o que ensina a ignorar
 * âmbar.
 * ---------------------------------------------------------------------------
 *
 * **"Quem revisa" aceita ficar vazio**, e o vazio é o estado inicial: um
 * revisor fixo não configurado travaria a fila no dia em que ele saísse da
 * agência. Vazio quer dizer "qualquer gestor revisa", que é o que a policy já
 * permite.
 */
export function FormularioDaConfig({
  config,
  gestores,
}: {
  config: ConfigDoFeedback;
  gestores: Pessoa[];
}) {
  const router = useRouter();
  const [periodicidade, setPeriodicidade] = useState<FeedbackPeriodicidade>(
    config.periodicidade,
  );
  const [revisor, setRevisor] = useState(config.revisor_id ?? SEM_REVISOR);
  const [exigeRevisao, setExigeRevisao] = useState(config.exige_revisao);
  const [minimo, setMinimo] = useState(String(config.minimo_subtarefas));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    await chamarEMostrar(() =>
      salvarConfigDoFeedback({
        periodicidade,
        revisor_id: revisor === SEM_REVISOR ? null : revisor,
        exige_revisao: exigeRevisao,
        minimo_subtarefas: Number(minimo),
      }),
    );
    setSalvando(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="config-periodicidade">Periodicidade</Label>
        <Select
          value={periodicidade}
          onValueChange={(v) => setPeriodicidade(v as FeedbackPeriodicidade)}
        >
          <SelectTrigger
            id="config-periodicidade"
            className="w-full"
            aria-label="Periodicidade do feedback"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="trimestral">Trimestral</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-text-muted text-xs">
          É o período que a tela de feedback abre por padrão, e o que a
          explicação diz à equipe.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="config-revisor">Quem revisa</Label>
        <Select value={revisor} onValueChange={setRevisor}>
          <SelectTrigger
            id="config-revisor"
            className="w-full"
            aria-label="Quem revisa o feedback"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_REVISOR}>Qualquer pessoa da gestão</SelectItem>
            {gestores.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-text-muted text-xs">
          É o nome que aparece para a equipe na explicação do módulo. Quem
          aprova continua sendo qualquer gestor — um revisor fixo travaria a fila
          no dia em que ele estivesse fora.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="config-minimo">
          Mínimo de etapas concluídas para gerar
        </Label>
        <Input
          id="config-minimo"
          type="number"
          min={1}
          max={100}
          value={minimo}
          onChange={(e) => setMinimo(e.target.value)}
          className="w-32"
        />
        <p className="text-text-muted text-xs">
          Abaixo disso o relatório fica marcado como sem dados suficientes e
          nenhum texto é escrito. Feedback em cima de três tarefas é invenção.
        </p>
      </div>

      <div className="border-border space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="config-revisao" className="cursor-pointer">
            Exigir revisão humana antes do envio
          </Label>
          <Switch
            id="config-revisao"
            checked={exigeRevisao}
            onCheckedChange={setExigeRevisao}
          />
        </div>
        {exigeRevisao ? (
          <p className="text-text-muted text-xs">
            Uma pessoa lê e pode corrigir o texto antes de outra pessoa receber.
            Comece com a revisão ligada.
          </p>
        ) : (
          <p className="text-warning text-xs">
            Sem revisão, o texto que a inteligência artificial escreveu vai
            direto para a pessoa sobre quem ele é. Comece com revisão ligada.
          </p>
        )}
      </div>

      <Button onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar configuração"}
      </Button>
    </div>
  );
}
