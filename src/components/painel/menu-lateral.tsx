"use client";

import { PanelLeftClose } from "lucide-react";

import { ListaDoMenu } from "@/components/painel/lista-do-menu";
import { CartaoDaPessoa } from "@/components/painel/cartao-da-pessoa";
import { Logo } from "@/components/shared/logo";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Coluna fixa do painel, no desktop.
 *
 * A barra SEGUE O TEMA, e antes ela era escura nos dois. Decisão do usuário
 * junto com a interface "Leve": no claro ela é branca, separada do conteúdo
 * por um fio, e o item ativo é a pílula azul clara; no escuro continua escura,
 * porque lá tudo é.
 *
 * O argumento contra o trilho preto é o da proposta: ele brigaria com a malha
 * de cor do topo — duas coisas pesadas na mesma dobra —, e a atenção precisa
 * ficar onde o trabalho está. **Por seguir o tema, nada aqui dentro usa mais
 * os tokens `--text-on-dark*`**: num fundo branco eles seriam texto branco
 * sobre branco. E o símbolo perdeu o `sobreEscuro` pelo mesmo motivo — os
 * tokens `--marca-*` já trocam as três cores por tema sozinhos, e forçar a
 * versão azul deixaria o disco claro em cima de uma barra clara.
 *
 * O estado recolhido não vive em estado do React, e sim no atributo data-menu
 * do <html>, gravado pelo script do layout antes da hidratação. Por isso a
 * largura certa já aparece na primeira pintura, e recarregar a página não faz
 * o menu piscar aberto antes de recolher.
 */
export function MenuLateral({
  role,
  nome,
  cargo,
  avatarUrl,
}: {
  role: UserRole;
  nome: string;
  cargo: string | null;
  avatarUrl: string | null;
}) {
  function alternar() {
    const raiz = document.documentElement;
    const proximo = raiz.dataset.menu === "recolhido" ? "expandido" : "recolhido";
    raiz.dataset.menu = proximo;
    try {
      localStorage.setItem("full-hub:menu", proximo);
    } catch {
      // Navegador sem armazenamento (aba anônima, cookies bloqueados): o menu
      // funciona igual, só não lembra da escolha na próxima visita.
    }
  }

  return (
    <aside className="bg-surface-sidebar border-border recolhido:lg:w-[4.5rem] border-r hidden w-64 shrink-0 transition-[width] duration-200 lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-6 py-4">
        <div className="recolhido:lg:justify-center flex items-center px-4">
          <Logo tamanho="sm" className="recolhido:lg:[&>span:last-child]:hidden" />
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <ListaDoMenu role={role} />
        </div>

        <div className="space-y-2 px-3">
          <CartaoDaPessoa nome={nome} cargo={cargo} role={role} avatarUrl={avatarUrl} />

          <button
            type="button"
            onClick={alternar}
            className="text-text-muted hover:bg-surface-sidebar-2 hover:text-text-primary focus-visible:ring-accent-strong/60 recolhido:lg:justify-center flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <PanelLeftClose
              aria-hidden
              className="recolhido:rotate-180 size-4 shrink-0 transition-transform"
            />
            <span className="recolhido:lg:hidden">Recolher menu</span>
            <span className="sr-only">Recolher ou expandir o menu</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
