-- Create freight_trains table for goods train data
CREATE TABLE public.freight_trains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id text NOT NULL,
  rake_id text,
  from_zone text,
  from_division text,
  from_section text,
  source_station text NOT NULL,
  to_zone text,
  to_division text,
  to_section text,
  destination_station text NOT NULL,
  load_type text,
  total_km numeric,
  commodity text,
  description text,
  is_ic_station boolean DEFAULT false,
  loco_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create freight_movements table for station-wise movement tracking
CREATE TABLE public.freight_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_train_id uuid REFERENCES public.freight_trains(id) ON DELETE CASCADE,
  load_id text NOT NULL,
  station_code text NOT NULL,
  block_section text,
  block_km numeric,
  block_hours numeric,
  speed numeric,
  arrival_time timestamp with time zone,
  departure_time timestamp with time zone,
  halt_minutes numeric GENERATED ALWAYS AS (
    CASE WHEN departure_time IS NOT NULL AND arrival_time IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (departure_time - arrival_time)) / 60 
    ELSE 0 END
  ) STORED,
  delay_minutes numeric DEFAULT 0,
  is_stoppage boolean DEFAULT false,
  stoppage_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create route_stations table for KTV-PSA route
CREATE TABLE public.route_stations (
  id serial PRIMARY KEY,
  seq_no integer NOT NULL,
  zone_code text,
  division_code text,
  station_code text NOT NULL UNIQUE,
  station_name text NOT NULL,
  is_junction boolean DEFAULT false,
  is_cabin boolean DEFAULT false,
  is_halt boolean DEFAULT false,
  is_ic_flag boolean DEFAULT false,
  is_frozen boolean DEFAULT false,
  from_station text,
  to_station text,
  block_section text,
  reverse_block_section text,
  distance_km numeric,
  cumulative_distance_km numeric,
  signal_type text,
  traction text,
  no_of_tracks integer DEFAULT 2,
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create station_lines table for platform/loop line details
CREATE TABLE public.station_lines (
  id serial PRIMARY KEY,
  station_code text NOT NULL,
  seq_number integer,
  line_number text,
  line_type text, -- L=Loop, M=Main, S=Siding
  line_category text,
  line_length_m integer,
  direction text, -- UP, DN, BOTH
  trains_allowed integer DEFAULT 1,
  capacity integer,
  gauge text DEFAULT 'B',
  traction_type text DEFAULT 'E',
  line_name text,
  max_speed integer DEFAULT 100,
  is_platform boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create route_block_sections table for block section details
CREATE TABLE public.route_block_sections (
  id serial PRIMARY KEY,
  block_section_code text NOT NULL UNIQUE,
  from_station_code text NOT NULL,
  to_station_code text NOT NULL,
  distance_km numeric NOT NULL,
  no_of_lines integer DEFAULT 2,
  no_of_signals integer DEFAULT 0,
  signal_type text NOT NULL, -- AB or AT
  gauge text DEFAULT 'B',
  traction_type text DEFAULT 'E',
  division_code text,
  max_speed integer DEFAULT 130,
  direction text, -- UP, DN
  traffic_type text DEFAULT 'CG', -- C=Coaching, G=Goods, CG=Both
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create passenger_trains table
CREATE TABLE public.passenger_trains (
  id serial PRIMARY KEY,
  train_id text NOT NULL,
  proposal_id text,
  train_number text NOT NULL,
  train_name text,
  source_station text NOT NULL,
  destination_station text NOT NULL,
  train_type text, -- SUF, MEX, MEMU, PAS, VNDB, etc.
  route_type text,
  day_of_services text, -- comma separated days
  no_of_coaches integer,
  train_composition text,
  reverse_train_number text,
  valid_from date,
  valid_to date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create passenger_schedule table for detailed schedule
CREATE TABLE public.passenger_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_train_id integer REFERENCES public.passenger_trains(id) ON DELETE CASCADE,
  train_id text NOT NULL,
  train_number text NOT NULL,
  route_seq_no integer NOT NULL,
  direction text, -- UP, DN
  station_code text NOT NULL,
  is_halt boolean DEFAULT false,
  block_section text,
  prev_block_section text,
  cumulative_distance numeric,
  signal_type text,
  arrival_seconds integer, -- seconds from midnight
  departure_seconds integer,
  day_of_run integer DEFAULT 1,
  platform text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create disruptions table for blocking sections
CREATE TABLE public.disruptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_section_code text,
  station_code text,
  disruption_type text NOT NULL, -- 'block', 'speed_restriction', 'signal_failure', 'accident'
  severity text NOT NULL DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
  description text,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone,
  is_active boolean DEFAULT true,
  affected_direction text, -- 'UP', 'DN', 'BOTH'
  max_speed_allowed integer, -- for speed restrictions
  created_by uuid,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create freight_throughput_metrics table for analysis
CREATE TABLE public.freight_throughput_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  block_section_code text,
  station_code text,
  time_window_start timestamp with time zone,
  time_window_end timestamp with time zone,
  freight_trains_count integer DEFAULT 0,
  passenger_trains_count integer DEFAULT 0,
  total_freight_tonnage numeric DEFAULT 0,
  avg_freight_speed numeric,
  total_halt_minutes numeric DEFAULT 0,
  total_delay_minutes numeric DEFAULT 0,
  total_stoppage_minutes numeric DEFAULT 0,
  throughput_score numeric,
  utilization_percent numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.freight_trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_block_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disruptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_throughput_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Authenticated users can view freight_trains" ON public.freight_trains FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert freight_trains" ON public.freight_trains FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update freight_trains" ON public.freight_trains FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view freight_movements" ON public.freight_movements FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert freight_movements" ON public.freight_movements FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update freight_movements" ON public.freight_movements FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view route_stations" ON public.route_stations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert route_stations" ON public.route_stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update route_stations" ON public.route_stations FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view station_lines" ON public.station_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert station_lines" ON public.station_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update station_lines" ON public.station_lines FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view route_block_sections" ON public.route_block_sections FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert route_block_sections" ON public.route_block_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update route_block_sections" ON public.route_block_sections FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view passenger_trains" ON public.passenger_trains FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert passenger_trains" ON public.passenger_trains FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_trains" ON public.passenger_trains FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view passenger_schedule" ON public.passenger_schedule FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert passenger_schedule" ON public.passenger_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_schedule" ON public.passenger_schedule FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view disruptions" ON public.disruptions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert disruptions" ON public.disruptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update disruptions" ON public.disruptions FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete disruptions" ON public.disruptions FOR DELETE USING (true);

CREATE POLICY "Authenticated users can view freight_throughput_metrics" ON public.freight_throughput_metrics FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert freight_throughput_metrics" ON public.freight_throughput_metrics FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_freight_movements_load_id ON public.freight_movements(load_id);
CREATE INDEX idx_freight_movements_station ON public.freight_movements(station_code);
CREATE INDEX idx_freight_movements_arrival ON public.freight_movements(arrival_time);
CREATE INDEX idx_route_stations_code ON public.route_stations(station_code);
CREATE INDEX idx_route_block_sections_code ON public.route_block_sections(block_section_code);
CREATE INDEX idx_passenger_schedule_train ON public.passenger_schedule(train_number);
CREATE INDEX idx_disruptions_active ON public.disruptions(is_active, block_section_code);
CREATE INDEX idx_disruptions_station ON public.disruptions(station_code) WHERE station_code IS NOT NULL;

-- Create trigger for updated_at on relevant tables
CREATE TRIGGER update_freight_trains_updated_at BEFORE UPDATE ON public.freight_trains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_disruptions_updated_at BEFORE UPDATE ON public.disruptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for disruptions (for instant updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.disruptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_movements;