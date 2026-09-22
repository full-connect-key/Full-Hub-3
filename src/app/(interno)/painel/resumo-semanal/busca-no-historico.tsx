"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Busca no próprio histórico.
 *
 * O termo mora na URL (`?busca=campanha`), como os filtros das outras telas de
 * listagem: um F5 no meio da leitura não pode jogar a pessoa de volta para a
 * semana de hoje, e voltar no navegador tem que desfazer a busca.
 *
 * `replace` e não `push`: com o debounce, cada pausa na digitação viraria uma
 * entrada no histórico, e "voltar" levaria letra por letra até a busca vazia.
 */
export function BuscaNoHistorico({ termoInicial }: { termoInicial: string }) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [termo, setTermo] = useState(termoInicial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const atual = timer;
    return () => {
      if (atual.current) clearTimeout(atual.current);
    };
  }, []);

  function digitar(valor: string) {
    setTermo(valor);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => aplicar(valor), 400);
  }

  function aplicar(valor: string) {
    const destino = new URLSearchParams(parametros.toString());
    if (valor.trim().length >= 2) destino.set("busca", valor.trim());
    else destino.delete("busca");
    router.replace(destino.size > 0 ? `?${destino.toString()}` : "?", { scroll: false });
  }

  function limpar() {
    if (timer.current) clearTimeout(timer.current);
    setTermo("");
    aplicar("");
  }

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        type="search"
        aria-label="Buscar no meu histórico"
        placeholder="Buscar no meu histórico: cliente, campanha, o que você escreveu…"
        className="pl-9"
        value={termo}
        onChange={(evento) => digitar(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key !== "Enter") return;
          evento.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          aplicar(termo);
        }}
      />
      {termo ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
          onClick={limpar}
        >
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
