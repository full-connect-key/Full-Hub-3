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
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          nome_empresa?: string;
          nome_contato?: string | null;
          email_contato?: string | null;
          telefone?: string | null;
          drive_folder_id?: string | null;
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
          funcao: string | null;
          data_admissao: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cargo?: string | null;
          area?: string | null;
          funcao?: string | null;
          data_admissao?: string | null;
          created_at?: string;
        };
        Update: {
          cargo?: string | null;
          area?: string | null;
          funcao?: string | null;
          data_admissao?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_socio: { Args: Record<string, never>; Returns: boolean };
      is_gestor: { Args: Record<string, never>; Returns: boolean };
      my_client_ids: { Args: Record<string, never>; Returns: string[] };
    };
    Enums: { user_role: UserRole };
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
