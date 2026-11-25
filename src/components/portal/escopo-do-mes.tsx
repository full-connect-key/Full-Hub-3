import {
  COR_DO_NIVEL_DO_ESCOPO,
  escopoParaOCliente,
  fraseDoItem,
  nivelDoEscopo,
  percentualUsado,
  quantoSobra,
  rotuloDaCompetencia,
  type LinhaDoEscopo,
} from "@/lib/dominio/escopo";
import { cn } from "@/lib/utils";

/**
 * Quanto do contrato mensal a conta já usou (migration 0149).
 *
 * Decisão do usuário: *"deve aparecer um espaço onde mostra quantos % do
 * escopo do contrato mensal, o cliente já usou (…) assim, o cliente vai saber
 * quantos posts ele ainda tem direito, e outras informações em aberto"*.
 *
 * ---------------------------------------------------------------------------
 * **O NÚMERO É O DO ITEM, e a porcentagem vem depois dele.** Ele pediu a
 * porcentagem e a frase diz por quê: *"quantos posts ele ainda tem direito"* —
 * o que decide alguma coisa é **"7 de 12"** e **"5 em aberto"**; 58% é a
 * leitura de relance. Com a porcentagem na frente, quem abre para saber
 * quantos posts sobram faz a conta de cabeça.
 *
 * ---------------------------------------------------------------------------
 * **ELE SOME QUANDO A CONTA NÃO TEM ESCOPO**, e isso não é zelo: medido, 21
 * das 21 contas ativas não têm nenhum item cadastrado hoje. Um bloco vazio em
 * toda tela inicial do portal seria uma caixa dizendo que a agência não
 * preencheu nada — e a regra dos blocos de exceção desta casa é que o que não
 * tem o que dizer não é desenhado.
 *
 * ---------------------------------------------------------------------------
 * **O NOME DA EMPRESA SÓ APARECE COM DUAS**, que é a decisão de
 * `empresaUnicaDoAcervo()`: quem responde por uma conta já sabe de quem é o
 * contrato, e o nome repetido em cada bloco é a mesma palavra duas vezes.
 */
export function EscopoDoMes({
  competencia,
  contas,
}: {
  competencia: string;
  contas: { nome: string; linhas: LinhaDoEscopo[] }[];
}) {
  // O FILTRO É AQUI E NÃO NA LEITURA, pela razão escrita em
  // `escopoParaOCliente()`: a ficha da agência precisa da linha desativada
  // para reativá-la, e o portal não pode mostrar um item que saiu do contrato.
  const comEscopo = contas
    .map((c) => ({ ...c, linhas: escopoParaOCliente(c.linhas) }))
    .filter((c) => c.linhas.length > 0);

  if (comEscopo.length === 0) return null;

  const umaConta = comEscopo.length === 1;

  return (
    <section aria-label="O escopo do seu contrato" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          O seu contrato em {rotuloDaCompetencia(competencia).toLowerCase()}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          O que foi contratado por mês, e quanto já foi usado. A Full atualiza
          estes números conforme o trabalho sai.
        </p>
      </div>

      <div className="space-y-4">
        {comEscopo.map((conta) => (
          <div
            key={conta.nome}
            className="bg-surface-card rounded-card shadow-cartao border-border border p-5"
          >
            {umaConta ? null : (
              <h3 className="mb-4 text-sm font-semibold">{conta.nome}</h3>
            )}
            <ul className="divide-y">
              {conta.linhas.map((linha) => (
                <ItemDoEscopo key={linha.item.id} linha={linha} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ItemDoEscopo({ linha }: { linha: LinhaDoEscopo }) {
  const { item } = linha;
  const pct = percentualUsado(linha);
  const nivel = nivelDoEscopo(linha);
  const sobra = quantoSobra(linha);
  const medida = item.unidade?.trim() ? ` ${item.unidade.trim()}` : "";
  const alem = linha.usado - item.quantidade;

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 text-sm font-medium">
          {item.descricao}
        </span>
        <span className="text-sm tabular-nums">
          {linha.usado}{" "}
          <span className="text-text-muted">
            de {item.quantidade}
            {medida}
          </span>
        </span>
        {/* A PORCENTAGEM VEM DEPOIS DO NÚMERO, e em tom secundário: ela é a
            leitura de relance, e o que decide algo é quanto sobra. */}
        <span className="text-text-muted w-10 text-right text-xs tabular-nums">
          {pct}%
        </span>
      </div>

      {/* A BARRA PARA EM 100 e o texto diz o resto: uma barra mais larga que a
          caixa estouraria a linha, e o "além do contratado" já está escrito. */}
      <div
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={fraseDoItem(linha)}
      >
        <div
          className={cn("h-full rounded-full", COR_DO_NIVEL_DO_ESCOPO[nivel])}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <p className="text-text-muted text-xs">
        {alem > 0
          ? `${alem}${medida} além do contratado neste mês`
          : sobra === 0
            ? "o contrato do mês foi usado por inteiro"
            : `${sobra}${medida} em aberto`}
        {/* A OBSERVAÇÃO É O QUE A AGÊNCIA ESCREVEU, e ela existe para o mês em
            que o número sozinho não explica — os extras aprovados por e-mail,
            o mês em que a conta pausou. */}
        {linha.observacao?.trim() ? ` · ${linha.observacao.trim()}` : null}
      </p>
    </li>
  );
}
