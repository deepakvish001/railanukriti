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
      block_sections: {
        Row: {
          block_time_minutes: number | null
          created_at: string
          distance_km: number
          electrified: boolean | null
          from_station_id: number | null
          gradient: number | null
          id: number
          max_speed: number
          section_code: string
          signalling_type: string | null
          to_station_id: number | null
          track_type: string | null
          updated_at: string
        }
        Insert: {
          block_time_minutes?: number | null
          created_at?: string
          distance_km: number
          electrified?: boolean | null
          from_station_id?: number | null
          gradient?: number | null
          id?: number
          max_speed?: number
          section_code: string
          signalling_type?: string | null
          to_station_id?: number | null
          track_type?: string | null
          updated_at?: string
        }
        Update: {
          block_time_minutes?: number | null
          created_at?: string
          distance_km?: number
          electrified?: boolean | null
          from_station_id?: number | null
          gradient?: number | null
          id?: number
          max_speed?: number
          section_code?: string
          signalling_type?: string | null
          to_station_id?: number | null
          track_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_sections_from_station_id_fkey"
            columns: ["from_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_sections_to_station_id_fkey"
            columns: ["to_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
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
      data_imports: {
        Row: {
          completed_at: string | null
          created_at: string
          data_type: string
          error_message: string | null
          file_name: string
          file_type: string
          id: string
          imported_by: string | null
          records_failed: number | null
          records_imported: number | null
          records_total: number | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_type: string
          error_message?: string | null
          file_name: string
          file_type: string
          id?: string
          imported_by?: string | null
          records_failed?: number | null
          records_imported?: number | null
          records_total?: number | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_type?: string
          error_message?: string | null
          file_name?: string
          file_type?: string
          id?: string
          imported_by?: string | null
          records_failed?: number | null
          records_imported?: number | null
          records_total?: number | null
          status?: string | null
        }
        Relationships: []
      }
      historical_runs: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          created_at: string
          delay_reason: string | null
          destination_station: string
          id: string
          load_tonnage: number | null
          origin_station: string
          run_date: string
          scheduled_arrival: string | null
          scheduled_departure: string | null
          total_delay_minutes: number | null
          train_number: string
          train_type: string
          wagons_count: number | null
          weather_condition: string | null
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          created_at?: string
          delay_reason?: string | null
          destination_station: string
          id?: string
          load_tonnage?: number | null
          origin_station: string
          run_date: string
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          total_delay_minutes?: number | null
          train_number: string
          train_type: string
          wagons_count?: number | null
          weather_condition?: string | null
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          created_at?: string
          delay_reason?: string | null
          destination_station?: string
          id?: string
          load_tonnage?: number | null
          origin_station?: string
          run_date?: string
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          total_delay_minutes?: number | null
          train_number?: string
          train_type?: string
          wagons_count?: number | null
          weather_condition?: string | null
        }
        Relationships: []
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
      schedules: {
        Row: {
          arrival_time: string | null
          created_at: string
          day_offset: number | null
          departure_time: string | null
          halt_duration_minutes: number | null
          id: string
          is_commercial_halt: boolean | null
          platform_number: number | null
          sequence_number: number
          station_id: number | null
          train_id: string | null
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string
          day_offset?: number | null
          departure_time?: string | null
          halt_duration_minutes?: number | null
          id?: string
          is_commercial_halt?: boolean | null
          platform_number?: number | null
          sequence_number: number
          station_id?: number | null
          train_id?: string | null
        }
        Update: {
          arrival_time?: string | null
          created_at?: string
          day_offset?: number | null
          departure_time?: string | null
          halt_duration_minutes?: number | null
          id?: string
          is_commercial_halt?: boolean | null
          platform_number?: number | null
          sequence_number?: number
          station_id?: number | null
          train_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["id"]
          },
        ]
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
      signals: {
        Row: {
          aspect: string | null
          block_section_id: number | null
          created_at: string
          direction: string | null
          id: number
          position_km: number | null
          signal_code: string
          signal_type: string
          station_id: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          aspect?: string | null
          block_section_id?: number | null
          created_at?: string
          direction?: string | null
          id?: number
          position_km?: number | null
          signal_code: string
          signal_type: string
          station_id?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          aspect?: string | null
          block_section_id?: number | null
          created_at?: string
          direction?: string | null
          id?: number
          position_km?: number | null
          signal_code?: string
          signal_type?: string
          station_id?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_block_section_id_fkey"
            columns: ["block_section_id"]
            isOneToOne: false
            referencedRelation: "block_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      speed_profiles: {
        Row: {
          block_section_id: number | null
          created_at: string
          from_km: number
          id: number
          max_speed: number
          reason: string | null
          to_km: number
          train_type: string | null
        }
        Insert: {
          block_section_id?: number | null
          created_at?: string
          from_km: number
          id?: number
          max_speed: number
          reason?: string | null
          to_km: number
          train_type?: string | null
        }
        Update: {
          block_section_id?: number | null
          created_at?: string
          from_km?: number
          id?: number
          max_speed?: number
          reason?: string | null
          to_km?: number
          train_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speed_profiles_block_section_id_fkey"
            columns: ["block_section_id"]
            isOneToOne: false
            referencedRelation: "block_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          code: string
          created_at: string
          division: string | null
          id: number
          latitude: number | null
          longitude: number | null
          name: string
          platforms: number
          type: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          code: string
          created_at?: string
          division?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name: string
          platforms?: number
          type?: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          division?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name?: string
          platforms?: number
          type?: string
          updated_at?: string
          zone?: string | null
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
