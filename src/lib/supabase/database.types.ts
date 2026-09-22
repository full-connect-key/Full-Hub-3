/**
 * Tipos do banco de dados.
 *
 * Este arquivo pode (e deve) ser gerado automaticamente a partir do schema
 * real, assim o TypeScript avisa quando uma coluna muda de nome ou some:
 *
 *   npx supabase login
 *   npx supabase link --project-ref <ref-do-projeto>
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 *
 * Ate a primeira geracao, vale a versao escrita a mao abaixo, que cobre o que
 * a migration 0001 cria. A cada sprint, rode o comando de novo depois de
 * aplicar as migrations novas.
 */

export type Papel = "admin" | "membro";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      perfis: {
        Row: {
          id: string;
          nome_completo: string | null;
          email: string | null;
          cargo: string | null;
          avatar_url: string | null;
          papel: Papel;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id: string;
          nome_completo?: string | null;
          email?: string | null;
          cargo?: string | null;
          avatar_url?: string | null;
          papel?: Papel;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          nome_completo?: string | null;
          email?: string | null;
          cargo?: string | null;
          avatar_url?: string | null;
          papel?: Papel;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      e_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Perfil = Database["public"]["Tables"]["perfis"]["Row"];
