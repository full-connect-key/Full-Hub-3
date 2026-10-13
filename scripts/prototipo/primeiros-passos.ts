/**
 * Versao de prototipo de src/lib/dados/primeiros-passos.ts.
 *
 * **O PADRAO E `null`, que e o bloco AUSENTE** -- e sem isso ele apareceria nas
 * telas de quem esta na agencia ha anos, que e o estado em que ele nao existe.
 * Quem o mostra e a Luiza (`Audiovisual`), que ja fez o tour e ainda esta se
 * ambientando: com o Pedro (`Design`), o dialogo de boas-vindas cobriria
 * justamente o bloco que ele cita.
 *
 * E DOIS DE CINCO FEITOS, nao zero e nem quatro: o zero nao prova que o risco
 * do item concluido funciona, e com quatro a contagem do cabecalho diria "4 de
 * 5" sobre uma lista em que quase tudo esta riscado -- nenhuma das duas mostra
 * a lista como ela e na primeira semana.
 */
export type PrimeiroPasso = {
  chave: string;
  titulo: string;
  href: string | null;
  feito: boolean;
};

export type PrimeirosPassos = {
  itens: PrimeiroPasso[];
  pendentes: number;
  recemChegada: boolean;
};

/**
 * A FUNCAO E O DISCRIMINADOR, e nao `USUARIO_EXEMPLO.id`: aquele e fixo, e a
 * pessoa logada vem de `NOMES[chaveDoUsuario()]` no stub de `dal.ts`. Foi a
 * imagem que mostrou -- lendo o id, o bloco nao saiu em tela nenhuma.
 */
function persona(): string {
  return process.env["PROTOTIPO_FUNCAO"] ?? "";
}

export async function meusPrimeirosPassos(): Promise<PrimeirosPassos | null> {
  const quem = persona();
  if (quem !== "Audiovisual" && quem !== "Design") return null;

  const itens: PrimeiroPasso[] = [
    {
      chave: "tour",
      titulo: "Fazer o tour do painel",
      href: null,
      feito: quem === "Audiovisual",
    },
    {
      chave: "foto",
      titulo: "Colocar sua foto de perfil",
      href: "/painel/perfil",
      feito: true,
    },
    {
      chave: "playbooks",
      titulo: "Ler os playbooks obrigatórios da sua função",
      href: "/painel/academy",
      feito: false,
    },
    {
      chave: "etapa",
      titulo: "Concluir sua primeira etapa",
      href: "/painel/minhas-tasks",
      feito: false,
    },
    {
      chave: "full-day",
      titulo: "Propor seu primeiro período no Full Days",
      href: "/painel/full-days?aba=solicitar",
      feito: false,
    },
  ];

  return {
    itens,
    pendentes: itens.filter((i) => !i.feito).length,
    recemChegada: true,
  };
}
