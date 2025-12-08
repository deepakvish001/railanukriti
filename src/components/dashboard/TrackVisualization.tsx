import { motion } from 'framer-motion';
import { Train, TrackSection } from '@/types/railway';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface TrackVisualizationProps {
  sections: TrackSection[];
  trains: Train[];
  selectedTrain: string | null;
  onTrainSelect: (id: string) => void;
  loading?: boolean;
}

const TrackVisualizationSkeleton = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-card border border-border rounded-lg p-6 card-glow"
  >
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex items-center gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>

    <div className="relative grid-pattern rounded-lg p-8 bg-muted/30">
      <div className="flex justify-between px-4 mb-8">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>

      <div className="flex gap-1 mb-16">
        {[...Array(8)].map((_, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center">
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-8 mt-2" />
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-4">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>

    <div className="flex items-center justify-center gap-6 mt-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  </motion.div>
);

const TrainMarker = ({ 
  train, 
  isSelected, 
  onClick,
  position 
}: { 
  train: Train; 
  isSelected: boolean; 
  onClick: () => void;
  position: number;
}) => {
  const typeColors = {
    express: 'bg-train-express border-train-express',
    freight: 'bg-train-freight border-train-freight',
    local: 'bg-train-local border-train-local',
    special: 'bg-train-special border-train-special',
  };

  const typeGlow = {
    express: 'shadow-[0_0_12px_hsl(var(--train-express)/0.6)]',
    freight: 'shadow-[0_0_12px_hsl(var(--train-freight)/0.6)]',
    local: 'shadow-[0_0_12px_hsl(var(--train-local)/0.6)]',
    special: 'shadow-[0_0_12px_hsl(var(--train-special)/0.6)]',
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: position * 0.1, type: 'spring' }}
      className="absolute flex flex-col items-center"
      style={{ left: `${(position / 8) * 100}%`, transform: 'translateX(-50%)' }}
    >
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={cn(
          'relative w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all',
          typeColors[train.type],
          isSelected ? typeGlow[train.type] : '',
          isSelected ? 'ring-2 ring-foreground/20 ring-offset-2 ring-offset-background' : '',
          train.status === 'halted' ? 'animate-pulse' : 'train-marker'
        )}
      >
        <span className="text-[10px] font-bold text-primary-foreground">
          {train.type[0].toUpperCase()}
        </span>
        {train.status === 'delayed' && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-background" />
        )}
      </motion.button>
      <div className={cn(
        'mt-2 px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-all',
        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      )}>
        {train.number}
      </div>
    </motion.div>
  );
};

export const TrackVisualization = ({ sections, trains, selectedTrain, onTrainSelect, loading = false }: TrackVisualizationProps) => {
  if (loading || sections.length === 0) {
    return <TrackVisualizationSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-lg p-6 card-glow"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Section Overview</h2>
          <p className="text-xs text-muted-foreground">Kanpur - Allahabad Main Line</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-track-clear" />
            <span className="text-muted-foreground">Clear</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-track-occupied" />
            <span className="text-muted-foreground">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-track-blocked" />
            <span className="text-muted-foreground">Blocked</span>
          </div>
        </div>
      </div>

      {/* Track visualization */}
      <div className="relative grid-pattern rounded-lg p-8 bg-muted/30">
        {/* Station markers */}
        <div className="absolute top-2 left-0 right-0 flex justify-between px-4 text-[10px] text-muted-foreground font-mono">
          <span>KANPUR JN</span>
          <span>ALLAHABAD JN</span>
        </div>

        {/* Main track line */}
        <div className="relative mt-8">
          {/* Track sections */}
          <div className="flex gap-1 mb-16">
            {sections.map((section, idx) => (
              <motion.div
                key={section.id}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="flex-1 flex flex-col items-center"
              >
                <div
                  className={cn(
                    'track-segment w-full',
                    section.status === 'clear' && 'track-clear',
                    section.status === 'occupied' && 'track-occupied',
                    section.status === 'blocked' && 'track-blocked'
                  )}
                />
                <span className="mt-2 text-[9px] text-muted-foreground font-mono">
                  {section.name}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Train markers */}
          <div className="absolute top-4 left-0 right-0">
            {trains.map((train) => (
              <TrainMarker
                key={train.id}
                train={train}
                isSelected={selectedTrain === train.id}
                onClick={() => onTrainSelect(train.id)}
                position={train.currentSection}
              />
            ))}
          </div>
        </div>

        {/* Direction indicators */}
        <div className="flex justify-between mt-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>← DN</span>
          </div>
          <div className="flex items-center gap-1">
            <span>UP →</span>
          </div>
        </div>
      </div>

      {/* Train type legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-train-express" />
          <span className="text-muted-foreground">Express</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-train-freight" />
          <span className="text-muted-foreground">Freight</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-train-local" />
          <span className="text-muted-foreground">Local</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-train-special" />
          <span className="text-muted-foreground">Special</span>
        </div>
      </div>
    </motion.div>
  );
};
