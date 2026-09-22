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
  | "aberta"
  | "em_andamento"
  | "aguardando_aprovacao"
  | "concluida"
  | "cancelada";

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
          ativo?: boolean;
          desligado_em?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          client_id: string | null;
          titulo: string;
          briefing_rico: Json | null;
          briefing_texto: string | null;
          prioridade: TaskPrioridade;
          status: TaskStatus;
          prazo: string | null;
          estimativa_horas: number | null;
          tempo_real_horas: number | null;
          responsavel_id: string | null;
          criado_por: string;
          etapa_atual_id: string | null;
          concluida_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          titulo: string;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          prazo?: string | null;
          estimativa_horas?: number | null;
          tempo_real_horas?: number | null;
          responsavel_id?: string | null;
          criado_por: string;
          etapa_atual_id?: string | null;
          concluida_em?: string | null;
        };
        Update: {
          client_id?: string | null;
          titulo?: string;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          prazo?: string | null;
          estimativa_horas?: number | null;
          tempo_real_horas?: number | null;
          responsavel_id?: string | null;
          etapa_atual_id?: string | null;
          concluida_em?: string | null;
        };
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          titulo: string;
          prazo: string | null;
          responsavel_id: string | null;
          estimativa_horas: number | null;
          tempo_real_horas: number | null;
          concluida: boolean;
          concluida_em: string | null;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          titulo: string;
          prazo?: string | null;
          responsavel_id?: string | null;
          estimativa_horas?: number | null;
          tempo_real_horas?: number | null;
          concluida?: boolean;
          concluida_em?: string | null;
          ordem?: number;
        };
        Update: {
          titulo?: string;
          prazo?: string | null;
          responsavel_id?: string | null;
          estimativa_horas?: number | null;
          tempo_real_horas?: number | null;
          concluida?: boolean;
          concluida_em?: string | null;
          ordem?: number;
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
          autor_id: string;
          texto: string;
          resposta_a: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          autor_id: string;
          texto: string;
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
      my_client_ids: { Args: Record<string, never>; Returns: string[] };
    };
    Enums: {
      user_role: UserRole;
      team_funcao: TeamFuncao;
      task_prioridade: TaskPrioridade;
      task_status: TaskStatus;
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
