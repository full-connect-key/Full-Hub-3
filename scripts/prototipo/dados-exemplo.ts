/**
 * Dados de exemplo usados APENAS na geracao de prototipos.
 *
 * A cada sprint, acrescente aqui as linhas ficticias do modulo novo. E o unico
 * arquivo que precisa crescer para as telas novas aparecerem nas imagens.
 *
 * Nada daqui entra no app publicado: o gerador trabalha sobre uma copia
 * temporaria do projeto (veja scripts/prototipo.mjs).
 */
import type { Profile } from "@/lib/supabase/database.types";

export const PROFILE_EQUIPE: Profile = {
  id: "a0000000-0000-0000-0000-000000000001",
  email: "ana@fullconnectkey.com.br",
  nome: "Ana Souza",
  role: "socio",
  avatar_url: null,
  ativo: true,
  created_at: "2026-01-15T10:00:00.000Z",
};

export const PROFILE_CLIENTE: Profile = {
  id: "a0000000-0000-0000-0000-000000000004",
  email: "contato@mundoverde.com.br",
  nome: "Caio Alves",
  role: "cliente",
  avatar_url: null,
  ativo: true,
  created_at: "2026-01-15T10:00:00.000Z",
};

export const USUARIO_EXEMPLO = {
  id: PROFILE_EQUIPE.id,
  email: PROFILE_EQUIPE.email,
  user_metadata: { nome: PROFILE_EQUIPE.nome },
};

export const EMPRESAS_EXEMPLO = [
  { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Mundo Verde" },
];

/** Equipe fictícia usada nas telas de Equipe e nos seletores. */
export const EQUIPE_EXEMPLO = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    email: "socia@fullconnectkey.com.br",
    nome: "Ana Souza",
    role: "socio" as const,
    avatar_url: null,
    ativo: true,
    created_at: "2021-03-01T10:00:00.000Z",
    membro: {
      id: "t1", user_id: "a0000000-0000-0000-0000-000000000001",
      cargo: "Sócia-diretora", area: "Direção", funcao: "Gestao" as const,
      data_admissao: "2021-03-01", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
      desligado_em: null, created_at: "2021-03-01T10:00:00.000Z",
    },
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    email: "dev@fullconnectkey.com.br",
    nome: "Diego Reis",
    role: "desenvolvedor" as const,
    avatar_url: null,
    ativo: true,
    created_at: "2023-08-14T10:00:00.000Z",
    membro: {
      id: "t2", user_id: "a0000000-0000-0000-0000-000000000002",
      cargo: "Desenvolvedor", area: "Tecnologia", funcao: "Desenvolvimento" as const,
      data_admissao: "2023-08-14", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
      desligado_em: null, created_at: "2023-08-14T10:00:00.000Z",
    },
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    email: "colab@fullconnectkey.com.br",
    nome: "Carla Nunes",
    role: "colaborador" as const,
    avatar_url: null,
    ativo: true,
    created_at: "2024-02-05T10:00:00.000Z",
    membro: {
      id: "t3", user_id: "a0000000-0000-0000-0000-000000000003",
      cargo: "Analista de contas", area: "Atendimento", funcao: "Atendimento" as const,
      data_admissao: "2024-02-05", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
      desligado_em: null, created_at: "2024-02-05T10:00:00.000Z",
    },
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    email: "design@fullconnectkey.com.br",
    nome: "Bruno Lima",
    role: "colaborador" as const,
    avatar_url: null,
    ativo: true,
    created_at: "2025-01-20T10:00:00.000Z",
    membro: {
      id: "t4", user_id: "a0000000-0000-0000-0000-000000000005",
      cargo: "Designer", area: "Criação", funcao: "Design" as const,
      data_admissao: "2024-06-10", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
      desligado_em: null, created_at: "2024-06-10T10:00:00.000Z",
    },
  },
  {
    id: "a0000000-0000-0000-0000-000000000006",
    email: "social@fullconnectkey.com.br",
    nome: "Marina Costa",
    role: "colaborador" as const,
    avatar_url: null,
    ativo: true,
    created_at: "2025-01-20T10:00:00.000Z",
    membro: {
      id: "t5", user_id: "a0000000-0000-0000-0000-000000000006",
      cargo: "Social media", area: "Criação", funcao: "Social Media" as const,
      data_admissao: "2025-01-20", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
      desligado_em: null, created_at: "2025-01-20T10:00:00.000Z",
    },
  },
  {
    id: "a0000000-0000-0000-0000-000000000007",
    email: "trafego@fullconnectkey.com.br",
    nome: "Rafael Dias",
    role: "colaborador" as const,
    avatar_url: null,
    ativo: true,
    created_at: "2025-04-02T10:00:00.000Z",
    membro: {
      id: "t6", user_id: "a0000000-0000-0000-0000-000000000007",
      cargo: "Analista de tráfego", area: "Mídia", funcao: "Trafego" as const,
      data_admissao: "2025-04-02", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
      desligado_em: null, created_at: "2025-04-02T10:00:00.000Z",
    },
  },
];

/** Clientes fictícios, já com responsável e contagem de acessos. */
export const CLIENTES_EXEMPLO = [
  {
    id: "c0000000-0000-0000-0000-00000000000a",
    nome_empresa: "Mundo Verde",
    nome_contato: "Caio Alves",
    email_contato: "contato@mundoverde.com.br",
    telefone: "(11) 98888-0001",
    drive_folder_id: null,
    segmento: "Alimentação saudável",
    responsavel_atendimento_id: "a0000000-0000-0000-0000-000000000003",
    observacoes: "Conta com dois contatos ativos. Reunião mensal na primeira terça.",
    ativo: true,
    created_at: "2024-03-10T10:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0000-00000000000b",
    nome_empresa: "Óptica Visão",
    nome_contato: "Marcos Vieira",
    email_contato: "contato@opticavisao.com.br",
    telefone: "(11) 98888-0002",
    drive_folder_id: null,
    segmento: "Varejo óptico",
    responsavel_atendimento_id: "a0000000-0000-0000-0000-000000000001",
    observacoes: null,
    ativo: true,
    created_at: "2024-06-02T10:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0000-00000000000c",
    nome_empresa: "Academia Corpo Livre",
    nome_contato: null,
    email_contato: null,
    telefone: null,
    drive_folder_id: null,
    segmento: "Academia",
    responsavel_atendimento_id: null,
    observacoes: null,
    ativo: false,
    created_at: "2023-11-18T10:00:00.000Z",
  },
];
