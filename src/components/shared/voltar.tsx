"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A seta de voltar, uma só para a plataforma inteira.
 *
 * ---------------------------------------------------------------------------
 * ERAM QUATRO DESENHOS, EM OITO TELAS
 *
 * Gestão de Tasks e Comodatos usavam `Button ghost sm` com a seta e o nome do
 * módulo; Clientes e Equipe usavam o mesmo botão com outra margem negativa
 * (`-ml-2` contra `-ms-2`) e a seta em outro tamanho; Campanhas e o Acervo
 * usavam `<Link>` cru, com dois pares de cor diferentes entre si. E o rótulo
 * ia de "Gestão de Tasks" a "Voltar às campanhas" — às vezes o destino, às
 * vezes a ação.
 *
 * É a história das sete cópias de `abas.tsx`: quem trocava de módulo trocava
 * de vocabulário visual sem que nada tivesse mudado de natureza. **O que este
 * componente centraliza é o DESENHO e o MECANISMO, nunca o destino** — cada
 * tela continua dizendo para onde se volta, porque só ela sabe.
 *
 * ---------------------------------------------------------------------------
 * ELE VOLTA NO HISTÓRICO, E CAI NA ROTA QUANDO NÃO HÁ HISTÓRICO
 *
 * Decisão do usuário: *"ao clicar, retornar à página anterior do histórico de
 * navegação; caso a página seja acessada diretamente, utilizar uma rota padrão
 * de retorno"*. As oito telas antigas faziam só a segunda metade — eram
 * `<Link href>` fixos —, então quem chegasse à ficha de um cliente vindo da
 * busca global voltava para a LISTA de clientes, e não para a busca.
 *
 * **É `<Link>` de verdade com o clique interceptado, e não um `<button>`.**
 * Um botão perde o que uma âncora dá de graça: abrir em aba nova com o meio
 * ou com Ctrl, o endereço na barra de status, e o menu de contexto. Por isso
 * o clique modificado passa direto — quem pediu aba nova quer a ROTA, não o
 * passo de trás.
 *
 * **A pergunta é `window.history.length > 1`**, e ela é exata no caso que
 * importa: uma aba aberta direto no endereço tem comprimento 1, e é
 * exatamente isso que "acessada diretamente" quer dizer. *O que ela não
 * distingue, e fica dito:* quem chegou de um link de fora da plataforma tem
 * comprimento 2, e aí o passo de trás sai do Full Hub — que continua sendo "a
 * página anterior do histórico", que é o que foi pedido.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE NÃO FAZ, E É DITO EM VEZ DE ESCONDIDO
 *
 * Ele não guarda formulário. A tela de task salva campo a campo desde a 0028,
 * então ali não há o que perder; as que têm botão de salvar — o editor de
 * recorrência, o de fluxo — respondem por isso, e é decisão delas, não desta
 * seta. Voltar no histórico não é mais perigoso que a seta do navegador, que
 * já está ali do lado.
 */
export function Voltar({
  para,
  rotulo,
  className,
}: {
  /** Para onde ir quando não há passo de trás. É o nome do lugar, não "voltar". */
  para: string;
  /**
   * O que a pessoa lê. **É o DESTINO e não a ação** — "Comodatos", e não
   * "Voltar aos comodatos": a seta já diz que é voltar, e repetir o verbo
   * gasta a linha para dizer duas vezes a mesma coisa.
   */
  rotulo: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn("text-text-secondary -ms-2 w-fit", className)}
    >
      <Link
        href={para}
        onClick={(evento) => {
          // CLIQUE MODIFICADO PASSA DIRETO: quem segura Ctrl, Shift ou Cmd,
          // ou clica com o meio, está pedindo outra aba — e aba nova não tem
          // passo de trás nenhum para dar.
          if (
            evento.metaKey ||
            evento.ctrlKey ||
            evento.shiftKey ||
            evento.altKey ||
            evento.button !== 0
          ) {
            return;
          }
          if (typeof window !== "undefined" && window.history.length > 1) {
            evento.preventDefault();
            router.back();
          }
        }}
      >
        <ArrowLeft aria-hidden className="size-4" />
        {rotulo}
      </Link>
    </Button>
  );
}
