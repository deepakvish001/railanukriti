import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertOctagon, Shield, Clock, Check, X, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useConflicts, Conflict } from '@/hooks/useConflicts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLogAction } from '@/hooks/useAuditLog';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SeverityIcon = ({ severity }: { severity: Conflict['severity'] }) => {
  switch (severity) {
    case 'critical':
      return <AlertOctagon className="w-4 h-4 text-destructive" />;
    case 'high':
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    case 'medium':
      return <Shield className="w-4 h-4 text-primary" />;
    case 'low':
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const severityColors: Record<Conflict['severity'], string> = {
  critical: 'bg-destructive/20 text-destructive border-destructive/30',
  high: 'bg-warning/20 text-warning border-warning/30',
  medium: 'bg-primary/20 text-primary border-primary/30',
  low: 'bg-muted text-muted-foreground border-border',
};

const typeLabels: Record<Conflict['type'], string> = {
  path: 'Path Conflict',
  schedule: 'Schedule Conflict',
  resource: 'Resource Conflict',
  priority: 'Priority Conflict',
};

interface ConflictCardProps {
  conflict: Conflict;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}

const ConflictCard = ({ conflict, onResolve, onDismiss }: ConflictCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState(conflict.aiSuggestion);
  const { logAction } = useLogAction();
  const { toast } = useToast();

  const fetchSuggestion = async () => {
    if (suggestion) return;
    
    setLoadingSuggestion(true);
    try {
      const { data, error } = await supabase.functions.invoke('conflict-suggestion', {
        body: { conflict },
      });

      if (error) throw error;
      setSuggestion(data.suggestion);
    } catch (error) {
      console.error('Error fetching suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to fetch AI suggestion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleResolve = () => {
    logAction('conflict_resolved', 'conflict', `Resolved conflict: ${conflict.description}`, conflict.id);
    onResolve(conflict.id);
    toast({
      title: "Conflict Resolved",
      description: "The conflict has been marked as resolved.",
    });
  };

  const handleDismiss = () => {
    logAction('conflict_dismissed', 'conflict', `Dismissed conflict: ${conflict.description}`, conflict.id);
    onDismiss(conflict.id);
  };

  const handleExpand = () => {
    setExpanded(!expanded);
    if (!expanded && !suggestion) {
      fetchSuggestion();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout
      className={`border rounded-lg p-3 ${severityColors[conflict.severity]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="mt-0.5">
            <SeverityIcon severity={conflict.severity} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {typeLabels[conflict.type]}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(conflict.detectedAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-xs mt-1 leading-relaxed">{conflict.description}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={handleExpand}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-current/10">
              {/* AI Suggestion */}
              <div className="bg-background/50 rounded-md p-2.5 mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary">AI Resolution Suggestion</span>
                </div>
                {loadingSuggestion ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing conflict...
                  </div>
                ) : suggestion ? (
                  <p className="text-xs text-foreground leading-relaxed">{suggestion}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Click to generate suggestion</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs flex-1"
                  onClick={handleResolve}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Apply & Resolve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={handleDismiss}
                >
                  <X className="w-3 h-3 mr-1" />
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const ConflictDetection = () => {
  const { conflicts, loading, resolveConflict, dismissConflict } = useConflicts();

  const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
  const highCount = conflicts.filter(c => c.severity === 'high').length;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-mono">Scanning for conflicts...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 h-full flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="text-sm font-medium text-foreground">Conflict Detection</h3>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {criticalCount} Critical
            </Badge>
          )}
          {highCount > 0 && (
            <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">
              {highCount} High
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {conflicts.length} Active
          </Badge>
        </div>
      </div>

      {/* Conflicts List */}
      <div className="flex-1 overflow-auto space-y-2 min-h-0">
        {conflicts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-success" />
            </div>
            <h4 className="text-sm font-medium text-foreground mb-1">No Active Conflicts</h4>
            <p className="text-xs text-muted-foreground">All train movements are clear</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {conflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={resolveConflict}
                onDismiss={dismissConflict}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};
