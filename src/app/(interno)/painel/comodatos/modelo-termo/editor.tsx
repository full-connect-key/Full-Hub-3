"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import { VARIAVEIS_DO_TERMO, montarTermo } from "@/lib/dominio/comodatos";

import { salvarModeloDoTermo } from "../acoes";

/**
 * O texto do termo, e a lista de variáveis AO LADO dele.
 *
 * **As variáveis são a mesma lista que o PDF substitui** — sem isso o editor
 * ofereceria uma chave que ninguém troca, e o termo sairia impresso com
 * `{{PATRIMONIO}}` no meio. O pior tipo de campo é o que faz quem o preenche
 * achar que garantiu alguma coisa.
 *
 * **E a prévia usa a MESMA função do PDF** (`montarTermo`), com valores de
 * exemplo. Uma prévia montada por conta própria mostraria um documento que não
 * é o que sai — e o dia em que as duas divergissem seria o dia em que alguém
 * já tinha assinado.
 */
const EXEMPLO = {
  PESSOA: "Marina Alves",
  EQUIPAMENTO: "MacBook Pro 14 M3 Apple A2918",
  PATRIMONIO: "FCK-0001",
  SERIE: "C02X1LMNPQ",
  ACESSORIOS: "carregador, capa",
  ESTADO: "Bom",
  DATA_ENTREGA: "02/03/2027",
  ACEITE: "Recebimento confirmado por Marina Alves no Full Hub em 03/03/2027 às 09:14.",
};

export function EditorDoTermo({ corpo }: { corpo: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(corpo);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setEnviando(true);
    const r = await chamarEMostrar(() => salvarModeloDoTermo({ corpo: texto }));
    setEnviando(false);
    if (r.ok) router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3">
        <label htmlFor="termo-corpo" className="text-text-primary block text-sm font-medium">
          Texto do termo
        </label>
        <Textarea
          id="termo-corpo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={24}
          className="font-mono text-xs"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={salvar} disabled={enviando || texto.trim() === corpo.trim()}>
            {enviando ? <Loader2 className="animate-spin" /> : null}
            Salvar modelo
          </Button>
          <p className="text-text-muted text-xs">
            Os comodatos já entregues continuam com o texto do dia deles.
          </p>
        </div>

        <section className="space-y-2" aria-labelledby="previa-titulo">
          <h2 id="previa-titulo" className="text-text-primary text-sm font-semibold">
            Como vai sair
          </h2>
          <pre className="bg-surface-page text-text-secondary overflow-x-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
            {montarTermo(texto, EXEMPLO)}
          </pre>
        </section>
      </div>

      <aside className="space-y-2">
        <h2 className="text-text-primary text-sm font-semibold">O que dá para usar</h2>
        <ul className="divide-border divide-y rounded-lg border text-xs">
          {VARIAVEIS_DO_TERMO.map((v) => (
            <li key={v.chave} className="px-3 py-2">
              <code className="text-accent-strong">{`{{${v.chave}}}`}</code>
              <p className="text-text-muted mt-0.5">{v.oQueE}</p>
            </li>
          ))}
        </ul>
        <p className="text-text-muted text-xs">
          O que não tiver valor sai como “—”, e nunca com a chave crua.
        </p>
      </aside>
    </div>
  );
}
