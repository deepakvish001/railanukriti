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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          action: string
          confidence: number
          created_at: string
          id: string
          impact: string
          is_active: boolean
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          train_id: string | null
          type: Database["public"]["Enums"]["recommendation_type"]
        }
        Insert: {
          action: string
          confidence?: number
          created_at?: string
          id?: string
          impact: string
          is_active?: boolean
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          train_id?: string | null
          type: Database["public"]["Enums"]["recommendation_type"]
        }
        Update: {
          action?: string
          confidence?: number
          created_at?: string
          id?: string
          impact?: string
          is_active?: boolean
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          train_id?: string | null
          type?: Database["public"]["Enums"]["recommendation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["id"]
          },
        ]
      }
      conflicts: {
        Row: {
          ai_suggestion: string | null
          created_at: string
          description: string
          detected_at: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          section_id: number | null
          severity: string
          status: string
          train_a_id: string | null
          train_b_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          ai_suggestion?: string | null
          created_at?: string
          description: string
          detected_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: number | null
          severity: string
          status?: string
          train_a_id?: string | null
          train_b_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          ai_suggestion?: string | null
          created_at?: string
          description?: string
          detected_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: number | null
          severity?: string
          status?: string
          train_a_id?: string | null
          train_b_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflicts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "track_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_train_a_id_fkey"
            columns: ["train_a_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_train_b_id_fkey"
            columns: ["train_b_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_section: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_section?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_section?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      section_metrics: {
        Row: {
          active_trains: number
          average_delay: number
          id: string
          on_time_performance: number
          pending_conflicts: number
          recorded_at: string
          throughput: number
          utilization: number
        }
        Insert: {
          active_trains?: number
          average_delay?: number
          id?: string
          on_time_performance?: number
          pending_conflicts?: number
          recorded_at?: string
          throughput?: number
          utilization?: number
        }
        Update: {
          active_trains?: number
          average_delay?: number
          id?: string
          on_time_performance?: number
          pending_conflicts?: number
          recorded_at?: string
          throughput?: number
          utilization?: number
        }
        Relationships: []
      }
      track_sections: {
        Row: {
          created_at: string
          gradient: number
          id: number
          length: number
          max_speed: number
          name: string
          occupied_by: string | null
          status: Database["public"]["Enums"]["track_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          gradient?: number
          id?: number
          length?: number
          max_speed?: number
          name: string
          occupied_by?: string | null
          status?: Database["public"]["Enums"]["track_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          gradient?: number
          id?: number
          length?: number
          max_speed?: number
          name?: string
          occupied_by?: string | null
          status?: Database["public"]["Enums"]["track_status"]
          updated_at?: string
        }
        Relationships: []
      }
      trains: {
        Row: {
          actual_time: string | null
          created_at: string
          current_section: number | null
          delay: number
          destination: string
          eta: string | null
          id: string
          name: string
          next_station: string | null
          number: string
          origin: string
          priority: Database["public"]["Enums"]["priority_level"]
          scheduled_time: string
          speed: number
          status: Database["public"]["Enums"]["train_status"]
          type: Database["public"]["Enums"]["train_type"]
          updated_at: string
        }
        Insert: {
          actual_time?: string | null
          created_at?: string
          current_section?: number | null
          delay?: number
          destination: string
          eta?: string | null
          id?: string
          name: string
          next_station?: string | null
          number: string
          origin: string
          priority?: Database["public"]["Enums"]["priority_level"]
          scheduled_time: string
          speed?: number
          status?: Database["public"]["Enums"]["train_status"]
          type?: Database["public"]["Enums"]["train_type"]
          updated_at?: string
        }
        Update: {
          actual_time?: string | null
          created_at?: string
          current_section?: number | null
          delay?: number
          destination?: string
          eta?: string | null
          id?: string
          name?: string
          next_station?: string | null
          number?: string
          origin?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          scheduled_time?: string
          speed?: number
          status?: Database["public"]["Enums"]["train_status"]
          type?: Database["public"]["Enums"]["train_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trains_current_section_fkey"
            columns: ["current_section"]
            isOneToOne: false
            referencedRelation: "track_sections"
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
      priority_level: "critical" | "high" | "medium" | "low"
      recommendation_type: "precedence" | "crossing" | "reroute" | "hold"
      track_status: "clear" | "occupied" | "blocked"
      train_status: "on-time" | "delayed" | "halted" | "approaching"
      train_type: "express" | "freight" | "local" | "special"
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
      priority_level: ["critical", "high", "medium", "low"],
      recommendation_type: ["precedence", "crossing", "reroute", "hold"],
      track_status: ["clear", "occupied", "blocked"],
      train_status: ["on-time", "delayed", "halted", "approaching"],
      train_type: ["express", "freight", "local", "special"],
    },
  },
} as const
