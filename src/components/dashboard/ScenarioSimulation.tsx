import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, Play, RotateCcw, Clock, TrendingUp, AlertTriangle,
  ChevronDown, CheckCircle2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Train } from '@/types/railway';
import { cn } from '@/lib/utils';

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

  const scenarios = [
    { value: 'precedence', label: 'Change Precedence', description: 'Swap train order at crossing' },
    { value: 'hold', label: 'Hold at Station', description: 'Hold train for crossing' },
    { value: 'speedup', label: 'Speed Adjustment', description: 'Increase/decrease speed' },
    { value: 'reroute', label: 'Reroute', description: 'Alternative track path' },
  ];

  const runSimulation = () => {
    if (!selectedTrain1 || !scenario) return;

    setIsSimulating(true);
    setResult(null);

    // Simulate AI processing
    setTimeout(() => {
      const mockResults: Record<string, SimulationResult> = {
        precedence: {
          scenario: 'Precedence Change',
          impact: {
            delayReduction: 12,
            throughputChange: 8,
            conflictsAvoided: 2,
          },
          recommendation: 'Recommended: Allow express train to pass first, reducing overall section delay by 12 minutes.',
          confidence: 92,
        },
        hold: {
          scenario: 'Station Hold',
          impact: {
            delayReduction: 8,
            throughputChange: 3,
            conflictsAvoided: 1,
          },
          recommendation: 'Hold freight at Manauri for 5 min to allow crossing. Minor impact on freight schedule.',
          confidence: 88,
        },
        speedup: {
          scenario: 'Speed Adjustment',
          impact: {
            delayReduction: 5,
            throughputChange: 5,
            conflictsAvoided: 0,
          },
          recommendation: 'Increase express speed to 110 km/h through clear sections to recover delay.',
          confidence: 85,
        },
        reroute: {
          scenario: 'Reroute',
          impact: {
            delayReduction: 15,
            throughputChange: -2,
            conflictsAvoided: 3,
          },
          recommendation: 'Reroute via loop line. Adds 3 km but avoids major conflict zone.',
          confidence: 78,
        },
      };

      setResult(mockResults[scenario] || mockResults.precedence);
      setIsSimulating(false);
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
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
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
                <p className="text-xs font-medium text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.description}</p>
              </button>
            ))}
          </div>
        </div>

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
              <Button className="w-full bg-success hover:bg-success/90 text-success-foreground">
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
