import { AtualizacaoAoVivo } from "@/components/shared/atualizacao-ao-vivo";

/**
 * A linha embaixo do título de cada tela do portal: de quem é esta conta.
 *
 * Ela entra como `subtitulo` do `PageHeader`, que já tem a forma que a proposta
 * pede — título grande, a linha de contexto embaixo, as ações à direita. Um
 * cabeçalho próprio do portal seria o segundo componente respondendo à mesma
 * pergunta, e o que divergiria é este, que vive numa área que a equipe
 * raramente abre.
 *
 * ---------------------------------------------------------------------------
 * **"· ATUALIZADO AGORA" NÃO ENTRA COMO TEXTO FIXO, e no lugar dele vai o
 * indicador de verdade.** A frase está no protótipo, e ela é renderizada uma
 * vez: um minuto depois ela afirma uma coisa que ninguém conferiu, e numa
 * aba esquecida aberta ela mente a tarde inteira. É a regra que o corpo do
 * aviso do sino já paga — ele leva a DATA e nunca a palavra "hoje" — e a
 * razão pela qual o "agora" do feed de Recomendações desce do servidor.
 *
 * O `AtualizacaoAoVivo` responde a mesma coisa e responde certo: ele diz que
 * a tela se atualiza sozinha enquanto a inscrição está de pé, e **aparece
 * também quando ela cai**. Um indicador que só nasce no erro ensina que a
 * ausência dele é boa notícia — e aí o dia em que ele sumir de um layout por
 * engano passa por "está tudo bem".
 * ---------------------------------------------------------------------------
 */
export function LinhaDaConta({
  nomeDaEmpresa,
  iniciais,
  extra,
}: {
  nomeDaEmpresa: string | null;
  /** As iniciais da empresa, para o selo azul do protótipo. */
  iniciais?: string | null;
  /** O que a tela quiser acrescentar depois do nome — uma contagem, um período. */
  extra?: React.ReactNode;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {iniciais ? (
        <span className="bg-action-soft text-action-text rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide">
          {iniciais}
        </span>
      ) : null}
      {nomeDaEmpresa ? (
        <span className="text-text-secondary font-medium">{nomeDaEmpresa}</span>
      ) : null}
      {extra ? (
        <>
          <span aria-hidden className="text-text-muted">
            ·
          </span>
          {extra}
        </>
      ) : null}
      <AtualizacaoAoVivo className="ml-1" />
    </span>
  );
}
