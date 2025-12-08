import { useState } from 'react';
import { motion } from 'framer-motion';
import { Train, TrackSection } from '@/types/railway';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLogAction } from '@/hooks/useAuditLog';

interface SignalBoxVisualizationProps {
  sections: TrackSection[];
  trains: Train[];
  selectedTrain: string | null;
  onTrainSelect: (id: string) => void;
}

type SignalStatus = 'clear' | 'caution' | 'danger';
type PointPosition = 'normal' | 'reverse';

interface SignalState {
  [key: string]: SignalStatus;
}

interface PointState {
  [key: string]: PointPosition;
}

// Signal component with interactive controls
const Signal = ({ 
  id,
  status, 
  direction = 'up',
  onStatusChange,
  disabled = false
}: { 
  id: string;
  status: SignalStatus; 
  direction?: 'up' | 'down';
  onStatusChange: (newStatus: SignalStatus) => void;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  const colors = {
    clear: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]',
    caution: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]',
    danger: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  };

  const statusLabels = {
    clear: 'Clear',
    caution: 'Caution',
    danger: 'Danger',
  };

  const handleStatusChange = (newStatus: SignalStatus) => {
    onStatusChange(newStatus);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            'flex flex-col items-center gap-0.5 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded',
            direction === 'down' && 'rotate-180',
            disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
          )}
        >
          <div className="w-3 h-6 bg-zinc-800 rounded-sm flex flex-col items-center justify-center gap-0.5 p-0.5 border border-zinc-600 hover:border-primary/50 transition-colors">
            <motion.div 
              className={cn('w-2 h-2 rounded-full transition-all', colors[status])}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="w-0.5 h-3 bg-zinc-600" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" side="top">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground mb-2">Set Signal {id}</p>
          <div className="flex flex-col gap-1">
            {(['clear', 'caution', 'danger'] as SignalStatus[]).map((s) => (
              <Button
                key={s}
                variant={status === s ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'justify-start gap-2 h-8',
                  status === s && s === 'clear' && 'bg-green-600 hover:bg-green-700',
                  status === s && s === 'caution' && 'bg-yellow-600 hover:bg-yellow-700',
                  status === s && s === 'danger' && 'bg-red-600 hover:bg-red-700'
                )}
                onClick={() => handleStatusChange(s)}
              >
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  s === 'clear' && 'bg-green-500',
                  s === 'caution' && 'bg-yellow-500',
                  s === 'danger' && 'bg-red-500'
                )} />
                <span className="text-xs">{statusLabels[s]}</span>
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Block section indicator
const BlockIndicator = ({ 
  number, 
  occupied, 
  hasSignal,
  signalId,
  signalStatus,
  onSignalChange,
  hasTrain,
  train,
  isSelected,
  onTrainClick
}: { 
  number: number; 
  occupied: boolean;
  hasSignal: boolean;
  signalId?: string;
  signalStatus: SignalStatus;
  onSignalChange?: (newStatus: SignalStatus) => void;
  hasTrain?: boolean;
  train?: Train;
  isSelected?: boolean;
  onTrainClick?: () => void;
}) => {
  return (
    <div className="flex flex-col items-center">
      {hasSignal && signalId && onSignalChange && (
        <div className="mb-1">
          <Signal 
            id={signalId}
            status={signalStatus} 
            onStatusChange={onSignalChange}
          />
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

// Point/Switch indicator with toggle control
const PointSwitch = ({ 
  id,
  position, 
  onToggle,
  label
}: { 
  id: string;
  position: PointPosition;
  onToggle: () => void;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    onToggle();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex flex-col items-center gap-0.5 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded group"
        >
          {label && (
            <span className="text-[7px] font-mono text-muted-foreground mb-0.5">{label}</span>
          )}
          <div className="relative w-8 h-6 bg-zinc-800 rounded border border-zinc-600 group-hover:border-primary/50 transition-colors overflow-hidden">
            {/* Track lines showing switch position */}
            <svg viewBox="0 0 32 24" className="w-full h-full">
              {/* Main track */}
              <line 
                x1="0" y1="12" x2="32" y2="12" 
                stroke="#52525b" 
                strokeWidth="2"
              />
              {/* Diverging track */}
              <line 
                x1="16" y1="12" x2="32" y2={position === 'reverse' ? '4' : '20'} 
                stroke="#52525b" 
                strokeWidth="2"
                strokeDasharray={position === 'normal' ? '2,2' : 'none'}
              />
              {/* Switch blade - animated position */}
              <motion.line 
                x1="10" y1="12" x2="22" 
                animate={{ y2: position === 'normal' ? 12 : (position === 'reverse' ? 6 : 18) }}
                transition={{ duration: 0.3 }}
                stroke={position === 'normal' ? '#22c55e' : '#f59e0b'}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Position indicator dot */}
              <motion.circle 
                cx="16" cy="12" r="3"
                animate={{ 
                  fill: position === 'normal' ? '#22c55e' : '#f59e0b',
                  cy: position === 'normal' ? 12 : 9
                }}
                transition={{ duration: 0.3 }}
              />
            </svg>
          </div>
          <span className={cn(
            'text-[8px] font-bold px-1.5 py-0.5 rounded',
            position === 'normal' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          )}>
            {position === 'normal' ? 'N' : 'R'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" side="top">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Point {id}</p>
          <p className="text-[10px] text-muted-foreground">
            Current: {position === 'normal' ? 'Normal (Main Line)' : 'Reverse (Diverging)'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'w-full h-8 text-xs',
              position === 'normal' 
                ? 'hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/50' 
                : 'hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/50'
            )}
            onClick={handleToggle}
          >
            Set to {position === 'normal' ? 'Reverse' : 'Normal'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const SignalBoxVisualization = ({ 
  sections, 
  trains, 
  selectedTrain, 
  onTrainSelect 
}: SignalBoxVisualizationProps) => {
  const { logAction } = useLogAction();
  
  // Local signal states that can be overridden by operator
  const [signalOverrides, setSignalOverrides] = useState<SignalState>({});
  
  // Point/switch positions
  const [pointPositions, setPointPositions] = useState<PointState>({
    'PT-1': 'normal',
    'PT-2': 'normal',
    'PT-3': 'normal',
    'PT-4': 'normal',
  });

  // Get train at specific section
  const getTrainAtSection = (sectionNum: number) => {
    return trains.find(t => t.currentSection === sectionNum);
  };

  // Determine signal status based on section or override
  const getSignalStatus = (signalId: string, section: TrackSection): SignalStatus => {
    // Check for manual override first
    if (signalOverrides[signalId]) {
      return signalOverrides[signalId];
    }
    // Otherwise use automatic status based on section
    if (section.status === 'blocked') return 'danger';
    if (section.status === 'occupied') return 'caution';
    return 'clear';
  };

  // Handle signal status change
  const handleSignalChange = (signalId: string, sectionId: number, newStatus: SignalStatus) => {
    setSignalOverrides(prev => ({
      ...prev,
      [signalId]: newStatus
    }));

    // Log the action
    logAction(
      'signal_change',
      'signal',
      `Signal ${signalId} manually set to ${newStatus.toUpperCase()}`,
      signalId,
      { sectionId, previousStatus: signalOverrides[signalId] || 'auto', newStatus }
    );

    toast.success(`Signal ${signalId} set to ${newStatus.toUpperCase()}`, {
      description: `Section ${sectionId} signal manually overridden`
    });
  };

  // Handle point toggle
  const handlePointToggle = (pointId: string) => {
    const currentPosition = pointPositions[pointId] || 'normal';
    const newPosition: PointPosition = currentPosition === 'normal' ? 'reverse' : 'normal';
    
    setPointPositions(prev => ({
      ...prev,
      [pointId]: newPosition
    }));

    logAction(
      'point_change',
      'point',
      `Point ${pointId} set to ${newPosition.toUpperCase()}`,
      pointId,
      { previousPosition: currentPosition, newPosition }
    );

    toast.success(`Point ${pointId} set to ${newPosition.toUpperCase()}`, {
      description: newPosition === 'normal' ? 'Routing to main line' : 'Routing to diverging line'
    });
  };

  // Reset all signals to automatic
  const resetAllSignals = () => {
    setSignalOverrides({});
    logAction(
      'signal_reset',
      'signal',
      'All signals reset to automatic control',
      'all',
      {}
    );
    toast.info('All signals reset to automatic control');
  };

  // Reset all points to normal
  const resetAllPoints = () => {
    setPointPositions({
      'PT-1': 'normal',
      'PT-2': 'normal',
      'PT-3': 'normal',
      'PT-4': 'normal',
    });
    logAction(
      'point_reset',
      'point',
      'All points reset to normal position',
      'all',
      {}
    );
    toast.info('All points reset to normal position');
  };

  // Count manual overrides
  const overrideCount = Object.keys(signalOverrides).length;
  const pointOverrideCount = Object.values(pointPositions).filter(p => p === 'reverse').length;

  return (
    <div className="h-full flex flex-col bg-zinc-900/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 bg-zinc-800/50 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground">Block Section Diagram</h3>
          <p className="text-[10px] text-muted-foreground">Kanpur - Allahabad Section</p>
        </div>
        <div className="flex items-center gap-2">
          {overrideCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
              {overrideCount} signal override{overrideCount > 1 ? 's' : ''}
            </span>
          )}
          {pointOverrideCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {pointOverrideCount} point{pointOverrideCount > 1 ? 's' : ''} reversed
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={resetAllSignals}
            disabled={overrideCount === 0}
          >
            Reset Signals
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={resetAllPoints}
            disabled={pointOverrideCount === 0}
          >
            Reset Points
          </Button>
        </div>
      </div>

      {/* Control hint */}
      <div className="px-3 py-1.5 bg-primary/5 border-b border-border/30">
        <p className="text-[9px] text-primary/80">
          💡 Click signals to override state • Click points to toggle routing
        </p>
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
                const signalId = `UP-S${section.id}`;
                const hasSignal = idx % 2 === 0;
                return (
                  <div key={section.id} className="flex items-center">
                    <BlockIndicator
                      number={section.id}
                      occupied={section.status === 'occupied'}
                      hasSignal={hasSignal}
                      signalId={hasSignal ? signalId : undefined}
                      signalStatus={getSignalStatus(signalId, section)}
                      onSignalChange={hasSignal ? (status) => handleSignalChange(signalId, section.id, status) : undefined}
                      hasTrain={!!train}
                      train={train}
                      isSelected={train?.id === selectedTrain}
                      onTrainClick={() => train && onTrainSelect(train.id)}
                    />
                    <TrackLine status={section.status === 'occupied' ? 'occupied' : 'clear'} />
                  </div>
                );
              })}
              {/* Point switch before platform */}
              <div className="flex flex-col items-center mx-1">
                <PointSwitch 
                  id="PT-1" 
                  position={pointPositions['PT-1']} 
                  onToggle={() => handlePointToggle('PT-1')}
                  label="PT-1"
                />
              </div>
              <div className="flex flex-col items-center mx-2">
                <Platform number={1} active={trains.some(t => t.nextStation?.includes('Platform'))} />
              </div>
              {/* Point switch after platform */}
              <div className="flex flex-col items-center mx-1">
                <PointSwitch 
                  id="PT-2" 
                  position={pointPositions['PT-2']} 
                  onToggle={() => handlePointToggle('PT-2')}
                  label="PT-2"
                />
              </div>
              {sections.slice(4).map((section, idx) => {
                const train = getTrainAtSection(section.id);
                const signalId = `UP-S${section.id}`;
                const hasSignal = idx % 2 === 0;
                return (
                  <div key={section.id} className="flex items-center">
                    <TrackLine status={section.status === 'occupied' ? 'occupied' : 'clear'} />
                    <BlockIndicator
                      number={section.id}
                      occupied={section.status === 'occupied'}
                      hasSignal={hasSignal}
                      signalId={hasSignal ? signalId : undefined}
                      signalStatus={getSignalStatus(signalId, section)}
                      onSignalChange={hasSignal ? (status) => handleSignalChange(signalId, section.id, status) : undefined}
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
              {[...Array(3)].map((_, idx) => {
                const blockNum = idx + 9;
                const signalId = `DN-S${blockNum}`;
                const hasSignal = idx === 0;
                return (
                  <div key={`dn-${idx}`} className="flex items-center">
                    <BlockIndicator
                      number={blockNum}
                      occupied={false}
                      hasSignal={hasSignal}
                      signalId={hasSignal ? signalId : undefined}
                      signalStatus={signalOverrides[signalId] || 'clear'}
                      onSignalChange={hasSignal ? (status) => handleSignalChange(signalId, blockNum, status) : undefined}
                    />
                    <TrackLine />
                  </div>
                );
              })}
              {/* Point switches for DN line */}
              <div className="flex flex-col items-center mx-1">
                <PointSwitch 
                  id="PT-3" 
                  position={pointPositions['PT-3']} 
                  onToggle={() => handlePointToggle('PT-3')}
                  label="PT-3"
                />
              </div>
              {[...Array(3)].map((_, idx) => {
                const blockNum = idx + 12;
                const signalId = `DN-S${blockNum}`;
                const hasSignal = idx === 2;
                return (
                  <div key={`dn2-${idx}`} className="flex items-center">
                    <TrackLine />
                    <BlockIndicator
                      number={blockNum}
                      occupied={false}
                      hasSignal={hasSignal}
                      signalId={hasSignal ? signalId : undefined}
                      signalStatus={signalOverrides[signalId] || 'clear'}
                      onSignalChange={hasSignal ? (status) => handleSignalChange(signalId, blockNum, status) : undefined}
                    />
                  </div>
                );
              })}
              <div className="flex flex-col items-center mx-1">
                <PointSwitch 
                  id="PT-4" 
                  position={pointPositions['PT-4']} 
                  onToggle={() => handlePointToggle('PT-4')}
                  label="PT-4"
                />
              </div>
              {[...Array(2)].map((_, idx) => {
                const blockNum = idx + 15;
                const signalId = `DN-S${blockNum}`;
                return (
                  <div key={`dn3-${idx}`} className="flex items-center">
                    <TrackLine />
                    <BlockIndicator
                      number={blockNum}
                      occupied={false}
                      hasSignal={false}
                      signalStatus={'clear'}
                    />
                  </div>
                );
              })}
              <div className="w-4 h-0.5 bg-zinc-600" />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-border/30">
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
              <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 font-bold">N</span>
              <span className="text-[9px] text-muted-foreground">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">R</span>
              <span className="text-[9px] text-muted-foreground">Reverse</span>
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
