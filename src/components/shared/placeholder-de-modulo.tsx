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
   * **Sem ela a tela diz que o módulo existirá, e não o que ele fará** — e é a
   * diferença entre quem fecha a aba e quem volta. A frase padrão descreve o
   * estado da OBRA ("a navegação já funciona"), que interessa a quem a
   * constrói; a frase de cada módulo descreve o que ele resolve, que é o que
   * interessa a quem o esperou.
   */
  frase?: string;
}) {
  await exigirAcessoARota(href);
  const item = findMenuItem(href);

  return (
    <div className="space-y-6">
      <PageHeader title={item?.label ?? "Módulo"} />
      <EmptyState
        icon={item?.icon ?? Hammer}
        title="Módulo em construção"
        description={
          frase ??
          "A navegação e as permissões já estão funcionando. O conteúdo entra em breve."
        }
      />
    </div>
  );
}
