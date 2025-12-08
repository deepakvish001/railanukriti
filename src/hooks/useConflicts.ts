import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Sound context for playing notifications
let playSoundCallback: ((type: 'critical' | 'warning' | 'success' | 'info') => void) | null = null;

export const setSoundCallback = (callback: typeof playSoundCallback) => {
  playSoundCallback = callback;
};

export interface Conflict {
  id: string;
  trainAId: string | null;
  trainBId: string | null;
  sectionId: number | null;
  type: 'path' | 'schedule' | 'resource' | 'priority';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  aiSuggestion: string | null;
  status: 'active' | 'resolved' | 'dismissed';
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

interface DbConflict {
  id: string;
  train_a_id: string | null;
  train_b_id: string | null;
  section_id: number | null;
  type: string;
  severity: string;
  description: string;
  ai_suggestion: string | null;
  status: string;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const mapDbConflict = (db: DbConflict): Conflict => ({
  id: db.id,
  trainAId: db.train_a_id,
  trainBId: db.train_b_id,
  sectionId: db.section_id,
  type: db.type as Conflict['type'],
  severity: db.severity as Conflict['severity'],
  description: db.description,
  aiSuggestion: db.ai_suggestion,
  status: db.status as Conflict['status'],
  detectedAt: db.detected_at,
  resolvedAt: db.resolved_at,
  resolvedBy: db.resolved_by,
});

export const useConflicts = () => {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchConflicts = async () => {
      const { data, error } = await supabase
        .from('conflicts')
        .select('*')
        .eq('status', 'active')
        .order('detected_at', { ascending: false });

      if (error) {
        console.error('Error fetching conflicts:', error);
        // Generate mock conflicts if none exist
        setConflicts(generateMockConflicts());
      } else if (data && data.length > 0) {
        setConflicts(data.map(mapDbConflict));
      } else {
        setConflicts(generateMockConflicts());
      }
      setLoading(false);
    };

    fetchConflicts();

    // Realtime subscription
    const channel = supabase
      .channel('conflicts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conflicts' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConflict = mapDbConflict(payload.new as DbConflict);
            setConflicts(prev => [newConflict, ...prev]);
            
            // Play sound based on severity
            if (playSoundCallback) {
              if (newConflict.severity === 'critical') {
                playSoundCallback('critical');
              } else if (newConflict.severity === 'high') {
                playSoundCallback('warning');
              } else {
                playSoundCallback('info');
              }
            }
            
            toast({
              title: "New Conflict Detected",
              description: newConflict.description,
              variant: "destructive",
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapDbConflict(payload.new as DbConflict);
            setConflicts(prev => 
              prev.map(c => c.id === updated.id ? updated : c)
                .filter(c => c.status === 'active')
            );
          } else if (payload.eventType === 'DELETE') {
            setConflicts(prev => prev.filter(c => c.id !== (payload.old as DbConflict).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const resolveConflict = async (conflictId: string) => {
    const { error } = await supabase
      .from('conflicts')
      .update({ 
        status: 'resolved', 
        resolved_at: new Date().toISOString() 
      })
      .eq('id', conflictId);

    if (error) {
      // Handle mock data
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
    }
  };

  const dismissConflict = async (conflictId: string) => {
    const { error } = await supabase
      .from('conflicts')
      .update({ status: 'dismissed' })
      .eq('id', conflictId);

    if (error) {
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
    }
  };

  return { conflicts, loading, resolveConflict, dismissConflict };
};

function generateMockConflicts(): Conflict[] {
  return [
    {
      id: 'mock-1',
      trainAId: null,
      trainBId: null,
      sectionId: 3,
      type: 'path',
      severity: 'critical',
      description: 'Rajdhani Express (12301) and Duronto Express (12213) converging on Section C at 14:35',
      aiSuggestion: 'Hold Duronto Express at previous signal. Rajdhani has higher priority and is on-time. Allow Rajdhani to clear section first.',
      status: 'active',
      detectedAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    },
    {
      id: 'mock-2',
      trainAId: null,
      trainBId: null,
      sectionId: 5,
      type: 'schedule',
      severity: 'high',
      description: 'Freight train (54321) running 25 mins late, blocking scheduled path for Shatabdi Express (12002)',
      aiSuggestion: 'Reroute Freight via alternate loop line. This maintains Shatabdi schedule with minimal network impact.',
      status: 'active',
      detectedAt: new Date(Date.now() - 10 * 60000).toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    },
    {
      id: 'mock-3',
      trainAId: null,
      trainBId: null,
      sectionId: 2,
      type: 'resource',
      severity: 'medium',
      description: 'Platform 3 double-booked for arrivals at 15:45 - Local (65432) and Express (12305)',
      aiSuggestion: 'Redirect Local train to Platform 5. Express train maintains original platform assignment.',
      status: 'active',
      detectedAt: new Date(Date.now() - 25 * 60000).toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    },
  ];
}
