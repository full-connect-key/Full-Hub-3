import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente } from "@/lib/auth/dal";
import { campanhasParaEscolher } from "@/lib/dados/campanhas";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import {
  contaAceitaPedidos,
  meusPedidos,
  tiposDePedido,
} from "@/lib/dados/solicitacoes";
import { ListaDePedidos } from "./lista";
import { PainelDeNovaSolicitacao } from "./painel-de-nova-solicitacao";

export const metadata: Metadata = { title: "Solicitações" };

/**
 * Os pedidos da empresa — a única seção do Portal em que o cliente ESCREVE.
 *
 * A consulta não filtra por empresa: quem separa é `client_requests_select` no
 * banco. Repetir o filtro aqui criaria um segundo lugar onde a regra pode
 * divergir, e o lado que esquecesse seria o que mostra o pedido de um cliente
 * para outro.
 */
async function Conteudo() {
  const [pedidos, empresas, tipos, campanhas] = await Promise.all([
    meusPedidos(),
    obterMinhasEmpresas(),
    tiposDePedido(),
    // SEM `clienteId`: o RLS já recorta por empresa, e quem responde por duas
    // contas precisa das duas listas — o formulário filtra pela empresa que
    // estiver escolhida no momento.
    campanhasParaEscolher(),
  ]);

  // COM MAIS DE UMA EMPRESA, o botão aparece se QUALQUER uma aceitar — e a
  // escolha de qual acontece no formulário, que é onde ela decide alguma
  // coisa. Perguntar aqui poria um seletor de empresa acima de uma lista que
  // já mostra as duas.
  const aceitam = await Promise.all(
    empresas.map((e) => contaAceitaPedidos(e.id)),
  );

  // SÓ AS EMPRESAS QUE ACEITAM entram no painel: o formulário pergunta para
  // qual delas é o pedido, e oferecer a desligada seria oferecer um caminho
  // que o `with check` da policy recusa no clique de enviar.
  const podeAbrir = empresas.filter((_, i) => aceitam[i]);

  // AS VERTENTES SAÍRAM DAQUI (0148), e com elas uma ida ao banco por visita.
  //
  // Elas eram buscadas por `vertentesDasContas()` e desciam ao formulário, que
  // perguntava *"de que parte da sua conta é"*. Com a saída de "Onde isso
  // entra" — decisão do usuário — a pergunta não tem mais onde morar nesta
  // tela, e quem classifica o trabalho por vertente é o Atendimento na
  // demanda (`tasks.vertente_id`, 0118), que é onde ela decide o board, a
  // Biblioteca e o relatório. A função continua tendo leitores: a tela da
  // task, a abertura de campanha e a leitura das demandas.

  return (
    <>
      <ListaDePedidos
        pedidos={pedidos}
        base="/portal"
        podeAbrir={podeAbrir.length > 0}
      />

      {/* O PAINEL É MONTADO SEMPRE E SÓ ABRE COM `?novo=1`. Montá-lo no clique
          custaria uma ida ao servidor para buscar os tipos de trabalho no
          instante em que a pessoa já quer escrever — e o roteiro de briefing
          muda com o tipo, então ele precisa deles para desenhar o primeiro
          campo. */}
      {podeAbrir.length > 0 ? (
        <PainelDeNovaSolicitacao
          empresas={podeAbrir}
          tipos={tipos.filter((t) => t.ativo)}
          campanhas={campanhas}
          base="/portal"
        />
      ) : null}
    </>
  );
}

export default async function Pagina({
  searchParams,
}: PageProps<"/portal/solicitacoes">) {
  await exigirCliente();
  // `searchParams` continua sendo aguardado porque o painel de nova
  // solicitação lê `?novo=1` de dentro dele, no cliente — o que esta função
  // deixou de ler é o `?fase=`.
  await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="Solicitações" />

      {/* O `?fase=` SAIU COM AS ABAS: a coluna do quadro é a fase, e um
          recorte por fase num quadro que mostra as cinco é esconder quatro
          para olhar uma que estava à vista. Um endereço antigo com ele abre o
          quadro inteiro, que é o que um link salvo tem de fazer — abrir, e não
          quebrar. E com ele saiu a `key` do Suspense, que existia para
          remontar a lista a cada troca de aba. */}
      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
