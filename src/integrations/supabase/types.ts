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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      broadcasts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          message: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: []
      }
      game_progress: {
        Row: {
          attempts: number
          created_at: string
          first_entered_at: string | null
          hint_available_at: string | null
          hint_taken: boolean
          id: string
          level_number: number
          locked_until: string | null
          solved_at: string | null
          team_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          first_entered_at?: string | null
          hint_available_at?: string | null
          hint_taken?: boolean
          id?: string
          level_number: number
          locked_until?: string | null
          solved_at?: string | null
          team_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          first_entered_at?: string | null
          hint_available_at?: string | null
          hint_taken?: boolean
          id?: string
          level_number?: number
          locked_until?: string | null
          solved_at?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_progress_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          answer_key: string
          created_at: string
          hint_text: string
          id: string
          level_number: number
          story_audio_url: string | null
          story_text: string
          updated_at: string
          zip_file_url: string | null
        }
        Insert: {
          answer_key?: string
          created_at?: string
          hint_text?: string
          id?: string
          level_number: number
          story_audio_url?: string | null
          story_text?: string
          updated_at?: string
          zip_file_url?: string | null
        }
        Update: {
          answer_key?: string
          created_at?: string
          hint_text?: string
          id?: string
          level_number?: number
          story_audio_url?: string | null
          story_text?: string
          updated_at?: string
          zip_file_url?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          college_name: string
          created_at: string
          current_session_id: string | null
          email: string
          finish_time: string | null
          highest_unlocked_level: number
          id: string
          member_names: string[]
          phone_number: string
          start_time: string | null
          team_name: string
          user_id: string
        }
        Insert: {
          college_name: string
          created_at?: string
          current_session_id?: string | null
          email: string
          finish_time?: string | null
          highest_unlocked_level?: number
          id?: string
          member_names?: string[]
          phone_number: string
          start_time?: string | null
          team_name: string
          user_id: string
        }
        Update: {
          college_name?: string
          created_at?: string
          current_session_id?: string | null
          email?: string
          finish_time?: string | null
          highest_unlocked_level?: number
          id?: string
          member_names?: string[]
          phone_number?: string
          start_time?: string | null
          team_name?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      login_user: {
        Args: {
          p_email: string
          p_password: string
        }
        Returns: Json
      }
      register_user: {
        Args: {
          p_email: string
          p_password: string
          p_team_name: string
          p_college_name: string
          p_phone_number: string
          p_member_names: string[]
        }
        Returns: Json
      }
      create_admin_user: {
        Args: {
          p_email: string
          p_password: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "team"
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
    Enums: {
      app_role: ["admin", "team"],
    },
  },
} as const
