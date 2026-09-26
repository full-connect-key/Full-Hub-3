import { Hammer } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { findMenuItem } from "@/lib/auth/permissions";

/**
 * Tela de um módulo que ainda não existe.
 *
 * Faz duas coisas: valida o perfil no servidor (quem não pode receber 403,
 * mesmo digitando a rota direto) e desenha o cabeçalho a partir do cadastro em
 * permissions.ts. Por isso cada rota placeholder tem uma linha só, e o título
 * nunca sai do mesmo lugar que alimenta o menu.
 *
 * **E NÃO TEM CAMPO, TABELA NEM BOTÃO** — nem desligado, nem com dado de
 * exemplo. Espaço reservado honesto é melhor que protótipo que engana: um
 * formulário que não salva ensina a pessoa a mandar a nota por aqui, e ela
 * descobre que não chegou no dia do pagamento.
 */
export async function PlaceholderDeModulo({
  href,
  frase,
}: {
  href: string;
  /**
   * O que a pessoa vai poder fazer aqui, em uma frase.
   *
   * **OBRIGATÓRIA, e ela já era o argumento deste arquivo.** O texto padrão
   * que existia aqui — "a navegação e as permissões já estão funcionando" —
   * descrevia o estado da OBRA, que interessa a quem a constrói e a mais
   * ninguém. Quem abre a tela quer saber o que ela vai resolver.
   *
   * Sendo opcional, a próxima rota placeholder herdava o texto errado de
   * graça. Sendo obrigatória, ela é uma frase que alguém precisa escrever —
   * e quem não tem o que escrever descobre que a rota não devia existir.
   */
  frase: string;
}) {
  await exigirAcessoARota(href);
  const item = findMenuItem(href);

  return (
    <div className="space-y-6">
      <PageHeader title={item?.label ?? "Módulo"} />
      {/* "Esta área ainda não está pronta" e não "Módulo em construção":
          módulo é palavra nossa, e obra é assunto de quem constrói. O título
          diz o estado em português comum; a descrição diz o que vai existir. */}
      <EmptyState
        icon={item?.icon ?? Hammer}
        title="Esta área ainda não está pronta"
        description={frase}
      />
    </div>
  );
}
