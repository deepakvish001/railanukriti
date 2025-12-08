import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Train, TrackSection, AIRecommendation, SectionMetrics } from '@/types/railway';
import { useToast } from '@/hooks/use-toast';

// Type mappings from database to frontend
type DbTrain = {
  id: string;
  number: string;
  name: string;
  type: 'express' | 'freight' | 'local' | 'special';
  status: 'on-time' | 'delayed' | 'halted' | 'approaching';
  priority: 'critical' | 'high' | 'medium' | 'low';
  current_section: number | null;
  destination: string;
  origin: string;
  scheduled_time: string;
  actual_time: string | null;
  delay: number;
  speed: number;
  next_station: string | null;
  eta: string | null;
};

type DbTrackSection = {
  id: number;
  name: string;
  status: 'clear' | 'occupied' | 'blocked';
  occupied_by: string | null;
  length: number;
  max_speed: number;
  gradient: number;
};

type DbRecommendation = {
  id: string;
  type: 'precedence' | 'crossing' | 'reroute' | 'hold';
  train_id: string | null;
  action: string;
  reason: string;
  impact: string;
  confidence: number;
  is_active: boolean;
  created_at: string;
};

type DbMetrics = {
  throughput: number;
  average_delay: number;
  utilization: number;
  on_time_performance: number;
  active_trains: number;
  pending_conflicts: number;
};

const mapDbTrainToTrain = (db: DbTrain): Train => ({
  id: db.id,
  number: db.number,
  name: db.name,
  type: db.type,
  status: db.status,
  priority: db.priority,
  currentSection: db.current_section || 0,
  destination: db.destination,
  origin: db.origin,
  scheduledTime: db.scheduled_time,
  actualTime: db.actual_time || db.scheduled_time,
  delay: db.delay,
  speed: db.speed,
  nextStation: db.next_station || '',
  eta: db.eta || '',
});

const mapDbSectionToSection = (db: DbTrackSection): TrackSection => ({
  id: db.id,
  name: db.name,
  status: db.status,
  occupiedBy: db.occupied_by,
  length: Number(db.length),
  maxSpeed: db.max_speed,
  gradient: Number(db.gradient),
});

const mapDbRecommendation = (db: DbRecommendation): AIRecommendation => ({
  id: db.id,
  type: db.type,
  trainId: db.train_id || '',
  action: db.action,
  reason: db.reason,
  impact: db.impact,
  confidence: Number(db.confidence),
  timestamp: db.created_at,
});

export const useTrains = () => {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTrains = async () => {
      const { data, error } = await supabase
        .from('trains')
        .select('*')
        .order('priority', { ascending: true });

      if (error) {
        toast({
          title: 'Error fetching trains',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        setTrains(data.map(mapDbTrainToTrain));
      }
      setLoading(false);
    };

    fetchTrains();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('trains-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trains' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTrains(prev => [...prev, mapDbTrainToTrain(payload.new as DbTrain)]);
          } else if (payload.eventType === 'UPDATE') {
            setTrains(prev => prev.map(t => 
              t.id === (payload.new as DbTrain).id 
                ? mapDbTrainToTrain(payload.new as DbTrain) 
                : t
            ));
          } else if (payload.eventType === 'DELETE') {
            setTrains(prev => prev.filter(t => t.id !== (payload.old as DbTrain).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const updateTrain = async (trainId: string, updates: Partial<DbTrain>) => {
    const { error } = await supabase
      .from('trains')
      .update(updates)
      .eq('id', trainId);

    if (error) {
      toast({
        title: 'Error updating train',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return { trains, loading, updateTrain, setTrains };
};

export const useTrackSections = () => {
  const [sections, setSections] = useState<TrackSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSections = async () => {
      const { data, error } = await supabase
        .from('track_sections')
        .select('*')
        .order('id');

      if (error) {
        toast({
          title: 'Error fetching track sections',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        setSections(data.map(mapDbSectionToSection));
      }
      setLoading(false);
    };

    fetchSections();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('sections-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'track_sections' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setSections(prev => prev.map(s => 
              s.id === (payload.new as DbTrackSection).id 
                ? mapDbSectionToSection(payload.new as DbTrackSection) 
                : s
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return { sections, loading };
};

export const useAIRecommendations = () => {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRecommendations = async () => {
      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('is_active', true)
        .order('confidence', { ascending: false });

      if (error) {
        toast({
          title: 'Error fetching recommendations',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        setRecommendations(data.map(mapDbRecommendation));
      }
      setLoading(false);
    };

    fetchRecommendations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('recommendations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_recommendations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRec = payload.new as DbRecommendation;
            if (newRec.is_active) {
              setRecommendations(prev => [...prev, mapDbRecommendation(newRec)]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as DbRecommendation;
            if (!updated.is_active) {
              setRecommendations(prev => prev.filter(r => r.id !== updated.id));
            } else {
              setRecommendations(prev => prev.map(r => 
                r.id === updated.id ? mapDbRecommendation(updated) : r
              ));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const resolveRecommendation = async (recommendationId: string) => {
    const { error } = await supabase
      .from('ai_recommendations')
      .update({ 
        is_active: false, 
        resolved_at: new Date().toISOString() 
      })
      .eq('id', recommendationId);

    if (error) {
      toast({
        title: 'Error resolving recommendation',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return { recommendations, loading, resolveRecommendation };
};

export const useSectionMetrics = () => {
  const [metrics, setMetrics] = useState<SectionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data, error } = await supabase
        .from('section_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        toast({
          title: 'Error fetching metrics',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        setMetrics({
          throughput: data.throughput,
          averageDelay: Number(data.average_delay),
          utilization: Number(data.utilization),
          onTimePerformance: Number(data.on_time_performance),
          activeTrains: data.active_trains,
          pendingConflicts: data.pending_conflicts,
        });
      }
      setLoading(false);
    };

    fetchMetrics();
  }, [toast]);

  return { metrics, loading, setMetrics };
};
