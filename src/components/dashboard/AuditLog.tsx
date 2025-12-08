import { motion } from 'framer-motion';
import { 
  History, User, Train, Zap, AlertTriangle, CheckCircle2,
  Clock, Filter, ChevronDown
} from 'lucide-react';
import { useAuditLogs } from '@/hooks/useAuditLog';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AuditLogProps {
  className?: string;
}

const actionIcons: Record<string, typeof Train> = {
  command: Train,
  recommendation: Zap,
  alert: AlertTriangle,
  resolve: CheckCircle2,
};

const actionColors: Record<string, { bg: string; text: string; border: string }> = {
  command: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  recommendation: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/30' },
  alert: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  resolve: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  default: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
};

export const AuditLog = ({ className }: AuditLogProps) => {
  const { logs, loading } = useAuditLogs(30);
  const [filter, setFilter] = useState<string | null>(null);

  const filteredLogs = filter 
    ? logs.filter(log => log.action_type === filter)
    : logs;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionStyle = (actionType: string) => {
    return actionColors[actionType] || actionColors.default;
  };

  const getActionIcon = (actionType: string) => {
    return actionIcons[actionType] || History;
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
          <div className="p-2 rounded-md bg-muted">
            <History className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Audit Log</h3>
            <p className="text-xs text-muted-foreground">{logs.length} actions recorded</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8">
              <Filter className="w-3 h-3" />
              {filter || 'All'}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilter(null)}>All Actions</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('command')}>Commands</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('recommendation')}>Recommendations</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('alert')}>Alerts</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('resolve')}>Resolved</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <History className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">No actions recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">Actions will appear here as you use the system</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredLogs.map((log, idx) => {
              const style = getActionStyle(log.action_type);
              const Icon = getActionIcon(log.action_type);

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className={cn(
                      'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border',
                      style.bg, style.border
                    )}>
                      <Icon className={cn('w-4 h-4', style.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground line-clamp-2">
                          {log.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(log.created_at)}
                        </span>
                        {log.entity_id && (
                          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                            {log.entity_type}: {log.entity_id}
                          </span>
                        )}
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded capitalize',
                          style.bg, style.text
                        )}>
                          {log.action_type}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
