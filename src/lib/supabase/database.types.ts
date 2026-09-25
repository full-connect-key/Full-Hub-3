/**
 * Tipos do banco de dados.
 *
 * Pode (e deve) ser gerado a partir do schema real, assim o TypeScript avisa
 * quando uma coluna muda de nome ou some:
 *
 *   npx supabase login
 *   npx supabase link --project-ref <referencia-do-projeto>
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 *
 * Ate a primeira geracao, vale a versao escrita a mao abaixo, que cobre o que
 * a migration 0002 cria.
 */

export type UserRole = "cliente" | "colaborador" | "desenvolvedor" | "socio";

/** O que a pessoa faz na agência. Diferente de UserRole, que é o acesso. */
export type TeamFuncao =
  | "Atendimento"
  | "Social Media"
  | "Redator"
  | "Design"
  | "Audiovisual"
  | "Trafego"
  | "Desenvolvimento"
  | "Gestao"
  | "Outro";

export type TaskPrioridade = "baixa" | "normal" | "alta" | "urgente";

export type FinTipo = "receita" | "despesa";

/**
 * `atrasado` existe no enum, mas NUNCA é gravado: ele é derivado do
 * vencimento a cada leitura, por `situacaoDoLancamento()` em
 * `lib/dominio/financeiro.ts` e por `situacao_do_lancamento()` no Postgres.
 * Um trigger reescreve para `previsto` quem tentar gravá-lo à mão.
 */
export type FinStatus = "previsto" | "faturado" | "pago" | "atrasado" | "cancelado";

export type ContratoRecorrencia = "mensal" | "trimestral" | "anual" | "pontual";

export type PfTipo = "entrada" | "saida";

export type TaskStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "aguardando_informacoes"
  | "entregue"
  | "em_aprovacao"
  | "em_ajustes"
  | "concluido"
  | "cancelada";

/** O status da subtarefa — a unidade real de trabalho. */
export type SubtaskStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "aguardando_informacoes"
  | "enviada_aprovacao"
  | "em_ajustes"
  | "concluida";

/** Para onde a aprovação vai no fim. Não é o caminho: toda aprovação passa
 *  primeiro pela rodada interna. */
export type TipoAprovacao = "interna" | "cliente";

export type EscopoRodada = "interna" | "cliente";

/**
 * O que passa por uma rodada de aprovação (migration 0030).
 *
 * **Os três têm dono.** A 0030 criou o par e recusou `post` e `deliverable`
 * de propósito, com a frase "quem acrescentar o tipo acrescenta a regra na
 * mesma migration"; a 0032 cumpriu isso para o post e a 0033 para o
 * entregável. A frase fica de pé assim mesmo: ela é a regra para o quarto
 * tipo, se um dia existir.
 */
export type TipoDeConteudo = "subtask" | "post" | "deliverable";

/**
 * Os sete estados de um conteúdo do cliente (`content_status` no Postgres).
 *
 * Três chaves se escrevem igual às de task e de subtarefa
 * (`aguardando_informacoes`, `em_aprovacao`), e é de propósito: o cliente e a
 * equipe usam a mesma palavra para a mesma coisa, e um selo só evita dois
 * amarelos diferentes na mesma tela.
 */
export type ContentStatus =
  | "aguardando_informacoes"
  | "em_producao"
  | "em_aprovacao"
  | "ajustes"
  | "aprovado"
  | "rejeitado"
  | "stand_by";

/** O que o material É. O ícone e o jeito de abrir saem daqui. */
export type MaterialTipo =
  | "video"
  | "artigo"
  | "pdf"
  | "curso_externo"
  | "template"
  | "aula_interna";

export type RecCategoria =
  | "filme"
  | "serie"
  | "livro"
  | "curso"
  | "ferramenta"
  | "podcast"
  | "referencia"
  | "outro";

/**
 * O desfecho de uma rodada.
 *
 * **`rejeitada` entrou na migration 0032, e vale para MATERIAL.** O Portal tem
 * três botões — Aprovar, Rejeitar, Solicitar ajustes — e os dois últimos não
 * são a mesma decisão: um diz "mude isto e volte", o outro diz "não". Post e
 * entregável de campanha aceitam os três, porque os dois usam
 * `content_status`, que tem `rejeitado`. Etapa de demanda continua com dois
 * desfechos, e o banco recusa `rejeitada` nela: não existe `subtask_status`
 * que signifique recusada.
 */
export type StatusRodada =
  | "pendente"
  | "aprovada"
  | "ajustes_solicitados"
  | "rejeitada";

/** As redes em que um post é publicado (`plataforma_social`, 0032). */
/**
 * O que a tela DESENHA (migration 0042).
 *
 * **Não confundir com `posts.formato`**, que é onde o material vai ao ar —
 * Feed, Stories, Reels — e continua texto porque nome comercial de plataforma
 * muda a cada temporada. Estes três não mudam: ou é uma imagem, ou são várias
 * em ordem, ou toca.
 *
 * É enum e não texto porque decide qual editor aparece: um `"Carrossel"` com
 * C maiúsculo faria a faixa de slides sumir sem erro nenhum.
 */
export type PostMidia = "imagem" | "carrossel" | "video";

/** Um slide de carrossel, dentro de `post_versions.arquivos`. */
export type ArquivoDaVersao = {
  url: string;
  thumbnail_url?: string | null;
  nome?: string | null;
};

export type PlataformaSocial =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "pinterest";

/**
 * O ciclo de vida da campanha como PROJETO (`campaign_status`, 0033).
 *
 * Distinto de `ContentStatus`, e de propósito: aquele é o estado de uma peça
 * no fluxo de aprovação, este é o da campanha inteira. "Em aprovação" não quer
 * dizer nada sobre uma campanha; "finalizada" não quer dizer nada sobre um
 * arquivo.
 */
export type CampaignStatus =
  | "planejamento"
  | "ativa"
  | "finalizada"
  | "cancelada";

/**
 * Um nó da árvore que o template guarda em `estrutura_json`.
 *
 * `itens` presente e vazio, com `quantidade`, é o caso do Feed/Storys: quantos
 * são se decide na criação da campanha, porque muda a cada mês. A tela lê esse
 * número como sugestão e gera "Feed/Story 1", "Feed/Story 2" — escrever quinze
 * linhas iguais no template seria fixar um número que nunca é o mesmo.
 */
export type NoDoTemplate = {
  nome: string;
  itens?: NoDoTemplate[];
  quantidade?: number;
};

export type EstruturaDeTemplate = NoDoTemplate[];

export type NotificationTipo =
  | "task"
  | "aprovacao"
  | "academy"
  | "recomendacao"
  | "full_days"
  | "equipe"
  | "cliente"
  | "sistema";

export type SkillNivel = "iniciante" | "intermediario" | "avancado" | "especialista";

export type HrTipo = "ferias" | "licenca" | "ausencia";
export type HrStatus = "pendente" | "aprovada" | "reprovada" | "cancelada";
/**
 * De onde veio o registro (migration 0037).
 *
 * `solicitacao` é o caminho de sempre: a pessoa propõe, o sócio responde.
 * `lancamento_retroativo` é a gestão registrando um período que já aconteceu,
 * que nasce aprovado e não passa por fila nenhuma. `importacao` é o mesmo
 * fato vindo de um arquivo, e existe separado para a auditoria saber
 * distinguir os dois.
 */
export type HrOrigem = "solicitacao" | "lancamento_retroativo" | "importacao";

/**
 * Como uma demanda recorrente se materializa (migration 0040).
 *
 * `mensal_agrupada`: uma task por mês, com uma etapa por ocorrência dentro
 * dela — o modo certo para trabalho diário, porque o board mostra uma linha
 * por mês e não trinta. `task_por_ocorrencia`: uma task inteira a cada
 * repetição, com as etapas do modelo dentro.
 */
export type RecorrenciaModo = "mensal_agrupada" | "task_por_ocorrencia";
export type RecorrenciaFrequencia = "diaria" | "semanal" | "quinzenal" | "mensal";
export type PresencaStatus =
  | "presente"
  | "remoto"
  | "ferias"
  | "licenca"
  | "ausente"
  | "folga"
  | "feriado";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          nome: string;
          role: UserRole;
          avatar_url: string | null;
          ativo: boolean;
          deve_trocar_senha: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nome: string;
          role?: UserRole;
          avatar_url?: string | null;
          ativo?: boolean;
          deve_trocar_senha?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          nome?: string;
          role?: UserRole;
          avatar_url?: string | null;
          ativo?: boolean;
          deve_trocar_senha?: boolean;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          nome_empresa: string;
          /**
           * O endereco do portal: /portal/<slug>. Unico, gerado do nome pelo
           * gatilho `clients_slug` (migration 0009). Nulo so no instante entre
           * o insert e o gatilho -- nenhuma linha gravada chega ao cliente sem
           * slug --, mas fica nulavel aqui porque o Insert pode omiti-lo.
           */
          slug: string | null;
          nome_contato: string | null;
          email_contato: string | null;
          telefone: string | null;
          drive_folder_id: string | null;
          segmento: string | null;
          responsavel_atendimento_id: string | null;
          observacoes: string | null;
          /** Enviada pelo proprio cliente, em /portal/configuracoes (0031). */
          logo_url: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome_empresa: string;
          /** Omita e o gatilho gera a partir do nome. */
          slug?: string | null;
          nome_contato?: string | null;
          email_contato?: string | null;
          telefone?: string | null;
          drive_folder_id?: string | null;
          segmento?: string | null;
          responsavel_atendimento_id?: string | null;
          observacoes?: string | null;
          logo_url?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          nome_empresa?: string;
          slug?: string | null;
          nome_contato?: string | null;
          email_contato?: string | null;
          telefone?: string | null;
          drive_folder_id?: string | null;
          segmento?: string | null;
          responsavel_atendimento_id?: string | null;
          observacoes?: string | null;
          logo_url?: string | null;
          ativo?: boolean;
        };
        Relationships: [];
      };

      /**
       * O que cada pessoa do cliente quer receber (migration 0031).
       *
       * Sem `user_id` no Update: a linha e' da pessoa, e a policy fecha em
       * `auth.uid()` nas quatro operacoes. Deixar a coluna editavel seria
       * oferecer no tipo um caminho que o banco recusa.
       */
      client_notification_prefs: {
        Row: {
          id: string;
          user_id: string;
          novo_conteudo: boolean;
          novo_comentario: boolean;
          lembrete_pendencias: boolean;
          frequencia: "imediato" | "diario" | "nunca";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          novo_conteudo?: boolean;
          novo_comentario?: boolean;
          lembrete_pendencias?: boolean;
          frequencia?: "imediato" | "diario" | "nunca";
        };
        Update: {
          novo_conteudo?: boolean;
          novo_comentario?: boolean;
          lembrete_pendencias?: boolean;
          frequencia?: "imediato" | "diario" | "nunca";
        };
        Relationships: [];
      };

      /**
       * Quem entrou no portal, quando, e o que abriu (migration 0031).
       *
       * SEM Update e SEM Delete, como `client_portal_views`: registro que o
       * proprio registrado reescreve nao e' registro. O banco tambem nao cria
       * policy para nenhum dos dois.
       */
      client_access_log: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          acao: "login" | "visualizou_item" | "download";
          entity_type: string | null;
          entity_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          acao: "login" | "visualizou_item" | "download";
          entity_type?: string | null;
          entity_id?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      /**
       * Quem da equipe abriu o portal de qual cliente. Sem Update alem de
       * encerrar, e sem Delete: registro de auditoria nao se apaga pela
       * aplicacao (migration 0009 nao cria policy de DELETE).
       */
      client_portal_views: {
        Row: {
          id: string;
          client_id: string;
          staff_user_id: string;
          iniciado_em: string;
          encerrado_em: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          staff_user_id: string;
          iniciado_em?: string;
          encerrado_em?: string | null;
        };
        Update: { encerrado_em?: string | null };
        Relationships: [];
      };
      /**
       * Avisos in-app (migration 0011).
       *
       * SEM Insert: nao existe policy de insert, e a unica porta e a funcao
       * `notificar()` no Postgres. O Update aceita so `lida_em` -- um trigger
       * recusa qualquer outra coluna.
       */
      notifications: {
        Row: {
          id: string;
          user_id: string;
          tipo: NotificationTipo;
          titulo: string;
          corpo: string | null;
          link: string | null;
          origem_id: string | null;
          lida_em: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { lida_em?: string | null };
        Relationships: [];
      };
      /** Pedidos de ferias, licenca e ausencia (migration 0011). */
      /** Uma regra de demanda recorrente (migration 0040). */
      task_recurrences: {
        Row: {
          id: string;
          client_id: string;
          nome: string;
          modo: RecorrenciaModo;
          frequencia: RecorrenciaFrequencia;
          dias_semana: number[] | null;
          dia_mes: number | null;
          pular_feriados: boolean;
          data_inicio: string;
          data_fim: string | null;
          antecedencia_dias: number;
          gerar_como_rascunho: boolean;
          modelo: Json;
          task_type_id: string | null;
          ativo: boolean;
          ultima_geracao_em: string | null;
          // Escrita pelo trigger `task_recurrences_recalcula` a cada mudanca
          // no QUANDO da regra. Fica fora de Insert e de Update: uma data
          // gravada a mao seria desfeita pelo trigger no mesmo instante.
          proxima_geracao_em: string | null;
          criado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nome: string;
          modo?: RecorrenciaModo;
          frequencia?: RecorrenciaFrequencia;
          dias_semana?: number[] | null;
          dia_mes?: number | null;
          pular_feriados?: boolean;
          data_inicio: string;
          data_fim?: string | null;
          antecedencia_dias?: number;
          gerar_como_rascunho?: boolean;
          modelo: Json;
          task_type_id?: string | null;
          ativo?: boolean;
          criado_por: string;
        };
        Update: {
          nome?: string;
          modo?: RecorrenciaModo;
          frequencia?: RecorrenciaFrequencia;
          dias_semana?: number[] | null;
          dia_mes?: number | null;
          pular_feriados?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          antecedencia_dias?: number;
          gerar_como_rascunho?: boolean;
          modelo?: Json;
          task_type_id?: string | null;
          ativo?: boolean;
        };
        Relationships: [];
      };
      /**
       * Uma linha por ocorrencia tentada. NAO TEM Insert nem Update: a unica
       * porta e `gerar_ocorrencia()`, como `notifications` so se escreve por
       * `notificar()`. Sem isso daria para forjar uma chave de ocorrencia e,
       * com ela, impedir para sempre que aquele mes fosse gerado.
       */
      recurrence_runs: {
        Row: {
          id: string;
          recurrence_id: string;
          chave_ocorrencia: string;
          task_id: string | null;
          status: "gerada" | "pulada" | "erro";
          detalhes: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      hr_requests: {
        Row: {
          id: string;
          user_id: string;
          tipo: HrTipo;
          data_inicio: string;
          data_fim: string;
          // CORRIDOS quando o tipo é descanso (`ferias`), dias úteis nos
          // outros dois — que não descontam saldo (migration 0024). O nome
          // ficou de antes, como `dias_ferias_ano`.
          dias_uteis: number;
          motivo: string | null;
          status: HrStatus;
          motivo_reprovacao: string | null;
          aprovado_por: string | null;
          decidido_em: string | null;
          origem: HrOrigem;
          lancado_por: string | null;
          lancado_em: string | null;
          created_at: string;
        };
        // `origem` FICA DE FORA do Insert, e não é esquecimento: gravar
        // qualquer coisa diferente de `solicitacao` é o lançamento
        // retroativo, e ele passa por `lancar_periodo()`, que confere
        // `is_gestor()` e preenche `lancado_por` sozinha. Deixá-la aqui
        // convidaria a montar o insert à mão — a policy recusaria, mas só na
        // hora de rodar, e o erro sairia como "nenhuma linha voltou".
        Insert: {
          id?: string;
          user_id: string;
          tipo: HrTipo;
          data_inicio: string;
          data_fim: string;
          dias_uteis: number;
          motivo?: string | null;
        };
        // Decidir e cancelar passam pelas funcoes do banco, nao por update.
        // O update direto e so do dono e so enquanto pendente. Corrigir um
        // lancamento passa por `corrigir_lancamento()`, pelo mesmo motivo.
        Update: {
          tipo?: HrTipo;
          data_inicio?: string;
          data_fim?: string;
          dias_uteis?: number;
          motivo?: string | null;
        };
        Relationships: [];
      };
      /** Um dia de uma pessoa na matriz da equipe (migration 0011). */
      team_presence: {
        Row: {
          id: string;
          user_id: string;
          data: string;
          status: PresencaStatus;
          observacao: string | null;
          hr_request_id: string | null;
          atualizado_por: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data: string;
          status?: PresencaStatus;
          observacao?: string | null;
          hr_request_id?: string | null;
          atualizado_por?: string | null;
        };
        Update: {
          status?: PresencaStatus;
          observacao?: string | null;
          atualizado_por?: string | null;
        };
        Relationships: [];
      };
      holidays: {
        Row: { id: string; data: string; nome: string };
        Insert: { id?: string; data: string; nome: string };
        Update: { data?: string; nome?: string };
        Relationships: [];
      };
      /** Catalogo compartilhado de skills (migration 0012). */
      skills: {
        Row: {
          id: string;
          nome: string;
          categoria: string | null;
          descricao: string | null;
          ativa: boolean;
          sugerida_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria?: string | null;
          descricao?: string | null;
          ativa?: boolean;
          sugerida_por?: string | null;
        };
        Update: {
          nome?: string;
          categoria?: string | null;
          descricao?: string | null;
          ativa?: boolean;
          sugerida_por?: string | null;
        };
        Relationships: [];
      };
      /** O que cada pessoa sabe. Escrita so pela propria pessoa. */
      user_skills: {
        Row: {
          id: string;
          user_id: string;
          skill_id: string;
          nivel: SkillNivel;
          quer_desenvolver: boolean;
          anos_experiencia: number | null;
          observacao: string | null;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skill_id: string;
          nivel?: SkillNivel;
          quer_desenvolver?: boolean;
          anos_experiencia?: number | null;
          observacao?: string | null;
        };
        Update: {
          nivel?: SkillNivel;
          quer_desenvolver?: boolean;
          anos_experiencia?: number | null;
          observacao?: string | null;
        };
        Relationships: [];
      };
      /** A observacao da gestao. O avaliado le. */
      skill_avaliacoes: {
        Row: {
          id: string;
          user_id: string;
          autor_id: string;
          texto: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; user_id: string; autor_id: string; texto: string };
        Update: { texto?: string };
        Relationships: [];
      };
      /** Texto livre sobre a semana. Privado (migration 0012). */
      contracts: {
        Row: {
          id: string;
          client_id: string;
          nome: string;
          valor: number;
          recorrencia: ContratoRecorrencia;
          dia_vencimento: number | null;
          data_inicio: string;
          data_fim: string | null;
          ativo: boolean;
          observacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nome: string;
          valor: number;
          recorrencia?: ContratoRecorrencia;
          dia_vencimento?: number | null;
          data_inicio: string;
          data_fim?: string | null;
          ativo?: boolean;
          observacoes?: string | null;
        };
        Update: {
          client_id?: string;
          nome?: string;
          valor?: number;
          recorrencia?: ContratoRecorrencia;
          dia_vencimento?: number | null;
          data_inicio?: string;
          data_fim?: string | null;
          ativo?: boolean;
          observacoes?: string | null;
        };
        Relationships: [];
      };
      finance_categories: {
        Row: { id: string; nome: string; tipo: FinTipo };
        Insert: { id?: string; nome: string; tipo: FinTipo };
        Update: { nome?: string; tipo?: FinTipo };
        Relationships: [];
      };
      finance_entries: {
        Row: {
          id: string;
          tipo: FinTipo;
          client_id: string | null;
          contract_id: string | null;
          category_id: string | null;
          descricao: string;
          valor: number;
          competencia: string;
          vencimento: string | null;
          pagamento: string | null;
          status: FinStatus;
          fornecedor: string | null;
          observacoes: string | null;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: FinTipo;
          client_id?: string | null;
          contract_id?: string | null;
          category_id?: string | null;
          descricao: string;
          valor: number;
          competencia: string;
          vencimento?: string | null;
          pagamento?: string | null;
          status?: FinStatus;
          fornecedor?: string | null;
          observacoes?: string | null;
          criado_por: string;
        };
        Update: {
          tipo?: FinTipo;
          client_id?: string | null;
          contract_id?: string | null;
          category_id?: string | null;
          descricao?: string;
          valor?: number;
          competencia?: string;
          vencimento?: string | null;
          pagamento?: string | null;
          status?: FinStatus;
          fornecedor?: string | null;
          observacoes?: string | null;
        };
        Relationships: [];
      };
      client_users: {
        Row: { id: string; client_id: string; user_id: string; created_at: string };
        Insert: { id?: string; client_id: string; user_id: string; created_at?: string };
        Update: { client_id?: string; user_id?: string };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          user_id: string;
          cargo: string | null;
          area: string | null;
          funcao: TeamFuncao | null;
          data_admissao: string | null;
          dias_ferias_ano: number;
          max_parcelas_ferias: number;
          ativo: boolean;
          desligado_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cargo?: string | null;
          area?: string | null;
          funcao?: TeamFuncao | null;
          data_admissao?: string | null;
          dias_ferias_ano?: number;
          max_parcelas_ferias?: number;
          ativo?: boolean;
          desligado_em?: string | null;
          created_at?: string;
        };
        Update: {
          cargo?: string | null;
          area?: string | null;
          funcao?: TeamFuncao | null;
          data_admissao?: string | null;
          dias_ferias_ano?: number;
          max_parcelas_ferias?: number;
          ativo?: boolean;
          desligado_em?: string | null;
        };
        Relationships: [];
      };
      academy_tracks: {
        Row: {
          id: string;
          titulo: string;
          descricao: string | null;
          area: string | null;
          capa_url: string | null;
          obrigatoria: boolean;
          publicada: boolean;
          ordem: number;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          descricao?: string | null;
          area?: string | null;
          capa_url?: string | null;
          obrigatoria?: boolean;
          publicada?: boolean;
          ordem?: number;
          criado_por: string;
        };
        Update: {
          titulo?: string;
          descricao?: string | null;
          area?: string | null;
          capa_url?: string | null;
          obrigatoria?: boolean;
          publicada?: boolean;
          ordem?: number;
        };
        Relationships: [];
      };
      academy_materials: {
        Row: {
          id: string;
          track_id: string;
          titulo: string;
          descricao: string | null;
          tipo: MaterialTipo;
          url: string | null;
          arquivo_url: string | null;
          duracao_minutos: number | null;
          ordem: number;
          skill_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          track_id: string;
          titulo: string;
          descricao?: string | null;
          tipo: MaterialTipo;
          url?: string | null;
          arquivo_url?: string | null;
          duracao_minutos?: number | null;
          ordem?: number;
          skill_id?: string | null;
        };
        Update: {
          titulo?: string;
          descricao?: string | null;
          tipo?: MaterialTipo;
          url?: string | null;
          arquivo_url?: string | null;
          duracao_minutos?: number | null;
          ordem?: number;
          skill_id?: string | null;
        };
        Relationships: [];
      };
      academy_progress: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          concluido: boolean;
          concluido_em: string | null;
          anotacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          concluido?: boolean;
          anotacoes?: string | null;
        };
        Update: {
          concluido?: boolean;
          anotacoes?: string | null;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          id: string;
          autor_id: string;
          categoria: RecCategoria;
          titulo: string;
          descricao: string | null;
          url: string | null;
          imagem_url: string | null;
          tags: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          autor_id: string;
          categoria: RecCategoria;
          titulo: string;
          descricao?: string | null;
          url?: string | null;
          imagem_url?: string | null;
          tags?: string[] | null;
        };
        Update: {
          categoria?: RecCategoria;
          titulo?: string;
          descricao?: string | null;
          url?: string | null;
          imagem_url?: string | null;
          tags?: string[] | null;
        };
        Relationships: [];
      };
      recommendation_likes: {
        Row: {
          id: string;
          recommendation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: { id?: string; recommendation_id: string; user_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      recommendation_comments: {
        Row: {
          id: string;
          recommendation_id: string;
          autor_id: string;
          texto: string;
          resposta_a: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recommendation_id: string;
          autor_id: string;
          texto: string;
          resposta_a?: string | null;
        };
        Update: { texto?: string };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          // NULO enquanto é rascunho (migration 0028): a pessoa escolhe o
          // cliente na própria tela. A exigência passou para a publicação.
          client_id: string | null;
          titulo: string;
          briefing_rico: Json | null;
          briefing_texto: string | null;
          prioridade: TaskPrioridade;
          status: TaskStatus;
          status_manual: boolean;
          data_inicio: string;
          data_fim: string | null;
          task_type_id: string | null;
          workflow_snapshot: Json | null;
          link_entrega: string | null;
          // De qual regra recorrente esta task saiu (migration 0040). Fica
          // FORA de Insert e de Update: quem preenche é `gerar_ocorrencia()`,
          // e uma task marcada à mão como recorrente mentiria sobre a origem
          // dela no selo que a tela mostra.
          recurrence_id: string | null;
          criado_por: string;
          concluida_em: string | null;
          // NULO = rascunho (migration 0028). Só quem criou enxerga, e nada
          // dela conta em lista, contador, notificação ou portal.
          publicada_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          titulo: string;
          // Omitido, a demanda nasce PUBLICADA (o default do banco é now()).
          // Rascunho se pede explicitamente, com null.
          publicada_em?: string | null;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          status_manual?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          task_type_id?: string | null;
          workflow_snapshot?: Json | null;
          link_entrega?: string | null;
          criado_por: string;
        };
        Update: {
          titulo?: string;
          client_id?: string | null;
          publicada_em?: string | null;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          status_manual?: boolean;
          // `data_inicio` e `data_fim` ficam FORA do Update: desde a 0028 o
          // período da Task é derivado das etapas, escrito por trigger.
          // Tentar gravá-los é erro de tipo aqui, antes de virar duas
          // verdades sobre a mesma demanda.
          task_type_id?: string | null;
          workflow_snapshot?: Json | null;
          link_entrega?: string | null;
        };
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          // A etapa de cima (migration 0022). Null = etapa da Task; preenchido
          // = sub-etapa. Nunca um terceiro nível: o trigger recusa o neto.
          parent_id: string | null;
          titulo: string;
          descricao_rica: Json | null;
          descricao_texto: string | null;
          // Aviso escrito pela geração automática (migration 0040):
          // responsável fora na data, responsável desligado. Só a geração
          // escreve; a tela mostra e a pessoa resolve.
          aviso_geracao: string | null;
          // O PERÍODO da etapa (migration 0027). O fim continua se chamando
          // `prazo`: é ele que define atraso, e o nome já diz que é a ponta
          // final. Os dois são opcionais — etapa sem data é caso normal.
          data_inicio: string | null;
          prazo: string | null;
          responsavel_id: string | null;
          prioridade: TaskPrioridade;
          status: SubtaskStatus;
          requer_aprovacao: boolean;
          tipo_aprovacao: TipoAprovacao | null;
          estimativa_minutos: number | null;
          tempo_real_minutos: number | null;
          ordem: number;
          iniciada_em: string | null;
          concluida_em: string | null;
          // O cronômetro (migration 0021). Só o trigger escreve, e por isso
          // as duas ficam FORA de Insert e de Update: assim tentar gravá-las
          // é erro de tipo aqui, muito antes de o banco descartar o valor.
          andando_desde: string | null;
          tempo_medido_segundos: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          parent_id?: string | null;
          titulo: string;
          descricao_rica?: Json | null;
          descricao_texto?: string | null;
          data_inicio?: string | null;
          prazo?: string | null;
          responsavel_id?: string | null;
          prioridade?: TaskPrioridade;
          status?: SubtaskStatus;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          estimativa_minutos?: number | null;
          tempo_real_minutos?: number | null;
          ordem?: number;
        };
        Update: {
          parent_id?: string | null;
          titulo?: string;
          descricao_rica?: Json | null;
          descricao_texto?: string | null;
          data_inicio?: string | null;
          prazo?: string | null;
          responsavel_id?: string | null;
          prioridade?: TaskPrioridade;
          status?: SubtaskStatus;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          estimativa_minutos?: number | null;
          tempo_real_minutos?: number | null;
          ordem?: number;
        };
        Relationships: [];
      };
      subtask_dependencies: {
        Row: {
          id: string;
          subtask_id: string;
          depende_de_id: string;
          created_at: string;
        };
        Insert: { id?: string; subtask_id: string; depende_de_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      approval_rounds: {
        Row: {
          id: string;
          /** subtask | post | deliverable (migration 0030). */
          content_type: TipoDeConteudo;
          /** O id na tabela que `content_type` nomeia. Sem chave estrangeira. */
          content_id: string;
          numero_rodada: number;
          escopo: EscopoRodada;
          status: StatusRodada;
          solicitado_por: string;
          solicitado_em: string;
          decidido_por: string | null;
          decidido_em: string | null;
          comentario: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          // OBRIGATORIO no tipo, embora o banco tenha default 'subtask'. O
          // default existe para a migration converter as linhas antigas; o
          // codigo novo diz de que conteudo esta falando, senao a
          // generalizacao vira uma coluna que ninguem preenche.
          content_type: TipoDeConteudo;
          content_id: string;
          numero_rodada: number;
          escopo: EscopoRodada;
          status?: StatusRodada;
          solicitado_por: string;
          comentario?: string | null;
        };
        Update: {
          status?: StatusRodada;
          decidido_por?: string | null;
          decidido_em?: string | null;
          comentario?: string | null;
        };
        Relationships: [];
      };
      subtask_entregas: {
        Row: {
          id: string;
          subtask_id: string;
          approval_round_id: string | null;
          tipo: "arquivo" | "link";
          url: string;
          nome: string | null;
          enviado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          subtask_id: string;
          approval_round_id?: string | null;
          tipo: "arquivo" | "link";
          url: string;
          nome?: string | null;
          enviado_por: string;
        };
        Update: { approval_round_id?: string | null; nome?: string | null };
        Relationships: [];
      };
      task_history: {
        Row: {
          id: string;
          task_id: string;
          subtask_id: string | null;
          approval_round_id: string | null;
          acao: string;
          de_valor: string | null;
          para_valor: string | null;
          autor_id: string | null;
          detalhes: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          subtask_id?: string | null;
          approval_round_id?: string | null;
          acao: string;
          de_valor?: string | null;
          para_valor?: string | null;
          autor_id?: string | null;
          detalhes?: Json | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      task_types: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          client_id: string | null;
          workflow_template_id: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          client_id?: string | null;
          workflow_template_id?: string | null;
          ativo?: boolean;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          client_id?: string | null;
          workflow_template_id?: string | null;
          ativo?: boolean;
        };
        Relationships: [];
      };
      workflow_templates: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          client_id: string | null;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          client_id?: string | null;
          ativo?: boolean;
          criado_por?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          client_id?: string | null;
          ativo?: boolean;
        };
        Relationships: [];
      };
      workflow_steps: {
        Row: {
          id: string;
          template_id: string;
          nome: string;
          ordem: number;
          responsavel_padrao_id: string | null;
          funcao_padrao: TeamFuncao | null;
          prioridade: TaskPrioridade;
          prazo_offset_dias: number | null;
          requer_aprovacao: boolean;
          tipo_aprovacao: TipoAprovacao | null;
          depende_de_ordem: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          nome: string;
          ordem: number;
          responsavel_padrao_id?: string | null;
          funcao_padrao?: TeamFuncao | null;
          prioridade?: TaskPrioridade;
          prazo_offset_dias?: number | null;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          depende_de_ordem?: number | null;
        };
        Update: {
          nome?: string;
          ordem?: number;
          responsavel_padrao_id?: string | null;
          funcao_padrao?: TeamFuncao | null;
          prioridade?: TaskPrioridade;
          prazo_offset_dias?: number | null;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          depende_de_ordem?: number | null;
        };
        Relationships: [];
      };
      task_referencias: {
        Row: {
          id: string;
          task_id: string;
          tipo: "link" | "arquivo";
          url: string;
          titulo: string | null;
          arquivo_nome: string | null;
          adicionado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          tipo: "link" | "arquivo";
          url: string;
          titulo?: string | null;
          arquivo_nome?: string | null;
          adicionado_por?: string | null;
        };
        Update: { titulo?: string | null };
        Relationships: [];
      };
      task_comentarios: {
        Row: {
          id: string;
          task_id: string;
          subtask_id: string | null;
          approval_round_id: string | null;
          autor_id: string;
          texto: string;
          interno: boolean;
          resposta_a: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          subtask_id?: string | null;
          approval_round_id?: string | null;
          autor_id: string;
          texto: string;
          interno?: boolean;
          resposta_a?: string | null;
        };
        Update: { texto?: string };
        Relationships: [];
      };

      /**
       * Post de social media.
       *
       * **O cliente só enxerga o que tem `enviado_em` preenchido**, e quem
       * decide isso é a policy `posts_select_cliente` (0032) — nenhuma
       * consulta do produto repete o filtro. `enviado_em` e `status` ficam
       * FORA de Insert e de Update: quem os escreve são o trigger
       * `approval_rounds_marca_post` e a função `decidir_rodada_do_cliente`,
       * a partir da rodada. Tentar gravá-los é erro de tipo antes de ser
       * recusa do banco — a mesma decisão do cronômetro da subtarefa.
       */
      posts: {
        Row: {
          id: string;
          client_id: string;
          subtask_id: string | null;
          tema: string;
          legenda: string | null;
          data_publicacao: string;
          horario: string | null;
          plataforma: PlataformaSocial;
          formato: string | null;
          midia: PostMidia;
          // Video e por LINK e nao por upload (0042, decisao do usuario): o
          // visualizador do portal desenha <img>, e player e poster sao
          // entrega propria.
          video_url: string | null;
          status: ContentStatus;
          // A CAPA. Num carrossel e o primeiro slide, escrito pelo trigger
          // `post_versions_sincroniza` -- e por isso que o calendario, o card
          // e a miniatura do portal nao sabem que carrossel existe.
          arte_url: string | null;
          thumbnail_url: string | null;
          versao_atual: number;
          prazo_aprovacao: string | null;
          // Escrito pelo trigger `approval_rounds_marca_post` (0032), nunca a
          // mao: enviar E abrir a rodada de escopo cliente.
          enviado_em: string | null;
          // Para quem a gestao liberou a producao (0042). Nulo = ninguem
          // pegou. NAO e `criado_por`: depois da 0042 quem cria e a gestao,
          // que abre o briefing, e quem produz e esta pessoa.
          responsavel_id: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          subtask_id?: string | null;
          tema: string;
          legenda?: string | null;
          data_publicacao: string;
          horario?: string | null;
          plataforma: PlataformaSocial;
          formato?: string | null;
          midia?: PostMidia;
          video_url?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          prazo_aprovacao?: string | null;
          responsavel_id?: string | null;
          criado_por?: string | null;
        };
        Update: {
          tema?: string;
          legenda?: string | null;
          data_publicacao?: string;
          horario?: string | null;
          plataforma?: PlataformaSocial;
          formato?: string | null;
          midia?: PostMidia;
          video_url?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          prazo_aprovacao?: string | null;
          subtask_id?: string | null;
          status?: ContentStatus;
          // Quem libera e a gestao: o trigger `posts_protege_colunas` (0042)
          // recusa o colaborador que tentar, e a recusa diz por que.
          responsavel_id?: string | null;
        };
        Relationships: [];
      };

      /**
       * O histórico de artes e legendas de um post.
       *
       * `numero_versao` fica fora de Insert: quem numera é o trigger
       * `post_versions_numera`, para duas abas salvando ao mesmo tempo não
       * baterem no `unique`.
       */
      post_versions: {
        Row: {
          id: string;
          post_id: string;
          numero_versao: number;
          arte_url: string | null;
          thumbnail_url: string | null;
          // Os slides desta versao, em ordem. A CAPA continua em
          // `posts.arte_url`, alimentada pelo primeiro slide.
          arquivos: ArquivoDaVersao[];
          video_url: string | null;
          legenda: string | null;
          notas_mudanca: string | null;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          arquivos?: ArquivoDaVersao[];
          video_url?: string | null;
          legenda?: string | null;
          notas_mudanca?: string | null;
          criado_por?: string | null;
        };
        Update: { notas_mudanca?: string | null };
        Relationships: [];
      };

      /**
       * Comentário de post ou de entregável.
       *
       * `interno` está no Insert de propósito: a equipe escolhe. O que impede
       * o cliente de escolher não é o tipo — é o trigger `comments_normaliza`,
       * que reescreve para `false` quem não é da equipe. Policy não limita
       * coluna, e tipo muito menos.
       *
       * Sem Update: comentário preso a uma rodada é o registro do que foi
       * pedido e do que foi respondido, e não se reescreve.
       */
      comments: {
        Row: {
          id: string;
          content_type: TipoDeConteudo;
          content_id: string;
          approval_round_id: string | null;
          autor_id: string;
          texto: string;
          resposta_a: string | null;
          interno: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_type: TipoDeConteudo;
          content_id: string;
          approval_round_id?: string | null;
          autor_id: string;
          texto: string;
          resposta_a?: string | null;
          interno?: boolean;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      /**
       * O formato de campanha da casa -- a Wave e o que mais vier.
       *
       * `estrutura_json` e uma arvore em `jsonb`, e nao um par de tabelas como
       * o workflow de task. A diferenca e o que se faz com cada um: o workflow
       * guarda funcao, prazo relativo e responsavel por etapa, coisas que se
       * consultam; isto aqui e uma lista de nomes que alguem edita inteira
       * antes de salvar. Normalizar seria criar duas tabelas para servir um
       * `select * where id = ?`.
       *
       * `client_id` nulo e template da casa, que serve a todo cliente.
       */
      campaign_templates: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          estrutura_json: EstruturaDeTemplate;
          client_id: string | null;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          estrutura_json: EstruturaDeTemplate;
          client_id?: string | null;
          ativo?: boolean;
          criado_por?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          estrutura_json?: EstruturaDeTemplate;
          ativo?: boolean;
        };
        Relationships: [];
      };

      campaigns: {
        Row: {
          id: string;
          client_id: string;
          nome: string;
          descricao: string | null;
          data_inicio: string;
          data_fim: string;
          template_id: string | null;
          status: CampaignStatus;
          drive_folder_id: string | null;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nome: string;
          descricao?: string | null;
          data_inicio: string;
          data_fim: string;
          template_id?: string | null;
          status?: CampaignStatus;
          drive_folder_id?: string | null;
          criado_por?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          data_inicio?: string;
          data_fim?: string;
          status?: CampaignStatus;
          drive_folder_id?: string | null;
        };
        Relationships: [];
      };

      /**
       * Um entregavel da campanha. `parent_id` nulo e item de topo.
       *
       * **`status` esta no Update, e no grupo ele e descartado.** Quem tem
       * filho para de ser unidade de trabalho -- a mesma regra da Task com as
       * subtarefas e da etapa com as sub-etapas --, e o status que o grupo
       * mostra sai de `status_do_entregavel()`. Descartar em vez de recusar e
       * escolha: quem edita um grupo quase sempre esta mexendo no nome, na
       * ordem ou no prazo, e recusar o update inteiro por causa de um campo
       * que a tela nem mostra travaria o trabalho para proteger um valor que
       * ninguem le.
       *
       * **`enviado_em` fica fora dos dois.** Quem carimba e o trigger
       * `approval_rounds_marca_conteudo`, no instante em que a rodada de
       * escopo cliente nasce: enviar E abrir a rodada. Separados, daria para
       * ter rodada de um material que o cliente nao enxerga.
       */
      deliverables: {
        Row: {
          id: string;
          campaign_id: string;
          parent_id: string | null;
          subtask_id: string | null;
          nome: string;
          descricao: string | null;
          ordem: number;
          status: ContentStatus;
          prazo: string | null;
          arte_url: string | null;
          thumbnail_url: string | null;
          arquivo_nome: string | null;
          versao_atual: number;
          responsavel_id: string | null;
          enviado_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          parent_id?: string | null;
          subtask_id?: string | null;
          nome: string;
          descricao?: string | null;
          ordem?: number;
          status?: ContentStatus;
          prazo?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          arquivo_nome?: string | null;
          responsavel_id?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          ordem?: number;
          status?: ContentStatus;
          prazo?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          arquivo_nome?: string | null;
          responsavel_id?: string | null;
          subtask_id?: string | null;
        };
        Relationships: [];
      };

      /**
       * O historico de arquivos de um entregavel.
       *
       * `numero_versao` fica fora de Insert pela mesma razao de
       * `post_versions`: quem numera e o trigger, para duas abas salvando ao
       * mesmo tempo nao baterem no `unique`.
       *
       * Sem Update nem Delete do lado do cliente -- e a ausencia de policy de
       * escrita e a trava, nao a ausencia do botao: reverter muda o que vai
       * ao ar, e quem responde por isso e a agencia.
       */
      deliverable_versions: {
        Row: {
          id: string;
          deliverable_id: string;
          numero_versao: number;
          arte_url: string | null;
          thumbnail_url: string | null;
          arquivo_nome: string | null;
          notas_mudanca: string | null;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deliverable_id: string;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          arquivo_nome?: string | null;
          notas_mudanca?: string | null;
          criado_por?: string | null;
        };
        Update: { notas_mudanca?: string | null };
        Relationships: [];
      };
    };
    Functions: {
      academy_reordenar: { Args: { p_track_id: string; p_ids: string[] }; Returns: number };
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_socio: { Args: Record<string, never>; Returns: boolean };
      is_gestor: { Args: Record<string, never>; Returns: boolean };
      is_atendimento: { Args: Record<string, never>; Returns: boolean };
      pode_editar_task: { Args: { p_task_id: string }; Returns: boolean };
      pode_aprovar_subtarefa: { Args: { p_subtask_id: string }; Returns: boolean };
      subtask_liberada: { Args: { p_subtask_id: string }; Returns: boolean };
      subtask_pendencias: { Args: { p_subtask_id: string }; Returns: string | null };
      /**
       * As pessoas com acesso as empresas de quem pergunta, com a data do
       * ultimo login (migration 0031).
       *
       * `security definer` porque devolve um agregado que a policy de
       * `client_access_log` nao deixaria montar linha a linha -- ela esconde o
       * rastro alheio de proposito, e a aba Usuarios precisa da DATA sem
       * precisar da lista.
       */
      usuarios_do_meu_cliente: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          nome: string;
          email: string;
          ultimo_acesso: string | null;
        }[];
      };
      decidir_rodada_do_cliente: {
        Args: { p_round_id: string; p_decisao: StatusRodada; p_comentario: string | null };
        Returns: void;
      };
      my_client_ids: { Args: Record<string, never>; Returns: string[] };

      // --- Cronometro da subtarefa (migration 0021) -----------------------
      // O gemeo em TypeScript e `minutosMedidos()`, em `lib/dominio/tempo.ts`.
      // Esta aqui serve a consulta e ao relatorio; a tela usa a de la, que
      // corre a cada segundo sem ir ao banco.
      tempo_medido_da_subtarefa: { Args: { p_subtask_id: string }; Returns: number | null };

      // --- Full Days e notificacoes (migration 0011) ----------------------
      dias_uteis: { Args: { inicio: string; fim: string }; Returns: number };
      dias_do_pedido: {
        Args: { p_tipo: HrTipo; p_inicio: string; p_fim: string };
        Returns: number;
      };
      /**
       * Saldo de descanso: tudo o que os ciclos de 12 meses ja concederam,
       * menos tudo o que a pessoa ja tirou (migration 0039).
       *
       * SEM O ANO, e e a mudanca inteira: era `(p_user_id, p_ano)`. O nome
       * ficou no vocabulario antigo pela decisao da 0016 -- nome de funcao e
       * de coluna nao se renomeia em uso, e ninguem que usa o sistema os ve.
       */
      saldo_de_ferias: { Args: { p_user_id: string }; Returns: number };
      parcelas_de_ferias: { Args: { p_user_id: string }; Returns: number };
      parcelas_concedidas: { Args: { p_user_id: string }; Returns: number };
      ciclos_de_descanso: { Args: { p_user_id: string }; Returns: number };
      inicio_do_ciclo: { Args: { p_user_id: string }; Returns: string | null };
      /**
       * Tudo o que a tela do saldo precisa, numa chamada so.
       *
       * A tela somava no navegador a partir da lista de pedidos e o banco
       * calculava a mesma coisa por outro caminho para validar. No modelo de
       * ciclo a conta depende da data de entrada, que a lista de pedidos nem
       * carrega -- entao ou a tela pergunta, ou mostra um numero que a trava
       * nao cumpre.
       */
      descanso_do_ciclo: {
        Args: { p_user_id: string };
        Returns: {
          inicio_do_ciclo: string | null;
          ciclos: number;
          dias_concedidos: number;
          dias_usados: number;
          saldo: number;
          parcelas_concedidas: number;
          parcelas_usadas: number;
        }[];
      };
      decidir_solicitacao: {
        Args: { p_request_id: string; p_decisao: HrStatus; p_motivo: string | null };
        Returns: void;
      };
      cancelar_solicitacao: { Args: { p_request_id: string }; Returns: void };
      /**
       * Gera UMA ocorrencia e devolve o id da task, ou null quando outra
       * execucao chegou primeiro (a idempotencia e o indice unico, nao uma
       * consulta). `security definer`: escreve em `recurrence_runs`, que nao
       * tem policy de escrita nenhuma.
       */
      gerar_ocorrencia: {
        Args: { p_recurrence_id: string; p_periodo: string };
        Returns: string | null;
      };
      /** A rotina diaria. Erro numa regra nao impede as outras. */
      gerar_recorrencias: {
        Args: Record<string, never>;
        Returns: {
          recurrence_id: string;
          regra: string;
          geradas: number;
          erro: string | null;
        }[];
      };
      /** O inicio do proximo periodo que a regra ainda vai gerar, ou null. */
      proximo_periodo_da_recorrencia: {
        Args: { p_recurrence_id: string };
        Returns: string | null;
      };
      /**
       * Registra um periodo que ja aconteceu, em nome de outra pessoa
       * (migration 0037). Nasce `aprovada`, pinta a presenca na mesma
       * transacao, e recusa quem nao e `is_gestor()` na primeira linha.
       *
       * `p_origem` nao entra aqui: a tela lanca, e importar arquivo e outro
       * caminho. O default da funcao e `lancamento_retroativo`.
       */
      lancar_periodo: {
        Args: {
          p_user_id: string;
          p_tipo: HrTipo;
          p_data_inicio: string;
          p_data_fim: string;
          p_observacao?: string | null;
        };
        Returns: string;
      };
      /**
       * Corrige um lancamento e REPINTA a presenca. Recusa `solicitacao`.
       *
       * NAO TEM `p_tipo`, e nao e esquecimento da migration: trocar o tipo
       * muda a regra de contagem (corrido x util) e o que o periodo desconta,
       * o que e outro registro e nao uma correcao. Trocou o tipo: apaga e
       * lanca de novo.
       */
      corrigir_lancamento: {
        Args: {
          p_request_id: string;
          p_data_inicio: string;
          p_data_fim: string;
          p_observacao?: string | null;
        };
        Returns: void;
      };
      /** Apaga um lancamento e despinta os dias dele. Recusa `solicitacao`. */
      apagar_lancamento: { Args: { p_request_id: string }; Returns: void };
      // Os rascunhos DE QUEM ESTA LOGADO que somem amanha (migration 0028).
      rascunhos_a_expirar: {
        Args: Record<string, never>;
        Returns: { id: string; titulo: string; updated_at: string }[];
      };
      limpar_rascunhos_abandonados: { Args: Record<string, never>; Returns: number };
      notificar: {
        Args: {
          p_user_id: string;
          p_tipo: NotificationTipo;
          p_titulo: string;
          p_corpo?: string | null;
          p_link?: string | null;
        };
        Returns: string | null;
      };
    };
    Views: {
      /** Progresso SEM a coluna `anotacoes`. É por aqui que a aba
       *  Acompanhamento lê — policy não limita coluna, e a anotação é
       *  privada. Veja a migration 0017. */
      academy_progresso_da_equipe: {
        Row: {
          user_id: string;
          track_id: string;
          material_id: string;
          concluido: boolean;
          concluido_em: string | null;
        };
        Relationships: [];
      };
    };
    Enums: {
      user_role: UserRole;
      team_funcao: TeamFuncao;
      task_prioridade: TaskPrioridade;
      task_status: TaskStatus;
      subtask_status: SubtaskStatus;
      tipo_aprovacao: TipoAprovacao;
      escopo_rodada: EscopoRodada;
      material_tipo: MaterialTipo;
      rec_categoria: RecCategoria;
      status_rodada: StatusRodada;
      plataforma_social: PlataformaSocial;
      campaign_status: CampaignStatus;
      notification_tipo: NotificationTipo;
      hr_tipo: HrTipo;
      hr_status: HrStatus;
      hr_origem: HrOrigem;
      recorrencia_modo: RecorrenciaModo;
      recorrencia_frequencia: RecorrenciaFrequencia;
      presenca_status: PresencaStatus;
      skill_nivel: SkillNivel;
      fin_tipo: FinTipo;
      fin_status: FinStatus;
      contrato_recorrencia: ContratoRecorrencia;
      pf_tipo: PfTipo;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AcademyTrack = Database["public"]["Tables"]["academy_tracks"]["Row"];
export type AcademyMaterial = Database["public"]["Tables"]["academy_materials"]["Row"];
export type AcademyProgress = Database["public"]["Tables"]["academy_progress"]["Row"];
export type Recomendacao = Database["public"]["Tables"]["recommendations"]["Row"];
export type RecomendacaoComentario =
  Database["public"]["Tables"]["recommendation_comments"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type ClientUser = Database["public"]["Tables"]["client_users"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskRecurrence =
  Database["public"]["Tables"]["task_recurrences"]["Row"];
export type RecurrenceRun =
  Database["public"]["Tables"]["recurrence_runs"]["Row"];
export type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];
export type TaskReferencia = Database["public"]["Tables"]["task_referencias"]["Row"];
export type TaskComentario = Database["public"]["Tables"]["task_comentarios"]["Row"];
export type SubtaskDependency = Database["public"]["Tables"]["subtask_dependencies"]["Row"];
export type ApprovalRound = Database["public"]["Tables"]["approval_rounds"]["Row"];
export type SubtaskEntrega = Database["public"]["Tables"]["subtask_entregas"]["Row"];
export type TaskHistory = Database["public"]["Tables"]["task_history"]["Row"];
export type TaskType = Database["public"]["Tables"]["task_types"]["Row"];
export type WorkflowTemplate = Database["public"]["Tables"]["workflow_templates"]["Row"];
export type WorkflowStep = Database["public"]["Tables"]["workflow_steps"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type HrRequest = Database["public"]["Tables"]["hr_requests"]["Row"];
export type TeamPresence = Database["public"]["Tables"]["team_presence"]["Row"];
export type Holiday = Database["public"]["Tables"]["holidays"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];
export type UserSkill = Database["public"]["Tables"]["user_skills"]["Row"];
export type SkillAvaliacao = Database["public"]["Tables"]["skill_avaliacoes"]["Row"];
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type FinanceCategory = Database["public"]["Tables"]["finance_categories"]["Row"];
export type FinanceEntry = Database["public"]["Tables"]["finance_entries"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostVersion = Database["public"]["Tables"]["post_versions"]["Row"];
export type Comentario = Database["public"]["Tables"]["comments"]["Row"];
