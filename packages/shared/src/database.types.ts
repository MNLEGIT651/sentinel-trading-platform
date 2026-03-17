// AUTO-GENERATED — do not edit by hand.
// Regenerate with: Supabase MCP → generate_typescript_types (project: luwyjfwauljwsfsnwiqb)
// Last generated: 2026-03-17

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.4';
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          broker: string;
          created_at: string | null;
          id: string;
          initial_capital: number;
          is_active: boolean | null;
          is_default: boolean | null;
          name: string;
          user_id: string;
        };
        Insert: {
          broker?: string;
          created_at?: string | null;
          id?: string;
          initial_capital?: number;
          is_active?: boolean | null;
          is_default?: boolean | null;
          name: string;
          user_id: string;
        };
        Update: {
          broker?: string;
          created_at?: string | null;
          id?: string;
          initial_capital?: number;
          is_active?: boolean | null;
          is_default?: boolean | null;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      agent_alerts: {
        Row: {
          acknowledged: boolean;
          created_at: string;
          id: string;
          message: string;
          severity: string;
          ticker: string | null;
          title: string;
        };
        Insert: {
          acknowledged?: boolean;
          created_at?: string;
          id?: string;
          message: string;
          severity: string;
          ticker?: string | null;
          title: string;
        };
        Update: {
          acknowledged?: boolean;
          created_at?: string;
          id?: string;
          message?: string;
          severity?: string;
          ticker?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      agent_logs: {
        Row: {
          action: string;
          agent_name: string;
          created_at: string | null;
          duration_ms: number | null;
          id: string;
          input: Json | null;
          output: Json | null;
          status: string | null;
          tokens_used: number | null;
        };
        Insert: {
          action: string;
          agent_name: string;
          created_at?: string | null;
          duration_ms?: number | null;
          id?: string;
          input?: Json | null;
          output?: Json | null;
          status?: string | null;
          tokens_used?: number | null;
        };
        Update: {
          action?: string;
          agent_name?: string;
          created_at?: string | null;
          duration_ms?: number | null;
          id?: string;
          input?: Json | null;
          output?: Json | null;
          status?: string | null;
          tokens_used?: number | null;
        };
        Relationships: [];
      };
      agent_recommendations: {
        Row: {
          agent_role: string;
          created_at: string;
          id: string;
          limit_price: number | null;
          metadata: Json;
          order_id: string | null;
          order_type: string;
          quantity: number;
          reason: string | null;
          reviewed_at: string | null;
          side: string;
          signal_strength: number | null;
          status: string;
          strategy_name: string | null;
          ticker: string;
        };
        Insert: {
          agent_role: string;
          created_at?: string;
          id?: string;
          limit_price?: number | null;
          metadata?: Json;
          order_id?: string | null;
          order_type?: string;
          quantity: number;
          reason?: string | null;
          reviewed_at?: string | null;
          side: string;
          signal_strength?: number | null;
          status?: string;
          strategy_name?: string | null;
          ticker: string;
        };
        Update: {
          agent_role?: string;
          created_at?: string;
          id?: string;
          limit_price?: number | null;
          metadata?: Json;
          order_id?: string | null;
          order_type?: string;
          quantity?: number;
          reason?: string | null;
          reviewed_at?: string | null;
          side?: string;
          signal_strength?: number | null;
          status?: string;
          strategy_name?: string | null;
          ticker?: string;
        };
        Relationships: [];
      };
      workflow_runs: {
        Row: {
          agent_role: string;
          created_at: string;
          cycle_number: number;
          error: string | null;
          finished_at: string | null;
          id: string;
          started_at: string;
          success: boolean;
          summary: string | null;
          tools_called: Json | null;
          workflow_updates_made: Json | null;
          workflow_version: number;
        };
        Insert: {
          agent_role: string;
          created_at?: string;
          cycle_number: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          started_at?: string;
          success?: boolean;
          summary?: string | null;
          tools_called?: Json | null;
          workflow_updates_made?: Json | null;
          workflow_version: number;
        };
        Update: {
          agent_role?: string;
          created_at?: string;
          cycle_number?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          started_at?: string;
          success?: boolean;
          summary?: string | null;
          tools_called?: Json | null;
          workflow_updates_made?: Json | null;
          workflow_version?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      portfolio_positions_live: {
        Row: {
          account_id: string | null;
          avg_entry_price: number | null;
          current_price: number | null;
          id: string | null;
          instrument_id: string | null;
          opened_at: string | null;
          quantity: number | null;
          realized_pnl: number | null;
          side: string | null;
          unrealized_pnl: number | null;
          unrealized_pnl_pct: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type WorkflowRunRow = Tables<'workflow_runs'>;
