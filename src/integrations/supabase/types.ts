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
      crossovers: {
        Row: {
          created_at: string
          crossover_type: string
          from_track_id: number | null
          id: number
          max_speed: number | null
          position_km: number | null
          status: string | null
          to_track_id: number | null
        }
        Insert: {
          created_at?: string
          crossover_type?: string
          from_track_id?: number | null
          id?: number
          max_speed?: number | null
          position_km?: number | null
          status?: string | null
          to_track_id?: number | null
        }
        Update: {
          created_at?: string
          crossover_type?: string
          from_track_id?: number | null
          id?: number
          max_speed?: number | null
          position_km?: number | null
          status?: string | null
          to_track_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crossovers_from_track_id_fkey"
            columns: ["from_track_id"]
            isOneToOne: false
            referencedRelation: "track_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossovers_to_track_id_fkey"
            columns: ["to_track_id"]
            isOneToOne: false
            referencedRelation: "track_sections"
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
      disruptions: {
        Row: {
          affected_direction: string | null
          block_section_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          disruption_type: string
          end_time: string | null
          id: string
          is_active: boolean | null
          max_speed_allowed: number | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          start_time: string
          station_code: string | null
          updated_at: string
        }
        Insert: {
          affected_direction?: string | null
          block_section_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disruption_type: string
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          max_speed_allowed?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          start_time?: string
          station_code?: string | null
          updated_at?: string
        }
        Update: {
          affected_direction?: string | null
          block_section_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disruption_type?: string
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          max_speed_allowed?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          start_time?: string
          station_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      freight_movements: {
        Row: {
          arrival_time: string | null
          block_hours: number | null
          block_km: number | null
          block_section: string | null
          created_at: string
          delay_minutes: number | null
          departure_time: string | null
          freight_train_id: string | null
          halt_minutes: number | null
          id: string
          is_stoppage: boolean | null
          load_id: string
          speed: number | null
          station_code: string
          stoppage_reason: string | null
        }
        Insert: {
          arrival_time?: string | null
          block_hours?: number | null
          block_km?: number | null
          block_section?: string | null
          created_at?: string
          delay_minutes?: number | null
          departure_time?: string | null
          freight_train_id?: string | null
          halt_minutes?: number | null
          id?: string
          is_stoppage?: boolean | null
          load_id: string
          speed?: number | null
          station_code: string
          stoppage_reason?: string | null
        }
        Update: {
          arrival_time?: string | null
          block_hours?: number | null
          block_km?: number | null
          block_section?: string | null
          created_at?: string
          delay_minutes?: number | null
          departure_time?: string | null
          freight_train_id?: string | null
          halt_minutes?: number | null
          id?: string
          is_stoppage?: boolean | null
          load_id?: string
          speed?: number | null
          station_code?: string
          stoppage_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_movements_freight_train_id_fkey"
            columns: ["freight_train_id"]
            isOneToOne: false
            referencedRelation: "freight_trains"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_throughput_metrics: {
        Row: {
          avg_freight_speed: number | null
          block_section_code: string | null
          calculation_date: string
          created_at: string
          freight_trains_count: number | null
          id: string
          passenger_trains_count: number | null
          station_code: string | null
          throughput_score: number | null
          time_window_end: string | null
          time_window_start: string | null
          total_delay_minutes: number | null
          total_freight_tonnage: number | null
          total_halt_minutes: number | null
          total_stoppage_minutes: number | null
          utilization_percent: number | null
        }
        Insert: {
          avg_freight_speed?: number | null
          block_section_code?: string | null
          calculation_date?: string
          created_at?: string
          freight_trains_count?: number | null
          id?: string
          passenger_trains_count?: number | null
          station_code?: string | null
          throughput_score?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          total_delay_minutes?: number | null
          total_freight_tonnage?: number | null
          total_halt_minutes?: number | null
          total_stoppage_minutes?: number | null
          utilization_percent?: number | null
        }
        Update: {
          avg_freight_speed?: number | null
          block_section_code?: string | null
          calculation_date?: string
          created_at?: string
          freight_trains_count?: number | null
          id?: string
          passenger_trains_count?: number | null
          station_code?: string | null
          throughput_score?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          total_delay_minutes?: number | null
          total_freight_tonnage?: number | null
          total_halt_minutes?: number | null
          total_stoppage_minutes?: number | null
          utilization_percent?: number | null
        }
        Relationships: []
      }
      freight_trains: {
        Row: {
          commodity: string | null
          created_at: string
          description: string | null
          destination_station: string
          from_division: string | null
          from_section: string | null
          from_zone: string | null
          id: string
          is_ic_station: boolean | null
          load_id: string
          load_type: string | null
          loco_type: string | null
          rake_id: string | null
          source_station: string
          to_division: string | null
          to_section: string | null
          to_zone: string | null
          total_km: number | null
          updated_at: string
        }
        Insert: {
          commodity?: string | null
          created_at?: string
          description?: string | null
          destination_station: string
          from_division?: string | null
          from_section?: string | null
          from_zone?: string | null
          id?: string
          is_ic_station?: boolean | null
          load_id: string
          load_type?: string | null
          loco_type?: string | null
          rake_id?: string | null
          source_station: string
          to_division?: string | null
          to_section?: string | null
          to_zone?: string | null
          total_km?: number | null
          updated_at?: string
        }
        Update: {
          commodity?: string | null
          created_at?: string
          description?: string | null
          destination_station?: string
          from_division?: string | null
          from_section?: string | null
          from_zone?: string | null
          id?: string
          is_ic_station?: boolean | null
          load_id?: string
          load_type?: string | null
          loco_type?: string | null
          rake_id?: string | null
          source_station?: string
          to_division?: string | null
          to_section?: string | null
          to_zone?: string | null
          total_km?: number | null
          updated_at?: string
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
      infrastructure_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          current_utilization: number | null
          description: string
          estimated_capacity_gain: number | null
          expires_at: string | null
          id: string
          is_acknowledged: boolean | null
          recommended_action: string | null
          section_id: number | null
          severity: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          current_utilization?: number | null
          description: string
          estimated_capacity_gain?: number | null
          expires_at?: string | null
          id?: string
          is_acknowledged?: boolean | null
          recommended_action?: string | null
          section_id?: number | null
          severity: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          current_utilization?: number | null
          description?: string
          estimated_capacity_gain?: number | null
          expires_at?: string | null
          id?: string
          is_acknowledged?: boolean | null
          recommended_action?: string | null
          section_id?: number | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "infrastructure_alerts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "track_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_edits: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          capacity_gain: number | null
          created_at: string
          created_by: string | null
          edit_type: string
          estimated_cost_lakhs: number | null
          id: string
          notes: string | null
          station_code: string
          status: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          capacity_gain?: number | null
          created_at?: string
          created_by?: string | null
          edit_type: string
          estimated_cost_lakhs?: number | null
          id?: string
          notes?: string | null
          station_code: string
          status?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          capacity_gain?: number | null
          created_at?: string
          created_by?: string | null
          edit_type?: string
          estimated_cost_lakhs?: number | null
          id?: string
          notes?: string | null
          station_code?: string
          status?: string
        }
        Relationships: []
      }
      loop_lines: {
        Row: {
          capacity_trains: number | null
          created_at: string
          direction: string | null
          id: number
          length_m: number
          loop_name: string
          max_speed: number
          status: string | null
          track_section_id: number | null
          updated_at: string
        }
        Insert: {
          capacity_trains?: number | null
          created_at?: string
          direction?: string | null
          id?: number
          length_m?: number
          loop_name: string
          max_speed?: number
          status?: string | null
          track_section_id?: number | null
          updated_at?: string
        }
        Update: {
          capacity_trains?: number | null
          created_at?: string
          direction?: string | null
          id?: number
          length_m?: number
          loop_name?: string
          max_speed?: number
          status?: string | null
          track_section_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loop_lines_track_section_id_fkey"
            columns: ["track_section_id"]
            isOneToOne: false
            referencedRelation: "track_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_schedule: {
        Row: {
          arrival_seconds: number | null
          block_section: string | null
          created_at: string
          cumulative_distance: number | null
          day_of_run: number | null
          departure_seconds: number | null
          direction: string | null
          id: string
          is_halt: boolean | null
          passenger_train_id: number | null
          platform: string | null
          prev_block_section: string | null
          route_seq_no: number
          signal_type: string | null
          station_code: string
          train_id: string
          train_number: string
        }
        Insert: {
          arrival_seconds?: number | null
          block_section?: string | null
          created_at?: string
          cumulative_distance?: number | null
          day_of_run?: number | null
          departure_seconds?: number | null
          direction?: string | null
          id?: string
          is_halt?: boolean | null
          passenger_train_id?: number | null
          platform?: string | null
          prev_block_section?: string | null
          route_seq_no: number
          signal_type?: string | null
          station_code: string
          train_id: string
          train_number: string
        }
        Update: {
          arrival_seconds?: number | null
          block_section?: string | null
          created_at?: string
          cumulative_distance?: number | null
          day_of_run?: number | null
          departure_seconds?: number | null
          direction?: string | null
          id?: string
          is_halt?: boolean | null
          passenger_train_id?: number | null
          platform?: string | null
          prev_block_section?: string | null
          route_seq_no?: number
          signal_type?: string | null
          station_code?: string
          train_id?: string
          train_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_schedule_passenger_train_id_fkey"
            columns: ["passenger_train_id"]
            isOneToOne: false
            referencedRelation: "passenger_trains"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_trains: {
        Row: {
          created_at: string
          day_of_services: string | null
          destination_station: string
          id: number
          no_of_coaches: number | null
          proposal_id: string | null
          reverse_train_number: string | null
          route_type: string | null
          source_station: string
          train_composition: string | null
          train_id: string
          train_name: string | null
          train_number: string
          train_type: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          day_of_services?: string | null
          destination_station: string
          id?: number
          no_of_coaches?: number | null
          proposal_id?: string | null
          reverse_train_number?: string | null
          route_type?: string | null
          source_station: string
          train_composition?: string | null
          train_id: string
          train_name?: string | null
          train_number: string
          train_type?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          day_of_services?: string | null
          destination_station?: string
          id?: number
          no_of_coaches?: number | null
          proposal_id?: string | null
          reverse_train_number?: string | null
          route_type?: string | null
          source_station?: string
          train_composition?: string | null
          train_id?: string
          train_name?: string | null
          train_number?: string
          train_type?: string | null
          valid_from?: string | null
          valid_to?: string | null
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
      route_block_sections: {
        Row: {
          block_section_code: string
          created_at: string
          direction: string | null
          distance_km: number
          division_code: string | null
          from_station_code: string
          gauge: string | null
          id: number
          max_speed: number | null
          no_of_lines: number | null
          no_of_signals: number | null
          signal_type: string
          to_station_code: string
          traction_type: string | null
          traffic_type: string | null
        }
        Insert: {
          block_section_code: string
          created_at?: string
          direction?: string | null
          distance_km: number
          division_code?: string | null
          from_station_code: string
          gauge?: string | null
          id?: number
          max_speed?: number | null
          no_of_lines?: number | null
          no_of_signals?: number | null
          signal_type: string
          to_station_code: string
          traction_type?: string | null
          traffic_type?: string | null
        }
        Update: {
          block_section_code?: string
          created_at?: string
          direction?: string | null
          distance_km?: number
          division_code?: string | null
          from_station_code?: string
          gauge?: string | null
          id?: number
          max_speed?: number | null
          no_of_lines?: number | null
          no_of_signals?: number | null
          signal_type?: string
          to_station_code?: string
          traction_type?: string | null
          traffic_type?: string | null
        }
        Relationships: []
      }
      route_stations: {
        Row: {
          block_section: string | null
          created_at: string
          cumulative_distance_km: number | null
          distance_km: number | null
          division_code: string | null
          from_station: string | null
          id: number
          is_cabin: boolean | null
          is_frozen: boolean | null
          is_halt: boolean | null
          is_ic_flag: boolean | null
          is_junction: boolean | null
          latitude: number | null
          longitude: number | null
          no_of_tracks: number | null
          reverse_block_section: string | null
          seq_no: number
          signal_type: string | null
          station_code: string
          station_name: string
          to_station: string | null
          traction: string | null
          zone_code: string | null
        }
        Insert: {
          block_section?: string | null
          created_at?: string
          cumulative_distance_km?: number | null
          distance_km?: number | null
          division_code?: string | null
          from_station?: string | null
          id?: number
          is_cabin?: boolean | null
          is_frozen?: boolean | null
          is_halt?: boolean | null
          is_ic_flag?: boolean | null
          is_junction?: boolean | null
          latitude?: number | null
          longitude?: number | null
          no_of_tracks?: number | null
          reverse_block_section?: string | null
          seq_no: number
          signal_type?: string | null
          station_code: string
          station_name: string
          to_station?: string | null
          traction?: string | null
          zone_code?: string | null
        }
        Update: {
          block_section?: string | null
          created_at?: string
          cumulative_distance_km?: number | null
          distance_km?: number | null
          division_code?: string | null
          from_station?: string | null
          id?: number
          is_cabin?: boolean | null
          is_frozen?: boolean | null
          is_halt?: boolean | null
          is_ic_flag?: boolean | null
          is_junction?: boolean | null
          latitude?: number | null
          longitude?: number | null
          no_of_tracks?: number | null
          reverse_block_section?: string | null
          seq_no?: number
          signal_type?: string | null
          station_code?: string
          station_name?: string
          to_station?: string | null
          traction?: string | null
          zone_code?: string | null
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
      station_lines: {
        Row: {
          capacity: number | null
          created_at: string
          direction: string | null
          gauge: string | null
          id: number
          is_platform: boolean | null
          line_category: string | null
          line_length_m: number | null
          line_name: string | null
          line_number: string | null
          line_type: string | null
          max_speed: number | null
          seq_number: number | null
          station_code: string
          traction_type: string | null
          trains_allowed: number | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          direction?: string | null
          gauge?: string | null
          id?: number
          is_platform?: boolean | null
          line_category?: string | null
          line_length_m?: number | null
          line_name?: string | null
          line_number?: string | null
          line_type?: string | null
          max_speed?: number | null
          seq_number?: number | null
          station_code: string
          traction_type?: string | null
          trains_allowed?: number | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          direction?: string | null
          gauge?: string | null
          id?: number
          is_platform?: boolean | null
          line_category?: string | null
          line_length_m?: number | null
          line_name?: string | null
          line_number?: string | null
          line_type?: string | null
          max_speed?: number | null
          seq_number?: number | null
          station_code?: string
          traction_type?: string | null
          trains_allowed?: number | null
        }
        Relationships: []
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
      throughput_calculations: {
        Row: {
          base_capacity: number
          block_length_km: number
          calculation_date: string
          created_at: string
          crossover_bonus: number | null
          final_capacity: number
          has_crossovers: boolean | null
          has_loops: boolean | null
          id: string
          loop_bonus: number | null
          loop_count: number | null
          signalling_type: string
          track_count: number
          track_section_id: number | null
          trains_per_hour: number | null
          utilization_percent: number | null
        }
        Insert: {
          base_capacity: number
          block_length_km: number
          calculation_date?: string
          created_at?: string
          crossover_bonus?: number | null
          final_capacity: number
          has_crossovers?: boolean | null
          has_loops?: boolean | null
          id?: string
          loop_bonus?: number | null
          loop_count?: number | null
          signalling_type: string
          track_count?: number
          track_section_id?: number | null
          trains_per_hour?: number | null
          utilization_percent?: number | null
        }
        Update: {
          base_capacity?: number
          block_length_km?: number
          calculation_date?: string
          created_at?: string
          crossover_bonus?: number | null
          final_capacity?: number
          has_crossovers?: boolean | null
          has_loops?: boolean | null
          id?: string
          loop_bonus?: number | null
          loop_count?: number | null
          signalling_type?: string
          track_count?: number
          track_section_id?: number | null
          trains_per_hour?: number | null
          utilization_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "throughput_calculations_track_section_id_fkey"
            columns: ["track_section_id"]
            isOneToOne: false
            referencedRelation: "track_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      track_sections: {
        Row: {
          block_length_km: number | null
          created_at: string
          gradient: number
          has_crossover: boolean | null
          has_loop: boolean | null
          id: number
          length: number
          loop_length_m: number | null
          loop_speed: number | null
          max_speed: number
          name: string
          occupied_by: string | null
          signalling_type: string | null
          status: Database["public"]["Enums"]["track_status"]
          theoretical_capacity: number | null
          track_count: number | null
          updated_at: string
        }
        Insert: {
          block_length_km?: number | null
          created_at?: string
          gradient?: number
          has_crossover?: boolean | null
          has_loop?: boolean | null
          id?: number
          length?: number
          loop_length_m?: number | null
          loop_speed?: number | null
          max_speed?: number
          name: string
          occupied_by?: string | null
          signalling_type?: string | null
          status?: Database["public"]["Enums"]["track_status"]
          theoretical_capacity?: number | null
          track_count?: number | null
          updated_at?: string
        }
        Update: {
          block_length_km?: number | null
          created_at?: string
          gradient?: number
          has_crossover?: boolean | null
          has_loop?: boolean | null
          id?: number
          length?: number
          loop_length_m?: number | null
          loop_speed?: number | null
          max_speed?: number
          name?: string
          occupied_by?: string | null
          signalling_type?: string | null
          status?: Database["public"]["Enums"]["track_status"]
          theoretical_capacity?: number | null
          track_count?: number | null
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
