export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ev_alert_history: {
        Row: {
          alert_type: string
          content: string
          created_at: string
          email_sent: boolean
          id: string
          is_read: boolean
          title: string
          trigger_reason: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          content: string
          created_at?: string
          email_sent?: boolean
          id?: string
          is_read?: boolean
          title: string
          trigger_reason?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          content?: string
          created_at?: string
          email_sent?: boolean
          id?: string
          is_read?: boolean
          title?: string
          trigger_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ev_dca_records: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          id: string
          name: string
          price: number
          priority: string
          shares: number
          symbol: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          id?: string
          name: string
          price: number
          priority?: string
          shares: number
          symbol: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          name?: string
          price?: number
          priority?: string
          shares?: number
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      ev_decisions: {
        Row: {
          admission_market_cap: boolean | null
          admission_moat: boolean | null
          admission_profitable: boolean | null
          admission_result: string | null
          admission_volume: boolean | null
          buy_amount: number | null
          buy_price: number | null
          buy_shares: number | null
          cancelled: boolean | null
          created_at: string | null
          current_tier: number | null
          drop_percent: number | null
          ev_value: number | null
          executed: boolean | null
          expected_gain_pct: number | null
          expected_loss_pct: number | null
          fundamental_decline_reason: string | null
          fundamental_earnings: boolean | null
          fundamental_growth: boolean | null
          fundamental_industry: boolean | null
          fundamental_result: string | null
          holding_id: string | null
          id: string
          symbol: string
          user_id: string
          veto_gov_contract: boolean | null
          veto_leveraged: boolean | null
          veto_no_revenue: boolean | null
          win_probability: number | null
        }
        Insert: {
          admission_market_cap?: boolean | null
          admission_moat?: boolean | null
          admission_profitable?: boolean | null
          admission_result?: string | null
          admission_volume?: boolean | null
          buy_amount?: number | null
          buy_price?: number | null
          buy_shares?: number | null
          cancelled?: boolean | null
          created_at?: string | null
          current_tier?: number | null
          drop_percent?: number | null
          ev_value?: number | null
          executed?: boolean | null
          expected_gain_pct?: number | null
          expected_loss_pct?: number | null
          fundamental_decline_reason?: string | null
          fundamental_earnings?: boolean | null
          fundamental_growth?: boolean | null
          fundamental_industry?: boolean | null
          fundamental_result?: string | null
          holding_id?: string | null
          id?: string
          symbol: string
          user_id: string
          veto_gov_contract?: boolean | null
          veto_leveraged?: boolean | null
          veto_no_revenue?: boolean | null
          win_probability?: number | null
        }
        Update: {
          admission_market_cap?: boolean | null
          admission_moat?: boolean | null
          admission_profitable?: boolean | null
          admission_result?: string | null
          admission_volume?: boolean | null
          buy_amount?: number | null
          buy_price?: number | null
          buy_shares?: number | null
          cancelled?: boolean | null
          created_at?: string | null
          current_tier?: number | null
          drop_percent?: number | null
          ev_value?: number | null
          executed?: boolean | null
          expected_gain_pct?: number | null
          expected_loss_pct?: number | null
          fundamental_decline_reason?: string | null
          fundamental_earnings?: boolean | null
          fundamental_growth?: boolean | null
          fundamental_industry?: boolean | null
          fundamental_result?: string | null
          holding_id?: string | null
          id?: string
          symbol?: string
          user_id?: string
          veto_gov_contract?: boolean | null
          veto_leveraged?: boolean | null
          veto_no_revenue?: boolean | null
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ev_decisions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "ev_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      ev_earnings_calendar: {
        Row: {
          created_at: string
          earnings_date: string
          id: string
          name: string
          notes: string | null
          remind_0d: boolean
          remind_1d: boolean
          remind_7d: boolean
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          earnings_date: string
          id?: string
          name: string
          notes?: string | null
          remind_0d?: boolean
          remind_1d?: boolean
          remind_7d?: boolean
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          earnings_date?: string
          id?: string
          name?: string
          notes?: string | null
          remind_0d?: boolean
          remind_1d?: boolean
          remind_7d?: boolean
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      ev_errors: {
        Row: {
          created_at: string | null
          error_type: string
          id: string
          is_revoked: boolean | null
          lesson: string
          loss_estimate: number | null
          occurred_at: string
          symbol: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_type: string
          id?: string
          is_revoked?: boolean | null
          lesson: string
          loss_estimate?: number | null
          occurred_at: string
          symbol?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_type?: string
          id?: string
          is_revoked?: boolean | null
          lesson?: string
          loss_estimate?: number | null
          occurred_at?: string
          symbol?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ev_holdings: {
        Row: {
          asset_type: string
          avg_price: number
          buy_tier1_price: number | null
          buy_tier2_price: number | null
          buy_tier3_price: number | null
          created_at: string | null
          disposal_plan: string | null
          high_52w: number | null
          id: string
          is_closed: boolean | null
          name: string
          notes: string | null
          recent_high: number | null
          sell_tier1_done: boolean | null
          sell_tier1_price: number | null
          sell_tier2_done: boolean | null
          sell_tier2_price: number | null
          sell_tier3_done: boolean | null
          sell_tier3_price: number | null
          shares: number
          status: string
          symbol: string
          total_cost: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_type?: string
          avg_price: number
          buy_tier1_price?: number | null
          buy_tier2_price?: number | null
          buy_tier3_price?: number | null
          created_at?: string | null
          disposal_plan?: string | null
          high_52w?: number | null
          id?: string
          is_closed?: boolean | null
          name: string
          notes?: string | null
          recent_high?: number | null
          sell_tier1_done?: boolean | null
          sell_tier1_price?: number | null
          sell_tier2_done?: boolean | null
          sell_tier2_price?: number | null
          sell_tier3_done?: boolean | null
          sell_tier3_price?: number | null
          shares: number
          status?: string
          symbol: string
          total_cost: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_type?: string
          avg_price?: number
          buy_tier1_price?: number | null
          buy_tier2_price?: number | null
          buy_tier3_price?: number | null
          created_at?: string | null
          disposal_plan?: string | null
          high_52w?: number | null
          id?: string
          is_closed?: boolean | null
          name?: string
          notes?: string | null
          recent_high?: number | null
          sell_tier1_done?: boolean | null
          sell_tier1_price?: number | null
          sell_tier2_done?: boolean | null
          sell_tier2_price?: number | null
          sell_tier3_done?: boolean | null
          sell_tier3_price?: number | null
          shares?: number
          status?: string
          symbol?: string
          total_cost?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ev_monthly_reviews: {
        Row: {
          created_at: string | null
          holdings_status: Json | null
          id: string
          month: string
          next_month_plan: string | null
          review_data: Json | null
          user_id: string
          violations: string | null
          watchlist: string | null
        }
        Insert: {
          created_at?: string | null
          holdings_status?: Json | null
          id?: string
          month: string
          next_month_plan?: string | null
          review_data?: Json | null
          user_id: string
          violations?: string | null
          watchlist?: string | null
        }
        Update: {
          created_at?: string | null
          holdings_status?: Json | null
          id?: string
          month?: string
          next_month_plan?: string | null
          review_data?: Json | null
          user_id?: string
          violations?: string | null
          watchlist?: string | null
        }
        Relationships: []
      }
      ev_playbooks: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_custom: boolean
          scenario_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_custom?: boolean
          scenario_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_custom?: boolean
          scenario_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ev_rule_changes: {
        Row: {
          context: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string
          rule_name: string
          user_id: string
        }
        Insert: {
          context?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason: string
          rule_name: string
          user_id: string
        }
        Update: {
          context?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string
          rule_name?: string
          user_id?: string
        }
        Relationships: []
      }
      identities: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      operation_logs: {
        Row: {
          action: string
          created_at: string
          currency: string
          direction: string
          id: string
          identity_id: string
          name: string
          note: string | null
          order_id: string | null
          price: number
          shares: number
          symbol: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          identity_id: string
          name: string
          note?: string | null
          order_id?: string | null
          price: number
          shares: number
          symbol: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          identity_id?: string
          name?: string
          note?: string | null
          order_id?: string | null
          price?: number
          shares?: number
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_logs_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_orders: {
        Row: {
          action: string
          created_at: string
          currency: string
          direction: string
          executed_at: string | null
          executed_price: number | null
          id: string
          identity_id: string
          name: string
          reason: string | null
          shares: number
          source_article: string | null
          status: string
          strategy: string
          symbol: string
          target_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          currency?: string
          direction?: string
          executed_at?: string | null
          executed_price?: number | null
          id?: string
          identity_id: string
          name: string
          reason?: string | null
          shares?: number
          source_article?: string | null
          status?: string
          strategy?: string
          symbol: string
          target_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          currency?: string
          direction?: string
          executed_at?: string | null
          executed_price?: number | null
          id?: string
          identity_id?: string
          name?: string
          reason?: string | null
          shares?: number
          source_article?: string | null
          status?: string
          strategy?: string
          symbol?: string
          target_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_orders_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_events: {
        Row: {
          action: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          impact: number
          title: string
          trade_id: string
          type: string
          user_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          impact?: number
          title: string
          trade_id: string
          type: string
          user_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          impact?: number
          title?: string
          trade_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_events_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_notes: {
        Row: {
          ai_summary: string | null
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          category: string
          content: string
          created_at: string
          id: string
          identity_id: string
          is_pinned: boolean
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          category: string
          content: string
          created_at?: string
          id?: string
          identity_id: string
          is_pinned?: boolean
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          identity_id?: string
          is_pinned?: boolean
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_notes_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_reviews: {
        Row: {
          created_at: string
          goals: string
          id: string
          identity_id: string
          lessons: string
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          rating: number
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goals?: string
          id?: string
          identity_id: string
          lessons?: string
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          rating?: number
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goals?: string
          id?: string
          identity_id?: string
          lessons?: string
          period_end?: string
          period_label?: string
          period_start?: string
          period_type?: string
          rating?: number
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_reviews_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          buy_date: string
          buy_price: number
          buy_reason: string | null
          created_at: string
          currency: string
          direction: string
          id: string
          identity_id: string
          name: string
          sell_date: string | null
          sell_price: number | null
          sell_reason: string | null
          shares: number
          strategy: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buy_date: string
          buy_price: number
          buy_reason?: string | null
          created_at?: string
          currency?: string
          direction: string
          id?: string
          identity_id: string
          name: string
          sell_date?: string | null
          sell_price?: number | null
          sell_reason?: string | null
          shares: number
          strategy: string
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buy_date?: string
          buy_price?: number
          buy_reason?: string | null
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          identity_id?: string
          name?: string
          sell_date?: string | null
          sell_price?: number | null
          sell_reason?: string | null
          shares?: number
          strategy?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
