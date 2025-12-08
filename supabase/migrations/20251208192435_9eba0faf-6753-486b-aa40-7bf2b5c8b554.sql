-- Create conflicts table
CREATE TABLE public.conflicts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  train_a_id UUID REFERENCES public.trains(id),
  train_b_id UUID REFERENCES public.trains(id),
  section_id INTEGER REFERENCES public.track_sections(id),
  type TEXT NOT NULL CHECK (type IN ('path', 'schedule', 'resource', 'priority')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  description TEXT NOT NULL,
  ai_suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view conflicts"
ON public.conflicts FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert conflicts"
ON public.conflicts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update conflicts"
ON public.conflicts FOR UPDATE
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conflicts;

-- Add trigger for updated_at
CREATE TRIGGER update_conflicts_updated_at
BEFORE UPDATE ON public.conflicts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();