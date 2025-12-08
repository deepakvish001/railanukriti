import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle2, 
  X, Clock, Wrench, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  trainNumber?: string;
  isRead: boolean;
}

interface InfrastructureAlert {
  id: string;
  section_id: number | null;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  current_utilization: number | null;
  recommended_action: string | null;
  estimated_capacity_gain: number | null;
  is_acknowledged: boolean;
  created_at: string;
}

interface AlertsPanelProps {
  className?: string;
}

const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'Potential Conflict Detected',
    message: 'Trains 12301 and 14853 approaching same block section S4',
    time: '2 min ago',
    trainNumber: '12301',
    isRead: false,
  },
  {
    id: '2',
    type: 'warning',
    title: 'Delay Alert',
    message: 'Train 14853 delayed by 15 min. Recommend precedence change.',
    time: '5 min ago',
    trainNumber: '14853',
    isRead: false,
  },
  {
    id: '3',
    type: 'info',
    title: 'Track Maintenance',
    message: 'Section S6-S7 scheduled for maintenance at 23:00',
    time: '12 min ago',
    isRead: true,
  },
  {
    id: '4',
    type: 'success',
    title: 'Conflict Resolved',
    message: 'Precedence conflict at Manauri resolved successfully',
    time: '18 min ago',
    isRead: true,
  },
];

const AlertIcon = ({ type }: { type: Alert['type'] }) => {
  const icons = {
    critical: <AlertCircle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
    success: <CheckCircle2 className="w-4 h-4" />,
  };
  return icons[type];
};

const SeverityIcon = ({ severity }: { severity: InfrastructureAlert['severity'] }) => {
  const icons = {
    critical: <AlertCircle className="w-4 h-4" />,
    high: <AlertTriangle className="w-4 h-4" />,
    medium: <Info className="w-4 h-4" />,
    low: <CheckCircle2 className="w-4 h-4" />,
  };
  return icons[severity];
};

export const AlertsPanel = ({ className }: AlertsPanelProps) => {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [infraAlerts, setInfraAlerts] = useState<InfrastructureAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch infrastructure alerts
  useEffect(() => {
    const fetchInfraAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('infrastructure_alerts')
          .select('*')
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;
        setInfraAlerts((data || []) as InfrastructureAlert[]);
      } catch (error) {
        console.error('Error fetching infrastructure alerts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInfraAlerts();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('infrastructure-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'infrastructure_alerts',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newAlert = payload.new as InfrastructureAlert;
            setInfraAlerts(prev => [newAlert, ...prev]);
            
            // Show toast notification for critical alerts
            if (newAlert.severity === 'critical') {
              toast({
                title: newAlert.title,
                description: newAlert.description,
                variant: 'destructive',
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setInfraAlerts(prev => 
              prev.map(a => a.id === payload.new.id ? payload.new as InfrastructureAlert : a)
            );
          } else if (payload.eventType === 'DELETE') {
            setInfraAlerts(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const unreadCount = alerts.filter(a => !a.isRead).length;
  const unacknowledgedInfraCount = infraAlerts.filter(a => !a.is_acknowledged).length;
  const filteredAlerts = filter === 'unread' ? alerts.filter(a => !a.isRead) : alerts;
  const filteredInfraAlerts = filter === 'unread' ? infraAlerts.filter(a => !a.is_acknowledged) : infraAlerts;

  const markAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const acknowledgeInfraAlert = async (id: string) => {
    try {
      const { error } = await supabase
        .from('infrastructure_alerts')
        .update({ 
          is_acknowledged: true, 
          acknowledged_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;

      setInfraAlerts(prev => 
        prev.map(a => a.id === id ? { ...a, is_acknowledged: true } : a)
      );
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const typeStyles = {
    critical: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      icon: 'text-destructive',
      dot: 'bg-destructive',
    },
    warning: {
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      icon: 'text-warning',
      dot: 'bg-warning',
    },
    info: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      icon: 'text-primary',
      dot: 'bg-primary',
    },
    success: {
      bg: 'bg-success/10',
      border: 'border-success/30',
      icon: 'text-success',
      dot: 'bg-success',
    },
  };

  const severityStyles = {
    critical: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      icon: 'text-destructive',
      badge: 'bg-destructive text-destructive-foreground',
    },
    high: {
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      icon: 'text-warning',
      badge: 'bg-warning text-warning-foreground',
    },
    medium: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      icon: 'text-primary',
      badge: 'bg-primary text-primary-foreground',
    },
    low: {
      bg: 'bg-success/10',
      border: 'border-success/30',
      icon: 'text-success',
      badge: 'bg-success text-success-foreground',
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('bg-card border border-border rounded-lg flex flex-col', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {(unreadCount + unacknowledgedInfraCount) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount + unacknowledgedInfraCount}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-border">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-2 py-1 text-xs transition-colors',
                filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={cn(
                'px-2 py-1 text-xs transition-colors',
                filter === 'unread' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Unread
            </button>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-7">
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs for different alert types */}
      <Tabs defaultValue="operational" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border h-9">
          <TabsTrigger value="operational" className="text-xs gap-1.5">
            Operational
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="infrastructure" className="text-xs gap-1.5">
            <Wrench className="w-3 h-3" />
            Infrastructure
            {unacknowledgedInfraCount > 0 && (
              <Badge variant="destructive" className="h-4 px-1 text-[10px]">{unacknowledgedInfraCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operational" className="flex-1 overflow-y-auto m-0">
          <AnimatePresence>
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No operational alerts</p>
              </div>
            ) : (
              filteredAlerts.map((alert, idx) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => markAsRead(alert.id)}
                  className={cn(
                    'relative px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors',
                    !alert.isRead && 'bg-muted/30',
                    'hover:bg-muted/50'
                  )}
                >
                  <div className="flex gap-3">
                    <div className={cn(
                      'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      typeStyles[alert.type].bg,
                      'border',
                      typeStyles[alert.type].border
                    )}>
                      <span className={typeStyles[alert.type].icon}>
                        <AlertIcon type={alert.type} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'text-sm font-medium text-foreground',
                            !alert.isRead && 'font-semibold'
                          )}>
                            {alert.title}
                          </p>
                          {!alert.isRead && (
                            <span className={cn('w-2 h-2 rounded-full', typeStyles[alert.type].dot)} />
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }}
                          className="text-muted-foreground hover:text-foreground p-1 -m-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.time}
                        </span>
                        {alert.trainNumber && (
                          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                            {alert.trainNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="infrastructure" className="flex-1 overflow-y-auto m-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading alerts...</p>
            </div>
          ) : filteredInfraAlerts.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No infrastructure alerts</p>
              <p className="text-xs text-muted-foreground mt-1">Analysis runs every hour</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredInfraAlerts.map((alert, idx) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => acknowledgeInfraAlert(alert.id)}
                  className={cn(
                    'relative px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors',
                    !alert.is_acknowledged && 'bg-muted/30',
                    'hover:bg-muted/50'
                  )}
                >
                  <div className="flex gap-3">
                    <div className={cn(
                      'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      severityStyles[alert.severity].bg,
                      'border',
                      severityStyles[alert.severity].border
                    )}>
                      <span className={severityStyles[alert.severity].icon}>
                        <SeverityIcon severity={alert.severity} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'text-sm font-medium text-foreground',
                            !alert.is_acknowledged && 'font-semibold'
                          )}>
                            {alert.title}
                          </p>
                          {!alert.is_acknowledged && (
                            <span className={cn('w-2 h-2 rounded-full', severityStyles[alert.severity].icon.replace('text-', 'bg-'))} />
                          )}
                        </div>
                        <Badge className={cn('text-[10px] h-5', severityStyles[alert.severity].badge)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {alert.description}
                      </p>
                      {alert.recommended_action && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                          <Wrench className="w-3 h-3" />
                          <span className="line-clamp-1">{alert.recommended_action}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                        {alert.current_utilization && (
                          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {alert.current_utilization.toFixed(1)}%
                          </span>
                        )}
                        {alert.estimated_capacity_gain && (
                          <span className="text-[10px] text-success">
                            +{alert.estimated_capacity_gain} trains/hr
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};