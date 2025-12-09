-- Create infrastructure_edits table for storing proposed and applied infrastructure changes
CREATE TABLE public.infrastructure_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_code TEXT NOT NULL,
  edit_type TEXT NOT NULL CHECK (edit_type IN ('loop', 'crossover', 'upgrade_at')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
  capacity_gain INTEGER DEFAULT 0,
  estimated_cost_lakhs NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  applied_at TIMESTAMP WITH TIME ZONE,
  applied_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.infrastructure_edits ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view infrastructure_edits"
  ON public.infrastructure_edits
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert infrastructure_edits"
  ON public.infrastructure_edits
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update infrastructure_edits"
  ON public.infrastructure_edits
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete infrastructure_edits"
  ON public.infrastructure_edits
  FOR DELETE
  USING (true);

-- Add index for faster lookups
CREATE INDEX idx_infrastructure_edits_station ON public.infrastructure_edits(station_code);
CREATE INDEX idx_infrastructure_edits_status ON public.infrastructure_edits(status);