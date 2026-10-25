"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * A BUSCA DA BIBLIOTECA, e só ela.
 *
 * **Não reaproveita `FiltrosDoPortalCliente`**, e a razão é a de sempre neste
 * produto: aquele componente carrega tipo, status e prazo, e três filtros que
 * esta tela não tem seriam três chips oferecendo um recorte que não existe. O
 * que ele tem de útil aqui — escrever na URL com `replace` e sem rolar — são
 * seis linhas.
 *
 * **O termo mora na URL**, como todo filtro de listagem: "manda o link do KV"
 * precisa ser um link, e é isso que permite a grade inteira ser componente de
 * servidor.
 *
 * **`replace` e não `push`**, pela razão do seletor de visão: cada tecla
 * viraria uma entrada no histórico, e o botão "voltar" do navegador andaria
 * letra por letra em vez de sair da tela.
 */
export function BuscaDaBiblioteca({
  busca,
  encontrados,
  temAlgum,
}: {
  busca: string;
  encontrados: number;
  /** Sem nada guardado o campo some: buscar em zero é um campo que não decide nada. */
  temAlgum: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function navegar(valor: string) {
    const proximos = new URLSearchParams(parametros.toString());
    if (valor.trim()) proximos.set("busca", valor);
    else proximos.delete("busca");
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  if (!temAlgum) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search
          aria-hidden
          className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          // `defaultValue` E NÃO `value`: com o valor controlado por uma
          // navegação de servidor, o cursor pula para o fim a cada tecla.
          defaultValue={busca}
          onChange={(evento) => navegar(evento.target.value)}
          placeholder="Buscar por nome, campanha ou demanda"
          aria-label="Buscar material"
          className="rounded-full pl-9"
        />
      </div>

      <p className="text-text-muted text-sm">
        {encontrados} {encontrados === 1 ? "material" : "materiais"}
      </p>

      {busca ? (
        <button
          type="button"
          onClick={() => navegar("")}
          className="text-text-muted hover:text-foreground inline-flex items-center gap-1 text-sm underline underline-offset-4"
        >
          <X aria-hidden className="size-3.5" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}
