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
        // Generate mock data if no real data
        const mockData = generateMockData(hours);
        setData(mockData);
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
        // Generate mock data if empty
        const mockData = generateMockData(hours);
        setData(mockData);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [hours]);

  return { data, loading };
};

function generateMockData(hours: number): MetricsDataPoint[] {
  const data: MetricsDataPoint[] = [];
  const now = new Date();
  
  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now);
    timestamp.setHours(timestamp.getHours() - i);
    
    // Simulate realistic railway patterns - peak hours have more traffic
    const hour = timestamp.getHours();
    const isPeakHour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20);
    const baseTraffic = isPeakHour ? 1.3 : 1;
    
    data.push({
      timestamp: timestamp.toISOString(),
      throughput: Math.round(15 + Math.random() * 10 * baseTraffic),
      averageDelay: Math.round((2 + Math.random() * 8 * (isPeakHour ? 1.5 : 1)) * 10) / 10,
      utilization: Math.round((60 + Math.random() * 30 * baseTraffic) * 10) / 10,
      onTimePerformance: Math.round((85 - Math.random() * 15 * (isPeakHour ? 1.2 : 0.8)) * 10) / 10,
      activeTrains: Math.round(8 + Math.random() * 12 * baseTraffic),
      pendingConflicts: Math.round(Math.random() * 3 * (isPeakHour ? 2 : 1)),
    });
  }
  
  return data;
}
