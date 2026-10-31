import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import {
  faltaMontar,
  ROTULO_DO_TIPO,
  type ComposicaoDaCampanha,
} from "@/lib/dominio/campanhas";

/**
 * A COMPOSIÇÃO DA CAMPANHA — quantos de cada tipo, e onde cada tipo está.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário, item 5: *"uma campanha pode ter 10 posts estáticos, 5
 * carrosséis, 3 vídeos, 15 stories, 2 banners e 1 landing page"*, com
 * *"registro da quantidade planejada, produzida, entregue, aprovada e
 * pendente de ajustes"*.
 * ---------------------------------------------------------------------------
 *
 * **SÓ A PLANEJADA É GRAVADA**, e as outras cinco são contadas das folhas por
 * `composicao_da_campanha()` (0122). É a regra do produto inteiro: o que dá
 * para calcular não se guarda, senão são duas verdades e a guardada é a que
 * envelhece — é `atraso` não ser coluna e `maoDoPost()` pela enésima vez.
 *
 * **É TABELA E NÃO SEIS LADRILHOS DE NÚMERO.** A pergunta desta seção é uma
 * comparação — quantos foram combinados contra quantos existem, por tipo —, e
 * comparação é o que uma tabela faz e uma fileira de cartões não: o olho
 * desce a coluna. Seis cartões por tipo seriam trinta e seis números soltos
 * numa campanha de seis tipos.
 *
 * **A SEÇÃO SOME QUANDO NÃO HÁ NADA A DIZER**, que é a regra dos blocos de
 * exceção do Início: uma campanha anterior à 0122, ou montada à mão sem
 * classificar nada, não tem composição — e uma tabela vazia dizendo "nenhum
 * tipo" ocuparia espaço em toda visita para informar em algumas.
 */
export function ComposicaoDaCampanhaPainel({
  composicao,
}: {
  composicao: ComposicaoDaCampanha[];
}) {
  if (composicao.length === 0) return null;

  const falta = faltaMontar(composicao);
  const totais = composicao.reduce(
    (soma, l) => ({
      planejada: soma.planejada + l.planejada,
      criadas: soma.criadas + l.criadas,
      produzidas: soma.produzidas + l.produzidas,
      entregues: soma.entregues + l.entregues,
      aprovadas: soma.aprovadas + l.aprovadas,
      emAjustes: soma.emAjustes + l.emAjustes,
    }),
    {
      planejada: 0,
      criadas: 0,
      produzidas: 0,
      entregues: 0,
      aprovadas: 0,
      emAjustes: 0,
    },
  );

  return (
    <section className="bg-surface-card rounded-card shadow-cartao space-y-4 border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">A composição</h2>
        <p className="text-text-muted text-sm tabular-nums">
          {totais.planejada > 0
            ? `${totais.criadas} de ${totais.planejada} peças montadas`
            : `${totais.criadas} peça(s)`}
        </p>
      </div>

      {/* FALTA MONTAR É UMA FRASE PRÓPRIA, e ela conta `criadas` e não
          `aprovadas`: "falta montar" quer dizer que alguém ainda vai CRIAR a
          peça, e "falta aprovar" é outra coisa, que a barra de progresso lá
          em cima já responde. Esta linha existe para pegar a campanha que
          combinou quinze stories e tem dez.

          `--warning` e nunca `--danger`: uma campanha incompleta no meio do
          mês é o estado normal dela, não um erro. */}
      {falta > 0 ? (
        <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-sm">
          {falta === 1
            ? "Falta montar 1 peça do que foi combinado."
            : `Faltam montar ${falta} peças do que foi combinado.`}
        </p>
      ) : null}

      {/* A TABELA ROLA NA PRÓPRIA CAIXA, e não a página: sete colunas de
          número não cabem em 375px, e `overflow-x-auto` no contêiner dela é
          o que impede o corpo da página de rolar para o lado.

          E ELA É UMA REGIÃO FOCÁVEL, o que a legenda do Calendário Full
          recusou — a diferença é o que está dentro. Lá a saída foi NÃO ROLAR,
          porque a fileira era estática e cabia quebrando de linha: um
          `tabIndex` numa lista que não decide nada é uma parada de teclado
          para ler o que já estava à vista. Aqui o conteúdo é uma COMPARAÇÃO
          entre sete colunas de número, e empilhá-la por tipo destruiria a
          coluna, que é a única coisa que a tabela faz melhor que uma lista.
          Quando rolar é o conteúdo, a resposta do axe é dar ao teclado como
          chegar nele — com nome, senão o leitor de tela anuncia uma região
          sem dizer de quê. */}
      <div
        className="focus-visible:ring-ring overflow-x-auto rounded-md focus-visible:ring-2 focus-visible:outline-none"
        tabIndex={0}
        role="region"
        aria-label="A composição da campanha por tipo de material"
      >
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-text-secondary border-b text-left">
              <th scope="col" className="py-2 pr-3 font-medium">
                Tipo
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Combinado
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Montadas
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Produzidas
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Entregues
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Aprovadas
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Em ajustes
              </th>
            </tr>
          </thead>
          <tbody>
            {composicao.map((linha) => (
              <tr key={linha.tipo} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {ROTULO_DO_TIPO[linha.tipo]}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {linha.planejada > 0 ? linha.planejada : "—"}
                </td>
                {/* MONTADAS CONTRA COMBINADO é a única célula com cor, e ela
                    acende só quando falta: um tom em toda linha faria a
                    tabela inteira parecer um alerta. */}
                <td
                  className={`py-2 pr-3 text-right tabular-nums ${
                    linha.criadas < linha.planejada ? "text-warning" : ""
                  }`}
                >
                  {linha.criadas}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {linha.produzidas}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {linha.entregues}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {linha.aprovadas}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {linha.emAjustes > 0 ? linha.emAjustes : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* A BARRA REPETE O QUE A COLUNA DIZ, e é de propósito: a tabela
          responde "onde está cada TIPO" e a barra responde "onde está a
          campanha" — de relance, sem somar sete linhas de cabeça. É o
          subtítulo da Home contra a lista dela: o número do alto sai da MESMA
          conta que desenha as linhas, então não há dois fatos. */}
      {totais.criadas > 0 ? (
        <BarraDeProgresso
          nome="Produção"
          valor={totais.produzidas}
          total={totais.criadas}
          tom={totais.produzidas === totais.criadas ? "sucesso" : "marca"}
          rotulo={`${totais.produzidas} de ${totais.criadas} peças com arquivo subido`}
        />
      ) : null}

      <p className="text-text-muted text-xs">
        <strong>Produzida</strong> é a peça que já tem arquivo subido — não o
        status dela. <strong>Entregue</strong> é a que foi enviada ao cliente.
        Só o combinado é guardado; o resto é contado das peças.
      </p>
    </section>
  );
}
