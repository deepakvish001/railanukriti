import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, Play, RotateCcw, Clock, TrendingUp, AlertTriangle,
  ChevronDown, CheckCircle2, X, Zap, Timer, Route
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Train } from '@/types/railway';
import { cn } from '@/lib/utils';
import { useLogAction } from '@/hooks/useAuditLog';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { toast } from '@/hooks/use-toast';

interface ScenarioSimulationProps {
  trains: Train[];
  onClose?: () => void;
}

interface SimulationResult {
  scenario: string;
  impact: {
    delayReduction: number;
    throughputChange: number;
    conflictsAvoided: number;
  };
  recommendation: string;
  confidence: number;
}

export const ScenarioSimulation = ({ trains, onClose }: ScenarioSimulationProps) => {
  const [selectedTrain1, setSelectedTrain1] = useState<string>('');
  const [selectedTrain2, setSelectedTrain2] = useState<string>('');
  const [scenario, setScenario] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [speedAdjust, setSpeedAdjust] = useState(0);
  const { logAction } = useLogAction();
  const { playSound } = useNotificationSound();

  const scenarios = [
    { value: 'precedence', label: 'Change Precedence', description: 'Swap train order at crossing', icon: Route },
    { value: 'hold', label: 'Hold at Station', description: 'Hold train for crossing', icon: Timer },
    { value: 'speedup', label: 'Speed Adjustment', description: 'Increase/decrease speed', icon: Zap },
    { value: 'reroute', label: 'Reroute', description: 'Alternative track path', icon: Route },
    { value: 'delay_inject', label: 'Inject Delay', description: 'Simulate delay scenario', icon: Clock },
  ];

  const runSimulation = () => {
    if (!selectedTrain1 || !scenario) return;

    setIsSimulating(true);
    setResult(null);

    // Simulate AI processing
    setTimeout(() => {
      const train1 = trains.find(t => t.id === selectedTrain1);
      const train2 = selectedTrain2 ? trains.find(t => t.id === selectedTrain2) : null;
      
      const mockResults: Record<string, SimulationResult> = {
        precedence: {
          scenario: 'Precedence Change',
          impact: {
            delayReduction: Math.floor(8 + Math.random() * 8),
            throughputChange: Math.floor(5 + Math.random() * 5),
            conflictsAvoided: Math.floor(1 + Math.random() * 2),
          },
          recommendation: `Recommended: Allow ${train1?.name || 'express train'} to pass first${train2 ? `, holding ${train2.name}` : ''}, reducing overall section delay.`,
          confidence: Math.floor(85 + Math.random() * 10),
        },
        hold: {
          scenario: 'Station Hold',
          impact: {
            delayReduction: Math.floor(5 + Math.random() * 6),
            throughputChange: Math.floor(2 + Math.random() * 4),
            conflictsAvoided: 1,
          },
          recommendation: `Hold ${train1?.name || 'freight'} at nearest station for ${Math.floor(3 + Math.random() * 5)} min to allow safe crossing.`,
          confidence: Math.floor(82 + Math.random() * 12),
        },
        speedup: {
          scenario: 'Speed Adjustment',
          impact: {
            delayReduction: Math.floor(3 + Math.random() * 5),
            throughputChange: Math.floor(3 + Math.random() * 4),
            conflictsAvoided: 0,
          },
          recommendation: `${speedAdjust >= 0 ? 'Increase' : 'Decrease'} ${train1?.name || 'train'} speed by ${Math.abs(speedAdjust) || 10} km/h through clear sections to ${speedAdjust >= 0 ? 'recover delay' : 'reduce conflicts'}.`,
          confidence: Math.floor(80 + Math.random() * 10),
        },
        reroute: {
          scenario: 'Reroute',
          impact: {
            delayReduction: Math.floor(10 + Math.random() * 8),
            throughputChange: Math.floor(-3 + Math.random() * 2),
            conflictsAvoided: Math.floor(2 + Math.random() * 2),
          },
          recommendation: `Reroute ${train1?.name || 'train'} via loop line. Adds ~3 km but avoids major conflict zone.`,
          confidence: Math.floor(75 + Math.random() * 10),
        },
        delay_inject: {
          scenario: 'Delay Injection Analysis',
          impact: {
            delayReduction: -delayMinutes,
            throughputChange: Math.floor(-5 - Math.random() * 5),
            conflictsAvoided: -Math.floor(Math.random() * 3),
          },
          recommendation: `If ${train1?.name || 'train'} is delayed by ${delayMinutes} min: ${Math.floor(Math.random() * 3) + 1} downstream trains affected. Recommend pre-emptive holds at Sections 2 and 4.`,
          confidence: Math.floor(88 + Math.random() * 8),
        },
      };

      setResult(mockResults[scenario] || mockResults.precedence);
      setIsSimulating(false);
      playSound('info');
      
      logAction('simulation', 'scenario', 
        `Ran ${scenario} simulation for train ${train1?.number || selectedTrain1}`,
        selectedTrain1, { scenario, result: mockResults[scenario]?.impact });
    }, 2000);
  };

  const resetSimulation = () => {
    setSelectedTrain1('');
    setSelectedTrain2('');
    setScenario('');
    setResult(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-accent/20 border border-accent/30">
            <FlaskConical className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">What-If Simulation</h3>
            <p className="text-xs text-muted-foreground">Analyze scenario outcomes</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" aria-label="Close scenario simulation" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Scenario Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Primary Train</label>
            <Select value={selectedTrain1} onValueChange={setSelectedTrain1}>
              <SelectTrigger className="h-9 bg-muted border-border">
                <SelectValue placeholder="Select train" />
              </SelectTrigger>
              <SelectContent>
                {trains.map(train => (
                  <SelectItem key={train.id} value={train.id}>
                    {train.number} - {train.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Secondary Train (Optional)</label>
            <Select value={selectedTrain2} onValueChange={setSelectedTrain2}>
              <SelectTrigger className="h-9 bg-muted border-border">
                <SelectValue placeholder="Select train" />
              </SelectTrigger>
              <SelectContent>
                {trains.filter(t => t.id !== selectedTrain1).map(train => (
                  <SelectItem key={train.id} value={train.id}>
                    {train.number} - {train.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scenario Type */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Scenario Type</label>
          <div className="grid grid-cols-2 gap-2">
            {scenarios.map(s => (
              <button
                key={s.value}
                onClick={() => setScenario(s.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  scenario === s.value
                    ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                    : 'bg-muted/50 border-border hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-center gap-2">
                  <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-foreground">{s.label}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{s.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Scenario Parameters */}
        {scenario === 'delay_inject' && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Delay Amount</label>
              <span className="text-xs font-mono text-foreground">{delayMinutes} min</span>
            </div>
            <Slider
              value={[delayMinutes]}
              onValueChange={(v) => setDelayMinutes(v[0])}
              min={5}
              max={60}
              step={5}
            />
          </div>
        )}

        {scenario === 'speedup' && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Speed Change</label>
              <span className="text-xs font-mono text-foreground">{speedAdjust >= 0 ? '+' : ''}{speedAdjust} km/h</span>
            </div>
            <Slider
              value={[speedAdjust]}
              onValueChange={(v) => setSpeedAdjust(v[0])}
              min={-30}
              max={30}
              step={5}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={runSimulation}
            disabled={!selectedTrain1 || !scenario || isSimulating}
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isSimulating ? (
              <>
                <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin mr-2" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>
          <Button variant="outline" onClick={resetSimulation} className="border-border">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="h-px bg-border" />
              
              {/* Impact Metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                  <Clock className="w-4 h-4 text-success mx-auto mb-1" />
                  <p className="text-lg font-bold text-success font-mono">-{result.impact.delayReduction}</p>
                  <p className="text-[10px] text-muted-foreground">Min Delay</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-primary font-mono">+{result.impact.throughputChange}%</p>
                  <p className="text-[10px] text-muted-foreground">Throughput</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-center">
                  <AlertTriangle className="w-4 h-4 text-warning mx-auto mb-1" />
                  <p className="text-lg font-bold text-warning font-mono">{result.impact.conflictsAvoided}</p>
                  <p className="text-[10px] text-muted-foreground">Conflicts Avoided</p>
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-foreground">{result.recommendation}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-success transition-all"
                          style={{ width: `${result.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {result.confidence}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply Button */}
              <Button 
                className="w-full bg-success hover:bg-success/90 text-success-foreground"
                onClick={() => {
                  const train1 = trains.find(t => t.id === selectedTrain1);
                  playSound('success');
                  logAction('apply_recommendation', 'simulation',
                    `Applied ${result.scenario} recommendation for ${train1?.number || 'train'}`,
                    selectedTrain1, { scenario: result.scenario, impact: result.impact });
                  toast({
                    title: 'Recommendation Applied',
                    description: `${result.scenario} action has been executed successfully.`,
                  });
                  resetSimulation();
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Apply Recommendation
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
