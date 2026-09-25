/**
 * Versao de prototipo de src/components/shared/atualizacao-ao-vivo.tsx.
 *
 * ELA NAO DESENHA NADA, e o motivo e um bug que a imagem mostrou.
 *
 * O gerador escreve um `.env.local` com uma URL de Supabase de mentira, para o
 * build passar. Com isso `supabaseConfigurado()` responde TRUE, o componente
 * tenta abrir o canal contra um host que nao existe, a inscricao nao fica de
 * pe -- e o aviso "Sem atualizacao ao vivo" aparecia no cabecalho de TODAS as
 * noventa telas.
 *
 * O aviso estava certo sobre o que mediu e errado sobre o que afirma: nao ha
 * atualizacao ao vivo caida aqui, ha um ambiente que nao tem Supabase. E o
 * mesmo erro que o seed cometia ao carimbar `enviado_em` em item que ninguem
 * enviou -- mostrar o produto como ele nao e, sem nada avisando.
 *
 * A imagem e a unica conferencia que pega isto: o build passa, o lint passa, e
 * o tipo passa. Foi a tela da Auditoria que mostrou, porque foi a primeira
 * gerada depois do componente entrar no layout.
 */
export function AtualizacaoAoVivo(_props: { className?: string }) {
  return null;
}
