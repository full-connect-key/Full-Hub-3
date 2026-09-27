import "server-only";

import { hojeNaAgencia } from "@/lib/dominio/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ouFalha } from "@/lib/dados/consulta";
import { assinarArquivos } from "@/lib/dados/conteudo";
import { BUCKET_DAS_FOTOS } from "@/lib/dominio/comodatos";
import type {
  AssetEstado,
  AssetEventoTipo,
  AssetStatus,
  AssetTipo,
} from "@/lib/supabase/database.types";

/**
 * A leitura dos comodatos.
 *
 * ---------------------------------------------------------------------------
 * **DUAS PORTAS, E ELAS NÃO SÃO A MESMA CONSULTA COM UM `if`.**
 *
 * A gestão lê `assets` direto — a policy é dela. O colaborador passa por
 * `meus_comodatos()`, que é `security definer` e devolve o recorte sem
 * `valor_aquisicao` e sem a nota fiscal. É a decisão da 0069, e ela é de
 * segurança: a linha do equipamento está fora do alcance dele, então não há
 * consulta de colaborador a escrever aqui — há uma chamada de função.
 * ---------------------------------------------------------------------------
 *
 * **`ouFalha()` em tudo**, e aqui ele vale como nas Métricas: a recusa destas
 * consultas chega como ERRO, e sem ele um inventário vazio leria como "a
 * agência não tem equipamento" para quem simplesmente não pode ver.
 */

const HOJE = () => hojeNaAgencia();

export type MeuComodato = {
  loan_id: string;
  asset_id: string;
  codigo: string | null;
  tipo: AssetTipo;
  nome: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  foto_url: string | null;
  foto: string | null;
  data_entrega: string;
  data_prevista_devolucao: string | null;
  data_devolucao: string | null;
  estado_entrega: AssetEstado;
  estado_devolucao: AssetEstado | null;
  acessorios: string | null;
  observacoes_entrega: string | null;
  aceito_em: string | null;
  devolvido: boolean;
};

/** O que está e o que esteve comigo. Vazio para quem não é da equipe. */
export async function meusComodatos(): Promise<MeuComodato[]> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha("meus comodatos", await supabase.rpc("meus_comodatos"));

  const assinadas = await assinarArquivos(
    BUCKET_DAS_FOTOS,
    (linhas ?? []).map((l) => l.foto_url),
  );

  return (linhas ?? []).map((l) => ({
    ...l,
    foto: l.foto_url ? (assinadas[l.foto_url] ?? null) : null,
  }));
}

export type ItemDoInventario = {
  id: string;
  codigo: string | null;
  tipo: AssetTipo;
  nome: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  status: AssetStatus;
  estado: AssetEstado;
  valor_aquisicao: number | null;
  foto_url: string | null;
  foto: string | null;
  // ELAS VÊM PORQUE O DIÁLOGO DE EDIÇÃO AS ESCREVE. Um formulário que abre com
  // o campo vazio apaga o que não mostrou, no primeiro save de quem só queria
  // corrigir o modelo.
  observacoes: string | null;
  data_aquisicao: string | null;
  // A FICHA TÉCNICA (0070). Ela vem pela mesma razão das duas de cima: o
  // diálogo de edição escreve os quatro, e um formulário que abre com o campo
  // vazio apaga o que não mostrou.
  memoria_ram: string | null;
  processador: string | null;
  placa_de_video: string | null;
  armazenamento: string | null;
  comodato: {
    id: string;
    user_id: string;
    pessoa: string;
    pessoa_ativa: boolean;
    avatar: string | null;
    data_entrega: string;
    data_prevista_devolucao: string | null;
    aceito_em: string | null;
  } | null;
};

// UMA STRING LITERAL, e não duas concatenadas: o tipo do `select` do
// PostgREST é inferido do literal, e um `"..." + "..."` colapsa o retorno em
// `GenericStringError` — o erro sai onde a linha é LIDA, três funções adiante,
// falando de `foto_url`. É a mesma família do `ouFalha(... .maybeSingle())`.
const COLUNAS_DO_ITEM =
  "id, codigo, tipo, nome, marca, modelo, numero_serie, status, estado, valor_aquisicao, foto_url, observacoes, data_aquisicao, memoria_ram, processador, placa_de_video, armazenamento";

/**
 * O inventário inteiro, com quem está com cada item.
 *
 * **O comodato aberto vem numa SEGUNDA consulta, e não num embutido.** O
 * PostgREST recusa o `select` inteiro quando não acha a relação pelo nome
 * escrito — foi assim que uma campanha recém-criada não apareceu em lugar
 * nenhum (Sprint 13). Duas idas ao banco custam menos que essa classe de bug,
 * e aqui a segunda ainda precisa do nome da pessoa, que mora em `profiles`.
 */
export async function inventario(): Promise<ItemDoInventario[]> {
  const supabase = await criarClienteServidor();

  const itens = ouFalha(
    "inventário de comodatos",
    await supabase.from("assets").select(COLUNAS_DO_ITEM).order("codigo"),
  );
  if (!itens || itens.length === 0) return [];

  const abertos = ouFalha(
    "comodatos em aberto",
    await supabase
      .from("asset_loans")
      .select("id, asset_id, user_id, data_entrega, data_prevista_devolucao, aceito_em")
      .is("data_devolucao", null),
  );

  const pessoas = await nomesDaEquipe((abertos ?? []).map((l) => l.user_id));
  const porAsset = new Map((abertos ?? []).map((l) => [l.asset_id, l]));

  const assinadas = await assinarArquivos(
    BUCKET_DAS_FOTOS,
    itens.map((i) => i.foto_url),
  );

  return itens.map((item) => {
    const aberto = porAsset.get(item.id);
    const pessoa = aberto ? pessoas.get(aberto.user_id) : undefined;
    return {
      ...item,
      foto: item.foto_url ? (assinadas[item.foto_url] ?? null) : null,
      comodato: aberto
        ? {
            id: aberto.id,
            user_id: aberto.user_id,
            pessoa: pessoa?.nome ?? "pessoa removida",
            pessoa_ativa: pessoa?.ativo ?? false,
            avatar: pessoa?.avatar_url ?? null,
            data_entrega: aberto.data_entrega,
            data_prevista_devolucao: aberto.data_prevista_devolucao,
            aceito_em: aberto.aceito_em,
          }
        : null,
    };
  });
}

async function nomesDaEquipe(ids: string[]) {
  const limpos = [...new Set(ids)];
  if (limpos.length === 0) return new Map<string, { nome: string; ativo: boolean; avatar_url: string | null }>();

  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes da equipe nos comodatos",
    await supabase.from("profiles").select("id, nome, ativo, avatar_url").in("id", limpos),
  );
  return new Map((linhas ?? []).map((p) => [p.id, p]));
}

export type IndicadoresDoInventario = {
  total: number;
  emprestados: number;
  disponiveis: number;
  manutencao: number;
  atrasados: number;
  comDesligado: number;
  semAceite: number;
};

/**
 * Os números do painel.
 *
 * **Contados aqui e não por uma função do Postgres**, ao contrário das
 * Métricas: eles saem do MESMO array que a tabela desenha, então não há como o
 * cartão dizer cinco e a lista mostrar três — que é o defeito que o contador
 * de atrasadas da Gestão de Tasks acabou de pagar.
 */
export function indicadoresDoInventario(itens: ItemDoInventario[]): IndicadoresDoInventario {
  const hoje = HOJE();
  const vivos = itens.filter((i) => i.status !== "baixado");
  const abertos = itens.map((i) => i.comodato).filter((c) => c !== null);

  return {
    total: vivos.length,
    emprestados: vivos.filter((i) => i.status === "emprestado").length,
    disponiveis: vivos.filter((i) => i.status === "disponivel").length,
    manutencao: vivos.filter((i) => i.status === "manutencao").length,
    atrasados: abertos.filter(
      (c) => c.data_prevista_devolucao !== null && c.data_prevista_devolucao < hoje,
    ).length,
    // O CASO QUE CUSTA DINHEIRO, e por isso ele tem cartão próprio.
    comDesligado: abertos.filter((c) => !c.pessoa_ativa).length,
    semAceite: abertos.filter((c) => c.aceito_em === null).length,
  };
}

export type PessoaComEquipamento = {
  user_id: string;
  nome: string;
  ativo: boolean;
  avatar: string | null;
  itens: ItemDoInventario[];
};

/**
 * "Por pessoa" — e quem não tem nada aparece no fim, e não fora.
 *
 * Ler "a Marina não está na lista" como "ela não tem equipamento" é uma
 * conclusão que a tela deixa a pessoa tirar sozinha, e ela também pode ser
 * "a lista está filtrada". Dizer zero é dizer.
 */
export async function porPessoa(itens: ItemDoInventario[]): Promise<PessoaComEquipamento[]> {
  const supabase = await criarClienteServidor();
  const equipe = ouFalha(
    "equipe dos comodatos",
    await supabase
      .from("profiles")
      .select("id, nome, ativo, avatar_url")
      .neq("role", "cliente")
      .order("nome"),
  );

  const porDono = new Map<string, ItemDoInventario[]>();
  for (const item of itens) {
    if (!item.comodato) continue;
    const lista = porDono.get(item.comodato.user_id) ?? [];
    lista.push(item);
    porDono.set(item.comodato.user_id, lista);
  }

  const linhas: PessoaComEquipamento[] = (equipe ?? []).map((p) => ({
    user_id: p.id,
    nome: p.nome,
    ativo: p.ativo,
    avatar: p.avatar_url,
    itens: porDono.get(p.id) ?? [],
  }));

  // Com equipamento primeiro, e entre elas quem tem mais; sem nada no fim.
  return linhas.sort((a, b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome));
}

/**
 * Um equipamento só, para a folha dele.
 *
 * **Ela não reaproveita `inventario()` filtrando em memória**, e a razão é a
 * mesma pela qual a consulta do inventário só acontece para a gestão: trazer
 * sessenta linhas e o comodato aberto de todas para desenhar uma é uma ida ao
 * banco que não responde a pergunta desta tela.
 *
 * Devolve `null` quando não há linha — e a página responde 404, que é o certo:
 * sem linha é a RLS dizendo "isto não é seu", e erro é o `select` recusado
 * inteiro, que `ouFalha()` estoura antes de chegar aqui.
 */
export async function equipamento(id: string): Promise<ItemDoInventario | null> {
  const supabase = await criarClienteServidor();

  // `.limit(1)` e não `.maybeSingle()`: o genérico de `ouFalha` colapsa para
  // `never` com o segundo, e o erro sai três arquivos adiante.
  const linhas = ouFalha(
    "equipamento",
    await supabase.from("assets").select(COLUNAS_DO_ITEM).eq("id", id).limit(1),
  );
  const item = linhas?.[0];
  if (!item) return null;

  const abertos = ouFalha(
    "comodato aberto do equipamento",
    await supabase
      .from("asset_loans")
      .select("id, asset_id, user_id, data_entrega, data_prevista_devolucao, aceito_em")
      .eq("asset_id", id)
      .is("data_devolucao", null)
      .limit(1),
  );
  const aberto = abertos?.[0];

  const pessoas = await nomesDaEquipe(aberto ? [aberto.user_id] : []);
  const pessoa = aberto ? pessoas.get(aberto.user_id) : undefined;
  const assinadas = await assinarArquivos(BUCKET_DAS_FOTOS, [item.foto_url]);

  return {
    ...item,
    foto: item.foto_url ? (assinadas[item.foto_url] ?? null) : null,
    comodato: aberto
      ? {
          id: aberto.id,
          user_id: aberto.user_id,
          pessoa: pessoa?.nome ?? "pessoa removida",
          pessoa_ativa: pessoa?.ativo ?? false,
          avatar: pessoa?.avatar_url ?? null,
          data_entrega: aberto.data_entrega,
          data_prevista_devolucao: aberto.data_prevista_devolucao,
          aceito_em: aberto.aceito_em,
        }
      : null,
  };
}

export type LinhaDaFolha = {
  id: string;
  tipo: AssetEventoTipo;
  texto: string | null;
  estado: AssetEstado | null;
  pessoa: string | null;
  quem: string | null;
  created_at: string;
};

/** A folha corrida de um equipamento, do mais novo para o mais antigo. */
export async function folhaDoEquipamento(assetId: string): Promise<LinhaDaFolha[]> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "folha do equipamento",
    await supabase
      .from("asset_events")
      .select("id, tipo, texto, estado, pessoa_id, registrado_por, created_at")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
  );

  const pessoas = await nomesDaEquipe([
    ...(linhas ?? []).map((l) => l.pessoa_id),
    ...(linhas ?? []).map((l) => l.registrado_por),
  ].filter((id): id is string => Boolean(id)));

  return (linhas ?? []).map((l) => ({
    id: l.id,
    tipo: l.tipo,
    texto: l.texto,
    estado: l.estado,
    pessoa: l.pessoa_id ? (pessoas.get(l.pessoa_id)?.nome ?? null) : null,
    // "SISTEMA" E NÃO EM BRANCO quando não há sessão — o seed e as rotinas
    // escrevem sem ninguém logado, e um espaço vazio parece defeito da tela.
    // É a mesma escolha da trilha de auditoria.
    quem: l.registrado_por ? (pessoas.get(l.registrado_por)?.nome ?? "sistema") : "sistema",
    created_at: l.created_at,
  }));
}

/** O que ainda está com uma pessoa — o que o desligamento precisa saber. */
export async function comodatosEmAbertoDe(userId: string) {
  const supabase = await criarClienteServidor();
  return (
    ouFalha(
      "comodatos em aberto da pessoa",
      await supabase.rpc("comodatos_em_aberto_de", { p_user_id: userId }),
    ) ?? []
  );
}

export async function modeloDoTermo(): Promise<string> {
  const supabase = await criarClienteServidor();
  // `limit(1)` E NAO `maybeSingle()`, e o motivo esta escrito em
  // `calendario.ts`: a resposta de `maybeSingle` e uma UNIAO de duas formas, e
  // a inferencia de `ouFalha` colapsa as duas em `never` -- o tipo some e tudo
  // depois vira erro de compilacao. Aqui a tabela tem uma linha so por
  // desenho, entao nao ha o que o `maybeSingle` proteja.
  const linhas = ouFalha(
    "modelo do termo",
    await supabase.from("asset_term_template").select("corpo").limit(1),
  );
  return linhas[0]?.corpo ?? "";
}

/** Tudo o que o PDF do termo precisa, numa ida. */
export async function comodatoParaOTermo(loanId: string) {
  const supabase = await criarClienteServidor();
  const achados = ouFalha(
    "comodato do termo",
    await supabase
      .from("asset_loans")
      .select(
        "id, user_id, data_entrega, acessorios, estado_entrega, termo_corpo, aceito_em, asset_id",
      )
      .eq("id", loanId)
      .limit(1),
  );
  const comodato = achados[0];
  if (!comodato) return null;

  const pessoas = await nomesDaEquipe([comodato.user_id]);

  // O EQUIPAMENTO VEM DE `meus_comodatos()` QUANDO QUEM PEDE É O DONO, porque
  // `assets` é da gestão: sem isso, a pessoa baixaria um termo sem o nome do
  // equipamento nele — que é a única coisa que o termo existe para descrever.
  const meus = ouFalha("comodato do termo (recorte)", await supabase.rpc("meus_comodatos"));
  const meu = (meus ?? []).find((m) => m.loan_id === loanId);

  let equipamento = meu
    ? { codigo: meu.codigo, nome: meu.nome, marca: meu.marca, modelo: meu.modelo, numero_serie: meu.numero_serie }
    : null;

  if (!equipamento) {
    const linhas = ouFalha(
      "equipamento do termo",
      await supabase
        .from("assets")
        .select("codigo, nome, marca, modelo, numero_serie")
        .eq("id", comodato.asset_id)
        .limit(1),
    );
    equipamento = linhas[0] ?? null;
  }
  if (!equipamento) return null;

  return {
    comodato,
    equipamento,
    pessoa: pessoas.get(comodato.user_id)?.nome ?? "—",
  };
}

/** As fotos de um comodato, já assinadas. */
export async function fotosDoComodato(loanId: string) {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "fotos do comodato",
    await supabase
      .from("asset_photos")
      .select("id, momento, url")
      .eq("loan_id", loanId)
      .order("created_at"),
  );
  const assinadas = await assinarArquivos(BUCKET_DAS_FOTOS, (linhas ?? []).map((f) => f.url));
  return (linhas ?? []).map((f) => ({ ...f, assinada: assinadas[f.url] ?? null }));
}
