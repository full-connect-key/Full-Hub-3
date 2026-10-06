import type { FluxoDeSocial } from "@/lib/dominio/social-flows";

/**
 * Os fluxos de social, para o protótipo (migration 0087).
 *
 * **SÃO DOIS E NÃO UM**, e a razão é a da peça combinada (0082) e da Óptica
 * Visão sem responsável de atendimento (0062): com um fluxo só, a imagem
 * mostraria o produto no único estado em que a 0087 não faz diferença nenhuma
 * — um seletor com uma opção, e nenhuma corrente diferente da de sempre.
 *
 * O segundo é o caso que o usuário descreveu palavra por palavra: *"algumas
 * contas validam pauta e conteúdo, antes de ir para Produção de Layout. E após
 * o layout feito, ele também vai para aprovação do cliente"* — três portões
 * antes da entrega. E o terceiro é o DESATIVADO, que é o único estado em que o
 * selo "Desativado" e o botão "Reativar" aparecem.
 */
export async function fluxosDeSocial(
  opcoes: { apenasAtivos?: boolean } = {},
): Promise<FluxoDeSocial[]> {
  return opcoes.apenasAtivos ? FLUXOS.filter((f) => f.ativo) : FLUXOS;
}

const CASA: FluxoDeSocial = {
  id: "f1000000-0000-4000-8000-000000000001",
  nome: "Padrão da casa",
  descricao:
    "A corrente que a agência percorre desde sempre. Só o envio passa pelo cliente.",
  ativo: true,
  etapas: [
    {
      ordem: 10,
      nome: "Pauta",
      funcao: "Social Media",
      papel: "producao",
      aprovacao_cliente: false,
      campo: "pauta",
    },
    {
      ordem: 20,
      nome: "Conteúdo",
      funcao: "Redator",
      papel: "producao",
      aprovacao_cliente: false,
      campo: "legenda",
    },
    {
      ordem: 30,
      nome: "Layout",
      funcao: "Design",
      papel: "producao",
      aprovacao_cliente: false,
      campo: null,
    },
    {
      ordem: 40,
      nome: "Envio",
      funcao: "Gestao",
      papel: "entrega",
      aprovacao_cliente: false,
      campo: null,
    },
    {
      ordem: 50,
      nome: "Programar",
      funcao: "Social Media",
      papel: "pos_entrega",
      aprovacao_cliente: false,
      campo: null,
    },
  ],
};

const FLUXOS: FluxoDeSocial[] = [
  CASA,
  {
    id: "f1000000-0000-4000-8000-00000000000a",
    nome: "Três avaliações antes da arte",
    descricao:
      "A conta valida a pauta, o texto e a arte, cada um na vez dele, antes de o material sair como peça fechada.",
    ativo: true,
    etapas: CASA.etapas.map((e) => ({
      ...e,
      aprovacao_cliente: e.papel === "producao",
    })),
  },
  {
    id: "f1000000-0000-4000-8000-00000000000b",
    nome: "Sem programação",
    descricao: "A conta publica por conta própria; a agência entrega a peça.",
    ativo: false,
    etapas: CASA.etapas
      .filter((e) => e.papel !== "pos_entrega")
      .map((e) => ({ ...e })),
  },
];
