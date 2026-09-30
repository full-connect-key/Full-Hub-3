"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navegacaoComBase } from "@/lib/navegacao-do-portal";
import { cn } from "@/lib/utils";

/**
 * Navegação superior do portal.
 *
 * No celular vira uma faixa que rola na horizontal: são poucos itens, então
 * uma gaveta como a do painel seria peso sem necessidade.
 *
 * ---------------------------------------------------------------------------
 * **ELA É A PÍLULA DA `BarraDeContexto`, e não mais a aba sublinhada.**
 *
 * As duas navegam entre SEÇÕES — cada uma com outra consulta, outro conteúdo,
 * e trocar é trocar de página no servidor. Eram dois desenhos para a mesma
 * natureza, que é exatamente o argumento das sete cópias de `abas.tsx` que a
 * barra de contexto desfez: quem atravessa do painel para o portal do cliente
 * trocava de vocabulário visual sem nada ter mudado.
 *
 * **O componente continua sendo OUTRO, e é de propósito.** A `BarraDeContexto`
 * carrega o `<h1>` `sr-only` da página, o selo de contagem e as ações do
 * módulo, e decide a seção por `?aba=` — aqui cada seção é uma ROTA, o título
 * mora no cabeçalho de cada tela, e o cliente não tem ação de módulo nenhuma.
 * Reaproveitá-la significaria carregar quatro parâmetros que este lado não usa
 * para herdar oito classes. O que se compartilha é o desenho; o mecanismo é
 * diferente porque a coisa é diferente.
 * ---------------------------------------------------------------------------
 *
 * Configurações NÃO está aqui — ela é o único item que fala do cliente e não
 * do trabalho da agência, e mora no menu do avatar, que é onde ele já
 * procura. Um caminho só, por decisão do usuário.
 */
export function NavegacaoDoPortal({ base = "/portal" }: { base?: string }) {
  const pathname = usePathname();
  // `foraDaBarra` FILTRA AQUI, e não em `navegacaoComBase()`: a lista inteira
  // continua sendo a fonte da trilha e do título da página — tirar o item de
  // lá deixaria quem abre Configurações pelo menu do avatar num cabeçalho sem
  // nome.
  const itens = navegacaoComBase(base).filter((item) => !item.foraDaBarra);

  return (
    <nav aria-label="Seções do portal" className="min-w-0 overflow-x-auto pb-3">
      <ul className="bg-muted inline-flex min-w-max items-center gap-1 rounded-xl p-1">
        {itens.map((item) => {
          const ativo =
            item.href === base
              ? pathname === base
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                  ativo
                    ? "bg-surface-card text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                <item.icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
