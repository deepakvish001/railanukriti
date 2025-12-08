-- Stations table for station lines
CREATE TABLE public.stations (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'junction', -- junction, halt, terminal
  platforms INTEGER NOT NULL DEFAULT 2,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  zone TEXT,
  division TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Block sections table for detailed block section data
CREATE TABLE public.block_sections (
  id SERIAL PRIMARY KEY,
  section_code TEXT NOT NULL UNIQUE,
  from_station_id INTEGER REFERENCES public.stations(id),
  to_station_id INTEGER REFERENCES public.stations(id),
  distance_km DECIMAL(10, 2) NOT NULL,
  max_speed INTEGER NOT NULL DEFAULT 100,
  gradient DECIMAL(5, 2) DEFAULT 0,
  track_type TEXT DEFAULT 'double', -- single, double
  electrified BOOLEAN DEFAULT true,
  signalling_type TEXT DEFAULT 'automatic', -- automatic, manual, semi-automatic
  block_time_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Signals table for signalling system
CREATE TABLE public.signals (
  id SERIAL PRIMARY KEY,
  signal_code TEXT NOT NULL UNIQUE,
  station_id INTEGER REFERENCES public.stations(id),
  block_section_id INTEGER REFERENCES public.block_sections(id),
  signal_type TEXT NOT NULL, -- home, starter, advanced_starter, distant, shunting
  aspect TEXT DEFAULT 'red', -- red, yellow, double_yellow, green
  position_km DECIMAL(10, 3),
  direction TEXT DEFAULT 'UP', -- UP, DOWN
  status TEXT DEFAULT 'working', -- working, faulty, maintenance
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Section speed profiles for varying speed limits
CREATE TABLE public.speed_profiles (
  id SERIAL PRIMARY KEY,
  block_section_id INTEGER REFERENCES public.block_sections(id),
  from_km DECIMAL(10, 3) NOT NULL,
  to_km DECIMAL(10, 3) NOT NULL,
  max_speed INTEGER NOT NULL,
  reason TEXT, -- curve, bridge, level_crossing, station_approach
  train_type TEXT, -- all, express, freight, local
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Passenger schedules with detailed stopping patterns
CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  train_id UUID REFERENCES public.trains(id),
  station_id INTEGER REFERENCES public.stations(id),
  sequence_number INTEGER NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  halt_duration_minutes INTEGER DEFAULT 0,
  platform_number INTEGER,
  day_offset INTEGER DEFAULT 0, -- for overnight trains
  is_commercial_halt BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Historical freight train data for ML training
CREATE TABLE public.historical_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  train_number TEXT NOT NULL,
  train_type TEXT NOT NULL,
  run_date DATE NOT NULL,
  origin_station TEXT NOT NULL,
  destination_station TEXT NOT NULL,
  scheduled_departure TIME,
  actual_departure TIME,
  scheduled_arrival TIME,
  actual_arrival TIME,
  total_delay_minutes INTEGER DEFAULT 0,
  delay_reason TEXT,
  weather_condition TEXT,
  load_tonnage DECIMAL(10, 2),
  wagons_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Data imports tracking table
CREATE TABLE public.data_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- csv, excel, json, xml
  data_type TEXT NOT NULL, -- stations, block_sections, signals, schedules, etc.
  records_total INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  imported_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all new tables
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view stations" ON public.stations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert stations" ON public.stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update stations" ON public.stations FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view block_sections" ON public.block_sections FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert block_sections" ON public.block_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update block_sections" ON public.block_sections FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view signals" ON public.signals FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert signals" ON public.signals FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update signals" ON public.signals FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view speed_profiles" ON public.speed_profiles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert speed_profiles" ON public.speed_profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view schedules" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert schedules" ON public.schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update schedules" ON public.schedules FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can view historical_runs" ON public.historical_runs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert historical_runs" ON public.historical_runs FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view data_imports" ON public.data_imports FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert data_imports" ON public.data_imports FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update data_imports" ON public.data_imports FOR UPDATE USING (true);

-- Add triggers for updated_at columns
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_block_sections_updated_at BEFORE UPDATE ON public.block_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON public.signals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();