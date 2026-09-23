"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Qual empresa o cliente está olhando.
 *
 * **Só aparece com mais de uma**, e quem decide isso é quem renderiza: uma
 * caixa de seleção com uma opção só é um controle que não controla nada, e
 * ocupa a largura do cabeçalho no celular.
 *
 * A escolha mora na URL, como todo filtro do produto: o link fica
 * compartilhável e sobrevive a um F5 no meio da aprovação.
 */

const TODAS = "__todas__";

export function SeletorDeEmpresa({
  empresas,
  selecionada,
}: {
  empresas: { id: string; nome_empresa: string }[];
  selecionada: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  if (empresas.length < 2) return null;

  function escolher(valor: string) {
    const proximos = new URLSearchParams(parametros.toString());
    if (valor === TODAS) proximos.delete("empresa");
    else proximos.set("empresa", valor);
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  return (
    <Select value={selecionada ?? TODAS} onValueChange={escolher}>
      <SelectTrigger
        className="h-9 w-auto gap-2 border-none shadow-none"
        aria-label="Empresa"
      >
        <Building2 aria-hidden className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS}>Todas as empresas</SelectItem>
        {empresas.map((empresa) => (
          <SelectItem key={empresa.id} value={empresa.id}>
            {empresa.nome_empresa}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
