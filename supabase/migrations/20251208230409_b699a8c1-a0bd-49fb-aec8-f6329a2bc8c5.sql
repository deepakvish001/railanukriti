-- Create alerts table for infrastructure analysis alerts
CREATE TABLE public.infrastructure_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id INTEGER REFERENCES public.track_sections(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  current_utilization NUMERIC,
  recommended_action TEXT,
  estimated_capacity_gain INTEGER,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours')
);

-- Enable RLS
ALTER TABLE public.infrastructure_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view alerts" 
ON public.infrastructure_alerts FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert alerts" 
ON public.infrastructure_alerts FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update alerts" 
ON public.infrastructure_alerts FOR UPDATE USING (true);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.infrastructure_alerts;