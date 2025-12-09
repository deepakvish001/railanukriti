import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MetricsDataPoint {
  timestamp: string;
  throughput: number;
  averageDelay: number;
  utilization: number;
  onTimePerformance: number;
  activeTrains: number;
  pendingConflicts: number;
}

export const useMetricsHistory = (hours: number = 24) => {
  const [data, setData] = useState<MetricsDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - hours);

      const { data: metrics, error } = await supabase
        .from('section_metrics')
        .select('*')
        .gte('recorded_at', cutoff.toISOString())
        .order('recorded_at', { ascending: true });

      if (error) {
        console.error('Error fetching metrics history:', error);
        setData([]);
      } else if (metrics && metrics.length > 0) {
        setData(metrics.map(m => ({
          timestamp: m.recorded_at,
          throughput: m.throughput,
          averageDelay: Number(m.average_delay),
          utilization: Number(m.utilization),
          onTimePerformance: Number(m.on_time_performance),
          activeTrains: m.active_trains,
          pendingConflicts: m.pending_conflicts,
        })));
      } else {
        // Return empty array when no data exists
        setData([]);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [hours]);

  return { data, loading };
};
