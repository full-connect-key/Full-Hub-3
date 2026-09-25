import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { forbidden } from "next/navigation";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { templatesDeCampanha } from "@/lib/dados/campanhas";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";

import { FormularioDeCampanha } from "./formulario";

export const metadata: Metadata = { title: "Nova campanha" };

/**
 * A abertura de campanha, na versão mínima.
 *
 * A gestão completa — editar campanha existente, enviar entregável, subir
 * arquivo — é de outro momento. O que existe aqui é o suficiente para uma
 * campanha nascer com a árvore certa e chegar ao Portal.
 *
 * A guarda é de SERVIDOR, e não do menu: esconder o link não é segurança. E
 * ela é a primeira barreira, não a única — `campaigns_insert` exige
 * `is_staff()` no banco, e é essa que vale para quem chamar a API direto.
 */
export default async function PaginaDeNovaCampanha() {
  await exigirAcessoARota("/painel/aprovacoes");

  // A GUARDA DA ROTA NÃO BASTA MAIS AQUI. Desde a 0054 o módulo é de
  // `EQUIPE` — o colaborador entra para subir a arte da peça dele —, e abrir
  // campanha continua sendo de quem abre demanda. Sem este 403, ele chegaria
  // ao formulário inteiro e levaria a recusa no clique de salvar, depois de
  // ter datilografado a árvore.
  //
  // E não é a proteção: `campaigns_insert` e `tasks_insert` exigem
  // `is_atendimento()` no banco, e é essa que vale para quem chamar a API
  // direto.
  if (!(await souDoAtendimento())) forbidden();

  const [clientes, templates, pessoas] = await Promise.all([
    listarClientes(),
    templatesDeCampanha(),
    listarEquipeAtiva(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Nova campanha" />
        <p className="text-text-muted mt-1">
          A campanha nasce com uma <strong>demanda</strong> junto, e cada
          entregável vira uma <strong>etapa</strong> dela — com responsável e
          prazo. É por isso que esta tela pede briefing e pasta de entrega: são
          os campos da demanda.
        </p>
      </div>

      <FormularioDeCampanha
        clientes={clientes
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, nome: c.nome_empresa }))}
        templates={templates}
        pessoas={pessoas.map((p) => ({
          id: p.id,
          nome: p.nome,
          funcao: p.funcao,
        }))}
      />
    </div>
  );
}
