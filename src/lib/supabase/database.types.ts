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

export type StatusRodada = "pendente" | "aprovada" | "ajustes_solicitados";

export type NotificationTipo =
  | "task"
  | "aprovacao"
  | "full_days"
  | "equipe"
  | "cliente"
  | "sistema";

export type SkillNivel = "iniciante" | "intermediario" | "avancado" | "especialista";

export type HrTipo = "ferias" | "licenca" | "ausencia";
export type HrStatus = "pendente" | "aprovada" | "reprovada" | "cancelada";
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
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nome: string;
          role?: UserRole;
          avatar_url?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          nome?: string;
          role?: UserRole;
          avatar_url?: string | null;
          ativo?: boolean;
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
          ativo?: boolean;
        };
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
      /** O Resumo Semanal. Privado: so o dono le e escreve (migration 0010). */
      weekly_entries: {
        Row: {
          id: string;
          user_id: string;
          data: string;
          descricao: string;
          client_id: string | null;
          subtask_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data?: string;
          descricao: string;
          client_id?: string | null;
          subtask_id?: string | null;
        };
        Update: {
          data?: string;
          descricao?: string;
          client_id?: string | null;
          subtask_id?: string | null;
        };
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
      hr_requests: {
        Row: {
          id: string;
          user_id: string;
          tipo: HrTipo;
          data_inicio: string;
          data_fim: string;
          dias_uteis: number;
          motivo: string | null;
          status: HrStatus;
          motivo_reprovacao: string | null;
          aprovado_por: string | null;
          decidido_em: string | null;
          created_at: string;
        };
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
        // O update direto e so do dono e so enquanto pendente.
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
      weekly_notes: {
        Row: {
          id: string;
          user_id: string;
          semana: string;
          conteudo_rico: Json | null;
          conteudo_texto: string | null;
          humor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          semana: string;
          conteudo_rico?: Json | null;
          conteudo_texto?: string | null;
          humor?: string | null;
        };
        Update: {
          conteudo_rico?: Json | null;
          conteudo_texto?: string | null;
          humor?: string | null;
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
      tasks: {
        Row: {
          id: string;
          client_id: string;
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
          criado_por: string;
          concluida_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          titulo: string;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          status_manual?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          task_type_id?: string | null;
          workflow_snapshot?: Json | null;
          criado_por: string;
        };
        Update: {
          titulo?: string;
          client_id?: string;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          status_manual?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          task_type_id?: string | null;
          workflow_snapshot?: Json | null;
        };
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          titulo: string;
          descricao_rica: Json | null;
          descricao_texto: string | null;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          titulo: string;
          descricao_rica?: Json | null;
          descricao_texto?: string | null;
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
          titulo?: string;
          descricao_rica?: Json | null;
          descricao_texto?: string | null;
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
          subtask_id: string;
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
          subtask_id: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_socio: { Args: Record<string, never>; Returns: boolean };
      is_gestor: { Args: Record<string, never>; Returns: boolean };
      is_atendimento: { Args: Record<string, never>; Returns: boolean };
      pode_editar_task: { Args: { p_task_id: string }; Returns: boolean };
      pode_aprovar_subtarefa: { Args: { p_subtask_id: string }; Returns: boolean };
      subtask_liberada: { Args: { p_subtask_id: string }; Returns: boolean };
      subtask_pendencias: { Args: { p_subtask_id: string }; Returns: string | null };
      decidir_rodada_do_cliente: {
        Args: { p_round_id: string; p_decisao: StatusRodada; p_comentario: string | null };
        Returns: void;
      };
      my_client_ids: { Args: Record<string, never>; Returns: string[] };

      // --- Full Days e notificacoes (migration 0011) ----------------------
      dias_uteis: { Args: { inicio: string; fim: string }; Returns: number };
      saldo_de_ferias: { Args: { p_user_id: string; p_ano: number }; Returns: number };
      parcelas_de_ferias: { Args: { p_user_id: string; p_ano: number }; Returns: number };
      decidir_solicitacao: {
        Args: { p_request_id: string; p_decisao: HrStatus; p_motivo: string | null };
        Returns: void;
      };
      cancelar_solicitacao: { Args: { p_request_id: string }; Returns: void };
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
    Enums: {
      user_role: UserRole;
      team_funcao: TeamFuncao;
      task_prioridade: TaskPrioridade;
      task_status: TaskStatus;
      subtask_status: SubtaskStatus;
      tipo_aprovacao: TipoAprovacao;
      escopo_rodada: EscopoRodada;
      status_rodada: StatusRodada;
      notification_tipo: NotificationTipo;
      hr_tipo: HrTipo;
      hr_status: HrStatus;
      presenca_status: PresencaStatus;
      skill_nivel: SkillNivel;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type ClientUser = Database["public"]["Tables"]["client_users"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
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
export type WeeklyNote = Database["public"]["Tables"]["weekly_notes"]["Row"];
