"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

/**
 * Linha de filtros das telas de listagem: selects para escolha única e chips
 * para ligar/desligar.
 *
 * O botão "Limpar filtros" só aparece quando há algo aplicado — botão morto
 * ocupando espaço é ruído, e sem ele a pessoa fica sem saída quando a lista
 * some por causa de um filtro que ela esqueceu.
 */

export type SelectFilter = {
  id: string;
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
    /**
     * A FOTO À FRENTE DO NOME, quando a opção tem uma identidade por trás.
     *
     * Decisão do usuário sobre o filtro de Responsáveis da Gestão de Tasks:
     * *"quero que a frente do nome de cada colaborador, tenha a foto da
     * pessoa"*, e depois sobre o de Clientes da mesma barra: *"no filtro de
     * clientes apareça a foto deles"*. É a mesma lista que o board e o
     * calendário já desenham com rosto — num seletor de quinze nomes, ou de
     * vinte e oito contas, a foto é o que faz achar sem ler.
     *
     * **E ela não custou consulta nenhuma na primeira vez:** `equipe` já chega
     * com `avatar_url` em quem monta a barra; o que a escondia era o tipo da
     * prop, estreitado a `{ id, nome }`. É a ponte construída e não
     * atravessada outra vez. A da conta custa a assinatura do bucket, porque
     * `clients.logo_url` é privado — e quem assina é o servidor.
     *
     * **O campo é OPCIONAL e a régua não é "só gente".** Ele entra onde a
     * opção É alguém ou alguma empresa; fica fora de status, prioridade e
     * vertente, que não têm retrato nenhum para mostrar — um círculo com as
     * iniciais de "Urgente" não é signo de coisa alguma.
     *
     * `src` nulo desenha as INICIAIS, e não nada: numa coluna de opções,
     * metade com círculo e metade sem deixa a margem esquerda irregular, e é
     * por ela que o olho desce a lista.
     */
    avatar?: { nome: string; src: string | null };
  }[];
  onChange: (value: string) => void;
  /** Rótulo da opção que não filtra nada. */
  allLabel?: string;
};

export type ChipFilter = {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
};

/** Valor usado para "sem filtro". O Select do Radix não aceita valor vazio. */
export const SEM_FILTRO = "__todos__";

export function FilterBar({
  selects = [],
  chips = [],
  onClear,
  children,
  className,
}: {
  selects?: SelectFilter[];
  chips?: ChipFilter[];
  onClear?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const algumAtivo =
    selects.some((filtro) => filtro.value !== SEM_FILTRO && filtro.value !== "") ||
    chips.some((chip) => chip.active);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {selects.map((filtro) => (
        <Select key={filtro.id} value={filtro.value || SEM_FILTRO} onValueChange={filtro.onChange}>
          <SelectTrigger size="sm" aria-label={filtro.label}>
            <SelectValue placeholder={filtro.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>{filtro.allLabel ?? filtro.label}</SelectItem>
            {filtro.options.map((opcao) => (
              // `textValue` é obrigatório quando o item deixa de ser texto
              // puro: é por ele que a busca por tecla do Radix acha a opção.
              <SelectItem key={opcao.value} value={opcao.value} textValue={opcao.label}>
                {opcao.avatar ? (
                  <span className="flex items-center gap-2">
                    {/* `tooltip={false}` porque o item do Select já é
                        interativo, e um `TooltipTrigger` dentro dele é
                        `nested-interactive` — crítico no axe. O nome está
                        escrito do lado, então nada se perde. */}
                    <UserAvatar
                      size="xs"
                      tooltip={false}
                      name={opcao.avatar.nome}
                      src={opcao.avatar.src}
                    />
                    {opcao.label}
                  </span>
                ) : (
                  opcao.label
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onToggle}
          aria-pressed={chip.active}
          className={cn(
            "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
            chip.active
              ? "border-blue-muted bg-accent text-accent-strong"
              : // `border-input` NO DESLIGADO, e é a mesma conta do botão
                // `outline`: sem ele o chip herda `--border` (1,07:1 sobre a
                // página) e o contorno de um controle não se vê. O ligado
                // tem a cor do `--accent` para carregar, e não precisa.
                "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {chip.label}
        </button>
      ))}

      {children}

      {algumAtivo && onClear ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X aria-hidden />
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
