import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const useAuditLogs = (limit = 50) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      // Using raw query since types may not be updated yet
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setLogs(data as unknown as AuditLog[]);
      }
      setLoading(false);
    };

    fetchLogs();

    // Subscribe to new logs
    const channel = supabase
      .channel('audit-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          setLogs(prev => [payload.new as AuditLog, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return { logs, loading };
};

export const useLogAction = () => {
  const { user } = useAuth();

  const logAction = async (
    actionType: string,
    entityType: string,
    description: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!user) return;

    await supabase.from('audit_logs' as any).insert({
      user_id: user.id,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId || null,
      description,
      metadata: metadata || {},
    });
  };

  return { logAction };
};
