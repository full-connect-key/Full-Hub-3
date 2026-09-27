import {
  Armchair,
  Camera,
  Aperture,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  Lightbulb,
  Mic,
  Monitor,
  Mouse,
  Package,
  Smartphone,
  Tablet,
  Video,
  type LucideIcon,
} from "lucide-react";

import type {
  AssetEstado,
  AssetEventoTipo,
  AssetStatus,
  AssetTipo,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário dos comodatos — o que os dois lados precisam saber.
 *
 * Módulo de domínio e não de dados: a tela do colaborador, a da gestão, o
 * editor do termo e a rota que monta o PDF perguntam as mesmas coisas, e uma
 * cópia por tela seria o lugar onde "Em manutenção" vira "manutenção" numa
 * delas.
 */

/** O bucket das fotos de estado. Mora aqui porque a TELA sobe o arquivo, e
 *  `lib/dados/` é `server-only` — foi o erro que o build pegou no Sprint 3E. */
export const BUCKET_DAS_FOTOS = "comodatos-fotos";

export const TIPOS_DE_ASSET = [
  "notebook",
  "desktop",
  "monitor",
  "celular",
  "tablet",
  "camera",
  "lente",
  "microfone",
  "iluminacao",
  "tripe",
  "headset",
  "teclado",
  "mouse",
  "hd_externo",
  "acessorio",
  "outro",
] as const satisfies readonly AssetTipo[];

export const ROTULOS_DE_TIPO: Record<AssetTipo, string> = {
  notebook: "Notebook",
  desktop: "Desktop",
  monitor: "Monitor",
  celular: "Celular",
  tablet: "Tablet",
  camera: "Câmera",
  lente: "Lente",
  microfone: "Microfone",
  iluminacao: "Iluminação",
  tripe: "Tripé",
  headset: "Headset",
  teclado: "Teclado",
  mouse: "Mouse",
  hd_externo: "HD externo",
  acessorio: "Acessório",
  outro: "Outro",
};

/**
 * O ÍCONE SUBSTITUI A FOTO, e é por isso que ele é por tipo e não um só.
 *
 * Equipamento recém-cadastrado não tem foto — quem cadastra vinte itens numa
 * tarde não fotografa vinte. Um ícone genérico em todos daria uma lista de
 * quadrados iguais, que é a mesma coisa que uma lista sem imagem nenhuma.
 */
export const ICONE_DO_TIPO: Record<AssetTipo, LucideIcon> = {
  notebook: Laptop,
  desktop: Monitor,
  monitor: Monitor,
  celular: Smartphone,
  tablet: Tablet,
  camera: Camera,
  lente: Aperture,
  microfone: Mic,
  iluminacao: Lightbulb,
  tripe: Video,
  headset: Headphones,
  teclado: Keyboard,
  mouse: Mouse,
  hd_externo: HardDrive,
  acessorio: Armchair,
  outro: Package,
};

export const STATUS_DE_ASSET = [
  "disponivel",
  "emprestado",
  "manutencao",
  "baixado",
] as const satisfies readonly AssetStatus[];

export const ROTULOS_DE_STATUS: Record<AssetStatus, string> = {
  disponivel: "Disponível",
  emprestado: "Emprestado",
  manutencao: "Em manutenção",
  baixado: "Baixado",
};

/** O par nomeado, nunca opacidade — a regra do produto para selo de estado. */
export const TOM_DO_STATUS: Record<AssetStatus, string> = {
  disponivel: "bg-success-soft text-success",
  emprestado: "bg-blue-soft text-blue-strong",
  manutencao: "bg-warning-soft text-warning",
  baixado: "bg-neutral-soft text-neutral",
};

export const ESTADOS = ["novo", "bom", "regular", "ruim"] as const satisfies readonly AssetEstado[];

export const ROTULOS_DE_ESTADO: Record<AssetEstado, string> = {
  novo: "Novo",
  bom: "Bom",
  regular: "Regular",
  ruim: "Ruim",
};

export const ROTULOS_DE_EVENTO: Record<AssetEventoTipo, string> = {
  cadastrado: "Cadastrado",
  emprestado: "Entregue",
  aceito: "Recebimento confirmado",
  devolvido: "Devolvido",
  manutencao: "Foi para manutenção",
  baixado: "Baixado",
  problema: "Problema reportado",
  voltou: "Voltou da manutenção",
};

/**
 * ATRASO É DERIVADO, e a conta mora aqui.
 *
 * Não existe coluna `atrasado`, pela razão de sempre: ela depende da data de
 * hoje, e uma coluna precisaria de uma rotina noturna para continuar
 * verdadeira — no dia em que ela não rodasse o painel mentiria sem avisar. É a
 * regra do Financeiro (0013) e do bloqueio de subtarefa (0007).
 *
 * `hoje` VEM DE FORA, e não de `new Date()` aqui dentro: se cada tela lesse o
 * relógio, o navegador num fuso diferente classificaria a mesma devolução de
 * outro jeito que o contador do servidor.
 */
export type SituacaoDaDevolucao = "sem_prazo" | "no_prazo" | "perto" | "atrasada" | "devolvido";

/** Dentro de quantos dias a devolução já pede atenção. */
export const DIAS_PARA_AVISAR = 7;

export function situacaoDaDevolucao(
  comodato: { data_prevista_devolucao: string | null; data_devolucao: string | null },
  hoje: string,
): SituacaoDaDevolucao {
  if (comodato.data_devolucao) return "devolvido";
  if (!comodato.data_prevista_devolucao) return "sem_prazo";
  if (comodato.data_prevista_devolucao < hoje) return "atrasada";

  const limite = new Date(`${hoje}T00:00:00`);
  limite.setDate(limite.getDate() + DIAS_PARA_AVISAR);
  return comodato.data_prevista_devolucao <= limite.toISOString().slice(0, 10)
    ? "perto"
    : "no_prazo";
}

export const TOM_DA_DEVOLUCAO: Record<SituacaoDaDevolucao, string> = {
  sem_prazo: "text-text-muted",
  no_prazo: "text-text-secondary",
  perto: "text-warning",
  atrasada: "text-danger",
  devolvido: "text-text-muted",
};

// ---------------------------------------------------------------------------
// O TERMO
// ---------------------------------------------------------------------------

/**
 * As variáveis do modelo, com a explicação ao lado.
 *
 * ELAS SÃO A MESMA LISTA que o editor mostra e que o PDF substitui, e é o que
 * impede o editor de oferecer uma variável que ninguém troca — o pior tipo de
 * campo, porque quem a escreve acha que garantiu alguma coisa e o termo sai
 * com `{{PATRIMONIO}}` impresso.
 */
export const VARIAVEIS_DO_TERMO = [
  { chave: "PESSOA", oQueE: "o nome de quem está com o equipamento" },
  { chave: "EQUIPAMENTO", oQueE: "nome, marca e modelo" },
  { chave: "PATRIMONIO", oQueE: "o código de patrimônio" },
  { chave: "SERIE", oQueE: "o número de série" },
  { chave: "ACESSORIOS", oQueE: "o que foi junto" },
  { chave: "ESTADO", oQueE: "o estado registrado na entrega" },
  { chave: "DATA_ENTREGA", oQueE: "o dia da entrega" },
  { chave: "ACEITE", oQueE: "a linha do aceite — some enquanto ninguém confirmou" },
] as const;

export type ValoresDoTermo = Partial<Record<(typeof VARIAVEIS_DO_TERMO)[number]["chave"], string>>;

/**
 * Troca as variáveis pelo que elas valem.
 *
 * **O que não tem valor vira "—", e não fica como `{{CHAVE}}`.** Um termo
 * impresso com a chave crua é um documento que a pessoa assina sem entender, e
 * "não informado" é uma resposta que o papel sabe dar.
 */
export function montarTermo(corpo: string, valores: ValoresDoTermo): string {
  return corpo.replace(/\{\{([A-Z_]+)\}\}/g, (_todo, chave: string) => {
    const valor = valores[chave as keyof ValoresDoTermo];
    return valor && valor.trim() !== "" ? valor : "—";
  });
}

/** A linha do aceite, ou vazio — ela só existe depois que a pessoa confirmou. */
export function linhaDoAceite(aceitoEm: string | null, nome: string): string {
  if (!aceitoEm) return "";
  const d = new Date(aceitoEm);
  const data = d.toLocaleDateString("pt-BR");
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Recebimento confirmado por ${nome} no Full Hub em ${data} às ${hora}.`;
}
