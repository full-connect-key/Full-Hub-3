"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Um nome que se edita no lugar, salvando sozinho.
 *
 * **ELE EXISTE PORQUE SÃO VÁRIOS, e não porque um era grande.** O título da
 * demanda já salvava assim desde a 0028 — 600 ms de pausa mais o `blur` —, e
 * quando o nome da ETAPA passou a ser editável a conta ficou clara: dois
 * lugares escrevendo o mesmo par de temporizadores são dois lugares para
 * divergirem, e o que divergiria é o segundo, que ninguém relê. É a decisão
 * das sete cópias de `abas.tsx` aplicada a um campo.
 *
 * **A PAUSA E O `blur` SÃO OS DOIS, e cada um cobre o que o outro deixa
 * passar:** a pausa é para não gravar letra a letra, o `blur` é para não
 * perder o que foi digitado por quem fecha a tela logo depois. E `Enter`
 * fecha o campo em vez de mandar um formulário: num diálogo, `Enter` num
 * `<input>` solto não submete nada, e quem digitou espera que ele valha.
 *
 * **O QUE FALHA FICA NA TELA.** Devolver o valor antigo apagaria o que a
 * pessoa escreveu por causa de uma falha de rede — e ela não tem como saber
 * que perdeu. Quem avisa é `aoGravar`, que devolve a mensagem.
 *
 * **E ELE NÃO GRAVA O QUE NÃO MUDOU**: a tela de task salva campo a campo, e
 * sem essa pergunta clicar fora de um nome sem digitar viraria uma escrita —
 * que a trilha de auditoria registraria como alteração.
 */
export function NomeEditavel({
  valor,
  podeEditar,
  aoGravar,
  rotulo,
  placeholder,
  className,
  autoFocus,
  comoTexto,
}: {
  valor: string;
  podeEditar: boolean;
  /** Devolve a mensagem de erro, ou nada quando gravou. */
  aoGravar: (valor: string) => Promise<string | null>;
  /** O rótulo acessível. O campo não tem `<Label>` ao lado: ele É o nome. */
  rotulo: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Como desenhar quando não dá para editar. O padrão é um `<span>`. */
  comoTexto?: (texto: string) => React.ReactNode;
}) {
  const [texto, setTexto] = useState(valor);
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O ÚLTIMO VALOR GRAVADO, e não a prop: entre a gravação e o `refresh` do
  // servidor a prop ainda é a antiga, e sem isto o `blur` seguinte mandaria
  // de novo exatamente o que acabou de ser gravado.
  const gravado = useRef(valor);

  const gravar = useCallback(
    async (novo: string) => {
      const limpo = novo.trim();
      if (limpo === gravado.current.trim()) return;
      gravado.current = limpo;
      const erro = await aoGravar(limpo);
      if (erro) gravado.current = valor;
    },
    [aoGravar, valor],
  );

  useEffect(() => {
    return () => {
      if (pendente.current) clearTimeout(pendente.current);
    };
  }, []);

  if (!podeEditar) {
    return comoTexto ? (
      comoTexto(valor)
    ) : (
      <span className={className}>{valor}</span>
    );
  }

  return (
    <Input
      value={texto}
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={rotulo}
      className={cn(
        "h-auto border-transparent px-2 py-1 shadow-none",
        className,
      )}
      onChange={(e) => {
        const novo = e.target.value;
        setTexto(novo);
        if (pendente.current) clearTimeout(pendente.current);
        pendente.current = setTimeout(() => void gravar(novo), 600);
      }}
      onBlur={() => {
        if (pendente.current) clearTimeout(pendente.current);
        void gravar(texto);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
