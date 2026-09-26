"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TABELAS_AUDITADAS, rotuloDaTabela } from "@/lib/dominio/auditoria";

/**
 * Os filtros da auditoria.
 *
 * **Tudo na URL**, como em toda listagem do produto: "olha o que aconteceu com
 * o Financeiro em setembro" precisa ser um link que abre no mesmo lugar para
 * quem recebe.
 *
 * **"Todas" é valor de verdade e não string vazia.** O `Select` do Radix não
 * aceita `value=""` — ele usa a string vazia internamente para "nada
 * escolhido", e um item com esse valor faz o placeholder voltar sozinho. Então
 * a opção tem chave própria e é traduzida para "sem filtro" na hora de montar
 * o endereço.
 */
const TODAS = "todas";

export function FiltrosDaAuditoria({
  pessoas,
}: {
  pessoas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const parametros = useSearchParams();

  function trocar(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    if (valor === TODAS) novos.delete(chave);
    else novos.set(chave, valor);
    router.push(`/painel/auditoria?${novos.toString()}`);
  }

  const temFiltro =
    parametros.has("tabela") ||
    parametros.has("quem") ||
    parametros.has("de") ||
    parametros.has("ate");

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">O quê</span>
        <Select
          value={parametros.get("tabela") ?? TODAS}
          onValueChange={(v) => trocar("tabela", v)}
        >
          <SelectTrigger aria-label="Tabela" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Tudo</SelectItem>
            {TABELAS_AUDITADAS.map((tabela) => (
              <SelectItem key={tabela} value={tabela}>
                {rotuloDaTabela(tabela)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">Quem</span>
        <Select
          value={parametros.get("quem") ?? TODAS}
          onValueChange={(v) => trocar("quem", v)}
        >
          <SelectTrigger aria-label="Quem mexeu" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Qualquer pessoa</SelectItem>
            {pessoas.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">De</span>
        <input
          type="date"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          defaultValue={parametros.get("de") ?? ""}
          onChange={(e) => trocar("de", e.target.value || TODAS)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">Até</span>
        <input
          type="date"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          defaultValue={parametros.get("ate") ?? ""}
          onChange={(e) => trocar("ate", e.target.value || TODAS)}
        />
      </label>

      {temFiltro ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/painel/auditoria")}
        >
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
