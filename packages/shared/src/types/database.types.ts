export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
          metadata: Json;
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
      alerts: {
        Row: {
          acknowledged: boolean | null;
          created_at: string | null;
          id: string;
          instrument_id: string | null;
          message: string;
          metadata: Json | null;
          severity: string;
          strategy_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          acknowledged?: boolean | null;
          created_at?: string | null;
          id?: string;
          instrument_id?: string | null;
          message: string;
          metadata?: Json | null;
          severity?: string;
          strategy_id?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          acknowledged?: boolean | null;
          created_at?: string | null;
          id?: string;
          instrument_id?: string | null;
          message?: string;
          metadata?: Json | null;
          severity?: string;
          strategy_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      backtest_results: {
        Row: {
          annualized_return: number | null;
          avg_trade_return: number | null;
          calmar_ratio: number | null;
          created_at: string | null;
          drawdown_curve: Json | null;
          end_date: string;
          equity_curve: Json | null;
          final_equity: number | null;
          id: string;
          initial_capital: number;
          max_drawdown: number | null;
          metadata: Json | null;
          parameters: Json;
          profit_factor: number | null;
          sharpe_ratio: number | null;
          sortino_ratio: number | null;
          start_date: string;
          strategy_id: string;
          total_costs: number | null;
          total_return: number | null;
          total_trades: number | null;
          trade_log: Json | null;
          turnover: number | null;
          win_rate: number | null;
        };
        Insert: {
          annualized_return?: number | null;
          avg_trade_return?: number | null;
          calmar_ratio?: number | null;
          created_at?: string | null;
          drawdown_curve?: Json | null;
          end_date: string;
          equity_curve?: Json | null;
          final_equity?: number | null;
          id?: string;
          initial_capital: number;
          max_drawdown?: number | null;
          metadata?: Json | null;
          parameters: Json;
          profit_factor?: number | null;
          sharpe_ratio?: number | null;
          sortino_ratio?: number | null;
          start_date: string;
          strategy_id: string;
          total_costs?: number | null;
          total_return?: number | null;
          total_trades?: number | null;
          trade_log?: Json | null;
          turnover?: number | null;
          win_rate?: number | null;
        };
        Update: {
          annualized_return?: number | null;
          avg_trade_return?: number | null;
          calmar_ratio?: number | null;
          created_at?: string | null;
          drawdown_curve?: Json | null;
          end_date?: string;
          equity_curve?: Json | null;
          final_equity?: number | null;
          id?: string;
          initial_capital?: number;
          max_drawdown?: number | null;
          metadata?: Json | null;
          parameters?: Json;
          profit_factor?: number | null;
          sharpe_ratio?: number | null;
          sortino_ratio?: number | null;
          start_date?: string;
          strategy_id?: string;
          total_costs?: number | null;
          total_return?: number | null;
          total_trades?: number | null;
          trade_log?: Json | null;
          turnover?: number | null;
          win_rate?: number | null;
        };
        Relationships: [];
      };
      instruments: {
        Row: {
          asset_class: string;
          created_at: string | null;
          exchange: string | null;
          id: string;
          is_active: boolean | null;
          metadata: Json | null;
          name: string;
          sector: string | null;
          ticker: string;
          updated_at: string | null;
        };
        Insert: {
          asset_class: string;
          created_at?: string | null;
          exchange?: string | null;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          name: string;
          sector?: string | null;
          ticker: string;
          updated_at?: string | null;
        };
        Update: {
          asset_class?: string;
          created_at?: string | null;
          exchange?: string | null;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          name?: string;
          sector?: string | null;
          ticker?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      market_data: {
        Row: {
          adjusted_close: number | null;
          close: number;
          created_at: string | null;
          high: number;
          instrument_id: string;
          low: number;
          open: number;
          source: string;
          timeframe: string;
          timestamp: string;
          volume: number | null;
          vwap: number | null;
        };
        Insert: {
          adjusted_close?: number | null;
          close: number;
          created_at?: string | null;
          high: number;
          instrument_id: string;
          low: number;
          open: number;
          source: string;
          timeframe?: string;
          timestamp: string;
          volume?: number | null;
          vwap?: number | null;
        };
        Update: {
          adjusted_close?: number | null;
          close?: number;
          created_at?: string | null;
          high?: number;
          instrument_id?: string;
          low?: number;
          open?: number;
          source?: string;
          timeframe?: string;
          timestamp?: string;
          volume?: number | null;
          vwap?: number | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          account_id: string;
          broker: string;
          commission: number | null;
          created_at: string | null;
          fill_price: number | null;
          fill_quantity: number | null;
          filled_at: string | null;
          id: string;
          instrument_id: string;
          limit_price: number | null;
          order_type: string;
          quantity: number;
          side: string;
          signal_id: string | null;
          slippage: number | null;
          status: string;
          stop_price: number | null;
          submitted_at: string | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          broker?: string;
          commission?: number | null;
          created_at?: string | null;
          fill_price?: number | null;
          fill_quantity?: number | null;
          filled_at?: string | null;
          id?: string;
          instrument_id: string;
          limit_price?: number | null;
          order_type: string;
          quantity: number;
          side: string;
          signal_id?: string | null;
          slippage?: number | null;
          status?: string;
          stop_price?: number | null;
          submitted_at?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          broker?: string;
          commission?: number | null;
          created_at?: string | null;
          fill_price?: number | null;
          fill_quantity?: number | null;
          filled_at?: string | null;
          id?: string;
          instrument_id?: string;
          limit_price?: number | null;
          order_type?: string;
          quantity?: number;
          side?: string;
          signal_id?: string | null;
          slippage?: number | null;
          status?: string;
          stop_price?: number | null;
          submitted_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      portfolio_positions: {
        Row: {
          account_id: string;
          avg_entry_price: number;
          id: string;
          instrument_id: string;
          opened_at: string | null;
          quantity: number;
          realized_pnl: number | null;
          side: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          avg_entry_price: number;
          id?: string;
          instrument_id: string;
          opened_at?: string | null;
          quantity: number;
          realized_pnl?: number | null;
          side: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          avg_entry_price?: number;
          id?: string;
          instrument_id?: string;
          opened_at?: string | null;
          quantity?: number;
          realized_pnl?: number | null;
          side?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      portfolio_snapshots: {
        Row: {
          account_id: string;
          cash: number;
          cumulative_pnl: number | null;
          cumulative_return: number | null;
          daily_pnl: number | null;
          daily_return: number | null;
          drawdown: number | null;
          id: number;
          max_drawdown: number | null;
          num_positions: number | null;
          positions_value: number;
          timestamp: string;
          total_equity: number;
          user_id: string;
        };
        Insert: {
          account_id: string;
          cash: number;
          cumulative_pnl?: number | null;
          cumulative_return?: number | null;
          daily_pnl?: number | null;
          daily_return?: number | null;
          drawdown?: number | null;
          id: number;
          max_drawdown?: number | null;
          num_positions?: number | null;
          positions_value: number;
          timestamp?: string;
          total_equity: number;
          user_id: string;
        };
        Update: {
          account_id?: string;
          cash?: number;
          cumulative_pnl?: number | null;
          cumulative_return?: number | null;
          daily_pnl?: number | null;
          daily_return?: number | null;
          drawdown?: number | null;
          id?: number;
          max_drawdown?: number | null;
          num_positions?: number | null;
          positions_value?: number;
          timestamp?: string;
          total_equity?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      risk_metrics: {
        Row: {
          account_id: string;
          annualized_return: number | null;
          annualized_volatility: number | null;
          avg_loss: number | null;
          avg_win: number | null;
          beta: number | null;
          calmar_ratio: number | null;
          current_drawdown: number | null;
          cvar_95: number | null;
          id: number;
          max_drawdown: number | null;
          metadata: Json | null;
          profit_factor: number | null;
          sharpe_ratio: number | null;
          sortino_ratio: number | null;
          timestamp: string;
          turnover: number | null;
          user_id: string;
          var_95: number | null;
          win_rate: number | null;
        };
        Insert: {
          account_id: string;
          annualized_return?: number | null;
          annualized_volatility?: number | null;
          avg_loss?: number | null;
          avg_win?: number | null;
          beta?: number | null;
          calmar_ratio?: number | null;
          current_drawdown?: number | null;
          cvar_95?: number | null;
          id: number;
          max_drawdown?: number | null;
          metadata?: Json | null;
          profit_factor?: number | null;
          sharpe_ratio?: number | null;
          sortino_ratio?: number | null;
          timestamp?: string;
          turnover?: number | null;
          user_id: string;
          var_95?: number | null;
          win_rate?: number | null;
        };
        Update: {
          account_id?: string;
          annualized_return?: number | null;
          annualized_volatility?: number | null;
          avg_loss?: number | null;
          avg_win?: number | null;
          beta?: number | null;
          calmar_ratio?: number | null;
          current_drawdown?: number | null;
          cvar_95?: number | null;
          id?: number;
          max_drawdown?: number | null;
          metadata?: Json | null;
          profit_factor?: number | null;
          sharpe_ratio?: number | null;
          sortino_ratio?: number | null;
          timestamp?: string;
          turnover?: number | null;
          user_id?: string;
          var_95?: number | null;
          win_rate?: number | null;
        };
        Relationships: [];
      };
      signals: {
        Row: {
          account_id: string;
          confidence: number | null;
          direction: string;
          expires_at: string | null;
          generated_at: string | null;
          id: string;
          instrument_id: string;
          is_active: boolean | null;
          metadata: Json | null;
          strategy_id: string;
          strength: number;
          user_id: string;
        };
        Insert: {
          account_id: string;
          confidence?: number | null;
          direction: string;
          expires_at?: string | null;
          generated_at?: string | null;
          id?: string;
          instrument_id: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          strategy_id: string;
          strength: number;
          user_id: string;
        };
        Update: {
          account_id?: string;
          confidence?: number | null;
          direction?: string;
          expires_at?: string | null;
          generated_at?: string | null;
          id?: string;
          instrument_id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          strategy_id?: string;
          strength?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      strategies: {
        Row: {
          created_at: string | null;
          description: string | null;
          family: string;
          id: string;
          is_active: boolean | null;
          name: string;
          parameters: Json;
          updated_at: string | null;
          version: number | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          family: string;
          id?: string;
          is_active?: boolean | null;
          name: string;
          parameters: Json;
          updated_at?: string | null;
          version?: number | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          family?: string;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          parameters?: Json;
          updated_at?: string | null;
          version?: number | null;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          account_id: string;
          closed_at: string | null;
          entry_order_id: string | null;
          entry_price: number;
          exit_order_id: string | null;
          exit_price: number | null;
          gross_pnl: number | null;
          holding_period_days: number | null;
          id: string;
          instrument_id: string;
          net_pnl: number | null;
          opened_at: string | null;
          quantity: number;
          return_pct: number | null;
          side: string;
          status: string;
          strategy_id: string | null;
          total_costs: number | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          closed_at?: string | null;
          entry_order_id?: string | null;
          entry_price: number;
          exit_order_id?: string | null;
          exit_price?: number | null;
          gross_pnl?: number | null;
          holding_period_days?: number | null;
          id?: string;
          instrument_id: string;
          net_pnl?: number | null;
          opened_at?: string | null;
          quantity: number;
          return_pct?: number | null;
          side: string;
          status?: string;
          strategy_id?: string | null;
          total_costs?: number | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          closed_at?: string | null;
          entry_order_id?: string | null;
          entry_price?: number;
          exit_order_id?: string | null;
          exit_price?: number | null;
          gross_pnl?: number | null;
          holding_period_days?: number | null;
          id?: string;
          instrument_id?: string;
          net_pnl?: number | null;
          opened_at?: string | null;
          quantity?: number;
          return_pct?: number | null;
          side?: string;
          status?: string;
          strategy_id?: string | null;
          total_costs?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      watchlist_items: {
        Row: {
          added_at: string | null;
          instrument_id: string;
          watchlist_id: string;
        };
        Insert: {
          added_at?: string | null;
          instrument_id: string;
          watchlist_id: string;
        };
        Update: {
          added_at?: string | null;
          instrument_id?: string;
          watchlist_id?: string;
        };
        Relationships: [];
      };
      watchlists: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          is_default: boolean | null;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean | null;
          name: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean | null;
          name?: string;
          user_id?: string;
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

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;
