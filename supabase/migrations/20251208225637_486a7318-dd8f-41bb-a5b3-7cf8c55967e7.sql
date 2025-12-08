-- Add infrastructure fields to track_sections for throughput calculation
ALTER TABLE public.track_sections 
ADD COLUMN IF NOT EXISTS has_loop BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS loop_length_m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loop_speed INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS track_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS has_crossover BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_length_km DECIMAL(5, 2) DEFAULT 10,
ADD COLUMN IF NOT EXISTS theoretical_capacity INTEGER DEFAULT 24;

-- Add signalling_type to track_sections (already exists in block_sections)
ALTER TABLE public.track_sections 
ADD COLUMN IF NOT EXISTS signalling_type TEXT DEFAULT 'absolute';

-- Create table for loop lines
CREATE TABLE IF NOT EXISTS public.loop_lines (
  id SERIAL PRIMARY KEY,
  track_section_id INTEGER REFERENCES public.track_sections(id) ON DELETE CASCADE,
  loop_name TEXT NOT NULL,
  length_m INTEGER NOT NULL DEFAULT 750,
  max_speed INTEGER NOT NULL DEFAULT 30,
  direction TEXT DEFAULT 'both', -- up, down, both
  capacity_trains INTEGER DEFAULT 1,
  status TEXT DEFAULT 'available', -- available, occupied, maintenance
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for crossovers
CREATE TABLE IF NOT EXISTS public.crossovers (
  id SERIAL PRIMARY KEY,
  from_track_id INTEGER REFERENCES public.track_sections(id),
  to_track_id INTEGER REFERENCES public.track_sections(id),
  position_km DECIMAL(10, 3),
  crossover_type TEXT NOT NULL DEFAULT 'single', -- single, double, scissors
  max_speed INTEGER DEFAULT 15,
  status TEXT DEFAULT 'working', -- working, faulty, maintenance
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for throughput calculations/history
CREATE TABLE IF NOT EXISTS public.throughput_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_section_id INTEGER REFERENCES public.track_sections(id),
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  signalling_type TEXT NOT NULL,
  track_count INTEGER NOT NULL DEFAULT 1,
  block_length_km DECIMAL(5, 2) NOT NULL,
  has_loops BOOLEAN DEFAULT false,
  loop_count INTEGER DEFAULT 0,
  has_crossovers BOOLEAN DEFAULT false,
  base_capacity INTEGER NOT NULL,
  loop_bonus INTEGER DEFAULT 0,
  crossover_bonus INTEGER DEFAULT 0,
  final_capacity INTEGER NOT NULL,
  trains_per_hour DECIMAL(5, 2),
  utilization_percent DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loop_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.throughput_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view loop_lines" ON public.loop_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert loop_lines" ON public.loop_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update loop_lines" ON public.loop_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete loop_lines" ON public.loop_lines FOR DELETE USING (true);

CREATE POLICY "Authenticated users can view crossovers" ON public.crossovers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert crossovers" ON public.crossovers FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update crossovers" ON public.crossovers FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete crossovers" ON public.crossovers FOR DELETE USING (true);

CREATE POLICY "Authenticated users can view throughput_calculations" ON public.throughput_calculations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert throughput_calculations" ON public.throughput_calculations FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_loop_lines_updated_at BEFORE UPDATE ON public.loop_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();