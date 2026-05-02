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
      body_weights: {
        Row: {
          created_at: string
          id: string
          recorded_at: string
          unit: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          recorded_at?: string
          unit?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          recorded_at?: string
          unit?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      exercise_notes: {
        Row: {
          created_at: string
          difficulty: number | null
          exercise_id: string
          id: string
          note: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: number | null
          exercise_id: string
          id?: string
          note?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: number | null
          exercise_id?: string
          id?: string
          note?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          aliases: string[]
          created_at: string
          id: string
          is_compound: boolean
          is_custom: boolean
          muscle_group: string
          name: string
          owner_id: string | null
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: string
          is_compound?: boolean
          is_custom?: boolean
          muscle_group: string
          name: string
          owner_id?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          is_compound?: boolean
          is_custom?: boolean
          muscle_group?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      plan_day_exercises: {
        Row: {
          created_at: string
          day_id: string
          exercise_id: string
          id: string
          position: number
          superset_group: number | null
          target_reps: number
          target_sets: number
        }
        Insert: {
          created_at?: string
          day_id: string
          exercise_id: string
          id?: string
          position?: number
          superset_group?: number | null
          target_reps?: number
          target_sets?: number
        }
        Update: {
          created_at?: string
          day_id?: string
          exercise_id?: string
          id?: string
          position?: number
          superset_group?: number | null
          target_reps?: number
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_day_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_day_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          created_at: string
          day_number: number
          id: string
          name: string | null
          plan_id: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          name?: string | null
          plan_id: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          name?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_shares: {
        Row: {
          created_at: string
          id: string
          plan_description: string | null
          plan_name: string
          revoked_at: string | null
          shared_by_name: string
          slug: string
          snapshot: Json
          source_plan_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_description?: string | null
          plan_name: string
          revoked_at?: string | null
          shared_by_name: string
          slug: string
          snapshot: Json
          source_plan_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_description?: string | null
          plan_name?: string
          revoked_at?: string | null
          shared_by_name?: string
          slug?: string
          snapshot?: Json
          source_plan_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile_shares: {
        Row: {
          created_at: string
          id: string
          revoked_at: string | null
          slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          goal: string
          id: string
          onboarded: boolean
          theme: string
          unit_pref: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          goal?: string
          id: string
          onboarded?: boolean
          theme?: string
          unit_pref?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          goal?: string
          id?: string
          onboarded?: boolean
          theme?: string
          unit_pref?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          position: number
          session_id: string
          superset_group: number | null
          target_reps: number
          target_sets: number
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          position?: number
          session_id: string
          superset_group?: number | null
          target_reps?: number
          target_sets?: number
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          position?: number
          session_id?: string
          superset_group?: number | null
          target_reps?: number
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sets: {
        Row: {
          completed_at: string
          id: string
          reps: number
          session_exercise_id: string
          set_number: number
          unit: string
          weight: number
        }
        Insert: {
          completed_at?: string
          id?: string
          reps?: number
          session_exercise_id: string
          set_number: number
          unit?: string
          weight?: number
        }
        Update: {
          completed_at?: string
          id?: string
          reps?: number
          session_exercise_id?: string
          set_number?: number
          unit?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_sets_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          day_number: number | null
          finished_at: string | null
          id: string
          notes: string | null
          plan_day_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          day_number?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          plan_day_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          day_number?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          plan_day_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_plan_share: { Args: { _slug: string }; Returns: Json }
      get_public_profile_stats: { Args: { _slug: string }; Returns: Json }
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
