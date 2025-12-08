import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Clock, AlertTriangle, TrendingUp, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Zap, Train, Shield, AlertOctagon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useTrains, useSectionMetrics } from '@/hooks/useRailwayData';
import { useConflicts } from '@/hooks/useConflicts';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TrainPrediction {
  trainNumber: string;
  trainName: string;
  currentDelay: number;
  predictedDelay: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommendation: string;
}

interface OverallAnalysis {
  sectionRisk: 'low' | 'medium' | 'high';
  expectedCascadeDelay: number;
  peakCongestionTime: string;
  summary: string;
}

interface PredictionAlert {
  type: 'warning' | 'critical';
  message: string;
  affectedTrains: string[];
}

interface PredictionResponse {
  predictions: TrainPrediction[];
  overallAnalysis: OverallAnalysis;
  alerts: PredictionAlert[];
}

const riskColors = {
  low: { bg: 'bg-success/20', text: 'text-success', border: 'border-success/30' },
  medium: { bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary/30' },
  high: { bg: 'bg-warning/20', text: 'text-warning', border: 'border-warning/30' },
  critical: { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive/30' },
};

const RiskIcon = ({ level }: { level: string }) => {
  switch (level) {
    case 'critical': return <AlertOctagon className="w-4 h-4" />;
    case 'high': return <AlertTriangle className="w-4 h-4" />;
    case 'medium': return <Zap className="w-4 h-4" />;
    default: return <Shield className="w-4 h-4" />;
  }
};

const PredictionCard = ({ prediction }: { prediction: TrainPrediction }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = riskColors[prediction.riskLevel];
  const delayChange = prediction.predictedDelay - prediction.currentDelay;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("border rounded-lg p-3", colors.bg, colors.border)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className={cn("mt-0.5", colors.text)}>
            <RiskIcon level={prediction.riskLevel} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium">{prediction.trainNumber}</span>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", colors.text)}>
                {prediction.riskLevel.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{prediction.trainName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-xs text-muted-foreground">Predicted:</span>
              <span className={cn("font-mono font-bold", prediction.predictedDelay > 10 ? 'text-destructive' : colors.text)}>
                {prediction.predictedDelay} min
              </span>
            </div>
            {delayChange !== 0 && (
              <div className={cn("text-[10px] font-mono", delayChange > 0 ? 'text-destructive' : 'text-success')}>
                {delayChange > 0 ? '+' : ''}{delayChange} min
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-current/10 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <Progress value={prediction.confidence * 100} className="h-1.5 flex-1" />
                  <span className="text-xs font-mono">{(prediction.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Contributing Factors</p>
                <div className="flex flex-wrap gap-1">
                  {prediction.factors.map((factor, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {factor}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="bg-background/50 rounded p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> AI Recommendation
                </p>
                <p className="text-xs">{prediction.recommendation}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const DelayPrediction = () => {
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { trains } = useTrains();
  const { metrics } = useSectionMetrics();
  const { conflicts } = useConflicts();
  const { toast } = useToast();

  const fetchPredictions = async () => {
    if (trains.length === 0) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('predict-delays', {
        body: { 
          trains: trains.slice(0, 10),
          metrics,
          conflicts: conflicts.slice(0, 5)
        },
      });

      if (error) throw error;
      
      setPredictions(data);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Prediction error:', error);
      toast({
        title: "Prediction Error",
        description: error.message || "Failed to fetch delay predictions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (trains.length > 0 && !predictions) {
      fetchPredictions();
    }
  }, [trains.length]);

  const overallRiskColors = predictions?.overallAnalysis?.sectionRisk 
    ? riskColors[predictions.overallAnalysis.sectionRisk]
    : riskColors.medium;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">AI Delay Prediction</h2>
            <p className="text-xs text-muted-foreground">
              {lastUpdated 
                ? `Last updated: ${lastUpdated.toLocaleTimeString('en-IN')}`
                : 'Click refresh to generate predictions'
              }
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPredictions}
          disabled={loading || trains.length === 0}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {loading ? 'Analyzing...' : 'Refresh'}
        </Button>
      </div>

      {/* Overall Analysis */}
      {predictions?.overallAnalysis && (
        <Card className={cn("border", overallRiskColors.border, overallRiskColors.bg)}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={cn("p-2 rounded-lg", overallRiskColors.bg)}>
                <TrendingUp className={cn("w-5 h-5", overallRiskColors.text)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium">Section Overview</h3>
                  <Badge variant="outline" className={cn("text-[10px]", overallRiskColors.text)}>
                    {predictions.overallAnalysis.sectionRisk.toUpperCase()} RISK
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{predictions.overallAnalysis.summary}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Cascade Delay</p>
                    <p className="font-mono font-bold">{predictions.overallAnalysis.expectedCascadeDelay} min</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Peak Time</p>
                    <p className="font-mono font-bold">{predictions.overallAnalysis.peakCongestionTime}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Trains Analyzed</p>
                    <p className="font-mono font-bold">{predictions.predictions.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {predictions?.alerts && predictions.alerts.length > 0 && (
        <div className="space-y-2">
          {predictions.alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-start gap-2 p-3 rounded-lg border",
                alert.type === 'critical' 
                  ? 'bg-destructive/10 border-destructive/30' 
                  : 'bg-warning/10 border-warning/30'
              )}
            >
              <AlertTriangle className={cn(
                "w-4 h-4 mt-0.5",
                alert.type === 'critical' ? 'text-destructive' : 'text-warning'
              )} />
              <div className="flex-1">
                <p className="text-xs font-medium">{alert.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Affected: {alert.affectedTrains.join(', ')}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Train Predictions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Train className="w-4 h-4 text-primary" />
            Train-wise Predictions
          </h3>
          {predictions?.predictions && (
            <span className="text-xs text-muted-foreground">
              {predictions.predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length} at risk
            </span>
          )}
        </div>

        {loading && !predictions ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing train patterns...</p>
            <p className="text-xs text-muted-foreground">This may take a few seconds</p>
          </div>
        ) : predictions?.predictions && predictions.predictions.length > 0 ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            <AnimatePresence>
              {predictions.predictions
                .sort((a, b) => {
                  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                  return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                })
                .map((prediction, i) => (
                  <PredictionCard key={prediction.trainNumber} prediction={prediction} />
                ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No predictions yet</p>
            <p className="text-xs text-muted-foreground mb-3">Click refresh to analyze current conditions</p>
            <Button variant="outline" size="sm" onClick={fetchPredictions} disabled={loading}>
              Generate Predictions
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-end text-xs">
          <span className="flex items-center gap-1.5 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Predictive Analytics Active
          </span>
        </div>
      </div>
    </div>
  );
};

export default DelayPrediction;
