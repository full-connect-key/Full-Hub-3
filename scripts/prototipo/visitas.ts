import type { Resultado } from "@/lib/acoes/tipos";

/**
 * AS ROTAS MAIS USADAS, NO PROTÓTIPO (0142).
 *
 * ---------------------------------------------------------------------------
 * **A ORDEM É FIXA AQUI, e é ela que a imagem confere.** No produto ela vem do
 * peso de cada pessoa, que decai com meia-vida de 30 dias; aqui ela é um
 * literal, porque o que a imagem precisa provar é que o cartão **deixou de
 * mostrar a lista fixa** — e com `[]` ele cai no fallback, que é exatamente a
 * tela de antes. A entrega nova não sairia em imagem nenhuma: é a duplicata do
 * Cronograma, pela enésima vez.
 * ---------------------------------------------------------------------------
 *
 * **E A PRIMEIRA NÃO É `/painel/minhas-tasks`, de propósito.** Aquela é a
 * primeira do fallback, então com ela no topo as duas respostas dariam a mesma
 * imagem — e a imagem provaria que o cartão desenha, não que ele **aprendeu**.
 * A ordem aqui é a de quem passa o dia na Gestão de Tasks: ela sobe, e "Meu
 * Perfil" — que é fixo no terceiro lugar da lista velha — cai fora das três.
 *
 * **SÃO CINCO E O CARTÃO MOSTRA TRÊS**, e as duas a mais existem para ser
 * CORTADAS: é o que prova o teto. Com três devolvidas e três desenhadas, a
 * imagem não distinguiria "corta em três" de "mostra o que vier" — e a quarta
 * é justamente `/painel/minhas-tasks`, que é a primeira do fallback: ela fica
 * de fora, que é o resultado que só a ordem aprendida produz.
 *
 * **E A MESMA LISTA DÁ TRÊS CARTÕES DIFERENTES, que é a mão dupla do
 * `check:sprint9` aplicada a um cartão.** O stub é um só e os dois filtros são
 * da tela, então cada perfil corta num lugar:
 *
 *   - o SÓCIO fica com Gestão de Tasks, Social Media e Solicitações;
 *   - a pessoa do ATENDIMENTO perde a primeira (`/painel/gestao-tasks` é
 *     `GESTAO`) e ganha Minhas Tasks no lugar;
 *   - a REDATORA perde aquela E Solicitações (que é `exigeAtendimento`, e
 *     `exigeAtendimento` não é perfil — é o que `canAccess` não responde), e
 *     fica com Social Media, Minhas Tasks e Calendário.
 *
 * É por isso que a lista tem cinco e não três: com três, o corte de perfil não
 * teria de onde puxar a substituta, e as três imagens sairiam com uma linha a
 * menos cada — o cartão encolhendo em vez de filtrar.
 *
 * **E O PESO NÃO APARECE AQUI**, porque ele não aparece na resposta: a função
 * devolve a ORDEM, e o número é como ela foi calculada — a razão está na
 * assinatura, em `lib/dados/visitas.ts`. Um stub com pesos inventados seria um
 * molde mais largo que o do produto.
 */
export async function minhasRotasMaisUsadas(): Promise<string[]> {
  return [
    "/painel/gestao-tasks",
    "/painel/social-media",
    "/painel/solicitacoes",
    "/painel/minhas-tasks",
    "/painel/calendario",
  ];
}

/**
 * O GRAVADOR DA VISITA, NO PROTÓTIPO.
 *
 * ---------------------------------------------------------------------------
 * **ELE ENTRA AQUI PELA RAZÃO DA BUSCA E DO TOUR: a action mora no LAYOUT.**
 * `GravadorDeVisitas` é montado em toda tela do painel, então sem o stub as
 * cento e cinquenta telas da rodada fariam um POST de Server Action que vai
 * ao Supabase num domínio `.invalid` — cento e cinquenta recusas no log, numa
 * rodada em que o que se procura são os achados do axe.
 *
 * É o segundo stub de _action_ do gerador, e a razão é a que o primeiro
 * escreveu: *"é decisão explícita quando valer"*. Aqui ela vale pelo número de
 * telas, que é o mesmo argumento dos stubs da busca e do tour.
 * ---------------------------------------------------------------------------
 *
 * **ELE NÃO GRAVA NADA, e nem tem onde:** o stub de leitura devolve a ordem
 * fixa, então o peso que ele somaria não mudaria imagem nenhuma. O que ele faz
 * é devolver `ok` sem sair da máquina.
 *
 * **E o tipo vem de `lib/acoes/tipos`, nunca de `lib/acoes/resultado`** — a
 * lição que o stub de `quemPodeAprovar` pagou: trocada por um módulo comum, a
 * action é compilada no bundle do cliente, e `resultado.ts` tem
 * `import "server-only"`.
 */
export async function registrarVisita(_href: string): Promise<Resultado> {
  return { ok: true, mensagem: "Visita registrada.", dados: undefined };
}
