import { motion, AnimatePresence } from 'framer-motion';
import { Train } from '@/types/railway';
import { cn } from '@/lib/utils';
import { X, Clock, MapPin, Gauge, Route, Calendar, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface TrainDetailsProps {
  train: Train | null;
  onClose: () => void;
}

const priorityConfig = {
  critical: { label: 'CRITICAL', className: 'bg-destructive text-destructive-foreground' },
  high: { label: 'HIGH', className: 'bg-warning text-warning-foreground' },
  medium: { label: 'MEDIUM', className: 'bg-primary text-primary-foreground' },
  low: { label: 'LOW', className: 'bg-muted text-muted-foreground' },
};

const statusConfig = {
  'on-time': { label: 'On Time', className: 'text-success', bg: 'bg-success/10' },
  delayed: { label: 'Delayed', className: 'text-destructive', bg: 'bg-destructive/10' },
  halted: { label: 'Halted', className: 'text-warning', bg: 'bg-warning/10' },
  approaching: { label: 'Approaching', className: 'text-primary', bg: 'bg-primary/10' },
};

export const TrainDetails = ({ train, onClose }: TrainDetailsProps) => {
  return (
    <AnimatePresence>
      {train && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="bg-card border border-border rounded-lg p-4 h-full flex flex-col"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-lg font-semibold text-foreground">{train.number}</span>
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', priorityConfig[train.priority].className)}>
                  {priorityConfig[train.priority].label}
                </span>
              </div>
              <h2 className="text-sm text-muted-foreground">{train.name}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className={cn('rounded-lg p-3 mb-4', statusConfig[train.status].bg)}>
            <div className="flex items-center justify-between">
              <span className={cn('text-sm font-medium', statusConfig[train.status].className)}>
                {statusConfig[train.status].label}
              </span>
              {train.delay !== 0 && (
                <span className={cn(
                  'font-mono text-sm font-semibold',
                  train.delay > 0 ? 'text-destructive' : 'text-success'
                )}>
                  {train.delay > 0 ? `+${train.delay}` : train.delay} min
                </span>
              )}
            </div>
            {train.delay > 0 && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <span>Delay propagation risk: Medium</span>
              </div>
            )}
          </div>

          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="data-label mb-1">Origin</p>
                <p className="text-sm text-foreground">{train.origin}</p>
              </div>
              <div>
                <p className="data-label mb-1">Destination</p>
                <p className="text-sm text-foreground">{train.destination}</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="data-label mb-3">Journey Progress</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{train.origin}</span>
                  <span className="text-muted-foreground">{train.destination}</span>
                </div>
                <Progress value={(train.currentSection / 8) * 100} className="h-2" />
                <div className="flex items-center justify-center gap-2 text-xs">
                  <MapPin className="w-3 h-3 text-primary" />
                  <span className="text-foreground">Currently at Section {train.currentSection}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="data-label">Scheduled</p>
                  <p className="font-mono text-sm text-foreground">{train.scheduledTime}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="data-label">Actual</p>
                  <p className="font-mono text-sm text-foreground">{train.actualTime}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <Gauge className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="data-label">Speed</p>
                  <p className="font-mono text-sm text-foreground">{train.speed} km/h</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <Route className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="data-label">ETA</p>
                  <p className="font-mono text-sm text-foreground">{train.eta}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="data-label mb-2">Next Station</p>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{train.nextStation}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <Button variant="outline" size="sm" className="flex-1">
              View History
            </Button>
            <Button variant="default" size="sm" className="flex-1">
              Send Command
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
