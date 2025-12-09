import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FreightTrain {
  id: string;
  load_id: string;
  rake_id: string | null;
  from_zone: string | null;
  from_division: string | null;
  source_station: string;
  destination_station: string;
  load_type: string | null;
  total_km: number | null;
  commodity: string | null;
  description: string | null;
}

export interface FreightMovement {
  id: string;
  freight_train_id: string | null;
  load_id: string;
  station_code: string;
  block_section: string | null;
  block_km: number | null;
  speed: number | null;
  arrival_time: string | null;
  departure_time: string | null;
  halt_minutes: number | null;
  delay_minutes: number | null;
  is_stoppage: boolean;
  stoppage_reason: string | null;
}

export interface RouteStation {
  id: number;
  seq_no: number;
  station_code: string;
  station_name: string;
  is_junction: boolean;
  is_halt: boolean;
  block_section: string | null;
  distance_km: number | null;
  cumulative_distance_km: number | null;
  signal_type: string | null;
  no_of_tracks: number;
  latitude: number | null;
  longitude: number | null;
}

export interface RouteBlockSection {
  id: number;
  block_section_code: string;
  from_station_code: string;
  to_station_code: string;
  distance_km: number;
  signal_type: string;
  max_speed: number;
  direction: string | null;
  no_of_lines: number;
}

export interface Disruption {
  id: string;
  block_section_code: string | null;
  station_code: string | null;
  disruption_type: string;
  severity: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  affected_direction: string | null;
  max_speed_allowed: number | null;
}

export interface FreightThroughputMetrics {
  id: string;
  calculation_date: string;
  block_section_code: string | null;
  station_code: string | null;
  freight_trains_count: number;
  avg_freight_speed: number | null;
  total_halt_minutes: number | null;
  total_delay_minutes: number | null;
  total_stoppage_minutes: number | null;
  throughput_score: number | null;
}

export function useFreightTrains() {
  const [trains, setTrains] = useState<FreightTrain[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTrains = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('freight_trains')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrains(data || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching freight trains',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTrains();
  }, [fetchTrains]);

  return { trains, loading, refetch: fetchTrains };
}

export function useFreightMovements(loadId?: string) {
  const [movements, setMovements] = useState<FreightMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMovements = useCallback(async () => {
    try {
      let query = supabase
        .from('freight_movements')
        .select('*')
        .order('arrival_time', { ascending: true });

      if (loadId) {
        query = query.eq('load_id', loadId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMovements(data || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching freight movements',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [loadId, toast]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  return { movements, loading, refetch: fetchMovements };
}

export function useRouteStations() {
  const [stations, setStations] = useState<RouteStation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('route_stations')
        .select('*')
        .order('seq_no', { ascending: true });

      if (error) throw error;
      setStations(data || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching route stations',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  return { stations, loading, refetch: fetchStations };
}

export function useRouteBlockSections() {
  const [sections, setSections] = useState<RouteBlockSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('route_block_sections')
        .select('*')
        .order('distance_km', { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching block sections',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  return { sections, loading, refetch: fetchSections };
}

export function useDisruptions() {
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDisruptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('disruptions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDisruptions(data || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching disruptions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const addDisruption = useCallback(async (disruption: Omit<Disruption, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('disruptions')
        .insert(disruption)
        .select()
        .single();

      if (error) throw error;
      
      setDisruptions(prev => [data, ...prev]);
      toast({
        title: 'Disruption added',
        description: `${disruption.disruption_type} at ${disruption.block_section_code || disruption.station_code}`,
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: 'Error adding disruption',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  const resolveDisruption = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('disruptions')
        .update({
          is_active: false,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      
      setDisruptions(prev => prev.filter(d => d.id !== id));
      toast({
        title: 'Disruption resolved',
        description: 'The section is now clear for traffic.',
      });
    } catch (error: any) {
      toast({
        title: 'Error resolving disruption',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchDisruptions();

    // Real-time subscription for disruptions
    const channel = supabase
      .channel('disruptions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disruptions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setDisruptions(prev => [payload.new as Disruption, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setDisruptions(prev =>
              prev.map(d => d.id === payload.new.id ? payload.new as Disruption : d)
                .filter(d => d.is_active)
            );
          } else if (payload.eventType === 'DELETE') {
            setDisruptions(prev => prev.filter(d => d.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDisruptions]);

  return { disruptions, loading, addDisruption, resolveDisruption, refetch: fetchDisruptions };
}

export function useFreightThroughputMetrics() {
  const [metrics, setMetrics] = useState<FreightThroughputMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMetrics = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('freight_throughput_metrics')
        .select('*')
        .order('calculation_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMetrics(data || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching throughput metrics',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, refetch: fetchMetrics };
}
