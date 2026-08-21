import { motion, AnimatePresence } from 'framer-motion';
import { Train } from '@/types/railway';
import { cn } from '@/lib/utils';
import { 
  X, Clock, MapPin, Gauge, Route, ArrowRight, AlertTriangle, 
  Play, Pause, Square, Radio, Send, Activity, Zap, ArrowUpDown, Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLogAction } from '@/hooks/useAuditLog';
import { useNotificationSound } from '@/hooks/useNotificationSound';

interface TrainDetailsProps {
  train: Train | null;
  onClose: () => void;
}

const priorityConfig = {
  critical: { label: 'CRITICAL', className: 'bg-destructive text-destructive-foreground', glow: 'shadow-destructive/30' },
  high: { label: 'HIGH', className: 'bg-warning text-warning-foreground', glow: 'shadow-warning/30' },
  medium: { label: 'MEDIUM', className: 'bg-primary text-primary-foreground', glow: 'shadow-primary/30' },
  low: { label: 'LOW', className: 'bg-muted text-muted-foreground', glow: '' },
};

const statusConfig = {
  'on-time': { label: 'On Time', className: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  delayed: { label: 'Delayed', className: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
  halted: { label: 'Halted', className: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  approaching: { label: 'Approaching', className: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
};

const trainTypeConfig = {
  express: { label: 'Express', color: 'text-primary' },
  freight: { label: 'Freight', color: 'text-muted-foreground' },
  local: { label: 'Local', color: 'text-success' },
  special: { label: 'Special', color: 'text-warning' },
};

export const TrainDetails = ({ train, onClose }: TrainDetailsProps) => {
  const [isActioning, setIsActioning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetSpeed, setTargetSpeed] = useState(train?.speed || 0);
  const [newPriority, setNewPriority] = useState(train?.priority || 'medium');
  const { logAction } = useLogAction();
  const { playSound } = useNotificationSound();

  const handleCommand = async (command: 'proceed' | 'hold' | 'stop') => {
    if (!train) return;
    
    setIsActioning(true);

    const statusMap = {
      proceed: 'on-time' as const,
      hold: 'halted' as const,
      stop: 'halted' as const,
    };

    const { error } = await supabase
      .from('trains')
      .update({ 
        status: statusMap[command],
        speed: command === 'stop' || command === 'hold' ? 0 : train.speed,
      })
      .eq('id', train.id);

    setIsActioning(false);

    if (error) {
      toast({
        title: 'Command Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      playSound('success');
      await logAction(
        'command',
        'train',
        `Sent ${command.toUpperCase()} command to train ${train.number} (${train.name})`,
        train.id,
        { command, trainNumber: train.number, previousStatus: train.status }
      );
      
      toast({
        title: 'Command Sent',
        description: `${command.charAt(0).toUpperCase() + command.slice(1)} command sent to ${train.number}.`,
      });
    }
  };

  const handleSpeedChange = async () => {
    if (!train) return;
    setIsActioning(true);

    const { error } = await supabase
      .from('trains')
      .update({ speed: targetSpeed })
      .eq('id', train.id);

    setIsActioning(false);

    if (error) {
      toast({ title: 'Speed Change Failed', description: error.message, variant: 'destructive' });
    } else {
      playSound('success');
      await logAction('speed_change', 'train', 
        `Changed speed of ${train.number} from ${train.speed} to ${targetSpeed} km/h`, 
        train.id, { previousSpeed: train.speed, newSpeed: targetSpeed });
      toast({ title: 'Speed Updated', description: `Target speed set to ${targetSpeed} km/h.` });
    }
  };

  const handlePriorityChange = async () => {
    if (!train || newPriority === train.priority) return;
    setIsActioning(true);

    const { error } = await supabase
      .from('trains')
      .update({ priority: newPriority })
      .eq('id', train.id);

    setIsActioning(false);

    if (error) {
      toast({ title: 'Priority Change Failed', description: error.message, variant: 'destructive' });
    } else {
      playSound('success');
      await logAction('priority_change', 'train',
        `Changed priority of ${train.number} from ${train.priority} to ${newPriority}`,
        train.id, { previousPriority: train.priority, newPriority });
      toast({ title: 'Priority Updated', description: `Train priority changed to ${newPriority}.` });
    }
  };

  return (
    <AnimatePresence>
      {train && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="bg-card border border-border rounded-xl p-5 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xl font-bold text-foreground">{train.number}</span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg',
                  priorityConfig[train.priority].className,
                  priorityConfig[train.priority].glow
                )}>
                  {priorityConfig[train.priority].label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm text-muted-foreground">{train.name}</h2>
                <span className={cn('text-xs', trainTypeConfig[train.type].color)}>
                  • {trainTypeConfig[train.type].label}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close train details" onClick={onClose} className="h-8 w-8 rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Status Banner */}
          <div className={cn(
            'rounded-xl p-4 mb-4 border',
            statusConfig[train.status].bg,
            statusConfig[train.status].border
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className={cn('w-4 h-4', statusConfig[train.status].className)} />
                <span className={cn('text-sm font-semibold', statusConfig[train.status].className)}>
                  {statusConfig[train.status].label}
                </span>
              </div>
              {train.delay !== 0 && (
                <span className={cn(
                  'font-mono text-lg font-bold px-3 py-1 rounded-lg',
                  train.delay > 0 ? 'text-destructive bg-destructive/10' : 'text-success bg-success/10'
                )}>
                  {train.delay > 0 ? `+${train.delay}` : train.delay} min
                </span>
              )}
            </div>
            {train.delay > 15 && (
              <div className="flex items-center gap-2 mt-3 p-2 bg-warning/10 rounded-lg border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-xs text-warning">High delay - May affect downstream trains</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* Route */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">From</p>
                <p className="text-sm font-medium text-foreground">{train.origin}</p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-8 h-px bg-border" />
                <ArrowRight className="w-4 h-4" />
                <div className="w-8 h-px bg-border" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">To</p>
                <p className="text-sm font-medium text-foreground">{train.destination}</p>
              </div>
            </div>

            {/* Journey Progress */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3">Section Progress</p>
              <div className="space-y-2">
                <Progress value={(train.currentSection / 6) * 100} className="h-2" />
                <div className="flex items-center justify-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-foreground">Section {train.currentSection} of 6</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Scheduled</span>
                </div>
                <p className="font-mono text-lg font-semibold text-foreground">{train.scheduledTime}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Actual</span>
                </div>
                <p className="font-mono text-lg font-semibold text-foreground">{train.actualTime}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Speed</span>
                </div>
                <p className="font-mono text-lg font-semibold text-foreground">
                  {train.speed} <span className="text-xs text-muted-foreground">km/h</span>
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Route className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">ETA</span>
                </div>
                <p className="font-mono text-lg font-semibold text-foreground">{train.eta || '--:--'}</p>
              </div>
            </div>

            {/* Next Station */}
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Next Station</p>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground">{train.nextStation || 'N/A'}</span>
                </div>
                <Radio className="w-4 h-4 text-primary animate-pulse" />
              </div>
            </div>
          </div>

          {/* Command Buttons */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Train Commands</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Basic' : 'Advanced'}
              </Button>
            </div>
            
            {/* Basic Commands */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-success/30 text-success hover:bg-success/10 h-10"
                onClick={() => handleCommand('proceed')}
                disabled={isActioning || train.status === 'on-time'}
              >
                <Play className="w-4 h-4" />
                Proceed
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-warning/30 text-warning hover:bg-warning/10 h-10"
                onClick={() => handleCommand('hold')}
                disabled={isActioning || train.status === 'halted'}
              >
                <Pause className="w-4 h-4" />
                Hold
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 h-10"
                onClick={() => handleCommand('stop')}
                disabled={isActioning}
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            </div>

            {/* Advanced Controls */}
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 space-y-4"
              >
                {/* Speed Control */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium">Speed Control</span>
                    <span className="ml-auto font-mono text-xs text-foreground">{targetSpeed} km/h</span>
                  </div>
                  <Slider
                    value={[targetSpeed]}
                    onValueChange={(v) => setTargetSpeed(v[0])}
                    max={160}
                    step={5}
                    className="mb-3"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs"
                    onClick={handleSpeedChange}
                    disabled={isActioning || targetSpeed === train.speed}
                  >
                    <Gauge className="w-3.5 h-3.5 mr-1.5" />
                    Set Target Speed
                  </Button>
                </div>

                {/* Priority Change */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-medium">Priority Level</span>
                  </div>
                  <div className="flex gap-2">
                    <Select value={newPriority} onValueChange={(v: any) => setNewPriority(v)}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-3"
                      onClick={handlePriorityChange}
                      disabled={isActioning || newPriority === train.priority}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
