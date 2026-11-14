"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    parametros.has("ate") ||
    parametros.has("busca");

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/*
        A BUSCA VEM PRIMEIRO, e é o que entrou no lugar da coluna "O que
        mudou" (0135): ela procura o nome de quem mexeu e o conteúdo da
        mudança, e é a única coisa desta barra que alcança o que a tabela
        deixou de desenhar. Os outros quatro recortam dimensões que a tabela
        mostra — tabela, pessoa, data.
      */}
      <Busca />
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
          className="border-input bg-transparent h-9 rounded-md border px-3 text-sm"
          defaultValue={parametros.get("de") ?? ""}
          onChange={(e) => trocar("de", e.target.value || TODAS)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">Até</span>
        <input
          type="date"
          className="border-input bg-transparent h-9 rounded-md border px-3 text-sm"
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

/**
 * O campo de busca da auditoria.
 *
 * ---------------------------------------------------------------------------
 * **ELE SÓ VAI PARA A URL NO ENTER (ou no `blur`)**, e a
 * assimetria com os outros quatro filtros é deliberada: eles são um clique, e
 * a busca é texto. Levando cada tecla à URL, cada letra digitada seria uma
 * navegação de servidor e uma consulta nova — e a trilha é a tela mais pesada
 * do painel, porque `audit_log` só cresce.
 *
 * **E ela NÃO é debounce de 600 ms**, como o título da task: ali o campo é a
 * coisa que se grava, aqui ele é o recorte de uma lista — quem digita um
 * termo de busca sabe quando acabou de digitar, e o Enter é esse momento. O
 * `blur` existe pelo mesmo par da 0028: ele é o que recolhe quem digitou e
 * clicou em outra coisa.
 *
 * **O valor mora na URL assim que é confirmado**, como todo filtro de
 * listagem do produto: "olha o que aconteceu com a Mundo Verde" precisa ser um
 * link que abre no mesmo lugar para quem recebe.
 * ---------------------------------------------------------------------------
 */
function Busca() {
  const router = useRouter();
  const parametros = useSearchParams();
  const naUrl = parametros.get("busca") ?? "";

  function enviar(valor: string) {
    const limpo = valor.trim();
    if (limpo === naUrl) return;

    const novos = new URLSearchParams(parametros.toString());
    if (limpo === "") novos.delete("busca");
    else novos.set("busca", limpo);
    router.push(`/painel/auditoria?${novos.toString()}`);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium">Procurar</span>
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        />
        <Input
          // O CAMPO E SOLTO, COM `key` NA PALAVRA DA URL, e nao um `useState`
          // ressincronizado por efeito: `setState` no corpo de um efeito
          // dispara renderizacao em cascata, e o `react-hooks` do projeto
          // reprova -- a mesma linha que o editor de post pagou com `key` em
          // vez de efeito, e que a faixa de disponibilidade pagou derivando.
          //
          // A `key` e o que faz "Limpar" limpar o campo tambem: sem ela o
          // botao apagaria o recorte e deixaria a palavra escrita, dizendo que
          // a lista esta filtrada por ela.
          key={naUrl}
          defaultValue={naUrl}
          type="search"
          aria-label="Procurar na auditoria"
          placeholder="Nome, cliente, valor…"
          className="h-9 w-56 pl-8"
          onBlur={(e) => enviar(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              enviar(e.currentTarget.value);
            }
          }}
        />
      </div>
    </label>
  );
}
