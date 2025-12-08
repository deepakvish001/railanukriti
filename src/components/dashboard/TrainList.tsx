import { motion } from 'framer-motion';
import { Train } from '@/types/railway';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Gauge, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TrainListProps {
  trains: Train[];
  selectedTrain: string | null;
  onTrainSelect: (id: string) => void;
}

const priorityConfig = {
  critical: { label: 'CRITICAL', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  high: { label: 'HIGH', className: 'bg-warning/20 text-warning border-warning/30' },
  medium: { label: 'MEDIUM', className: 'bg-primary/20 text-primary border-primary/30' },
  low: { label: 'LOW', className: 'bg-muted text-muted-foreground border-muted-foreground/30' },
};

const statusConfig = {
  'on-time': { label: 'On Time', className: 'text-success' },
  delayed: { label: 'Delayed', className: 'text-destructive' },
  halted: { label: 'Halted', className: 'text-warning' },
  approaching: { label: 'Approaching', className: 'text-primary' },
};

const typeConfig = {
  express: { color: 'bg-train-express' },
  freight: { color: 'bg-train-freight' },
  local: { color: 'bg-train-local' },
  special: { color: 'bg-train-special' },
};

const TrainCard = ({ 
  train, 
  isSelected, 
  onClick,
  index 
}: { 
  train: Train; 
  isSelected: boolean; 
  onClick: () => void;
  index: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all',
        isSelected 
          ? 'bg-primary/10 border-primary/40 border-glow-primary' 
          : 'bg-card border-border hover:border-muted-foreground/30 card-glow'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', typeConfig[train.type].color)} />
          <span className="font-mono text-sm font-semibold text-foreground">{train.number}</span>
        </div>
        <Badge variant="outline" className={cn('text-[10px] h-5', priorityConfig[train.priority].className)}>
          {priorityConfig[train.priority].label}
        </Badge>
      </div>

      <h3 className="text-sm font-medium text-foreground mb-2 truncate">{train.name}</h3>

      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
        <span>{train.origin}</span>
        <ArrowRight className="w-3 h-3" />
        <span>{train.destination}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ETA
          </span>
          <span className="font-mono text-foreground">{train.eta}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            Speed
          </span>
          <span className="font-mono text-foreground">{train.speed} km/h</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Next
          </span>
          <span className="font-mono text-foreground truncate text-[10px]">{train.nextStation}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className={cn('text-xs font-medium', statusConfig[train.status].className)}>
          {statusConfig[train.status].label}
        </span>
        {train.delay !== 0 && (
          <span className={cn(
            'text-xs font-mono',
            train.delay > 0 ? 'text-destructive' : 'text-success'
          )}>
            {train.delay > 0 ? `+${train.delay}` : train.delay} min
          </span>
        )}
      </div>
    </motion.div>
  );
};

export const TrainList = ({ trains, selectedTrain, onTrainSelect }: TrainListProps) => {
  // Sort by priority
  const sortedTrains = [...trains].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-lg p-4 flex flex-col max-h-[600px]"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Active Trains</h2>
          <p className="text-xs text-muted-foreground">{trains.length} trains in section</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {sortedTrains.map((train, index) => (
          <TrainCard
            key={train.id}
            train={train}
            isSelected={selectedTrain === train.id}
            onClick={() => onTrainSelect(train.id)}
            index={index}
          />
        ))}
      </div>
    </motion.div>
  );
};
