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
          reviewed_by: string | null;
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
          reviewed_by?: string | null;
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
          reviewed_by?: string | null;
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
          category: string | null;
          created_at: string | null;
          id: string;
          instrument_id: string | null;
          message: string;
          metadata: Json | null;
          related_object_id: string | null;
          related_object_type: string | null;
          resolved_at: string | null;
          severity: string;
          source_agent: string | null;
          strategy_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          acknowledged?: boolean | null;
          category?: string | null;
          created_at?: string | null;
          id?: string;
          instrument_id?: string | null;
          message: string;
          metadata?: Json | null;
          related_object_id?: string | null;
          related_object_type?: string | null;
          resolved_at?: string | null;
          severity?: string;
          source_agent?: string | null;
          strategy_id?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          acknowledged?: boolean | null;
          category?: string | null;
          created_at?: string | null;
          id?: string;
          instrument_id?: string | null;
          message?: string;
          metadata?: Json | null;
          related_object_id?: string | null;
          related_object_type?: string | null;
          resolved_at?: string | null;
          severity?: string;
          source_agent?: string | null;
          strategy_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alerts_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'alerts_strategy_id_fkey';
            columns: ['strategy_id'];
            isOneToOne: false;
            referencedRelation: 'strategies';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'backtest_results_strategy_id_fkey';
            columns: ['strategy_id'];
            isOneToOne: false;
            referencedRelation: 'strategies';
            referencedColumns: ['id'];
          },
        ];
      };
      catalyst_events: {
        Row: {
          created_at: string;
          description: string | null;
          eps_actual: number | null;
          eps_estimate: number | null;
          event_date: string;
          event_time: string | null;
          event_type: string;
          id: string;
          impact: string | null;
          metadata: Json | null;
          revenue_actual: number | null;
          revenue_estimate: number | null;
          sector: string | null;
          source: string | null;
          source_id: string | null;
          ticker: string | null;
          title: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          eps_actual?: number | null;
          eps_estimate?: number | null;
          event_date: string;
          event_time?: string | null;
          event_type: string;
          id?: string;
          impact?: string | null;
          metadata?: Json | null;
          revenue_actual?: number | null;
          revenue_estimate?: number | null;
          sector?: string | null;
          source?: string | null;
          source_id?: string | null;
          ticker?: string | null;
          title: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          eps_actual?: number | null;
          eps_estimate?: number | null;
          event_date?: string;
          event_time?: string | null;
          event_type?: string;
          id?: string;
          impact?: string | null;
          metadata?: Json | null;
          revenue_actual?: number | null;
          revenue_estimate?: number | null;
          sector?: string | null;
          source?: string | null;
          source_id?: string | null;
          ticker?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      cycle_history: {
        Row: {
          agents_run: string[] | null;
          error: string | null;
          finished_at: string | null;
          holder_id: string;
          id: string;
          outcome: string;
          started_at: string;
        };
        Insert: {
          agents_run?: string[] | null;
          error?: string | null;
          finished_at?: string | null;
          holder_id: string;
          id?: string;
          outcome?: string;
          started_at?: string;
        };
        Update: {
          agents_run?: string[] | null;
          error?: string | null;
          finished_at?: string | null;
          holder_id?: string;
          id?: string;
          outcome?: string;
          started_at?: string;
        };
        Relationships: [];
      };
      data_quality_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: number;
          message: string;
          metadata: Json | null;
          provider: string | null;
          resolved: boolean;
          resolved_at: string | null;
          severity: string;
          ticker: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: never;
          message: string;
          metadata?: Json | null;
          provider?: string | null;
          resolved?: boolean;
          resolved_at?: string | null;
          severity?: string;
          ticker?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: never;
          message?: string;
          metadata?: Json | null;
          provider?: string | null;
          resolved?: boolean;
          resolved_at?: string | null;
          severity?: string;
          ticker?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      decision_journal: {
        Row: {
          agent_name: string | null;
          confidence: number | null;
          created_at: string;
          direction: string | null;
          event_type: string;
          graded_at: string | null;
          id: string;
          market_regime: string | null;
          metadata: Json | null;
          order_id: string | null;
          outcome_hold_minutes: number | null;
          outcome_pnl: number | null;
          outcome_return_pct: number | null;
          price: number | null;
          quantity: number | null;
          reasoning: string | null;
          recommendation_id: string | null;
          sector: string | null;
          signal_id: string | null;
          strategy_name: string | null;
          ticker: string | null;
          user_grade: string | null;
          user_id: string;
          user_notes: string | null;
          vix_at_time: number | null;
        };
        Insert: {
          agent_name?: string | null;
          confidence?: number | null;
          created_at?: string;
          direction?: string | null;
          event_type: string;
          graded_at?: string | null;
          id?: string;
          market_regime?: string | null;
          metadata?: Json | null;
          order_id?: string | null;
          outcome_hold_minutes?: number | null;
          outcome_pnl?: number | null;
          outcome_return_pct?: number | null;
          price?: number | null;
          quantity?: number | null;
          reasoning?: string | null;
          recommendation_id?: string | null;
          sector?: string | null;
          signal_id?: string | null;
          strategy_name?: string | null;
          ticker?: string | null;
          user_grade?: string | null;
          user_id: string;
          user_notes?: string | null;
          vix_at_time?: number | null;
        };
        Update: {
          agent_name?: string | null;
          confidence?: number | null;
          created_at?: string;
          direction?: string | null;
          event_type?: string;
          graded_at?: string | null;
          id?: string;
          market_regime?: string | null;
          metadata?: Json | null;
          order_id?: string | null;
          outcome_hold_minutes?: number | null;
          outcome_pnl?: number | null;
          outcome_return_pct?: number | null;
          price?: number | null;
          quantity?: number | null;
          reasoning?: string | null;
          recommendation_id?: string | null;
          sector?: string | null;
          signal_id?: string | null;
          strategy_name?: string | null;
          ticker?: string | null;
          user_grade?: string | null;
          user_id?: string;
          user_notes?: string | null;
          vix_at_time?: number | null;
        };
        Relationships: [];
      };
      fills: {
        Row: {
          broker_fill_id: string | null;
          commission: number;
          created_at: string;
          fill_price: number;
          fill_qty: number;
          fill_ts: string;
          id: string;
          order_id: string;
          slippage: number | null;
          venue: string | null;
        };
        Insert: {
          broker_fill_id?: string | null;
          commission?: number;
          created_at?: string;
          fill_price: number;
          fill_qty: number;
          fill_ts?: string;
          id?: string;
          order_id: string;
          slippage?: number | null;
          venue?: string | null;
        };
        Update: {
          broker_fill_id?: string | null;
          commission?: number;
          created_at?: string;
          fill_price?: number;
          fill_qty?: number;
          fill_ts?: string;
          id?: string;
          order_id?: string;
          slippage?: number | null;
          venue?: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'market_data_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      market_regime_history: {
        Row: {
          confidence: number;
          created_at: string;
          detected_at: string;
          expires_at: string | null;
          id: number;
          indicators: Json;
          notes: string | null;
          regime: string;
          source: string;
          user_id: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          detected_at?: string;
          expires_at?: string | null;
          id?: never;
          indicators?: Json;
          notes?: string | null;
          regime: string;
          source?: string;
          user_id: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          detected_at?: string;
          expires_at?: string | null;
          id?: never;
          indicators?: Json;
          notes?: string | null;
          regime?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      market_snapshots: {
        Row: {
          captured_at: string;
          created_at: string;
          day_change_pct: number | null;
          id: string;
          instrument_id: string;
          last_price: number | null;
          regime_label: string | null;
          source: string;
          volatility_score: number | null;
          volume: number | null;
        };
        Insert: {
          captured_at?: string;
          created_at?: string;
          day_change_pct?: number | null;
          id?: string;
          instrument_id: string;
          last_price?: number | null;
          regime_label?: string | null;
          source?: string;
          volatility_score?: number | null;
          volume?: number | null;
        };
        Update: {
          captured_at?: string;
          created_at?: string;
          day_change_pct?: number | null;
          id?: string;
          instrument_id?: string;
          last_price?: number | null;
          regime_label?: string | null;
          source?: string;
          volatility_score?: number | null;
          volume?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'market_snapshots_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      operator_actions: {
        Row: {
          action_type: string;
          created_at: string;
          id: string;
          metadata: Json;
          operator_id: string;
          reason: string | null;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action_type: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          operator_id: string;
          reason?: string | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action_type?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          operator_id?: string;
          reason?: string | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      orchestrator_locks: {
        Row: {
          acquired_at: string;
          expires_at: string;
          heartbeat_at: string;
          holder_id: string;
          lock_name: string;
        };
        Insert: {
          acquired_at?: string;
          expires_at: string;
          heartbeat_at?: string;
          holder_id: string;
          lock_name: string;
        };
        Update: {
          acquired_at?: string;
          expires_at?: string;
          heartbeat_at?: string;
          holder_id?: string;
          lock_name?: string;
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
        Relationships: [
          {
            foreignKeyName: 'orders_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_signal_id_fkey';
            columns: ['signal_id'];
            isOneToOne: false;
            referencedRelation: 'signals';
            referencedColumns: ['id'];
          },
        ];
      };
      policy_change_log: {
        Row: {
          changed_at: string;
          field_name: string;
          id: string;
          new_value: string | null;
          old_value: string | null;
          user_id: string;
        };
        Insert: {
          changed_at?: string;
          field_name: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
          user_id: string;
        };
        Update: {
          changed_at?: string;
          field_name?: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'portfolio_positions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_positions_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
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
          id?: never;
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
          id?: never;
          max_drawdown?: number | null;
          num_positions?: number | null;
          positions_value?: number;
          timestamp?: string;
          total_equity?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'portfolio_snapshots_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      recommendation_events: {
        Row: {
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          event_ts: string;
          event_type: string;
          id: string;
          payload: Json;
          recommendation_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          event_ts?: string;
          event_type: string;
          id?: string;
          payload?: Json;
          recommendation_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          event_ts?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          recommendation_id?: string;
        };
        Relationships: [];
      };
      regime_playbooks: {
        Row: {
          auto_approve: boolean;
          created_at: string;
          daily_loss_limit_pct: number | null;
          description: string | null;
          disabled_strategies: string[];
          enabled_strategies: string[];
          id: string;
          is_active: boolean;
          max_position_pct: number | null;
          max_sector_pct: number | null;
          name: string;
          position_size_modifier: number;
          regime: string;
          require_confirmation: boolean;
          strategy_weights: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_approve?: boolean;
          created_at?: string;
          daily_loss_limit_pct?: number | null;
          description?: string | null;
          disabled_strategies?: string[];
          enabled_strategies?: string[];
          id?: string;
          is_active?: boolean;
          max_position_pct?: number | null;
          max_sector_pct?: number | null;
          name: string;
          position_size_modifier?: number;
          regime: string;
          require_confirmation?: boolean;
          strategy_weights?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_approve?: boolean;
          created_at?: string;
          daily_loss_limit_pct?: number | null;
          description?: string | null;
          disabled_strategies?: string[];
          enabled_strategies?: string[];
          id?: string;
          is_active?: boolean;
          max_position_pct?: number | null;
          max_sector_pct?: number | null;
          name?: string;
          position_size_modifier?: number;
          regime?: string;
          require_confirmation?: boolean;
          strategy_weights?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      risk_evaluations: {
        Row: {
          adjusted_quantity: number | null;
          allowed: boolean;
          checks_performed: Json;
          created_at: string;
          evaluated_at: string;
          id: string;
          original_quantity: number | null;
          policy_version: string | null;
          reason: string | null;
          recommendation_id: string;
        };
        Insert: {
          adjusted_quantity?: number | null;
          allowed: boolean;
          checks_performed?: Json;
          created_at?: string;
          evaluated_at?: string;
          id?: string;
          original_quantity?: number | null;
          policy_version?: string | null;
          reason?: string | null;
          recommendation_id: string;
        };
        Update: {
          adjusted_quantity?: number | null;
          allowed?: boolean;
          checks_performed?: Json;
          created_at?: string;
          evaluated_at?: string;
          id?: string;
          original_quantity?: number | null;
          policy_version?: string | null;
          reason?: string | null;
          recommendation_id?: string;
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
          id?: never;
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
          id?: never;
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
        Relationships: [
          {
            foreignKeyName: 'risk_metrics_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      risk_policies: {
        Row: {
          approval_required: boolean;
          autonomy_mode: string;
          created_at: string;
          created_by: string | null;
          daily_loss_limit_pct: number;
          disabled_at: string | null;
          enabled_at: string;
          hard_drawdown_pct: number;
          id: string;
          max_position_pct: number;
          max_sector_pct: number;
          soft_drawdown_pct: number;
          version: number;
        };
        Insert: {
          approval_required?: boolean;
          autonomy_mode?: string;
          created_at?: string;
          created_by?: string | null;
          daily_loss_limit_pct?: number;
          disabled_at?: string | null;
          enabled_at?: string;
          hard_drawdown_pct?: number;
          id?: string;
          max_position_pct?: number;
          max_sector_pct?: number;
          soft_drawdown_pct?: number;
          version?: never;
        };
        Update: {
          approval_required?: boolean;
          autonomy_mode?: string;
          created_at?: string;
          created_by?: string | null;
          daily_loss_limit_pct?: number;
          disabled_at?: string | null;
          enabled_at?: string;
          hard_drawdown_pct?: number;
          id?: string;
          max_position_pct?: number;
          max_sector_pct?: number;
          soft_drawdown_pct?: number;
          version?: never;
        };
        Relationships: [];
      };
      role_change_log: {
        Row: {
          changed_by: string;
          created_at: string;
          id: string;
          new_role: string;
          old_role: string;
          reason: string | null;
          target_user_id: string;
        };
        Insert: {
          changed_by: string;
          created_at?: string;
          id?: string;
          new_role: string;
          old_role: string;
          reason?: string | null;
          target_user_id: string;
        };
        Update: {
          changed_by?: string;
          created_at?: string;
          id?: string;
          new_role?: string;
          old_role?: string;
          reason?: string | null;
          target_user_id?: string;
        };
        Relationships: [];
      };
      shadow_portfolio_snapshots: {
        Row: {
          cash: number;
          created_at: string;
          equity: number;
          id: number;
          max_drawdown_pct: number;
          positions_count: number;
          positions_value: number;
          shadow_portfolio_id: string;
          signals_approved: number;
          signals_blocked: number;
          signals_generated: number;
          snapshot_at: string;
          total_pnl: number;
          total_return_pct: number;
        };
        Insert: {
          cash?: number;
          created_at?: string;
          equity?: number;
          id?: never;
          max_drawdown_pct?: number;
          positions_count?: number;
          positions_value?: number;
          shadow_portfolio_id: string;
          signals_approved?: number;
          signals_blocked?: number;
          signals_generated?: number;
          snapshot_at?: string;
          total_pnl?: number;
          total_return_pct?: number;
        };
        Update: {
          cash?: number;
          created_at?: string;
          equity?: number;
          id?: never;
          max_drawdown_pct?: number;
          positions_count?: number;
          positions_value?: number;
          shadow_portfolio_id?: string;
          signals_approved?: number;
          signals_blocked?: number;
          signals_generated?: number;
          snapshot_at?: string;
          total_pnl?: number;
          total_return_pct?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'shadow_portfolio_snapshots_shadow_portfolio_id_fkey';
            columns: ['shadow_portfolio_id'];
            isOneToOne: false;
            referencedRelation: 'shadow_portfolios';
            referencedColumns: ['id'];
          },
        ];
      };
      shadow_portfolios: {
        Row: {
          created_at: string;
          daily_loss_limit_pct: number | null;
          description: string | null;
          disabled_strategies: string[];
          enabled_strategies: string[];
          hard_drawdown_pct: number | null;
          id: string;
          initial_capital: number;
          is_active: boolean;
          max_open_positions: number | null;
          max_position_pct: number | null;
          max_sector_pct: number | null;
          name: string;
          soft_drawdown_pct: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          daily_loss_limit_pct?: number | null;
          description?: string | null;
          disabled_strategies?: string[];
          enabled_strategies?: string[];
          hard_drawdown_pct?: number | null;
          id?: string;
          initial_capital?: number;
          is_active?: boolean;
          max_open_positions?: number | null;
          max_position_pct?: number | null;
          max_sector_pct?: number | null;
          name: string;
          soft_drawdown_pct?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          daily_loss_limit_pct?: number | null;
          description?: string | null;
          disabled_strategies?: string[];
          enabled_strategies?: string[];
          hard_drawdown_pct?: number | null;
          id?: string;
          initial_capital?: number;
          is_active?: boolean;
          max_open_positions?: number | null;
          max_position_pct?: number | null;
          max_sector_pct?: number | null;
          name?: string;
          soft_drawdown_pct?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      signal_runs: {
        Row: {
          created_at: string;
          days: number;
          errors: Json;
          finished_at: string | null;
          id: string;
          min_strength: number;
          requested_by: string;
          started_at: string;
          status: string;
          strategies: Json;
          total_signals: number;
          universe: Json;
        };
        Insert: {
          created_at?: string;
          days?: number;
          errors?: Json;
          finished_at?: string | null;
          id?: string;
          min_strength?: number;
          requested_by?: string;
          started_at?: string;
          status?: string;
          strategies?: Json;
          total_signals?: number;
          universe?: Json;
        };
        Update: {
          created_at?: string;
          days?: number;
          errors?: Json;
          finished_at?: string | null;
          id?: string;
          min_strength?: number;
          requested_by?: string;
          started_at?: string;
          status?: string;
          strategies?: Json;
          total_signals?: number;
          universe?: Json;
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
        Relationships: [
          {
            foreignKeyName: 'signals_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'signals_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'signals_strategy_id_fkey';
            columns: ['strategy_id'];
            isOneToOne: false;
            referencedRelation: 'strategies';
            referencedColumns: ['id'];
          },
        ];
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
          parameters?: Json;
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
      strategy_health_snapshots: {
        Row: {
          avg_confidence: number | null;
          avg_return_pct: number | null;
          computed_at: string;
          expectancy: number | null;
          expectancy_trend: string | null;
          false_positive_rate: number | null;
          health_label: string | null;
          health_score: number | null;
          id: string;
          losing_trades: number;
          max_drawdown: number | null;
          profit_factor: number | null;
          regime_performance: Json | null;
          sharpe_ratio: number | null;
          signal_freq_trend: string | null;
          source: string;
          strategy_name: string;
          total_signals: number;
          total_trades: number;
          win_rate: number | null;
          win_rate_trend: string | null;
          window_days: number;
          winning_trades: number;
        };
        Insert: {
          avg_confidence?: number | null;
          avg_return_pct?: number | null;
          computed_at?: string;
          expectancy?: number | null;
          expectancy_trend?: string | null;
          false_positive_rate?: number | null;
          health_label?: string | null;
          health_score?: number | null;
          id?: string;
          losing_trades?: number;
          max_drawdown?: number | null;
          profit_factor?: number | null;
          regime_performance?: Json | null;
          sharpe_ratio?: number | null;
          signal_freq_trend?: string | null;
          source?: string;
          strategy_name: string;
          total_signals?: number;
          total_trades?: number;
          win_rate?: number | null;
          win_rate_trend?: string | null;
          window_days?: number;
          winning_trades?: number;
        };
        Update: {
          avg_confidence?: number | null;
          avg_return_pct?: number | null;
          computed_at?: string;
          expectancy?: number | null;
          expectancy_trend?: string | null;
          false_positive_rate?: number | null;
          health_label?: string | null;
          health_score?: number | null;
          id?: string;
          losing_trades?: number;
          max_drawdown?: number | null;
          profit_factor?: number | null;
          regime_performance?: Json | null;
          sharpe_ratio?: number | null;
          signal_freq_trend?: string | null;
          source?: string;
          strategy_name?: string;
          total_signals?: number;
          total_trades?: number;
          win_rate?: number | null;
          win_rate_trend?: string | null;
          window_days?: number;
          winning_trades?: number;
        };
        Relationships: [];
      };
      system_controls: {
        Row: {
          global_mode: string;
          id: string;
          live_execution_enabled: boolean;
          max_daily_trades: number;
          trading_halted: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          global_mode?: string;
          id?: string;
          live_execution_enabled?: boolean;
          max_daily_trades?: number;
          trading_halted?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          global_mode?: string;
          id?: string;
          live_execution_enabled?: boolean;
          max_daily_trades?: number;
          trading_halted?: boolean;
          updated_at?: string;
          updated_by?: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'trades_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_entry_order_id_fkey';
            columns: ['entry_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_exit_order_id_fkey';
            columns: ['exit_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_strategy_id_fkey';
            columns: ['strategy_id'];
            isOneToOne: false;
            referencedRelation: 'strategies';
            referencedColumns: ['id'];
          },
        ];
      };
      user_profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_trading_policy: {
        Row: {
          auto_trading: boolean;
          created_at: string;
          daily_loss_limit_pct: number;
          hard_drawdown_pct: number;
          id: string;
          max_open_positions: number;
          max_position_pct: number;
          max_sector_pct: number;
          paper_trading: boolean;
          require_confirmation: boolean;
          soft_drawdown_pct: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_trading?: boolean;
          created_at?: string;
          daily_loss_limit_pct?: number;
          hard_drawdown_pct?: number;
          id?: string;
          max_open_positions?: number;
          max_position_pct?: number;
          max_sector_pct?: number;
          paper_trading?: boolean;
          require_confirmation?: boolean;
          soft_drawdown_pct?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_trading?: boolean;
          created_at?: string;
          daily_loss_limit_pct?: number;
          hard_drawdown_pct?: number;
          id?: string;
          max_open_positions?: number;
          max_position_pct?: number;
          max_sector_pct?: number;
          paper_trading?: boolean;
          require_confirmation?: boolean;
          soft_drawdown_pct?: number;
          updated_at?: string;
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
        Relationships: [
          {
            foreignKeyName: 'watchlist_items_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'watchlist_items_watchlist_id_fkey';
            columns: ['watchlist_id'];
            isOneToOne: false;
            referencedRelation: 'watchlists';
            referencedColumns: ['id'];
          },
        ];
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
      workflow_jobs: {
        Row: {
          agent_run_id: string | null;
          completed_at: string | null;
          created_at: string;
          current_step: string | null;
          error_count: number | null;
          error_message: string | null;
          id: string;
          idempotency_key: string | null;
          input_data: Json | null;
          max_retries: number | null;
          order_id: string | null;
          output_data: Json | null;
          recommendation_id: string | null;
          retry_after: string | null;
          started_at: string | null;
          status: string;
          steps_completed: string[] | null;
          timeout_at: string | null;
          updated_at: string;
          workflow_type: string;
        };
        Insert: {
          agent_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: string | null;
          error_count?: number | null;
          error_message?: string | null;
          id?: string;
          idempotency_key?: string | null;
          input_data?: Json | null;
          max_retries?: number | null;
          order_id?: string | null;
          output_data?: Json | null;
          recommendation_id?: string | null;
          retry_after?: string | null;
          started_at?: string | null;
          status?: string;
          steps_completed?: string[] | null;
          timeout_at?: string | null;
          updated_at?: string;
          workflow_type: string;
        };
        Update: {
          agent_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: string | null;
          error_count?: number | null;
          error_message?: string | null;
          id?: string;
          idempotency_key?: string | null;
          input_data?: Json | null;
          max_retries?: number | null;
          order_id?: string | null;
          output_data?: Json | null;
          recommendation_id?: string | null;
          retry_after?: string | null;
          started_at?: string | null;
          status?: string;
          steps_completed?: string[] | null;
          timeout_at?: string | null;
          updated_at?: string;
          workflow_type?: string;
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
      workflow_step_log: {
        Row: {
          duration_ms: number | null;
          error: string | null;
          executed_at: string;
          id: string;
          input_data: Json | null;
          job_id: string;
          output_data: Json | null;
          status: string;
          step_name: string;
        };
        Insert: {
          duration_ms?: number | null;
          error?: string | null;
          executed_at?: string;
          id?: string;
          input_data?: Json | null;
          job_id: string;
          output_data?: Json | null;
          status: string;
          step_name: string;
        };
        Update: {
          duration_ms?: number | null;
          error?: string | null;
          executed_at?: string;
          id?: string;
          input_data?: Json | null;
          job_id?: string;
          output_data?: Json | null;
          status?: string;
          step_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workflow_step_log_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'workflow_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      journal_stats: {
        Row: {
          avg_pnl: number | null;
          grade_variety: number | null;
          losses: number | null;
          total_entries: number | null;
          wins: number | null;
        };
        Relationships: [];
      };
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
        Relationships: [
          {
            foreignKeyName: 'portfolio_positions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_positions_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      risk_policy_current: {
        Row: {
          approval_required: boolean | null;
          autonomy_mode: string | null;
          created_at: string | null;
          created_by: string | null;
          daily_loss_limit_pct: number | null;
          disabled_at: string | null;
          enabled_at: string | null;
          hard_drawdown_pct: number | null;
          id: string | null;
          max_position_pct: number | null;
          max_sector_pct: number | null;
          soft_drawdown_pct: number | null;
          version: number | null;
        };
        Relationships: [];
      };
      strategy_health_latest: {
        Row: {
          avg_confidence: number | null;
          avg_return_pct: number | null;
          computed_at: string | null;
          expectancy: number | null;
          health_label: string | null;
          health_score: number | null;
          id: string | null;
          losing_trades: number | null;
          max_drawdown: number | null;
          profit_factor: number | null;
          sharpe_ratio: number | null;
          source: string | null;
          strategy_name: string | null;
          total_signals: number | null;
          total_trades: number | null;
          win_rate: number | null;
          window_days: number | null;
          winning_trades: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      acquire_lock: {
        Args: {
          p_holder_id: string;
          p_lock_name: string;
          p_ttl_seconds?: number;
        };
        Returns: boolean;
      };
      claim_workflow_job: {
        Args: {
          p_timeout_seconds?: number;
          p_worker_id: string;
          p_workflow_type: string;
        };
        Returns: string;
      };
      complete_workflow_step: {
        Args: {
          p_duration_ms?: number;
          p_job_id: string;
          p_next_step?: string;
          p_output?: Json;
          p_step_name: string;
        };
        Returns: boolean;
      };
      fail_workflow_job: {
        Args: {
          p_error: string;
          p_job_id: string;
          p_retry?: boolean;
          p_step_name?: string;
        };
        Returns: string;
      };
      get_user_role: { Args: { p_user_id?: string }; Returns: string };
      has_role_level: {
        Args: { p_required_role: string; p_user_id?: string };
        Returns: boolean;
      };
      heartbeat_lock: {
        Args: {
          p_holder_id: string;
          p_lock_name: string;
          p_ttl_seconds?: number;
        };
        Returns: boolean;
      };
      is_lock_held: { Args: { p_lock_name: string }; Returns: boolean };
      release_lock: {
        Args: { p_holder_id: string; p_lock_name: string };
        Returns: boolean;
      };
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

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
