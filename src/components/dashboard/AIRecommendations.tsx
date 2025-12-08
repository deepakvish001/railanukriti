import { motion, AnimatePresence } from 'framer-motion';
import { AIRecommendation } from '@/types/railway';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronRight, Check, X, Zap, RotateCcw, Pause, Navigation, Brain, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AIRecommendationsProps {
  recommendations: AIRecommendation[];
}

const typeConfig = {
  precedence: { icon: Zap, label: 'Precedence', color: 'text-primary', bgColor: 'bg-primary/20' },
  crossing: { icon: Navigation, label: 'Crossing', color: 'text-success', bgColor: 'bg-success/20' },
  reroute: { icon: RotateCcw, label: 'Reroute', color: 'text-warning', bgColor: 'bg-warning/20' },
  hold: { icon: Pause, label: 'Hold', color: 'text-muted-foreground', bgColor: 'bg-muted' },
};

const RecommendationCard = ({ 
  recommendation, 
  index,
  onResolve,
}: { 
  recommendation: AIRecommendation;
  index: number;
  onResolve: (id: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [isActioning, setIsActioning] = useState(false);
  const { user } = useAuth();
  const config = typeConfig[recommendation.type];
  const Icon = config.icon;

  const handleApprove = async () => {
    setIsActioning(true);
    
    const { error } = await supabase
      .from('ai_recommendations')
      .update({ 
        is_active: false, 
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id 
      })
      .eq('id', recommendation.id);

    setIsActioning(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to apply recommendation.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Recommendation Applied",
        description: `${recommendation.action.slice(0, 50)}... has been executed.`,
      });
      onResolve(recommendation.id);
    }
  };

  const handleReject = async () => {
    setIsActioning(true);
    
    const { error } = await supabase
      .from('ai_recommendations')
      .update({ 
        is_active: false, 
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id 
      })
      .eq('id', recommendation.id);

    setIsActioning(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to dismiss recommendation.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Recommendation Dismissed",
        description: "The recommendation has been dismissed.",
      });
      onResolve(recommendation.id);
    }
  };

  const confidenceColor = recommendation.confidence >= 0.9 ? 'text-success' :
    recommendation.confidence >= 0.75 ? 'text-primary' : 'text-warning';

  const formattedTime = new Date(recommendation.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'border rounded-xl overflow-hidden transition-all',
        isExpanded 
          ? 'bg-gradient-to-br from-primary/10 via-card to-card border-primary/30 shadow-lg shadow-primary/5' 
          : 'bg-card border-border hover:border-primary/20'
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left"
      >
        <div className={cn('p-2.5 rounded-lg', config.bgColor)}>
          <Icon className={cn('w-4 h-4', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
              config.bgColor, config.color
            )}>
              {config.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formattedTime}
            </span>
          </div>
          <p className="text-sm text-foreground font-medium line-clamp-2">{recommendation.action}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Confidence</div>
            <div className={cn('font-mono text-lg font-bold', confidenceColor)}>
              {Math.round(recommendation.confidence * 100)}%
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
          >
            <div className="border-t border-border/50 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    AI Reasoning
                  </p>
                  <p className="text-sm text-foreground">{recommendation.reason}</p>
                </div>
                <div className="bg-success/10 rounded-lg p-3 border border-success/20">
                  <p className="text-[10px] text-success uppercase tracking-wide mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Projected Impact
                  </p>
                  <p className="text-sm text-success font-medium">{recommendation.impact}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-2 bg-success hover:bg-success/90 text-white h-10"
                  onClick={handleApprove}
                  disabled={isActioning}
                >
                  <Check className="w-4 h-4" />
                  Apply Action
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 h-10"
                  onClick={handleReject}
                  disabled={isActioning}
                >
                  <X className="w-4 h-4" />
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

export const AIRecommendations = ({ recommendations }: AIRecommendationsProps) => {
  const [localRecs, setLocalRecs] = useState(recommendations);

  // Update local state when props change
  if (recommendations !== localRecs && recommendations.length !== localRecs.length) {
    setLocalRecs(recommendations);
  }

  const handleResolve = (id: string) => {
    setLocalRecs(prev => prev.filter(r => r.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-xl p-5 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">AI Recommendations</h2>
            <p className="text-xs text-muted-foreground">{localRecs.length} pending actions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">AI Active</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        <AnimatePresence mode="popLayout">
          {localRecs.length > 0 ? (
            localRecs.map((rec, index) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                index={index}
                onResolve={handleResolve}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">All Clear</h3>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                No pending recommendations. The AI is monitoring your section.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-2">
            <Brain className="w-3.5 h-3.5" />
            RailOptimizer AI v2.1
          </span>
          <span className="flex items-center gap-1.5 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Analyzing traffic patterns
          </span>
        </div>
      </div>
    </motion.div>
  );
};
