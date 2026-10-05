import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import {
  campanhasDoCliente,
  entregaveisDaCampanha,
} from "@/lib/dados/campanhas";
import {
  emArvore,
  folhas,
  periodoCurto,
  progresso,
  ROTULO_DA_CAMPANHA,
} from "@/lib/dominio/campanhas";

import { ApagarCampanha } from "./apagar-campanha";
import { ClientesDasCampanhas } from "./clientes-das-campanhas";
import { CapaDaCampanha } from "./capa-da-campanha";

export const metadata: Metadata = { title: "Campanhas" };

/**
 * A entrada das campanhas pelo lado da agência, na versão mínima.
 *
 * **Isto NÃO é o gerenciador**, que é de outro momento: não dá para editar a
 * estrutura, subir arquivo nem enviar entregável por aqui. O que existe é a
 * lista do que foi aberto, a capa de cada uma e o caminho para abrir mais.
 *
 * A contagem é a MESMA do portal, pela mesma função: se a tela da agência
 * contasse por conta própria, as duas dariam números diferentes no dia em que
 * alguém mexesse numa delas.
 *
 * **ERA UMA LISTA DE LINHAS, e virou uma grade de cartões** por causa da
 * capa (0050): "identificável direto pela imagem qual campanha é" não cabe
 * numa linha de 56px de altura, e a imagem que coubesse ali seria pequena
 * demais para reconhecer.
 *
 * **O cartão inteiro não é um link**, e não é descuido: a capa carrega os
 * botões de trocar e tirar, e botão dentro de âncora é elemento interativo
 * dentro de elemento interativo — o clique vai para um dos dois conforme o
 * navegador, e o teclado tabula para um controle que não existe na árvore de
 * acessibilidade. Quem leva ao portal é o título.
 */
export default async function PaginaDeAprovacoes({
  searchParams,
}: PageProps<"/painel/aprovacoes">) {
  const sessao = await exigirAcessoARota("/painel/aprovacoes");
  const parametros = await searchParams;

  // A ROTA JÁ É DE GESTÃO, e a pergunta é feita mesmo assim: o dia em que
  // `/painel/aprovacoes` abrir para o colaborador — como o Social Media
  // abriu, pelo argumento de que quem produz precisa chegar ao trabalho dele
  // —, a rota deixa de responder por quem apaga. Quem responde é a policy
  // `campaigns_delete`, que é `is_gestor()` desde a 0033, e esta linha é a
  // mesma pergunta escrita na tela.
  const podeApagar = ehGestor(sessao.profile.role);

  // ABRIR CAMPANHA É DE QUEM ABRE DEMANDA, e a pergunta vai ao BANCO com
  // `is_atendimento()` — a mesma que `campaigns_insert` faz desde a 0054 e
  // que `tasks_insert` faz desde a 0006. Repetir a regra em TypeScript
  // ("desenvolvedor ou sócio") divergiria da policy na primeira vez que
  // alguém mexesse numa das duas: perfil de acesso e função na agência são
  // coisas diferentes, e quem é do Atendimento abre demanda sendo
  // colaborador.
  const podeAbrir = await souDoAtendimento();

  // ---------------------------------------------------------------------------
  // O FILTRO POR CLIENTE (decisão do usuário), e ele é UMA consulta só.
  //
  // A lista inteira é lida e o recorte acontece aqui, em memória, em vez de
  // passar o cliente para `campanhasDoCliente()`. Não é economia: é que a
  // coluna lateral mostra QUANTAS cada conta tem, e com a consulta já
  // filtrada o número das outras não existiria — seriam dez consultas para
  // desenhar dez linhas, ou uma segunda contagem que divergiria da lista na
  // primeira vez que alguém mexesse numa das duas. É a decisão do contador de
  // Minhas Tasks, que sai da mesma função que desenha as linhas.
  //
  // **A árvore de entregáveis, essa é buscada só das visíveis**: ela é uma
  // consulta por campanha, e filtrar depois de buscar todas seria pagar dez
  // idas ao banco para desenhar duas.
  // ---------------------------------------------------------------------------
  const [todas, clientes] = await Promise.all([
    campanhasDoCliente(),
    listarClientes(),
  ]);

  const quantasPorCliente = new Map<string, number>();
  for (const c of todas) {
    quantasPorCliente.set(
      c.clienteId,
      (quantasPorCliente.get(c.clienteId) ?? 0) + 1,
    );
  }

  // ID DESCONHECIDO VOLTA PARA "Todas", como `ehVisao()` volta para o mês e
  // `lerMes()` normaliza: parâmetro torto na URL cai no padrão, nunca numa
  // tela que não se explica.
  const pedido =
    typeof parametros.cliente === "string" ? parametros.cliente : null;
  const escolhido =
    pedido && clientes.some((c) => c.id === pedido) ? pedido : null;

  const campanhas = escolhido
    ? todas.filter((c) => c.clienteId === escolhido)
    : todas;
  const arvores = await Promise.all(
    campanhas.map((c) => entregaveisDaCampanha(c.id)),
  );

  const nomeEscolhido = escolhido
    ? (clientes.find((c) => c.id === escolhido)?.nome_empresa ?? null)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        actions={
          podeAbrir ? (
            <Button asChild>
              <Link href="/painel/aprovacoes/campanhas/nova">
                <Plus aria-hidden className="size-4" />
                Nova campanha
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <ClientesDasCampanhas
          clientes={clientes.map((c) => ({
            id: c.id,
            nome: c.nome_empresa,
            quantas: quantasPorCliente.get(c.id) ?? 0,
          }))}
          total={todas.length}
          escolhido={escolhido}
        />

        <div>
          {campanhas.length === 0 ? (
            <EmptyState
              title={
                nomeEscolhido
                  ? `Nenhuma campanha da ${nomeEscolhido}`
                  : "Nenhuma campanha aberta"
              }
              description={
                /* O VAZIO FILTRADO DIZ OUTRA COISA do vazio da agência: "abra a
               primeira" numa conta sem campanha, com outras oito abertas ao
               lado, é a tela afirmando que nada existe. A coluna continua
               mostrando onde há. */
                nomeEscolhido
                  ? "Esta conta não tem campanha por aqui. As outras continuam na coluna ao lado."
                  : podeAbrir
                    ? "Abra a primeira e a estrutura de entregáveis nasce junto, a partir de um modelo."
                    : "Quando o Atendimento abrir uma campanha, as peças que forem suas aparecem aqui."
              }
            />
          ) : (
            /* DUAS COLUNAS E NÃO TRÊS, e é consequência da coluna de clientes:
           com 280px a menos, a terceira deixaria cada cartão com uns 275px —
           e a capa, que é 16/6, viraria uma faixa de 103px de altura. A capa
           existe para a campanha ser reconhecida de relance (0050), e abaixo
           disso ela não reconhece nada. */
            <ul className="grid gap-4 sm:grid-cols-2">
              {campanhas.map((campanha, i) => {
                const conta = progresso(folhas(emArvore(arvores[i])));
                // O TÍTULO ABRE A TELA DE PRODUÇÃO, e não mais o portal daquele
                // cliente. Era o portal porque a tela de cá não existia; agora
                // existe, e é onde a equipe sobe arquivo, escreve a justificativa
                // e envia. O portal continua a um clique, no topo de lá.
                const href = `/painel/aprovacoes/campanhas/${campanha.id}`;

                return (
                  <li
                    key={campanha.id}
                    className="bg-surface-card rounded-card shadow-cartao flex flex-col gap-3 border p-4"
                  >
                    <CapaDaCampanha
                      campanhaId={campanha.id}
                      clienteId={campanha.clienteId}
                      nome={campanha.nome}
                      capaAssinada={campanha.capaAssinada}
                      temCapa={Boolean(campanha.capaUrl)}
                      podeTrocar
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={href}
                        className="hover:text-accent-strong block text-[15px] font-bold tracking-[-0.015em] transition-colors"
                      >
                        {campanha.nome}
                      </Link>

                      <p className="text-text-muted text-sm tabular-nums">
                        {campanha.cliente}
                        <span aria-hidden> · </span>
                        {periodoCurto(campanha.dataInicio, campanha.dataFim)}
                        <span aria-hidden> · </span>
                        <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
                      </p>
                    </div>

                    {/* `mt-auto` gruda o pé no fim do cartão: sem ele, o cartão
                    cujo período quebra em duas linhas empurra a conta para
                    baixo e a grade fica com três números em três alturas
                    diferentes — que é justamente o que se compara.

                    E APAGAR FICA NO PÉ, longe do título que abre o portal:
                    ação que encerra alguma coisa vai para o fim, como as da
                    demanda no detalhe da Task. */}
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <p className="text-text-muted text-sm tabular-nums">
                        {conta.aprovados} de {conta.total} aprovados
                      </p>
                      {podeApagar ? (
                        <ApagarCampanha
                          campanhaId={campanha.id}
                          nome={campanha.nome}
                          materiais={conta.total}
                          aprovados={conta.aprovados}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
