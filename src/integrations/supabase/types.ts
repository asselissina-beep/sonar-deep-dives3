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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_config: {
        Row: {
          controller_footer: string
          controller_header: string
          created_at: string
          footer_text: string
          game_name: string
          gameplay_settings: Json
          id: string
          mission_description: string
          session_break_enabled: boolean
          session_break_minutes: number
          show_footer_text: boolean
          show_logo: boolean
          show_mission_description: boolean
          show_qr_code: boolean
          show_share_buttons: boolean
          show_slogan: boolean
          subtitle: string
          title: string
          umami_script_url: string
          umami_website_id: string
          updated_at: string
        }
        Insert: {
          controller_footer?: string
          controller_header?: string
          created_at?: string
          footer_text?: string
          game_name?: string
          gameplay_settings?: Json
          id?: string
          mission_description?: string
          session_break_enabled?: boolean
          session_break_minutes?: number
          show_footer_text?: boolean
          show_logo?: boolean
          show_mission_description?: boolean
          show_qr_code?: boolean
          show_share_buttons?: boolean
          show_slogan?: boolean
          subtitle?: string
          title?: string
          umami_script_url?: string
          umami_website_id?: string
          updated_at?: string
        }
        Update: {
          controller_footer?: string
          controller_header?: string
          created_at?: string
          footer_text?: string
          game_name?: string
          gameplay_settings?: Json
          id?: string
          mission_description?: string
          session_break_enabled?: boolean
          session_break_minutes?: number
          show_footer_text?: boolean
          show_logo?: boolean
          show_mission_description?: boolean
          show_qr_code?: boolean
          show_share_buttons?: boolean
          show_slogan?: boolean
          subtitle?: string
          title?: string
          umami_script_url?: string
          umami_website_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          created_at: string
          depth: number
          id: string
          player_name: string
          score: number
          session_code: string
          session_id: string | null
          wave: number
        }
        Insert: {
          created_at?: string
          depth?: number
          id?: string
          player_name?: string
          score?: number
          session_code: string
          session_id?: string | null
          wave?: number
        }
        Update: {
          created_at?: string
          depth?: number
          id?: string
          player_name?: string
          score?: number
          session_code?: string
          session_id?: string | null
          wave?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          player_name: string | null
          session_code: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          player_name?: string | null
          session_code: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          player_name?: string | null
          session_code?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      player_registrations: {
        Row: {
          company: string
          created_at: string
          email: string
          first_name: string
          gdpr_consent: boolean
          id: string
          last_name: string
          session_code: string
        }
        Insert: {
          company: string
          created_at?: string
          email: string
          first_name: string
          gdpr_consent?: boolean
          id?: string
          last_name: string
          session_code: string
        }
        Update: {
          company?: string
          created_at?: string
          email?: string
          first_name?: string
          gdpr_consent?: boolean
          id?: string
          last_name?: string
          session_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
