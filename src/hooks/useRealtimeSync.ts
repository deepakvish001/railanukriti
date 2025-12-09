import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Tables to sync across all pages
const SYNC_TABLES = [
  'freight_movements',
  'freight_trains',
  'disruptions',
  'passenger_schedule',
  'conflicts',
  'ai_recommendations',
  'section_metrics',
  'trains',
  'track_sections',
  'infrastructure_alerts',
  'freight_throughput_metrics',
] as const;

// Query keys to invalidate when tables change
const TABLE_QUERY_MAP: Record<string, string[]> = {
  freight_movements: [
    'freight-movements',
    'freight-movements-chart-all',
    'freight-data',
    'freight-throughput',
    'kpi-data',
  ],
  freight_trains: [
    'freight-trains',
    'freight-data',
    'freight-movements-chart-all',
  ],
  disruptions: [
    'disruptions',
    'disruptions-chart',
    'active-disruptions',
  ],
  passenger_schedule: [
    'passenger-schedule',
    'passenger-schedule-chart-all',
  ],
  conflicts: [
    'conflicts',
    'active-conflicts',
    'conflict-data',
  ],
  ai_recommendations: [
    'ai-recommendations',
    'recommendations',
  ],
  section_metrics: [
    'section-metrics',
    'metrics-history',
    'kpi-data',
  ],
  trains: [
    'trains',
    'train-data',
  ],
  track_sections: [
    'track-sections',
    'infrastructure',
  ],
  infrastructure_alerts: [
    'infrastructure-alerts',
    'alerts',
  ],
  freight_throughput_metrics: [
    'freight-throughput',
    'throughput-metrics',
    'kpi-data',
  ],
};

export function useRealtimeSync(options?: { showNotifications?: boolean }) {
  const queryClient = useQueryClient();
  const showNotifications = options?.showNotifications ?? false;

  useEffect(() => {
    // Create a single channel for all table subscriptions
    const channel = supabase.channel('global-sync');

    // Subscribe to all tables
    SYNC_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          // Get query keys to invalidate for this table
          const queryKeys = TABLE_QUERY_MAP[table] || [];
          
          // Invalidate all related queries
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });

          // Also invalidate any query that starts with the table name
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === 'string' && key.includes(table.replace('_', '-'));
            }
          });

          // Show notification for important changes
          if (showNotifications) {
            const eventType = payload.eventType;
            if (table === 'disruptions' && eventType === 'INSERT') {
              toast.warning('New disruption detected', {
                description: 'A new disruption has been added to the system.',
              });
            } else if (table === 'conflicts' && eventType === 'INSERT') {
              toast.error('New conflict detected', {
                description: 'A scheduling conflict has been identified.',
              });
            } else if (table === 'ai_recommendations' && eventType === 'INSERT') {
              toast.info('New AI recommendation', {
                description: 'AI has generated a new recommendation.',
              });
            }
          }
        }
      );
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Real-time sync active across all pages');
      }
    });

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, showNotifications]);
}

// Hook to trigger a global refresh across all pages
export function useGlobalRefresh() {
  const queryClient = useQueryClient();

  const refreshAll = () => {
    // Invalidate all queries to trigger refetch
    queryClient.invalidateQueries();
    toast.success('Data refreshed across all pages');
  };

  const refreshTable = (table: typeof SYNC_TABLES[number]) => {
    const queryKeys = TABLE_QUERY_MAP[table] || [];
    queryKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  return { refreshAll, refreshTable };
}
