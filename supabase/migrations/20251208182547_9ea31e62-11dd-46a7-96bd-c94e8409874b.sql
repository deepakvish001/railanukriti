-- Create enum types for railway system
CREATE TYPE train_type AS ENUM ('express', 'freight', 'local', 'special');
CREATE TYPE train_status AS ENUM ('on-time', 'delayed', 'halted', 'approaching');
CREATE TYPE track_status AS ENUM ('clear', 'occupied', 'blocked');
CREATE TYPE priority_level AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE recommendation_type AS ENUM ('precedence', 'crossing', 'reroute', 'hold');

-- Create track_sections table
CREATE TABLE public.track_sections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status track_status NOT NULL DEFAULT 'clear',
  occupied_by TEXT,
  length NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_speed INTEGER NOT NULL DEFAULT 100,
  gradient NUMERIC(4,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trains table
CREATE TABLE public.trains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type train_type NOT NULL DEFAULT 'express',
  status train_status NOT NULL DEFAULT 'on-time',
  priority priority_level NOT NULL DEFAULT 'medium',
  current_section INTEGER REFERENCES public.track_sections(id),
  destination TEXT NOT NULL,
  origin TEXT NOT NULL,
  scheduled_time TIME NOT NULL,
  actual_time TIME,
  delay INTEGER NOT NULL DEFAULT 0,
  speed INTEGER NOT NULL DEFAULT 0,
  next_station TEXT,
  eta TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI recommendations table
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type recommendation_type NOT NULL,
  train_id UUID REFERENCES public.trains(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  impact TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.8,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Create section_metrics table for real-time metrics tracking
CREATE TABLE public.section_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  throughput INTEGER NOT NULL DEFAULT 0,
  average_delay NUMERIC(5,2) NOT NULL DEFAULT 0,
  utilization NUMERIC(5,2) NOT NULL DEFAULT 0,
  on_time_performance NUMERIC(5,2) NOT NULL DEFAULT 0,
  active_trains INTEGER NOT NULL DEFAULT 0,
  pending_conflicts INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE public.track_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_metrics ENABLE ROW LEVEL SECURITY;

-- Track sections policies - all authenticated users can read
CREATE POLICY "Authenticated users can view track sections"
ON public.track_sections FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update track sections"
ON public.track_sections FOR UPDATE
TO authenticated
USING (true);

-- Trains policies - all authenticated users can read and update
CREATE POLICY "Authenticated users can view trains"
ON public.trains FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert trains"
ON public.trains FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update trains"
ON public.trains FOR UPDATE
TO authenticated
USING (true);

-- AI Recommendations policies
CREATE POLICY "Authenticated users can view recommendations"
ON public.ai_recommendations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert recommendations"
ON public.ai_recommendations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update recommendations"
ON public.ai_recommendations FOR UPDATE
TO authenticated
USING (true);

-- Section metrics policies
CREATE POLICY "Authenticated users can view metrics"
ON public.section_metrics FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert metrics"
ON public.section_metrics FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_track_sections_updated_at
  BEFORE UPDATE ON public.track_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trains_updated_at
  BEFORE UPDATE ON public.trains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for trains and track sections
ALTER PUBLICATION supabase_realtime ADD TABLE public.trains;
ALTER PUBLICATION supabase_realtime ADD TABLE public.track_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_recommendations;