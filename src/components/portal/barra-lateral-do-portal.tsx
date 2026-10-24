"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Logo } from "@/components/shared/logo";
import { navegacaoComBase } from "@/lib/navegacao-do-portal";
import { cn } from "@/lib/utils";

/**
 * A barra lateral do Portal do Cliente.
 *
 * ---------------------------------------------------------------------------
 * **ELA DESFAZ UMA DECISÃO QUE ESTAVA ESCRITA AQUI, e por decisão do usuário**
 * — a proposta aprovada pede a sidebar fixa de 244px. A casca anterior tinha
 * recusado a barra entre três propostas, com três razões; duas delas o próprio
 * proposta responde, e a terceira deixou de valer:
 *
 * 1. *"no celular ela cobra um toque a mais"* — e a proposta manda ela virar
 *    menu recolhível abaixo de 1024px, que é a `GavetaDoPortal` ao lado. A
 *    faixa de seções que rolava na horizontal some junto;
 * 2. *"ela carrega o cartão da pessoa no pé, que diz perfil de acesso e
 *    cargo: vocabulário da agência"* — aqui o cartão é **nome e empresa**, e
 *    mais nada. Perfil de acesso é palavra de dentro da agência e não entra no
 *    portal, que é a regra do `check:cores` para este lado do produto;
 * 3. *"a coluna de 306px não tem o que carregar"* — era sobre a coluna da
 *    direita do painel, que não vem no pacote. A barra é da esquerda.
 * ---------------------------------------------------------------------------
 *
 * **NENHUM TOKEN DE COR NOVO, e isso foi medido.** A proposta traz uma paleta
 * própria na seção 3.1, e ela diz quase tudo o que os tokens do produto já
 * dizem: `surface` É `--surface-card`, `primary` É `--action`, `divider` e
 * `border` ficam a ΔE 0,67 e 1,02 dos equivalentes — distâncias que ninguém vê.
 * Onde ela difere de verdade é na escala de texto, e ali ela é **mais clara**
 * que a do produto: o cinza mais fraco dela dá 2,41:1 no rótulo de 11px em caixa
 * alta que esta barra usa, contra 7,67:1 do `--text-muted`. A escala daqui foi
 * escurecida de propósito, depois de o usuário dizer duas vezes que o cinza
 * não dava leitura; adotar a da proposta seria desfazer aquilo em silêncio.
 *
 * **O SÍMBOLO É O ARQUIVO DA AGÊNCIA, e não o quadrado escuro com "F"** que o
 * protótipo desenha. É a regra da identidade: a marca é o arquivo que a Full
 * mandou, e não um desenho parecido — desenhar um "F" seria pôr no ar um
 * wordmark que a agência não fez. "FULL CONNECT KEY" em caixa alta espaçada,
 * esse o produto já usa nos lockups pequenos e a proposta pede igual.
 *
 * **O ITEM ATIVO É O PAR DO PAINEL**, `--sidebar-ativo-fundo` com
 * `--sidebar-ativo-texto`, que está medido em 5,88:1 desde a interface "Leve".
 * O `primary-ring` da proposta — a borda de 1px em volta do item ativo — ficou
 * de fora: ele dá 1,29:1 sobre o fundo dele, então não é sinal, é enfeite, e
 * um token novo para um fio que ninguém distingue é a segunda verdade de
 * graça. Quem diz que o item está ativo são o fundo, o peso e o fio de 3px à
 * esquerda, que é o mesmo da barra do painel.
 */
export function ListaDaBarraDoPortal({
  base = "/portal",
  aprovacoesPendentes = 0,
  aoNavegar,
}: {
  base?: string;
  /**
   * Quantas esperam a decisão do cliente.
   *
   * **No zero o selo não aparece**, e é a regra do produto: um selo com zero é
   * a mesma linha com um número a mais, e a ausência é a resposta — a decisão
   * da matriz do Day Off, que pinta só a exceção.
   *
   * Ele chega como prop e não de uma consulta daqui porque esta barra é
   * montada no layout, que serve toda tela do portal: a contagem sai da mesma
   * `esperandoOCliente()` que o Início e a fila de Aprovações já usam, e será
   * ligada quando a tela de Aprovações entrar — uma consulta pesada agora, só
   * para o selo, seria trocada em seguida.
   */
  aprovacoesPendentes?: number;
  /** Fecha a gaveta no celular. No desktop não existe o que fechar. */
  aoNavegar?: () => void;
}) {
  const pathname = usePathname();
  const itens = navegacaoComBase(base).filter((item) => !item.foraDaBarra);

  return (
    <nav aria-label="Seções do portal">
      <p className="text-text-muted px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase">
        Portal do cliente
      </p>

      <ul className="flex flex-col gap-0.5">
        {itens.map((item) => {
          // O Início casa por igualdade e os outros por prefixo: com
          // `startsWith`, `/portal` casaria com toda rota do portal e ele
          // ficaria aceso em todas as telas.
          const ativo =
            item.href === base
              ? pathname === base
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          const selo =
            item.href === `${base}/aprovacoes` && aprovacoesPendentes > 0
              ? aprovacoesPendentes
              : null;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={aoNavegar}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-md py-2 pr-3 pl-3 text-sm transition-colors",
                  ativo
                    ? "bg-sidebar-ativo-fundo text-sidebar-ativo-texto font-semibold"
                    : "text-text-secondary hover:bg-neutral-soft hover:text-foreground",
                )}
              >
                {ativo ? (
                  <span
                    aria-hidden
                    className="bg-sidebar-ativo-texto absolute top-1 bottom-1 left-0 w-[3px] rounded-r"
                  />
                ) : null}
                <item.icon aria-hidden className="size-[18px] shrink-0" />
                <span className="leading-tight">{item.label}</span>

                {selo ? (
                  <span className="bg-danger-soft text-danger ml-auto min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-bold tabular-nums">
                    {selo}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * O cartão de quem está logado, no pé da barra.
 *
 * **Nome e empresa, nunca perfil de acesso nem cargo** — a razão está no
 * cabeçalho deste arquivo. Ele não é link: o caminho para os dados da pessoa é
 * o menu do avatar no canto superior direito, e é um só, por decisão do
 * usuário.
 */
export function CartaoDeQuemEntrou({
  nome,
  nomeDaEmpresa,
}: {
  nome: string;
  nomeDaEmpresa: string | null;
}) {
  return (
    <div className="border-border flex items-center gap-2.5 border-t px-3 pt-3">
      <UserAvatar name={nome} size="sm" tooltip={false} />
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-semibold">{nome}</p>
        {nomeDaEmpresa ? (
          <p className="text-text-muted truncate text-xs">{nomeDaEmpresa}</p>
        ) : null}
      </div>
    </div>
  );
}

/** A barra fixa de 244px. Abaixo de `lg` ela não é desenhada — lá é a gaveta. */
export function BarraLateralDoPortal({
  base = "/portal",
  nome,
  nomeDaEmpresa,
  aprovacoesPendentes = 0,
}: {
  base?: string;
  nome: string;
  nomeDaEmpresa: string | null;
  aprovacoesPendentes?: number;
}) {
  return (
    <aside className="bg-surface-sidebar border-border hidden w-[244px] shrink-0 flex-col justify-between border-r px-3 py-5 lg:flex">
      <div>
        <div className="mb-6 px-3">
          <Logo tamanho="sm" />
        </div>
        <ListaDaBarraDoPortal
          base={base}
          aprovacoesPendentes={aprovacoesPendentes}
        />
      </div>
      <CartaoDeQuemEntrou nome={nome} nomeDaEmpresa={nomeDaEmpresa} />
    </aside>
  );
}
