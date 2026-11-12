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
  // A FOTO NÃO É ENFEITE DO EXEMPLO: ela é quem está logada em quase toda
  // imagem do painel, então é o avatar dela que aparece na topbar, no pé da
  // barra lateral e na pilha. Com `null` aqui, as cento e cinquenta imagens
  // saem com iniciais e nenhuma delas confere a foto — que é exatamente como
  // o avatar da topbar passou doze sprints sem `AvatarImage`.
  //
  // O arquivo é 3 por 4 de propósito; a razão está em
  // `public/exemplos/LEIA-ME.md`.
  avatar_url: "/exemplos/retrato-1.svg",
  ativo: true,
  deve_trocar_senha: false,
  created_at: "2026-01-15T10:00:00.000Z",
};

export const PROFILE_CLIENTE: Profile = {
  id: "a0000000-0000-0000-0000-000000000004",
  email: "contato@mundoverde.com.br",
  nome: "Caio Alves",
  role: "cliente",
  avatar_url: null,
  ativo: true,
  deve_trocar_senha: false,
  created_at: "2026-01-15T10:00:00.000Z",
};

/**
 * A PESSOA DA CONTA QUE APROVA, e ela mora aqui porque TRES stubs a nomeiam.
 *
 * A aba "Quem tem acesso" do portal, a lista que o seletor de aprovadores
 * oferece e o historico de aprovacoes de cada peca falam da MESMA pessoa --
 * e no produto isso e garantido pelo banco: `aprovadores_da_conta()` e a
 * unica resposta para "quem aprova por esta conta", e `aprovador_pertence_a_
 * conta()` (0129) recusa uma rodada que nomeie quem nao esta nela.
 *
 * Escrita tres vezes, ela diverge -- e a imagem do prototipo passou a mostrar
 * o painel de envio oferecendo uma pessoa e a rodada logo abaixo esperando
 * outra: um estado que o produto NAO alcanca, numa tela que existe para
 * provar o que ele faz. E a licao da duplicata do Cronograma.
 *
 * E ela nao e `PROFILE_CLIENTE`, que e o cliente LOGADO do portal: sao duas
 * pessoas da Mundo Verde, que e o normal de uma conta -- e e justamente por
 * haver duas que "varios aprovadores" (0129) significa alguma coisa.
 */
export const APROVADOR_DO_CLIENTE = {
  id: "c1",
  nome: "Joana Prado",
  email: "joana@mundoverde.com.br",
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
    // A MESMA PESSOA DO `PROFILE_EQUIPE`, e a mesma foto: são dois registros
    // do mesmo nome, e a lista de Equipe mostra este. Com um só preenchido, a
    // topbar sairia com foto e a linha dela na lista com iniciais, na mesma
    // tela. As outras sete continuam nulas de propósito — é o que faz a
    // imagem provar que o círculo ESCOLHE, e não só que a foto aparece.
    avatar_url: "/exemplos/retrato-1.svg",
    ativo: true,
    deve_trocar_senha: false,
    created_at: "2021-03-01T10:00:00.000Z",
    membro: {
      id: "t1", user_id: "a0000000-0000-0000-0000-000000000001",
      cargo: "Sócia-diretora", area: "Direção", funcao: "Gestao" as const,
      data_admissao: "2021-03-01", data_nascimento: "1989-07-22", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
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
    deve_trocar_senha: false,
    created_at: "2023-08-14T10:00:00.000Z",
    membro: {
      id: "t2", user_id: "a0000000-0000-0000-0000-000000000002",
      cargo: "Desenvolvedor", area: "Tecnologia", funcao: "Desenvolvimento" as const,
      data_admissao: "2023-08-14", data_nascimento: "1994-11-30", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
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
    deve_trocar_senha: false,
    created_at: "2024-02-05T10:00:00.000Z",
    membro: {
      id: "t3", user_id: "a0000000-0000-0000-0000-000000000003",
      cargo: "Analista de contas", area: "Atendimento", funcao: "Atendimento" as const,
      data_admissao: "2024-02-05", data_nascimento: "1992-04-17", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
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
    deve_trocar_senha: false,
    created_at: "2025-01-20T10:00:00.000Z",
    membro: {
      id: "t4", user_id: "a0000000-0000-0000-0000-000000000005",
      cargo: "Designer", area: "Criação", funcao: "Design" as const,
      data_admissao: "2024-06-10", data_nascimento: null, dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
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
    deve_trocar_senha: false,
    created_at: "2025-01-20T10:00:00.000Z",
    membro: {
      id: "t5", user_id: "a0000000-0000-0000-0000-000000000006",
      cargo: "Social media", area: "Criação", funcao: "Social Media" as const,
      data_admissao: "2025-01-20", data_nascimento: null, dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
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
    deve_trocar_senha: false,
    created_at: "2025-04-02T10:00:00.000Z",
    membro: {
      id: "t6", user_id: "a0000000-0000-0000-0000-000000000007",
      cargo: "Analista de tráfego", area: "Mídia", funcao: "Trafego" as const,
      data_admissao: "2025-04-02", dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: true,
      desligado_em: null, created_at: "2025-04-02T10:00:00.000Z",
    },
  },
  // ELA ESTA DESLIGADA, e sem ela a lista de Equipe nao prova a mudanca: ate
  // aqui o conjunto de exemplo tinha so gente ativa, e o padrao do filtro
  // "Situacao" indo de "ativos" para "todos" sairia na MESMA imagem. E a licao
  // da duplicata do Cronograma pela enesima vez -- um ambiente de exemplo que
  // mostra o produto no unico estado em que a mudanca e invisivel.
  //
  // ELA E A ULTIMA DO ARRAY de proposito: `obterMinhaFicha` acha a pessoa pelo
  // `role`, e uma `colaborador` antes da Carla trocaria o cargo do cartao do
  // menu em toda tela rodada como colaborador.
  //
  // E A FUNCAO E `Redator` por coerencia com o que o produto ja desenha: o
  // stub dos padroes da conta diz que a etapa de Redator e a que fica sem
  // dono, e uma Redatora que saiu da agencia e exatamente por que a conta nao
  // tem ninguem naquela funcao.
  //
  // SEM DATA DE NASCIMENTO: `aniversarios_do_periodo()` (0130) le quem esta
  // ativo, e um aniversario dela no Calendario Full seria o exemplo mentindo
  // na outra direcao.
  {
    id: "a0000000-0000-0000-0000-000000000008",
    email: "redacao@fullconnectkey.com.br",
    nome: "Helena Braga",
    role: "colaborador" as const,
    avatar_url: null,
    ativo: false,
    deve_trocar_senha: false,
    created_at: "2024-09-09T10:00:00.000Z",
    membro: {
      id: "t7", user_id: "a0000000-0000-0000-0000-000000000008",
      cargo: "Redatora", area: "Criação", funcao: "Redator" as const,
      data_admissao: "2024-09-09", data_nascimento: null, dias_ferias_ano: 15, max_parcelas_ferias: 2, ativo: false,
      desligado_em: "2026-08-29", created_at: "2024-09-09T10:00:00.000Z",
    },
  },
];

/** Clientes fictícios, já com responsável e contagem de acessos. */
export const CLIENTES_EXEMPLO = [
  {
    id: "c0000000-0000-0000-0000-00000000000a",
    nome_empresa: "Mundo Verde",
    // O LOGO VAI PARA UMA DAS TRÊS, e as outras duas ficam nulas de propósito:
    // com as três preenchidas a imagem provaria que o círculo do filtro
    // aparece, e não que ele ESCOLHE entre o logo e as iniciais da empresa. É
    // a razão escrita de `retrato-1.svg` ir para a Ana e não para a equipe
    // inteira, e a do evento de cada par da legenda do calendário.
    logo_url: "/exemplos/logo-1.svg",
    nome_contato: "Caio Alves",
    email_contato: "contato@mundoverde.com.br",
    telefone: "(11) 98888-0001",
    drive_folder_id: null,
    segmento: "Alimentação saudável",
    responsavel_atendimento_id: "a0000000-0000-0000-0000-000000000003",
    observacoes: "Conta com dois contatos ativos. Reunião mensal na primeira terça.",
    ativo: true,
    deve_trocar_senha: false,
    created_at: "2024-03-10T10:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0000-00000000000b",
    nome_empresa: "Óptica Visão",
    logo_url: null,
    nome_contato: "Marcos Vieira",
    email_contato: "contato@opticavisao.com.br",
    telefone: "(11) 98888-0002",
    drive_folder_id: null,
    segmento: "Varejo óptico",
    responsavel_atendimento_id: "a0000000-0000-0000-0000-000000000001",
    observacoes: null,
    ativo: true,
    deve_trocar_senha: false,
    created_at: "2024-06-02T10:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0000-00000000000c",
    nome_empresa: "Academia Corpo Livre",
    logo_url: null,
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
