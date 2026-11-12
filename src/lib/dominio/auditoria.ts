/**
 * O vocabulário da auditoria.
 *
 * ---------------------------------------------------------------------------
 * OS RÓTULOS MORAM AQUI, e é a mesma razão de `ROTULOS_DE_TIPO` no Full Days:
 * o que vem do banco é nome de tabela e nome de coluna — a camada em inglês,
 * que a convenção manda deixar como está. Desenhar isso cru poria
 * `finance_entries` e `link_entrega` na tela de quem usa o sistema.
 *
 * E aqui vale duas vezes: a pessoa que abre a auditoria está procurando o que
 * aconteceu, não decifrando o schema. "Lançamento financeiro" e "pasta de
 * entrega" respondem; `finance_entries.link_entrega` manda ela adivinhar.
 * ---------------------------------------------------------------------------
 */

export type Operacao = "INSERT" | "UPDATE" | "DELETE";

/**
 * O que cada tabela é, em português.
 *
 * **Uma tabela sem rótulo aparece com o nome cru, e não escondida.** É a mesma
 * escolha de `ROTULOS_DE_TIPO`: o `??` devolve a chave. Se alguém acrescentar
 * uma tabela à lista da 0058 e esquecer o rótulo, a linha aparece feia — e
 * aparecer feia é muito melhor que não aparecer, porque a auditoria que omite
 * é a que não serve para nada.
 */
export const ROTULOS_DE_TABELA: Record<string, string> = {
  profiles: "Perfil de acesso",
  clients: "Cliente",
  client_users: "Acesso ao portal",
  team_members: "Ficha da equipe",
  // `contracts` SAIU DA LISTA com a tabela (0095): um rótulo para uma tabela
  // que não existe é prosa mantida à mão afirmando que ela existe, lida por
  // quem está procurando uma linha dela. O laço da 0058 pula o que
  // `to_regclass()` não acha, então nenhuma linha nova aponta para lá — e as
  // ANTIGAS, essas continuam no log com `contracts` cru, que é o desenho: o
  // `??` devolve a chave, e aparecer feia é melhor que não aparecer.
  finance_entries: "Gasto",
  finance_categories: "Categoria de gasto",
  hr_requests: "Day Off",
  tasks: "Demanda",
  subtasks: "Etapa",
  campaigns: "Campanha",
  posts: "Post",
  deliverables: "Material de campanha",
};

/**
 * O verbo, e ele muda de peso por operação.
 *
 * "Apagou" é o único que não dá para desfazer nem reconstruir, e é o que a
 * pessoa está procurando quando abre esta tela. Por isso ele é o tom de erro
 * na tabela, e os outros dois não.
 */
export const ROTULOS_DE_OPERACAO: Record<Operacao, string> = {
  INSERT: "Criou",
  UPDATE: "Mudou",
  DELETE: "Apagou",
};

/** Nome de coluna → o que a pessoa chama aquilo. */
export const ROTULOS_DE_COLUNA: Record<string, string> = {
  role: "perfil de acesso",
  ativo: "situação",
  nome: "nome",
  nome_empresa: "nome da empresa",
  slug: "endereço do portal",
  email: "e-mail",
  telefone: "telefone",
  cargo: "cargo",
  funcao: "função na agência",
  area: "área",
  valor: "valor",
  status: "situação",
  competencia: "competência",
  vencimento: "vencimento",
  pagamento: "pagamento",
  dias_uteis: "dias",
  inicio: "início",
  fim: "fim",
  data_inicio: "início",
  data_fim: "fim",
  prazo: "prazo",
  capacidade_minutos_dia: "capacidade por dia",
  dias_ferias_ano: "dias de day off por ciclo",
  max_parcelas_ferias: "parcelas de day off",
  deve_trocar_senha: "precisa trocar a senha",
  link_entrega: "pasta de entrega",
  titulo: "título",
  client_id: "cliente",
  user_id: "pessoa",
  criado_por: "criado por",
  created_at: "criado em",
  descricao: "descrição",
  observacoes: "observações",
};

export function rotuloDaColuna(coluna: string): string {
  return ROTULOS_DE_COLUNA[coluna] ?? coluna.replaceAll("_", " ");
}

export function rotuloDaTabela(tabela: string): string {
  return ROTULOS_DE_TABELA[tabela] ?? tabela;
}

/**
 * O valor, em texto legível.
 *
 * **Nulo vira "(vazio)" e não string vazia.** Numa linha que diz "mudou o
 * telefone de para 11 9999-9999", o espaço em branco parece defeito da tela;
 * "(vazio)" diz que o campo não tinha nada, que é a informação.
 *
 * **Booleano vira sim/não**, porque `true` na tela de quem usa o sistema é a
 * camada em inglês vazando pelo mesmo buraco dos nomes de coluna.
 */
export function valorLegivel(valor: unknown): string {
  if (valor === null || valor === undefined) return "(vazio)";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (typeof valor === "string") {
    const limpo = valor.trim();
    if (limpo === "") return "(vazio)";
    // TEXTO LONGO É CORTADO, e o corte é dito. Um briefing inteiro numa célula
    // de tabela empurra tudo o mais para fora da tela — e o que a auditoria
    // precisa responder é "mudou", não "mudou para exatamente este texto".
    return limpo.length > 80 ? `${limpo.slice(0, 80)}…` : limpo;
  }
  if (typeof valor === "number") return String(valor);
  return JSON.stringify(valor);
}

/**
 * `mudancasDe()` E `MudancaDeCampo` SAÍRAM, e a ausência é decisão do usuário:
 * *"pode tirar da auditoria a parte de o que mudou"* (0135).
 *
 * Elas montavam o diff campo por campo, e a tabela deixou de desenhá-lo em
 * todo estado. **Apagar e não aposentar**, que é a decisão da 0023: um
 * `export` sem chamador atravessa o `tsc`, o `lint` e o `build`, e é o que
 * alguém reaproveita três sprints depois achando que a tela ainda mostra
 * aquilo.
 *
 * `rotuloDaColuna()` e `valorLegivel()` FICARAM, com um consumidor cada: a
 * busca da 0135 devolve o CAMPO que casou, e são os dois que o escrevem em
 * português — o nome da coluna e o valor dela.
 */

/**
 * As tabelas que o filtro oferece.
 *
 * Sai do mapa de rótulos, e não de uma segunda lista: duas listas divergiriam
 * na primeira tabela nova — a do filtro esqueceria uma, e o filtro passaria a
 * esconder linhas sem dizer que existem.
 */
export const TABELAS_AUDITADAS = Object.keys(ROTULOS_DE_TABELA);
