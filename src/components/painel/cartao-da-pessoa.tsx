import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { iniciaisDe } from "@/components/shared/user-avatar";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Quem está logado, no pé da barra lateral — e SÓ isso.
 *
 * Três linhas com papéis diferentes: o NOME é quem você é, o CARGO é o que
 * você faz na agência, e o PERFIL é o que você alcança na plataforma. As duas
 * últimas se confundem o tempo todo — uma pessoa pode ser "Social Media" de
 * cargo e "Desenvolvedor" de perfil de acesso —, por isso o perfil vem em azul
 * da marca, separado do resto.
 *
 * Não usa o UserAvatar compartilhado: aquele traz um tooltip com o nome, que
 * aqui seria repetir o que já está escrito ao lado. As primitivas do Avatar
 * são as mesmas; o que muda são as cores, porque esta barra tem fundo próprio.
 */
export function CartaoDaPessoa({
  nome,
  cargo,
  role,
  avatarUrl,
}: {
  nome: string;
  cargo: string | null;
  role: UserRole;
  avatarUrl: string | null;
}) {
  return (
    // NÃO É MAIS UM LINK, e a mudança é o ponto — decisão do usuário: o cartão
    // "mostra quem está logado e nada mais". Ele levava a `/painel/perfil`, que
    // é para onde o menu do avatar leva; eram dois caminhos para a mesma tela,
    // e o de baixo era o que ninguém encontrava.
    //
    // **O cartão fica**, em vez de sumir com o item de menu: recolhida, a
    // barra lateral vira uma coluna de ícones, e este avatar é a única coisa
    // que diz de quem é a sessão. Num produto em que a mesma pessoa abre o
    // painel da agência e o portal de um cliente, isso não é decoração.
    <div className="bg-surface-sidebar-2 recolhido:lg:justify-center recolhido:lg:px-2 flex items-center gap-3 rounded-lg px-3 py-2.5">
      <Avatar className="size-8 shrink-0">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="bg-brand-blue text-brand-foreground text-xs font-semibold">
          {iniciaisDe(nome)}
        </AvatarFallback>
      </Avatar>

      <span className="recolhido:lg:hidden flex min-w-0 flex-col leading-tight">
        <span className="text-text-on-dark truncate text-sm font-medium">{nome}</span>
        {/*
          `on-dark-muted` E NÃO `muted`, e é o token que existe para isto: a
          barra lateral é escura nos DOIS temas, então o token do tema claro
          nunca foi o certo aqui. A 12px o mínimo é 4,5:1, e o par antigo dava
          4,49 — dois centésimos, invisíveis numa lista escrita à mão e óbvios
          para a varredura que lê o estilo calculado.
        */}
        {cargo ? (
          <span className="text-text-on-dark-muted truncate text-xs">{cargo}</span>
        ) : null}
        <span className="text-brand-blue truncate text-[11px] font-medium">
          {ROTULOS_DE_ROLE[role]}
        </span>
      </span>
    </div>
  );
}
