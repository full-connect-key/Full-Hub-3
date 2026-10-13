import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { gastosVencidos, lancamentosDaCompetencia, listarCategorias } from "@/lib/dados/financeiro";
import { filaDeNotas, pedidosDeNota } from "@/lib/dados/notas-fiscais";
import { competenciaDaChave } from "@/lib/dominio/financeiro";
import { porColunaDaFila } from "@/lib/dominio/notas-fiscais";

import { AbasDoFinanceiro } from "./abas";
import { NotasRecebidas } from "./notas-recebidas";
import { PedirNotas } from "./pedir-notas";
import { Softwares } from "./softwares";
import { lerAba } from "./vocabulario";
import { hojeNaAgencia } from "@/lib/dominio/datas";

export const metadata: Metadata = { title: "Financeiro" };

/**
 * O financeiro da agência — DUAS ABAS (0095).
 *
 * Decisão do usuário: *"Preciso que o financeiro tenha apenas duas abas, a aba
 * de visualizar as notas recebidas, e pagar, ou recusar, e a aba de Softwares -
 * em que a pessoa responsável consegue fazer controle, de todos os gastos da
 * agência"*. As duas são sobre dinheiro SAINDO, e é isso que as põe na mesma
 * tela: a nota que o sócio marca como paga vira, no mesmo instante, uma linha
 * da aba ao lado — `nota_paga_vira_despesa()` desde a 0065.
 *
 * SOMENTE SÓCIO, e a guarda são três camadas independentes:
 *
 *   1. o item não aparece no menu de quem não é sócio (`roles: SOCIO` em
 *      permissions.ts) — o que NÃO é proteção, só arrumação;
 *   2. `exigirAcessoARota` devolve HTTP 403 para quem digitar o endereço;
 *   3. a RLS de `finance_categories`, `finance_entries` e `team_invoices`
 *      recusa quem não é sócio mesmo chamando a API do Supabase direto. Esta é
 *      a que vale.
 *
 * O desenvolvedor é gestão para todo o resto do sistema e aqui não. Está
 * escrito por extenso na migration 0013, junto com a razão — e a aba de notas
 * recebidas é a folha de pagamento da agência vista de outro ângulo, o que
 * torna a regra mais apertada e não menos.
 */
export default async function PaginaDoFinanceiro({
  searchParams,
}: PageProps<"/painel/financeiro">) {
  await exigirAcessoARota("/painel/financeiro");
  const parametros = await searchParams;

  const aba = lerAba(parametros.aba);

  // Hoje e a competência saem daqui e descem prontos. Se cada tela lesse o
  // próprio relógio, o navegador em outro fuso classificaria um vencimento
  // como atrasado enquanto o contador do cartão ainda o daria em dia.
  const hojeISO = hojeNaAgencia();
  const mes = typeof parametros.mes === "string" ? parametros.mes : undefined;
  const competencia = competenciaDaChave(mes, hojeISO);

  // O ÚLTIMO PEDIDO DESTE MÊS DESCE COM A PÁGINA, e não é buscado pelo
  // diálogo: ele responde "eu já pedi?", que é a pergunta de quem está olhando
  // o botão — buscá-la ao abrir faria a resposta chegar depois da dúvida.
  const pedidos = await pedidosDeNota(competencia);

  // O SELO DA ABA CONTA A FILA INTEIRA, nunca o que sobrou do filtro de mês ou
  // de pessoa: ele diz quantas notas esperam conferência, e um número que
  // encolhe porque o sócio escolheu setembro cobraria menos do que existe. O
  // corte por estado é o mesmo da fila — `porColunaDaFila()` —, e não um
  // `filter` escrito aqui: dois lugares nomeando os estados é onde um deles
  // esquece do estado novo.
  //
  // ELE CUSTA UMA CONSULTA NAS DUAS ABAS, e é escolha: um selo que só aparece
  // quando a pessoa já está na aba das notas não cobra nada de quem abriu os
  // gastos — que é justamente quem precisa saber que há nota esperando.
  const fila = await filaDeNotas();
  const aConferir = porColunaDaFila(fila).enviada.length;

  return (
    <div className="space-y-6">
      {/* Sem `PageHeader`: a topbar já diz "Financeiro". O botão subiu para
          a barra de contexto e o `<h1>` mora nela, invisível. */}
      <AbasDoFinanceiro
        atual={aba}
        aConferir={aConferir}
        acoes={
          <PedirNotas
            competencia={competencia}
            hojeISO={hojeISO}
            pedidoAnterior={
              pedidos[0]
                ? {
                    quantasPessoas: pedidos[0].quantasPessoas,
                    criadoEm: pedidos[0].criadoEm,
                  }
                : null
            }
          />
        }
      />

      {aba === "notas" ? (
        <NotasRecebidas notas={fila} />
      ) : (
        <Suspense
          key={competencia}
          fallback={<LoadingSkeleton variant="table" rows={6} />}
        >
          <ConteudoDosGastos competencia={competencia} hojeISO={hojeISO} />
        </Suspense>
      )}
    </div>
  );
}

async function ConteudoDosGastos({
  competencia,
  hojeISO,
}: {
  competencia: string;
  hojeISO: string;
}) {
  const [gastos, vencidos, clientes, categorias] = await Promise.all([
    lancamentosDaCompetencia(competencia, hojeISO),
    gastosVencidos(hojeISO),
    listarClientes(),
    listarCategorias(),
  ]);

  return (
    <Softwares
      gastos={gastos}
      vencidos={vencidos}
      // Cliente desativado continua na lista de filtro: o histórico dele
      // existe, e escondê-lo faria o gasto antigo sumir do filtro sem sumir
      // do total.
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      categorias={categorias}
      competencia={competencia}
      hojeISO={hojeISO}
    />
  );
}
