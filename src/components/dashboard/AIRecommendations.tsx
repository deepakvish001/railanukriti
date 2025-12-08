import { motion } from 'framer-motion';
import { AIRecommendation } from '@/types/railway';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronRight, Check, X, Zap, RotateCcw, Pause, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface AIRecommendationsProps {
  recommendations: AIRecommendation[];
}

const typeConfig = {
  precedence: { icon: Zap, label: 'Precedence', color: 'text-primary' },
  crossing: { icon: Navigation, label: 'Crossing', color: 'text-success' },
  reroute: { icon: RotateCcw, label: 'Reroute', color: 'text-warning' },
  hold: { icon: Pause, label: 'Hold', color: 'text-muted-foreground' },
};

const RecommendationCard = ({ 
  recommendation, 
  index 
}: { 
  recommendation: AIRecommendation;
  index: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const config = typeConfig[recommendation.type];
  const Icon = config.icon;

  const handleApprove = () => {
    toast({
      title: "Recommendation Applied",
      description: `${recommendation.action} has been executed.`,
    });
  };

  const handleReject = () => {
    toast({
      title: "Recommendation Dismissed",
      description: "The recommendation has been dismissed.",
      variant: "destructive",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        isExpanded ? 'bg-primary/5 border-primary/30' : 'bg-card border-border'
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left"
      >
        <div className={cn('p-2 rounded-md bg-muted', config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-medium uppercase tracking-wider', config.color)}>
              {config.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {recommendation.timestamp}
            </span>
          </div>
          <p className="text-sm text-foreground line-clamp-2">{recommendation.action}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div className={cn(
              'font-mono text-sm font-semibold',
              recommendation.confidence >= 90 ? 'text-success' :
              recommendation.confidence >= 75 ? 'text-primary' : 'text-warning'
            )}>
              {recommendation.confidence}%
            </div>
          </div>
          <ChevronRight className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90'
          )} />
        </div>
      </button>

      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4"
        >
          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Reason</p>
              <p className="text-sm text-foreground">{recommendation.reason}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Projected Impact</p>
              <p className="text-sm text-success">{recommendation.impact}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1 gap-2"
                onClick={handleApprove}
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={handleReject}
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export const AIRecommendations = ({ recommendations }: AIRecommendationsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-lg p-4 h-full flex flex-col"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-md bg-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Recommendations</h2>
          <p className="text-xs text-muted-foreground">{recommendations.length} active suggestions</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {recommendations.map((rec, index) => (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            index={index}
          />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">AI Model: RailOptimizer v2.1</span>
          <span className="flex items-center gap-1 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Processing
          </span>
        </div>
      </div>
    </motion.div>
  );
};
