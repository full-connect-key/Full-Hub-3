"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIODOS, ROTULOS_DE_PERIODO, type Periodo } from "@/lib/dominio/metricas";

const TODOS = "todos";

/**
 * O recorte, e o filtro de cliente.
 *
 * ---------------------------------------------------------------------------
 * TUDO NA URL, e o servidor é quem recalcula as datas.
 *
 * A barra grava `?periodo=`, `?de=`, `?ate=` e `?cliente=`, e nada mais —
 * nunca as datas de um recorte pronto. "Últimos 30 dias" gravado como
 * `de=2026-08-26` é um link que, mandado na segunda-feira e aberto na sexta,
 * mostra um recorte que já não é o de ninguém, sem nada dizendo isso. Com a
 * chave na URL, o link continua querendo dizer "os últimos 30 dias".
 *
 * As duas datas só aparecem em `livre`, e é onde elas significam alguma coisa.
 * ---------------------------------------------------------------------------
 *
 * **A faixa mostra o período resolvido por extenso**, e ela é a única resposta
 * para "30 dias a partir de quando?". Sem ela, quem exporta o CSV não tem como
 * saber que recorte está mandando para o sócio.
 */
export function BarraDePeriodo({
  periodo,
  de,
  ate,
  clienteId,
  clientes,
}: {
  periodo: Periodo;
  de: string;
  ate: string;
  /** `null` quando a aba não filtra por cliente. */
  clienteId?: string | null;
  clientes?: { id: string; nome_empresa: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function trocar(mudancas: Record<string, string | null>) {
    const destino = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) destino.delete(chave);
      else destino.set(chave, valor);
    }
    router.push(`${pathname}?${destino.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="periodo" className="text-text-muted text-xs">
            Período
          </Label>
          <Select
            value={periodo}
            onValueChange={(valor) =>
              // Sair do livre APAGA as duas datas: deixá-las na URL faria o
              // link carregar um recorte que a tela não está mostrando, e
              // quem voltasse para "Escolher as datas" veria datas antigas
              // reaparecerem sozinhas.
              trocar(
                valor === "livre"
                  ? { periodo: valor, de, ate }
                  : { periodo: valor, de: null, ate: null },
              )
            }
          >
            <SelectTrigger id="periodo" size="sm" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p} value={p}>
                  {ROTULOS_DE_PERIODO[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodo === "livre" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="de" className="text-text-muted text-xs">
                De
              </Label>
              <Input
                id="de"
                type="date"
                value={de}
                className="h-8 w-40"
                onChange={(e) => trocar({ de: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ate" className="text-text-muted text-xs">
                Até
              </Label>
              <Input
                id="ate"
                type="date"
                value={ate}
                className="h-8 w-40"
                onChange={(e) => trocar({ ate: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {clientes ? (
          <div className="space-y-1">
            <Label htmlFor="cliente" className="text-text-muted text-xs">
              Cliente
            </Label>
            <Select
              value={clienteId ?? TODOS}
              onValueChange={(valor) => trocar({ cliente: valor === TODOS ? null : valor })}
            >
              <SelectTrigger id="cliente" size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os clientes</SelectItem>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome_empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <p className="text-text-muted text-xs">
        {format(parseISO(de), "d 'de' MMMM 'de' yyyy", { locale: ptBR })} até{" "}
        {format(parseISO(ate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </p>
    </div>
  );
}
