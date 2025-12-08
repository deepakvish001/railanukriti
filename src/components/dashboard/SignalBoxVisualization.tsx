import { motion } from 'framer-motion';
import { Train, TrackSection } from '@/types/railway';
import { cn } from '@/lib/utils';

interface SignalBoxVisualizationProps {
  sections: TrackSection[];
  trains: Train[];
  selectedTrain: string | null;
  onTrainSelect: (id: string) => void;
}

// Signal component
const Signal = ({ status, direction = 'up' }: { status: 'clear' | 'caution' | 'danger'; direction?: 'up' | 'down' }) => {
  const colors = {
    clear: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]',
    caution: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]',
    danger: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  };

  return (
    <div className={cn('flex flex-col items-center gap-0.5', direction === 'down' && 'rotate-180')}>
      <div className="w-3 h-6 bg-zinc-800 rounded-sm flex flex-col items-center justify-center gap-0.5 p-0.5">
        <div className={cn('w-2 h-2 rounded-full transition-all', colors[status])} />
      </div>
      <div className="w-0.5 h-3 bg-zinc-600" />
    </div>
  );
};

// Block section indicator
const BlockIndicator = ({ 
  number, 
  occupied, 
  hasSignal,
  signalStatus,
  hasTrain,
  train,
  isSelected,
  onTrainClick
}: { 
  number: number; 
  occupied: boolean;
  hasSignal: boolean;
  signalStatus: 'clear' | 'caution' | 'danger';
  hasTrain?: boolean;
  train?: Train;
  isSelected?: boolean;
  onTrainClick?: () => void;
}) => {
  return (
    <div className="flex flex-col items-center">
      {hasSignal && (
        <div className="mb-1">
          <Signal status={signalStatus} />
        </div>
      )}
      <div className="relative">
        <div 
          className={cn(
            'w-6 h-8 rounded-sm border-2 flex items-center justify-center text-[8px] font-mono font-bold transition-all',
            occupied 
              ? 'bg-red-500/20 border-red-500 text-red-400' 
              : 'bg-zinc-800 border-zinc-600 text-zinc-400'
          )}
        >
          {String(number).padStart(2, '0')}
        </div>
        {hasTrain && train && (
          <motion.button
            onClick={onTrainClick}
            whileHover={{ scale: 1.1 }}
            className={cn(
              'absolute -top-6 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold cursor-pointer transition-all',
              train.type === 'express' && 'bg-train-express text-white',
              train.type === 'freight' && 'bg-train-freight text-white',
              train.type === 'local' && 'bg-train-local text-white',
              train.type === 'special' && 'bg-train-special text-white',
              isSelected && 'ring-2 ring-white ring-offset-1 ring-offset-background'
            )}
          >
            {train.type[0].toUpperCase()}
          </motion.button>
        )}
      </div>
    </div>
  );
};

// Track line segment
const TrackLine = ({ length = 'normal', status = 'clear' }: { length?: 'short' | 'normal' | 'long'; status?: 'clear' | 'occupied' }) => {
  const widths = {
    short: 'w-4',
    normal: 'w-8',
    long: 'w-12',
  };
  
  return (
    <div className={cn(
      'h-1 rounded-full',
      widths[length],
      status === 'occupied' ? 'bg-red-500' : 'bg-zinc-500'
    )} />
  );
};

// Platform marker
const Platform = ({ number, active }: { number: number; active?: boolean }) => (
  <div className={cn(
    'px-2 py-1 rounded text-[9px] font-bold border',
    active 
      ? 'bg-primary/20 border-primary text-primary' 
      : 'bg-zinc-800 border-zinc-600 text-zinc-400'
  )}>
    Platform {number}
  </div>
);

// Station marker
const StationMarker = ({ name, side }: { name: string; side: 'left' | 'right' }) => (
  <div className={cn(
    'px-2 py-1 rounded text-[10px] font-semibold bg-emerald-500/20 border border-emerald-500/50 text-emerald-400',
    side === 'left' ? 'mr-auto' : 'ml-auto'
  )}>
    {name}
  </div>
);

export const SignalBoxVisualization = ({ 
  sections, 
  trains, 
  selectedTrain, 
  onTrainSelect 
}: SignalBoxVisualizationProps) => {
  // Get train at specific section
  const getTrainAtSection = (sectionNum: number) => {
    return trains.find(t => t.currentSection === sectionNum);
  };

  // Determine signal status based on section
  const getSignalStatus = (section: TrackSection): 'clear' | 'caution' | 'danger' => {
    if (section.status === 'blocked') return 'danger';
    if (section.status === 'occupied') return 'caution';
    return 'clear';
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 bg-zinc-800/50">
        <h3 className="text-xs font-semibold text-foreground">Block Section Diagram</h3>
        <p className="text-[10px] text-muted-foreground">Kanpur - Allahabad Section</p>
      </div>

      {/* Main visualization */}
      <div className="flex-1 p-3 overflow-auto">
        <div className="min-w-[600px]">
          {/* Station markers */}
          <div className="flex justify-between mb-4 px-2">
            <StationMarker name="KANPUR JN" side="left" />
            <StationMarker name="ALLAHABAD JN" side="right" />
          </div>

          {/* Main Line (UP) */}
          <div className="relative mb-6">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[9px] text-muted-foreground font-mono">UP LINE →</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-800/30 rounded p-2">
              <div className="w-4 h-0.5 bg-zinc-600" />
              {sections.slice(0, 4).map((section, idx) => {
                const train = getTrainAtSection(section.id);
                return (
                  <div key={section.id} className="flex items-center">
                    <BlockIndicator
                      number={section.id}
                      occupied={section.status === 'occupied'}
                      hasSignal={idx % 2 === 0}
                      signalStatus={getSignalStatus(section)}
                      hasTrain={!!train}
                      train={train}
                      isSelected={train?.id === selectedTrain}
                      onTrainClick={() => train && onTrainSelect(train.id)}
                    />
                    <TrackLine status={section.status === 'occupied' ? 'occupied' : 'clear'} />
                  </div>
                );
              })}
              <div className="flex flex-col items-center mx-2">
                <Platform number={1} active={trains.some(t => t.nextStation?.includes('Platform'))} />
              </div>
              {sections.slice(4).map((section, idx) => {
                const train = getTrainAtSection(section.id);
                return (
                  <div key={section.id} className="flex items-center">
                    <TrackLine status={section.status === 'occupied' ? 'occupied' : 'clear'} />
                    <BlockIndicator
                      number={section.id}
                      occupied={section.status === 'occupied'}
                      hasSignal={idx % 2 === 0}
                      signalStatus={getSignalStatus(section)}
                      hasTrain={!!train}
                      train={train}
                      isSelected={train?.id === selectedTrain}
                      onTrainClick={() => train && onTrainSelect(train.id)}
                    />
                  </div>
                );
              })}
              <div className="w-4 h-0.5 bg-zinc-600" />
            </div>
          </div>

          {/* Main Line (DN) */}
          <div className="relative mb-4">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[9px] text-muted-foreground font-mono">← DN LINE</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-800/30 rounded p-2">
              <div className="w-4 h-0.5 bg-zinc-600" />
              {[...Array(8)].map((_, idx) => (
                <div key={`dn-${idx}`} className="flex items-center">
                  <BlockIndicator
                    number={idx + 9}
                    occupied={false}
                    hasSignal={idx % 3 === 0}
                    signalStatus="clear"
                  />
                  <TrackLine />
                </div>
              ))}
              <div className="w-4 h-0.5 bg-zinc-600" />
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 pt-3 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[9px] text-muted-foreground">Clear</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-[9px] text-muted-foreground">Caution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[9px] text-muted-foreground">Danger</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-train-express" />
              <span className="text-[9px] text-muted-foreground">Express</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-train-freight" />
              <span className="text-[9px] text-muted-foreground">Freight</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-train-local" />
              <span className="text-[9px] text-muted-foreground">Local</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
