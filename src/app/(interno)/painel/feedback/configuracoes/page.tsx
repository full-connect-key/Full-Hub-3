import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { configDoFeedback, gestoresAtivos } from "@/lib/dados/feedback";

import { FormularioDaConfig } from "./formulario";

export const metadata: Metadata = { title: "Configurações do feedback" };

/**
 * A CONFIGURAÇÃO, E ELA É DO SÓCIO.
 *
 * ---------------------------------------------------------------------------
 * `exige_revisao` decide se um texto escrito por máquina vai direto para uma
 * pessoa da equipe, e isso é decisão de quem responde pela agência — a mesma
 * razão da fila de notas fiscais. **O desenvolvedor é gestão para todo o resto
 * do sistema e aqui não**, e é por isso que esta rota tem entrada própria em
 * `permissions.ts`: sem ela, ele cairia no item de `/painel/feedback`, que é
 * `GESTAO`, e abriria a tela.
 *
 * A guarda de tela existe ao lado da trava, não em vez dela:
 * `feedback_config_update` exige `is_socio()` e a action confere de novo.
 * ---------------------------------------------------------------------------
 */
export default async function Pagina() {
  await exigirAcessoARota("/painel/feedback/configuracoes");

  const [config, gestores] = await Promise.all([
    configDoFeedback(),
    gestoresAtivos(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Configurações do feedback" />

      {config ? (
        <FormularioDaConfig config={config} gestores={gestores} />
      ) : (
        <p className="text-text-muted text-sm">
          A linha de configuração não foi encontrada. Aplique a migration 0075.
        </p>
      )}
    </div>
  );
}
