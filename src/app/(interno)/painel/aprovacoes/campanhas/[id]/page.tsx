import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ListChecks } from "lucide-react";

import { CapaDaCampanha } from "../../capa-da-campanha";
import { EditarCampanha } from "../../editar-campanha";
import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import {
  analiseDosEntregaveis,
  entregaveisDaCampanha,
  obterCampanha,
  urlsDosArquivos,
  versoesDoEntregavel,
} from "@/lib/dados/campanhas";
import { enderecoDaArte } from "@/lib/dados/conteudo";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import {
  emArvore,
  folhas,
  periodoCurto,
  progresso,
  ROTULO_DA_CAMPANHA,
} from "@/lib/dominio/campanhas";

import { ArvoreDeProducao } from "./arvore-de-producao";

export const metadata: Metadata = { title: "Campanha" };

/**
 * A CAMPANHA PELO LADO DE CÁ — onde a equipe sobe o material.
 *
 * **Não é área nova, e não precisava ser.** `deliverable_versions` nasceu na
 * 0033 com número de versão, arquivo, justificativa e autor, com o trigger
 * que numera e o que sincroniza a capa; o bucket privado e as quatro policies
 * também. Mais de uma versão já funcionava e a justificativa já tinha coluna
 * — o que nunca existiu foi a tela. É exatamente a situação em que o Social
 * Media estava até a 0042: o Portal pronto, o lado de cá inexistente.
 *
 * Então o lugar onde a equipe sobe o material da campanha é a própria
 * campanha. Um módulo separado de arquivos criaria um segundo lugar para
 * procurar a mesma arte — e o entregável, que é quem o cliente decide,
 * continuaria apontando para o primeiro.
 *
 * **As duas portas ficam no topo**, e elas respondem a perguntas diferentes:
 * "como isto está chegando para o cliente" abre o portal daquela empresa, e
 * "quem está com o quê" abre a demanda. A segunda só aparece quando a
 * campanha tem demanda — as anteriores à 0051 não têm.
 */
export default async function PaginaDaCampanha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirAcessoARota("/painel/aprovacoes");
  const { id } = await params;

  const campanha = await obterCampanha(id);
  if (!campanha) notFound();

  // QUEM EDITA É QUEM ABRE, e a pergunta vai ao BANCO pela mesma RPC que o
  // botão "Nova campanha" usa — `is_atendimento()`, a de `campaigns_insert`
  // desde a 0054. Escrever a regra em TypeScript ("desenvolvedor ou sócio")
  // divergiria da policy: quem é do Atendimento abre campanha sendo
  // colaborador. E ela não é a trava — `campaigns_protege_colunas` (0078)
  // recusa quem chamar a API direto; esta linha só decide se o botão aparece.
  const podeEditar = await souDoAtendimento();

  const entregaveis = await entregaveisDaCampanha(campanha.id);
  const arvore = emArvore(entregaveis);
  const itens = folhas(arvore);
  const conta = progresso(itens);

  // UMA ASSINATURA PARA A TELA INTEIRA, e não uma por item: o bucket é
  // privado, a URL vale uma hora, e quinze itens seriam quinze idas à rede
  // em série para desenhar uma lista.
  const miniaturas = await urlsDosArquivos(itens.map((i) => i.thumbnailUrl));

  const versoes = Object.fromEntries(
    await Promise.all(
      itens.map(
        async (item) => [item.id, await versoesDoEntregavel(item.id)] as const,
      ),
    ),
  );

  // O ESTADO DO AVAL INTERNO DE CADA PEÇA, numa consulta para a árvore
  // inteira. É ele que decide entre "Enviar para análise" e "Enviar ao
  // cliente", e a pergunta é a MESMA que `validar_nova_rodada` faz no banco —
  // esta existe só para escrever a frase do botão desligado.
  const analise = await analiseDosEntregaveis(
    itens.map((i) => ({ id: i.id, versaoAtual: i.versaoAtual })),
  );

  const arquivosDasVersoes = await urlsDosArquivos(
    Object.values(versoes).flatMap((lista) =>
      lista.flatMap((v) => [v.arteUrl, ...v.arquivos]),
    ),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/painel/aprovacoes"
        className="text-text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Voltar às campanhas
      </Link>

      <PageHeader
        title={campanha.nome}
        actions={
          <div className="flex flex-wrap gap-2">
            {podeEditar ? (
              <EditarCampanha
                campanhaId={campanha.id}
                nome={campanha.nome}
                descricao={campanha.descricao}
                dataInicio={campanha.dataInicio}
                dataFim={campanha.dataFim}
                status={campanha.status}
                tudoAprovado={conta.total > 0 && conta.aprovados === conta.total}
              />
            ) : null}
            {campanha.taskId ? (
              <Button variant="outline" asChild>
                <Link href={`/painel/gestao-tasks/${campanha.taskId}`}>
                  <ListChecks aria-hidden className="size-4" />
                  Abrir a demanda
                </Link>
              </Button>
            ) : null}
            {campanha.slug ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/portal/${campanha.slug}/campanhas/${campanha.id}`}
                >
                  <ExternalLink aria-hidden className="size-4" />
                  Ver como o cliente vê
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* A IDENTIDADE DA CAMPANHA VIROU UMA LINHA, e não mais uma pilha.
          A capa ocupava a largura inteira com 160px de altura e empurrava a
          barra de progresso — que é o número que a pessoa veio ver — para
          baixo da dobra num notebook. Agora ela é um quadrado de 150px à
          esquerda, e o cliente, o período, o status e o progresso ocupam a
          coluna ao lado: a mesma altura, com a informação dentro dela.

          A capa é `quadrada` aqui e `larga` no cartão da grade, e as duas
          continuam sendo o MESMO componente — o que muda é a proporção que
          cada tela pede, não o desenho. Numa faixa 16/6 de 150px de largura a
          imagem teria 56px de altura, que não reconhece campanha nenhuma.

          E A LINHA NÃO EMPILHA NO CELULAR, ao contrário de quase tudo neste
          produto. Empilhada ela custava o que a linha veio consertar: em
          390px a capa quadrada ocupa a largura inteira, fica com uns 330px de
          altura, e a barra de progresso volta para baixo da dobra — o mesmo
          problema de antes, só que pior, porque agora a imagem é maior. Foi a
          imagem de 390px que mostrou. Então a capa encolhe para 96px e a
          linha continua sendo uma linha: uma composição só, uma proporção só,
          em toda largura. */}
      <section className="bg-surface-card rounded-card shadow-cartao flex items-start gap-4 border p-4">
        {/* ---------------------------------------------- a capa, e o lugar --
            AQUI SE PÕE A CAPA, e até agora não se punha em lugar nenhum que
            alguém abrisse. O uploader existe desde a 0050 e morava SÓ no
            cartão da listagem; esta tela — que é onde a equipe trabalha a
            campanha, sobe arquivo e envia — desenhava a capa quando ela
            existia e nada quando não existia.

            O resultado é o que o usuário viu do outro lado: a campanha chega
            ao portal do cliente sem imagem, porque o único lugar de subir uma
            é um cartão numa grade que ninguém abre para isso. **A capa
            existe para a campanha ser reconhecida de relance (0050), e uma
            capa que ninguém consegue pôr não reconhece nada.**

            `vazia` é o que faz a moldura pontilhada aparecer quando não há
            capa — ela é a única coisa na tela que diz onde clicar, e é a
            razão de o componente ter essa bandeira desde que nasceu. */}
        <div className="w-24 shrink-0 sm:w-[150px]">
          <CapaDaCampanha
            campanhaId={campanha.id}
            clienteId={campanha.clienteId}
            nome={campanha.nome}
            capaAssinada={campanha.capaAssinada}
            temCapa={Boolean(campanha.capaUrl)}
            podeTrocar
            proporcao="quadrada"
            className="w-full"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-text-muted text-sm tabular-nums">
            {campanha.cliente}
            <span aria-hidden> · </span>
            {periodoCurto(campanha.dataInicio, campanha.dataFim)}
            <span aria-hidden> · </span>
            <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
          </p>

          {conta.total > 0 ? (
            <BarraDeProgresso
              nome="Materiais aprovados"
              valor={conta.aprovados}
              total={conta.total}
              tom={conta.aprovados === conta.total ? "sucesso" : "marca"}
              rotulo={`${conta.aprovados} de ${conta.total} aprovados pelo cliente`}
            />
          ) : (
            /* A FRASE PASSOU A SER VERDADE NA 0080, e até ela era uma
               promessa que o produto não cumpria: acrescentar uma etapa na
               demanda não criava peça nenhuma aqui, e a arvore de uma
               campanha era congelada no clique de "Criar campanha". Hoje o
               espelho `subtasks_espelha_no_entregavel` cria a peça — então a
               frase virou um LINK, porque mandar alguém procurar a demanda
               sozinho quando ela está a um clique é gastar a frase. */
            <p className="text-text-muted text-sm">
              Esta campanha ainda não tem material.{" "}
              {campanha.taskId ? (
                <Link
                  href={`/painel/gestao-tasks/${campanha.taskId}`}
                  className="text-accent-strong hover:underline"
                >
                  Acrescente uma etapa na demanda
                </Link>
              ) : (
                "Acrescente uma etapa na demanda"
              )}{" "}
              — cada etapa vira uma peça aqui.
            </p>
          )}
        </div>
      </section>

      <ArvoreDeProducao
        clienteId={campanha.clienteId}
        arvore={arvore}
        miniaturas={Object.fromEntries(
          itens.map((i) => [
            i.id,
            enderecoDaArte(i.thumbnailUrl, miniaturas) ?? "",
          ]),
        )}
        versoes={versoes}
        assinadas={arquivosDasVersoes}
        analise={Object.fromEntries(analise)}
        ehGestao={ehGestor(sessao.profile.role)}
      />
    </div>
  );
}
