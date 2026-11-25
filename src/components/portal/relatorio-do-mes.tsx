import { TrendingUp } from "lucide-react";

import {
  montarRelatorio,
  numeroNaTela,
  type NumeroDoRelatorio,
} from "@/lib/dominio/relatorio-do-social";
import { ROTULO_DA_PLATAFORMA } from "@/lib/dominio/posts";

/**
 * O desempenho do mês, no portal (itens 17 e 18 do pedido).
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"gostaria que no Social Media, aparecesse um relatório
 * preenchido com os dados do social, como visualização, curtidas e afins, para
 * o cliente ter essas informações o tempo todo (…)"*.
 *
 * **"O TEMPO TODO" É O QUE DECIDE O LUGAR DELE.** Ele não é uma nona entrada na
 * navegação do portal: ele mora DENTRO do mês de social, que é a tela em que o
 * cliente já entra para olhar o mês — uma aba própria faria o relatório de
 * outubro ficar a dois cliques do mês de outubro, com um seletor de mês do lado
 * de um seletor de mês. É a decisão do Cronograma vista do outro lado: aquela
 * tela existe porque a pergunta dela não tinha resposta em lugar nenhum; esta
 * tem, e é a tela ao lado.
 *
 * **E ELE VEM DEPOIS DO CABEÇALHO DO LOTE E ANTES DOS FILTROS**, que é a ordem
 * escrita naquela tela: o lote diz o que CHEGOU, o relatório diz como foi o que
 * já saiu, e os filtros são como se recorta o que chegou. Depois dos filtros,
 * ele leria como o resultado de um filtro.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * **"QUE OS DADOS APAREÇAM SEMPRE QUANDO FOREM POSITIVOS" É O ITEM 18, e a
 * leitura que ficou é esta:** o NÚMERO aparece sempre, e a COMPARAÇÃO com o mês
 * anterior aparece só quando ela é um ganho.
 *
 * A outra leitura — esconder o número que caiu — foi recusada, e a razão é a da
 * recusa que nomeia cada uma delas (0023): um relatório com oito métricas em
 * novembro e cinco em dezembro faz o cliente perguntar quais sumiram, e a
 * resposta é pior que o número. **Pinta-se a exceção**, que é a decisão da
 * matriz do Day Off: o ganho é a exceção, e é ele que ganha cor.
 *
 * ***E O QUE ISSO CUSTA ESTÁ DITO:*** num mês em que tudo caiu, o relatório sai
 * sem um único selo verde — os números estão todos lá, e nada afirma que foi um
 * mês bom. O mês anterior continua publicado e alcançável pela navegação de
 * mês, então a queda não é escondida: ela deixa de ser APONTADA.
 * ---------------------------------------------------------------------------
 */
export function RelatorioDoMes({
  contas,
}: {
  contas: {
    nome: string;
    numeros: NumeroDoRelatorio[];
    anteriores: NumeroDoRelatorio[];
  }[];
}) {
  // A SEÇÃO NÃO É DESENHADA QUANDO NENHUMA CONTA TEM NÚMERO PUBLICADO, que é a
  // regra dos blocos de exceção do Início: uma caixa dizendo "nenhum relatório
  // deste mês" apareceria em todo mês que a social media ainda não fechou —
  // informando em alguns e ocupando a primeira dobra em todos.
  const comNumeros = contas
    .map((conta) => ({
      nome: conta.nome,
      blocos: montarRelatorio(conta.numeros, conta.anteriores),
    }))
    .filter((conta) => conta.blocos.length > 0);

  if (comNumeros.length === 0) return null;

  // O NOME DA EMPRESA SÓ APARECE COM DUAS, que é `empresaUnicaDoAcervo()`
  // palavra por palavra: quem responde por uma conta não precisa que a tela
  // diga qual é.
  const nomeia = comNumeros.length > 1;

  return (
    <section aria-label="Desempenho do mês" className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Desempenho do mês</h2>
        <p className="text-text-muted text-sm">
          Os números das redes neste mês, informados pela Full.
        </p>
      </div>

      <div className="space-y-3">
        {comNumeros.map((conta) => (
          <div
            key={conta.nome}
            className="bg-card rounded-card border-input space-y-4 border p-4"
          >
            {nomeia ? (
              <p className="text-sm font-medium">{conta.nome}</p>
            ) : null}

            {conta.blocos.map((bloco) => (
              <div key={bloco.plataforma} className="space-y-2">
                <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
                  {ROTULO_DA_PLATAFORMA[bloco.plataforma]}
                </p>

                {/* A GRADE É O QUE ALINHA UMA REDE COM A DE BAIXO, e é a
                    decisão da faixa de meses do cartão da conta: em
                    `flex-wrap` cada número fica do tamanho do próprio texto, e
                    o "Curtidas" do Instagram não cai na mesma coluna que o do
                    Facebook — que é justamente a comparação que alguém faz
                    olhando duas redes do mesmo mês. */}
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {bloco.linhas.map((linha) => (
                    <div key={linha.metrica} className="min-w-0">
                      <dt className="text-text-muted truncate text-xs">
                        {linha.rotulo}
                      </dt>
                      <dd className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-xl font-semibold tabular-nums">
                          {numeroNaTela(linha.valor)}
                        </span>

                        {/* O SELO DO GANHO, e só o do ganho (item 18).
                            `variacaoDaMetrica` devolve nulo quando não há mês
                            anterior publicado, quando o número caiu e quando
                            ele empatou — então a ausência do selo quer dizer
                            três coisas, e é por isso que a tela nunca escreve
                            a negativa: ela afirmaria a queda sobre um mês que
                            talvez nem tenha relatório. */}
                        {linha.variacao ? (
                          <span className="text-success flex items-center gap-0.5 text-xs font-medium">
                            <TrendingUp aria-hidden className="size-3" />
                            {linha.variacao.frase}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
