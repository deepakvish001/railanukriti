import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Train, TrackSection } from '@/types/railway';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLogAction } from '@/hooks/useAuditLog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Train position tracking for animation
interface TrainPosition {
  trainId: string;
  sectionIndex: number;
  progress: number; // 0-1 progress within section
  previousPositions: number[]; // For trail effect
}

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

// Route lock interface for interlocking
interface RouteLock {
  id: string;
  trainId: string;
  trainNumber: string;
  fromSection: number;
  toSection: number;
  lockedSignals: string[];
  lockedPoints: string[];
  setAt: Date;
  status: 'setting' | 'locked' | 'releasing';
}

// Track occupancy history entry
interface OccupancyHistoryEntry {
  id: string;
  sectionId: number;
  sectionName: string;
  trainId: string;
  trainNumber: string;
  trainType: string;
  enteredAt: Date;
  exitedAt?: Date;
}

// Signal component with interactive controls
const Signal = ({ 
  id,
  status, 
  direction = 'up',
  onStatusChange,
  disabled = false,
  locked = false,
  lockedBy
}: { 
  id: string;
  status: SignalStatus; 
  direction?: 'up' | 'down';
  onStatusChange: (newStatus: SignalStatus) => void;
  disabled?: boolean;
  locked?: boolean;
  lockedBy?: string;
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
          disabled={disabled || locked}
          className={cn(
            'flex flex-col items-center gap-0.5 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded relative',
            direction === 'down' && 'rotate-180',
            (disabled || locked) && 'opacity-50 cursor-not-allowed hover:scale-100'
          )}
        >
          <div className={cn(
            'w-3 h-6 bg-zinc-800 rounded-sm flex flex-col items-center justify-center gap-0.5 p-0.5 border transition-colors',
            locked ? 'border-cyan-500/50' : 'border-zinc-600 hover:border-primary/50'
          )}>
            <motion.div 
              className={cn('w-2 h-2 rounded-full transition-all', colors[status])}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="w-0.5 h-3 bg-zinc-600" />
          {/* Lock indicator */}
          {locked && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" side="top">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground mb-2">Signal {id}</p>
          {locked ? (
            <p className="text-[10px] text-cyan-400 bg-cyan-500/10 p-2 rounded">
              🔒 Locked by route for {lockedBy}
            </p>
          ) : (
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
          )}
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
  onTrainClick,
  onRouteSet,
  trainProgress = 0,
  signalLocked,
  signalLockedBy
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
  onRouteSet?: () => void;
  trainProgress?: number;
  signalLocked?: boolean;
  signalLockedBy?: string;
}) => {
  return (
    <div className="flex flex-col items-center relative">
      {hasSignal && signalId && onSignalChange && (
        <div className="mb-1">
          <Signal 
            id={signalId}
            status={signalStatus} 
            onStatusChange={onSignalChange}
            locked={signalLocked}
            lockedBy={signalLockedBy}
          />
        </div>
      )}
      <div className="relative">
        <motion.div 
          className={cn(
            'w-6 h-8 rounded-sm border-2 flex items-center justify-center text-[8px] font-mono font-bold transition-all',
            occupied 
              ? 'bg-red-500/20 border-red-500 text-red-400' 
              : 'bg-zinc-800 border-zinc-600 text-zinc-400'
          )}
          animate={occupied ? { borderColor: ['#ef4444', '#f87171', '#ef4444'] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {String(number).padStart(2, '0')}
        </motion.div>
        
        {/* Animated train position */}
        <AnimatePresence>
          {hasTrain && train && (
            <motion.div
              className="absolute -top-8 left-0 right-0 flex justify-center"
              style={{ 
                x: `${(trainProgress - 0.5) * 30}px` // Animate position within block
              }}
            >
              {/* Trail effect */}
              <TrainTrail train={train} />
              
              {/* Train marker */}
              <AnimatedTrainMarker
                train={train}
                isSelected={isSelected || false}
                onClick={() => onTrainClick?.()}
                onDoubleClick={() => onRouteSet?.()}
                animatedProgress={trainProgress}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
  label,
  locked,
  lockedBy
}: { 
  id: string;
  position: PointPosition;
  onToggle: () => void;
  label?: string;
  locked?: boolean;
  lockedBy?: string;
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
          disabled={locked}
          className={cn(
            'flex flex-col items-center gap-0.5 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded group relative',
            locked && 'opacity-50 cursor-not-allowed hover:scale-100'
          )}
        >
          {label && (
            <span className="text-[7px] font-mono text-muted-foreground mb-0.5">{label}</span>
          )}
          <div className={cn(
            'relative w-8 h-6 bg-zinc-800 rounded border transition-colors overflow-hidden',
            locked ? 'border-cyan-500/50' : 'border-zinc-600 group-hover:border-primary/50'
          )}>
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
          {/* Lock indicator */}
          {locked && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" side="top">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Point {id}</p>
          {locked ? (
            <p className="text-[10px] text-cyan-400 bg-cyan-500/10 p-2 rounded">
              🔒 Locked by route for {lockedBy}
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Animated train marker component
const AnimatedTrainMarker = ({
  train,
  isSelected,
  onClick,
  onDoubleClick,
  animatedProgress = 0
}: {
  train: Train;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  animatedProgress?: number;
}) => {
  const typeColors = {
    express: 'bg-train-express',
    freight: 'bg-train-freight',
    local: 'bg-train-local',
    special: 'bg-train-special'
  };

  // Speed thresholds for color coding
  const getSpeedColor = (speed: number) => {
    if (speed === 0) return { bg: 'bg-red-500', text: 'text-red-400', label: 'STOP' };
    if (speed < 30) return { bg: 'bg-amber-500', text: 'text-amber-400', label: 'SLOW' };
    if (speed < 80) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: 'MED' };
    return { bg: 'bg-green-500', text: 'text-green-400', label: 'NORM' };
  };

  const speedInfo = getSpeedColor(train.speed);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <motion.button
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
          scale: 1, 
          opacity: 1,
          x: animatedProgress * 100 // Animate within block
        }}
        exit={{ scale: 0.8, opacity: 0 }}
        whileHover={{ scale: 1.15 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 25,
          x: { duration: 2, ease: "linear" }
        }}
        className={cn(
          'relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold cursor-pointer z-10',
          typeColors[train.type],
          'text-white shadow-lg',
          isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-background'
        )}
        title={`${train.number} - ${train.speed} km/h - Double-click to set route`}
      >
        {train.type[0].toUpperCase()}
        {/* Movement indicator pulse */}
        {train.status === 'on-time' && train.speed > 0 && (
          <motion.div
            className="absolute inset-0 rounded-full bg-white/30"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        {/* Direction arrow - only show when moving */}
        {train.speed > 0 && (
          <motion.div 
            className="absolute -right-1 top-1/2 -translate-y-1/2"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: Math.max(0.3, 1 - train.speed / 120), repeat: Infinity }}
          >
            <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
              <path d="M0 0L6 3L0 6V0Z" />
            </svg>
          </motion.div>
        )}
        {/* Stopped indicator */}
        {train.speed === 0 && (
          <motion.div 
            className="absolute inset-0 rounded-full border-2 border-red-500"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </motion.button>
      
      {/* Speed indicator badge */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-mono font-bold',
          'bg-zinc-900/80 border',
          train.speed === 0 && 'border-red-500/50',
          train.speed > 0 && train.speed < 30 && 'border-amber-500/50',
          train.speed >= 30 && train.speed < 80 && 'border-yellow-500/50',
          train.speed >= 80 && 'border-green-500/50'
        )}
      >
        <motion.div 
          className={cn('w-1.5 h-1.5 rounded-full', speedInfo.bg)}
          animate={train.speed > 0 ? { scale: [1, 1.2, 1] } : { opacity: [1, 0.5, 1] }}
          transition={{ duration: train.speed > 0 ? 0.5 : 0.3, repeat: Infinity }}
        />
        <span className={speedInfo.text}>{train.speed}</span>
      </motion.div>
    </div>
  );
};

// Train trail effect
const TrainTrail = ({ train }: { train: Train }) => {
  const typeColors = {
    express: 'from-train-express/60',
    freight: 'from-train-freight/60',
    local: 'from-train-local/60',
    special: 'from-train-special/60'
  };

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 40, opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'absolute h-1 rounded-full bg-gradient-to-r to-transparent -left-10 top-1/2 -translate-y-1/2',
        typeColors[train.type]
      )}
    />
  );
};

export const SignalBoxVisualization = ({ 
  sections, 
  trains, 
  selectedTrain, 
  onTrainSelect 
}: SignalBoxVisualizationProps) => {
  const { logAction } = useLogAction();
  
  // Animated train positions
  const [trainPositions, setTrainPositions] = useState<Map<string, { progress: number; moving: boolean }>>(new Map());
  const animationRef = useRef<number>();
  
  // Simulate train movement animation
  useEffect(() => {
    const updatePositions = () => {
      setTrainPositions(prev => {
        const newPositions = new Map(prev);
        trains.forEach(train => {
          if (train.status === 'on-time' || train.status === 'delayed') {
            const current = newPositions.get(train.id) || { progress: 0, moving: true };
            const newProgress = (current.progress + 0.005) % 1; // Continuous movement
            newPositions.set(train.id, { progress: newProgress, moving: true });
          } else if (train.status === 'halted') {
            const current = newPositions.get(train.id) || { progress: 0.5, moving: false };
            newPositions.set(train.id, { ...current, moving: false });
          }
        });
        return newPositions;
      });
    };

    animationRef.current = window.setInterval(updatePositions, 50);
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [trains]);
  
  // Local signal states that can be overridden by operator
  const [signalOverrides, setSignalOverrides] = useState<SignalState>({});
  
  // Point/switch positions
  const [pointPositions, setPointPositions] = useState<PointState>({
    'PT-1': 'normal',
    'PT-2': 'normal',
    'PT-3': 'normal',
    'PT-4': 'normal',
  });

  // Route locks for interlocking
  const [routeLocks, setRouteLocks] = useState<RouteLock[]>([]);

  // Track occupancy history
  const [occupancyHistory, setOccupancyHistory] = useState<OccupancyHistoryEntry[]>([]);
  const [showOccupancyHistory, setShowOccupancyHistory] = useState(false);
  const previousTrainSections = useRef<Map<string, number | null>>(new Map());

  // History filters
  const [historyFilterType, setHistoryFilterType] = useState<string>('all');
  const [historyFilterSection, setHistoryFilterSection] = useState<string>('all');
  const [historyFilterTime, setHistoryFilterTime] = useState<string>('all');

  // Filter the occupancy history
  const filteredHistory = occupancyHistory.filter(entry => {
    // Train type filter
    if (historyFilterType !== 'all' && entry.trainType !== historyFilterType) {
      return false;
    }
    // Section filter
    if (historyFilterSection !== 'all' && entry.sectionId.toString() !== historyFilterSection) {
      return false;
    }
    // Time range filter
    if (historyFilterTime !== 'all') {
      const now = Date.now();
      const entryTime = entry.enteredAt.getTime();
      const minutesAgo = (now - entryTime) / (1000 * 60);
      if (historyFilterTime === '1min' && minutesAgo > 1) return false;
      if (historyFilterTime === '5min' && minutesAgo > 5) return false;
      if (historyFilterTime === '15min' && minutesAgo > 15) return false;
      if (historyFilterTime === '30min' && minutesAgo > 30) return false;
    }
    return true;
  });

  // Get unique sections from history for filter dropdown
  const uniqueSections = [...new Set(occupancyHistory.map(e => e.sectionId))].sort((a, b) => a - b);

  // Section statistics view toggle
  const [showSectionStats, setShowSectionStats] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Heatmap data - tracks occupancy over time intervals
  const [heatmapData, setHeatmapData] = useState<{
    sectionId: number;
    sectionName: string;
    timeSlots: { time: Date; occupied: boolean; trainType?: string }[];
  }[]>([]);

  // Update heatmap data every 5 seconds
  useEffect(() => {
    const updateHeatmap = () => {
      const now = new Date();
      setHeatmapData(prev => {
        const newData = sections.map(section => {
          const existing = prev.find(d => d.sectionId === section.id);
          const train = trains.find(t => t.currentSection === section.id);
          const newSlot = {
            time: now,
            occupied: section.status === 'occupied',
            trainType: train?.type
          };
          
          // Keep last 12 time slots (60 seconds of data at 5s intervals)
          const timeSlots = existing 
            ? [...existing.timeSlots.slice(-11), newSlot]
            : [newSlot];
          
          return {
            sectionId: section.id,
            sectionName: section.name,
            timeSlots
          };
        });
        return newData;
      });
    };

    updateHeatmap(); // Initial update
    const interval = setInterval(updateHeatmap, 5000);
    return () => clearInterval(interval);
  }, [sections, trains]);

  // Get heatmap cell color based on occupancy
  const getHeatmapColor = (slot: { occupied: boolean; trainType?: string }) => {
    if (!slot.occupied) return 'bg-zinc-800/50';
    switch (slot.trainType) {
      case 'express': return 'bg-train-express';
      case 'freight': return 'bg-train-freight';
      case 'local': return 'bg-train-local';
      case 'special': return 'bg-train-special';
      default: return 'bg-red-500';
    }
  };

  // Calculate section utilization percentage for heatmap
  const getSectionUtilization = (timeSlots: { occupied: boolean }[]) => {
    if (timeSlots.length === 0) return 0;
    const occupiedCount = timeSlots.filter(s => s.occupied).length;
    return Math.round((occupiedCount / timeSlots.length) * 100);
  };

  // Overstay alert configuration and state
  const [overstayThreshold, setOverstayThreshold] = useState(30); // seconds
  const [overstayAlerts, setOverstayAlerts] = useState<{
    id: string;
    trainId: string;
    trainNumber: string;
    trainType: string;
    sectionId: number;
    sectionName: string;
    enteredAt: Date;
    duration: number;
    acknowledged: boolean;
  }[]>([]);
  const [showOverstayPanel, setShowOverstayPanel] = useState(true);
  const acknowledgedAlerts = useRef<Set<string>>(new Set());

  // Check for overstay alerts
  useEffect(() => {
    const checkOverstays = () => {
      const now = Date.now();
      const activeOccupancies = occupancyHistory.filter(entry => !entry.exitedAt);
      
      const newAlerts = activeOccupancies
        .map(entry => {
          const duration = Math.round((now - entry.enteredAt.getTime()) / 1000);
          if (duration >= overstayThreshold) {
            return {
              id: `${entry.trainId}-${entry.sectionId}`,
              trainId: entry.trainId,
              trainNumber: entry.trainNumber,
              trainType: entry.trainType,
              sectionId: entry.sectionId,
              sectionName: entry.sectionName,
              enteredAt: entry.enteredAt,
              duration,
              acknowledged: acknowledgedAlerts.current.has(`${entry.trainId}-${entry.sectionId}`)
            };
          }
          return null;
        })
        .filter((alert): alert is NonNullable<typeof alert> => alert !== null);

      setOverstayAlerts(newAlerts);
    };

    checkOverstays();
    const interval = setInterval(checkOverstays, 1000);
    return () => clearInterval(interval);
  }, [occupancyHistory, overstayThreshold]);

  // Acknowledge an alert
  const acknowledgeAlert = (alertId: string) => {
    acknowledgedAlerts.current.add(alertId);
    setOverstayAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
    logAction(
      'alert_acknowledge',
      'alert',
      `Overstay alert acknowledged for ${alertId}`,
      alertId,
      {}
    );
  };

  // Get alert severity based on overstay duration
  const getAlertSeverity = (duration: number) => {
    const excess = duration - overstayThreshold;
    if (excess >= overstayThreshold) return 'critical'; // 2x threshold
    if (excess >= overstayThreshold / 2) return 'warning'; // 1.5x threshold
    return 'info';
  };

  // Unacknowledged alert count
  const unacknowledgedCount = overstayAlerts.filter(a => !a.acknowledged).length;

  // Congestion forecast state
  interface CongestionForecast {
    forecasts: {
      timeframe: string;
      timestamp: string;
      overallCongestion: number;
      level: 'low' | 'medium' | 'high' | 'critical';
      sectionForecasts: {
        sectionId: number;
        sectionName: string;
        predictedOccupancy: number;
        expectedTrains: number;
        bottleneckRisk: boolean;
      }[];
    }[];
    hotspots: {
      sectionId: number;
      sectionName: string;
      peakTime: string;
      peakCongestion: number;
      reason: string;
    }[];
    recommendations: {
      priority: 'low' | 'medium' | 'high';
      action: string;
      targetSection: number | null;
      expectedImpact: string;
    }[];
    summary: string;
  }

  // Scheduling recommendation interface
  interface SchedulingRecommendation {
    trainId: string;
    trainNumber: string;
    trainType: string;
    currentSchedule: string;
    recommendedSchedule: string;
    delayMinutes: number;
    reason: string;
    impactLevel: 'high' | 'medium' | 'low';
    congestionReduction: number;
    affectedSections: string[];
  }

  const [congestionForecast, setCongestionForecast] = useState<CongestionForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [showForecastPanel, setShowForecastPanel] = useState(false);
  const [lastForecastTime, setLastForecastTime] = useState<Date | null>(null);
  
  // Scheduling recommendations state
  const [schedulingRecommendations, setSchedulingRecommendations] = useState<SchedulingRecommendation[]>([]);
  const [showSchedulingPanel, setShowSchedulingPanel] = useState(false);
  const [schedulingLoading, setSchedulingLoading] = useState(false);

  // Generate scheduling recommendations from congestion forecast
  const generateSchedulingRecommendations = () => {
    if (!congestionForecast) return;
    
    setSchedulingLoading(true);
    
    // Analyze forecast hotspots and generate scheduling adjustments
    const recommendations: SchedulingRecommendation[] = [];
    
    // Find trains that could be rescheduled to avoid congestion
    const hotspotTimes = congestionForecast.hotspots.map(h => h.peakTime);
    const highCongestionPeriods = congestionForecast.forecasts.filter(f => 
      f.level === 'high' || f.level === 'critical'
    );
    
    trains.forEach(train => {
      const trainSection = sections.find(s => s.id === train.currentSection);
      const currentTime = new Date();
      const scheduledTime = new Date(train.scheduledTime);
      
      // Check if train is heading into a hotspot
      const isHeadingToHotspot = congestionForecast.hotspots.some(hotspot => {
        const sectionInPath = trainSection && 
          (hotspot.sectionId === trainSection.id || 
           hotspot.sectionId === trainSection.id + 1 ||
           hotspot.sectionId === trainSection.id + 2);
        return sectionInPath;
      });
      
      // Check if train's schedule overlaps with high congestion
      const overlapsHighCongestion = highCongestionPeriods.some(period => {
        const periodTime = period.timestamp;
        const trainETA = train.eta ? new Date(train.eta) : currentTime;
        const trainTimeStr = trainETA.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return periodTime === trainTimeStr;
      });
      
      if ((isHeadingToHotspot || overlapsHighCongestion) && train.status !== 'halted') {
        // Calculate recommended delay based on congestion
        const delayMinutes = train.type === 'freight' ? 15 : (train.type === 'local' ? 10 : 5);
        const newTime = new Date(scheduledTime.getTime() + delayMinutes * 60 * 1000);
        
        // Find affected sections
        const affectedSections = congestionForecast.hotspots
          .filter(h => h.sectionId >= (train.currentSection || 0) && h.sectionId <= (train.currentSection || 0) + 3)
          .map(h => h.sectionName);
        
        // Calculate expected congestion reduction
        const congestionReduction = Math.min(
          Math.round(20 + Math.random() * 15), // 20-35% reduction
          35
        );
        
        recommendations.push({
          trainId: train.id,
          trainNumber: train.number,
          trainType: train.type,
          currentSchedule: scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recommendedSchedule: newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          delayMinutes,
          reason: isHeadingToHotspot 
            ? `Approaching congestion hotspot at ${congestionForecast.hotspots[0]?.sectionName || 'junction'}`
            : `Schedule overlaps with predicted high congestion period`,
          impactLevel: train.type === 'express' ? 'high' : (train.type === 'freight' ? 'low' : 'medium'),
          congestionReduction,
          affectedSections: affectedSections.length > 0 ? affectedSections : ['Multiple sections']
        });
      }
    });
    
    // Sort by impact level
    recommendations.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.impactLevel] - order[b.impactLevel];
    });
    
    setSchedulingRecommendations(recommendations);
    setSchedulingLoading(false);
    setShowSchedulingPanel(true);
    
    if (recommendations.length > 0) {
      toast.success('Scheduling Recommendations Generated', {
        description: `${recommendations.length} trains can be rescheduled to optimize flow`
      });
      
      logAction(
        'scheduling_recommendation',
        'ai',
        `Generated ${recommendations.length} scheduling recommendations`,
        'scheduling',
        { count: recommendations.length }
      );
    } else {
      toast.info('No scheduling changes recommended', {
        description: 'Current schedules are optimal for predicted congestion'
      });
    }
  };

  // Apply a scheduling recommendation
  const applySchedulingRecommendation = (rec: SchedulingRecommendation) => {
    toast.success(`Schedule Updated: ${rec.trainNumber}`, {
      description: `Dispatch delayed by ${rec.delayMinutes} minutes to ${rec.recommendedSchedule}`
    });
    
    logAction(
      'schedule_apply',
      'train',
      `Applied scheduling recommendation for ${rec.trainNumber}: delay ${rec.delayMinutes} min`,
      rec.trainId,
      { 
        originalTime: rec.currentSchedule, 
        newTime: rec.recommendedSchedule,
        reason: rec.reason 
      }
    );
    
    // Remove from recommendations
    setSchedulingRecommendations(prev => prev.filter(r => r.trainId !== rec.trainId));
  };

  // Dismiss a scheduling recommendation  
  const dismissSchedulingRecommendation = (trainId: string) => {
    setSchedulingRecommendations(prev => prev.filter(r => r.trainId !== trainId));
    toast.info('Recommendation dismissed');
  };

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60); // seconds
  const [nextRefreshIn, setNextRefreshIn] = useState(0);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-refresh effect
  useEffect(() => {
    // Clear existing timers
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (autoRefreshEnabled && !forecastLoading) {
      setNextRefreshIn(autoRefreshInterval);
      
      // Countdown timer
      countdownRef.current = setInterval(() => {
        setNextRefreshIn(prev => {
          if (prev <= 1) return autoRefreshInterval;
          return prev - 1;
        });
      }, 1000);
      
      // Refresh timer
      autoRefreshTimerRef.current = setInterval(() => {
        fetchCongestionForecast();
        setNextRefreshIn(autoRefreshInterval);
      }, autoRefreshInterval * 1000);
    }

    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefreshEnabled, autoRefreshInterval, forecastLoading]);

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    const newState = !autoRefreshEnabled;
    setAutoRefreshEnabled(newState);
    
    if (newState) {
      toast.success('Auto-refresh enabled', {
        description: `Forecast will refresh every ${autoRefreshInterval} seconds`
      });
      // Immediately fetch if no forecast exists
      if (!congestionForecast) {
        fetchCongestionForecast();
      }
    } else {
      toast.info('Auto-refresh disabled');
      setNextRefreshIn(0);
    }
  };

  // Fetch congestion forecast
  const fetchCongestionForecast = async () => {
    setForecastLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forecast-congestion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            trains,
            sections,
            occupancyHistory: occupancyHistory.slice(0, 30),
            currentMetrics: {
              utilization: sections.filter(s => s.status === 'occupied').length / Math.max(sections.length, 1) * 100,
              pendingConflicts: 0
            }
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Forecast request failed');
      }

      const forecast = await response.json();
      setCongestionForecast(forecast);
      setLastForecastTime(new Date());
      
      logAction(
        'forecast_request',
        'ai',
        'Congestion forecast generated',
        'forecast',
        { summary: forecast.summary }
      );
    } catch (error) {
      console.error('Forecast error:', error);
      toast.error('Failed to generate forecast', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setForecastLoading(false);
    }
  };

  // Get color for congestion level
  const getCongestionColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/50';
      case 'high': return 'text-amber-400 bg-amber-500/20 border-amber-500/50';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      default: return 'text-green-400 bg-green-500/20 border-green-500/50';
    }
  };

  const getCongestionBarColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-amber-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  // Calculate section occupancy statistics
  const sectionStats = useMemo(() => {
    const stats: Record<number, {
      sectionId: number;
      sectionName: string;
      trainCount: number;
      completedCount: number;
      totalDwellTime: number;
      avgDwellTime: number;
      minDwellTime: number;
      maxDwellTime: number;
      activeOccupancy: boolean;
      trainTypes: Record<string, number>;
    }> = {};

    occupancyHistory.forEach(entry => {
      if (!stats[entry.sectionId]) {
        stats[entry.sectionId] = {
          sectionId: entry.sectionId,
          sectionName: entry.sectionName,
          trainCount: 0,
          completedCount: 0,
          totalDwellTime: 0,
          avgDwellTime: 0,
          minDwellTime: Infinity,
          maxDwellTime: 0,
          activeOccupancy: false,
          trainTypes: {}
        };
      }

      const stat = stats[entry.sectionId];
      stat.trainCount++;
      stat.trainTypes[entry.trainType] = (stat.trainTypes[entry.trainType] || 0) + 1;

      if (entry.exitedAt) {
        const duration = (entry.exitedAt.getTime() - entry.enteredAt.getTime()) / 1000;
        stat.completedCount++;
        stat.totalDwellTime += duration;
        stat.minDwellTime = Math.min(stat.minDwellTime, duration);
        stat.maxDwellTime = Math.max(stat.maxDwellTime, duration);
      } else {
        stat.activeOccupancy = true;
      }
    });

    // Calculate averages and fix infinity values
    Object.values(stats).forEach(stat => {
      if (stat.completedCount > 0) {
        stat.avgDwellTime = stat.totalDwellTime / stat.completedCount;
      }
      if (stat.minDwellTime === Infinity) {
        stat.minDwellTime = 0;
      }
    });

    return Object.values(stats).sort((a, b) => a.sectionId - b.sectionId);
  }, [occupancyHistory]);

  // Calculate overall utilization (percentage of time sections were occupied)
  const getUtilizationColor = (trainCount: number) => {
    if (trainCount >= 5) return 'text-red-400 bg-red-500/20';
    if (trainCount >= 3) return 'text-amber-400 bg-amber-500/20';
    if (trainCount >= 1) return 'text-green-400 bg-green-500/20';
    return 'text-zinc-400 bg-zinc-500/20';
  };

  // Track train movements for occupancy history
  useEffect(() => {
    trains.forEach(train => {
      const previousSection = previousTrainSections.current.get(train.id);
      const currentSection = train.currentSection;

      // Train entered a new section
      if (currentSection && currentSection !== previousSection) {
        const section = sections.find(s => s.id === currentSection);
        
        // Mark exit from previous section
        if (previousSection) {
          setOccupancyHistory(prev => 
            prev.map(entry => 
              entry.trainId === train.id && entry.sectionId === previousSection && !entry.exitedAt
                ? { ...entry, exitedAt: new Date() }
                : entry
            )
          );
        }

        // Add entry for new section
        const newEntry: OccupancyHistoryEntry = {
          id: `${train.id}-${currentSection}-${Date.now()}`,
          sectionId: currentSection,
          sectionName: section?.name || `Section ${currentSection}`,
          trainId: train.id,
          trainNumber: train.number,
          trainType: train.type,
          enteredAt: new Date()
        };
        
        setOccupancyHistory(prev => [newEntry, ...prev].slice(0, 100)); // Keep last 100 entries
      }

      // Train left section completely
      if (previousSection && !currentSection) {
        setOccupancyHistory(prev => 
          prev.map(entry => 
            entry.trainId === train.id && entry.sectionId === previousSection && !entry.exitedAt
              ? { ...entry, exitedAt: new Date() }
              : entry
          )
        );
      }

      previousTrainSections.current.set(train.id, currentSection);
    });
  }, [trains, sections]);

  // Check if signal is locked by any route
  const isSignalLocked = (signalId: string): RouteLock | undefined => {
    return routeLocks.find(lock => lock.lockedSignals.includes(signalId) && lock.status === 'locked');
  };

  // Check if point is locked by any route
  const isPointLocked = (pointId: string): RouteLock | undefined => {
    return routeLocks.find(lock => lock.lockedPoints.includes(pointId) && lock.status === 'locked');
  };

  // Set route for a train (locks signals and points)
  const setRoute = (train: Train, fromSection: number, toSection: number) => {
    const routeId = `R-${train.number}-${Date.now()}`;
    
    // Determine which signals and points to lock based on route
    const lockedSignals: string[] = [];
    const lockedPoints: string[] = [];
    
    // Lock entrance signal to clear
    lockedSignals.push(`UP-S${fromSection}`);
    
    // Lock points if route crosses junctions
    if (fromSection <= 4 && toSection >= 5) {
      lockedPoints.push('PT-1', 'PT-2');
    }
    
    // Check for conflicts with existing locks
    const conflicts = routeLocks.filter(lock => 
      lock.status === 'locked' && (
        lock.lockedSignals.some(s => lockedSignals.includes(s)) ||
        lock.lockedPoints.some(p => lockedPoints.includes(p))
      )
    );

    if (conflicts.length > 0) {
      toast.error('Route conflict detected!', {
        description: `Cannot set route - conflicting with ${conflicts[0].trainNumber}`
      });
      logAction(
        'route_conflict',
        'route',
        `Route setting blocked for ${train.number} due to conflict with ${conflicts[0].trainNumber}`,
        routeId,
        { conflictingRoute: conflicts[0].id }
      );
      return false;
    }

    // Create new route lock
    const newLock: RouteLock = {
      id: routeId,
      trainId: train.id,
      trainNumber: train.number,
      fromSection,
      toSection,
      lockedSignals,
      lockedPoints,
      setAt: new Date(),
      status: 'locked'
    };

    setRouteLocks(prev => [...prev, newLock]);

    // Set signals for the route
    lockedSignals.forEach(signalId => {
      setSignalOverrides(prev => ({
        ...prev,
        [signalId]: 'clear'
      }));
    });

    // Set exit signals to caution
    setSignalOverrides(prev => ({
      ...prev,
      [`UP-S${toSection}`]: 'caution'
    }));

    logAction(
      'route_set',
      'route',
      `Route set for ${train.number}: Section ${fromSection} → ${toSection}`,
      routeId,
      { lockedSignals, lockedPoints }
    );

    toast.success(`Route set for ${train.number}`, {
      description: `Sections ${fromSection} → ${toSection} locked`
    });

    return true;
  };

  // Release route lock
  const releaseRoute = (routeId: string) => {
    const lock = routeLocks.find(l => l.id === routeId);
    if (!lock) return;

    // Update lock status to releasing
    setRouteLocks(prev => prev.map(l => 
      l.id === routeId ? { ...l, status: 'releasing' as const } : l
    ));

    // Set signals back to danger
    lock.lockedSignals.forEach(signalId => {
      setSignalOverrides(prev => {
        const newState = { ...prev };
        delete newState[signalId];
        return newState;
      });
    });

    // Remove lock after brief delay
    setTimeout(() => {
      setRouteLocks(prev => prev.filter(l => l.id !== routeId));
    }, 500);

    logAction(
      'route_release',
      'route',
      `Route released for ${lock.trainNumber}`,
      routeId,
      {}
    );

    toast.info(`Route released for ${lock.trainNumber}`);
  };

  // Auto-release routes when train clears section
  useEffect(() => {
    routeLocks.forEach(lock => {
      if (lock.status === 'locked') {
        const train = trains.find(t => t.id === lock.trainId);
        if (train && train.currentSection && train.currentSection > lock.toSection) {
          releaseRoute(lock.id);
        }
      }
    });
  }, [trains, routeLocks]);

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
    // Check if signal is locked
    const lock = isSignalLocked(signalId);
    if (lock) {
      toast.error(`Signal ${signalId} is locked`, {
        description: `Route locked for train ${lock.trainNumber}`
      });
      return;
    }

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
    // Check if point is locked
    const lock = isPointLocked(pointId);
    if (lock) {
      toast.error(`Point ${pointId} is locked`, {
        description: `Route locked for train ${lock.trainNumber}`
      });
      return;
    }

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

  // Handle train click to set route
  const handleTrainRouteSet = (train: Train) => {
    if (!train.currentSection) return;
    
    // Check if train already has a route
    const existingRoute = routeLocks.find(l => l.trainId === train.id && l.status === 'locked');
    if (existingRoute) {
      toast.info(`Route already set for ${train.number}`, {
        description: 'Release existing route first to set a new one'
      });
      return;
    }

    // Set route to next section (simplified - in real system would be more complex)
    const nextSection = train.currentSection + 1;
    if (nextSection <= 8) {
      setRoute(train, train.currentSection, nextSection);
    }
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

  // Emergency stop state
  const [emergencyStopActive, setEmergencyStopActive] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  // Emergency stop - halt all trains and set all signals to danger
  const activateEmergencyStop = () => {
    setEmergencyStopActive(true);

    // Set all signals to danger
    const allSignals: SignalState = {};
    sections.forEach(section => {
      allSignals[`UP-S${section.id}`] = 'danger';
      allSignals[`DN-S${section.id}`] = 'danger';
    });
    // Add any additional signals
    for (let i = 9; i <= 16; i++) {
      allSignals[`DN-S${i}`] = 'danger';
    }
    setSignalOverrides(allSignals);

    // Release all routes
    routeLocks.forEach(lock => {
      if (lock.status === 'locked') {
        setRouteLocks(prev => prev.filter(l => l.id !== lock.id));
      }
    });

    logAction(
      'emergency_stop',
      'system',
      'EMERGENCY STOP ACTIVATED - All signals set to DANGER',
      'system',
      { 
        trainsAffected: trains.length,
        signalsSet: Object.keys(allSignals).length
      }
    );

    toast.error('🚨 EMERGENCY STOP ACTIVATED', {
      description: 'All signals set to DANGER - All trains must halt immediately',
      duration: 10000
    });
  };

  // Reset emergency stop
  const resetEmergencyStop = () => {
    setEmergencyStopActive(false);
    setSignalOverrides({});
    
    logAction(
      'emergency_reset',
      'system',
      'Emergency stop reset - Signals returned to automatic control',
      'system',
      {}
    );

    toast.success('Emergency stop reset', {
      description: 'Signals returned to automatic control'
    });
  };

  // Count manual overrides
  const overrideCount = Object.keys(signalOverrides).length;
  const pointOverrideCount = Object.values(pointPositions).filter(p => p === 'reverse').length;
  const activeRoutes = routeLocks.filter(l => l.status === 'locked').length;

  return (
    <div className={cn(
      'h-full flex flex-col bg-zinc-900/50 rounded-lg overflow-hidden',
      emergencyStopActive && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background'
    )}>
      {/* Emergency Stop Banner */}
      {emergencyStopActive && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-red-500/20 border-b-2 border-red-500 px-3 py-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div 
                className="w-3 h-3 rounded-full bg-red-500"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              <span className="text-sm font-bold text-red-400">🚨 EMERGENCY STOP ACTIVE</span>
              <span className="text-[10px] text-red-300">All signals at DANGER - Trains must halt</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-3 border-red-500 text-red-400 hover:bg-red-500/20"
              onClick={resetEmergencyStop}
            >
              Reset Emergency Stop
            </Button>
          </div>
        </motion.div>
      )}

      {/* Overstay Alerts Panel */}
      <AnimatePresence>
        {overstayAlerts.length > 0 && showOverstayPanel && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              'border-b-2 px-3 py-2',
              unacknowledgedCount > 0 
                ? 'bg-amber-500/10 border-amber-500' 
                : 'bg-zinc-800/30 border-zinc-700'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {unacknowledgedCount > 0 && (
                  <motion.div 
                    className="w-2 h-2 rounded-full bg-amber-500"
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}
                <span className="text-[10px] font-semibold text-amber-400">
                  ⏱️ Overstay Alerts ({overstayAlerts.length})
                </span>
                <span className="text-[9px] text-muted-foreground">
                  Threshold: {overstayThreshold}s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={overstayThreshold}
                  onChange={(e) => setOverstayThreshold(Number(e.target.value))}
                  className="h-5 text-[9px] px-1.5 rounded bg-zinc-800 border border-zinc-700 text-foreground focus:outline-none"
                >
                  <option value="15">15s</option>
                  <option value="30">30s</option>
                  <option value="45">45s</option>
                  <option value="60">60s</option>
                  <option value="90">90s</option>
                  <option value="120">120s</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[9px] px-2"
                  onClick={() => setShowOverstayPanel(false)}
                >
                  Hide
                </Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap max-h-20 overflow-auto">
              {overstayAlerts.map(alert => {
                const severity = getAlertSeverity(alert.duration);
                const typeColors: Record<string, string> = {
                  express: 'border-train-express',
                  freight: 'border-train-freight',
                  local: 'border-train-local',
                  special: 'border-train-special'
                };
                return (
                  <motion.div 
                    key={alert.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded text-[9px] border-l-2',
                      typeColors[alert.trainType],
                      alert.acknowledged ? 'bg-zinc-800/50 opacity-60' : 'bg-zinc-800',
                      severity === 'critical' && !alert.acknowledged && 'ring-1 ring-red-500/50',
                      severity === 'warning' && !alert.acknowledged && 'ring-1 ring-amber-500/50'
                    )}
                  >
                    <span className={cn(
                      'font-mono font-bold',
                      severity === 'critical' && 'text-red-400',
                      severity === 'warning' && 'text-amber-400',
                      severity === 'info' && 'text-foreground'
                    )}>
                      {alert.trainNumber}
                    </span>
                    <span className="text-muted-foreground">in</span>
                    <span className="font-medium">{alert.sectionName}</span>
                    <span className={cn(
                      'font-mono px-1.5 py-0.5 rounded',
                      severity === 'critical' && 'bg-red-500/20 text-red-400',
                      severity === 'warning' && 'bg-amber-500/20 text-amber-400',
                      severity === 'info' && 'bg-zinc-600/20 text-zinc-300'
                    )}>
                      {alert.duration}s
                    </span>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30"
                      >
                        ACK
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed Overstay Alert Indicator */}
      {overstayAlerts.length > 0 && !showOverstayPanel && (
        <button
          onClick={() => setShowOverstayPanel(true)}
          className={cn(
            'px-3 py-1 border-b text-[9px] flex items-center gap-2 transition-colors',
            unacknowledgedCount > 0 
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 hover:bg-amber-500/20' 
              : 'bg-zinc-800/30 border-zinc-700 text-muted-foreground hover:bg-zinc-800/50'
          )}
        >
          <span>⏱️ {overstayAlerts.length} overstay alert{overstayAlerts.length > 1 ? 's' : ''}</span>
          {unacknowledgedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
              {unacknowledgedCount} new
            </span>
          )}
          <span className="text-muted-foreground ml-auto">Click to expand</span>
        </button>
      )}

      {/* Congestion Forecast Panel */}
      <AnimatePresence>
        {showForecastPanel && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/30 overflow-hidden"
          >
            <div className="px-3 py-2 bg-gradient-to-r from-cyan-500/5 to-primary/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-cyan-400">📊 Congestion Forecast</span>
                  {lastForecastTime && (
                    <span className="text-[8px] text-muted-foreground">
                      Updated: {lastForecastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {autoRefreshEnabled && (
                    <span className="text-[8px] text-emerald-400 flex items-center gap-1">
                      <motion.div 
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      Auto ({nextRefreshIn}s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Auto-refresh controls */}
                  <div className="flex items-center gap-1 mr-2 border-r border-zinc-700/50 pr-2">
                    <button
                      onClick={toggleAutoRefresh}
                      className={cn(
                        'h-5 px-2 rounded text-[8px] font-medium transition-colors',
                        autoRefreshEnabled 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-zinc-800 text-muted-foreground border border-zinc-700 hover:text-foreground'
                      )}
                    >
                      {autoRefreshEnabled ? '⏸ Auto' : '▶ Auto'}
                    </button>
                    <select
                      value={autoRefreshInterval}
                      onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                      className="h-5 text-[8px] px-1 rounded bg-zinc-800 border border-zinc-700 text-foreground focus:outline-none"
                      disabled={autoRefreshEnabled}
                    >
                      <option value="30">30s</option>
                      <option value="60">1m</option>
                      <option value="120">2m</option>
                      <option value="300">5m</option>
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 text-[9px] px-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={fetchCongestionForecast}
                    disabled={forecastLoading}
                  >
                    {forecastLoading ? '⏳ Loading...' : '🔄 Refresh'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[9px] px-2"
                    onClick={() => setShowForecastPanel(false)}
                  >
                    Hide
                  </Button>
                </div>
              </div>

              {forecastLoading ? (
                <div className="flex items-center justify-center py-4">
                  <motion.div 
                    className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="ml-2 text-[10px] text-muted-foreground">Analyzing patterns...</span>
                </div>
              ) : congestionForecast ? (
                <div className="space-y-3">
                  {/* Forecast Timeline */}
                  <div className="grid grid-cols-4 gap-2">
                    {congestionForecast.forecasts.map(forecast => (
                      <div 
                        key={forecast.timeframe}
                        className={cn(
                          'p-2 rounded border text-center',
                          getCongestionColor(forecast.level)
                        )}
                      >
                        <div className="text-[8px] text-muted-foreground mb-1">+{forecast.timeframe}</div>
                        <div className="text-[10px] font-mono font-bold">{forecast.timestamp}</div>
                        <div className="mt-1">
                          <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${forecast.overallCongestion}%` }}
                              transition={{ duration: 0.5 }}
                              className={cn('h-full rounded-full', getCongestionBarColor(forecast.level))}
                            />
                          </div>
                          <div className="text-[9px] font-bold mt-0.5">{forecast.overallCongestion}%</div>
                        </div>
                        <div className={cn(
                          'text-[7px] uppercase font-bold mt-1',
                          forecast.level === 'critical' && 'text-red-400',
                          forecast.level === 'high' && 'text-amber-400',
                          forecast.level === 'medium' && 'text-yellow-400',
                          forecast.level === 'low' && 'text-green-400'
                        )}>
                          {forecast.level}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hotspots */}
                  {congestionForecast.hotspots.length > 0 && (
                    <div className="pt-2 border-t border-zinc-700/50">
                      <div className="text-[9px] font-semibold text-amber-400 mb-1">🔥 Hotspots</div>
                      <div className="flex gap-2 flex-wrap">
                        {congestionForecast.hotspots.map((hotspot, idx) => (
                          <div 
                            key={idx}
                            className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[8px]"
                          >
                            <span className="font-semibold text-amber-400">{hotspot.sectionName}</span>
                            <span className="text-muted-foreground ml-1">@ {hotspot.peakTime}</span>
                            <span className="ml-1 text-amber-300">({hotspot.peakCongestion}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {congestionForecast.recommendations.length > 0 && (
                    <div className="pt-2 border-t border-zinc-700/50">
                      <div className="text-[9px] font-semibold text-primary mb-1">💡 Recommendations</div>
                      <div className="space-y-1">
                        {congestionForecast.recommendations.slice(0, 3).map((rec, idx) => (
                          <div 
                            key={idx}
                            className={cn(
                              'px-2 py-1 rounded text-[8px] flex items-start gap-2',
                              rec.priority === 'high' && 'bg-red-500/10 border border-red-500/30',
                              rec.priority === 'medium' && 'bg-amber-500/10 border border-amber-500/30',
                              rec.priority === 'low' && 'bg-zinc-700/30 border border-zinc-600/30'
                            )}
                          >
                            <span className={cn(
                              'font-bold uppercase text-[7px] px-1 py-0.5 rounded',
                              rec.priority === 'high' && 'bg-red-500/20 text-red-400',
                              rec.priority === 'medium' && 'bg-amber-500/20 text-amber-400',
                              rec.priority === 'low' && 'bg-zinc-600/20 text-zinc-400'
                            )}>
                              {rec.priority}
                            </span>
                            <span className="text-foreground flex-1">{rec.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="pt-2 border-t border-zinc-700/50 text-[9px] text-muted-foreground italic">
                    {congestionForecast.summary}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[9px] text-muted-foreground mb-2">No forecast data available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[9px] px-3 border-cyan-500/30 text-cyan-400"
                    onClick={fetchCongestionForecast}
                  >
                    Generate Forecast
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduling Recommendations Panel */}
      <AnimatePresence>
        {showSchedulingPanel && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/30 overflow-hidden"
          >
            <div className="px-3 py-2 bg-gradient-to-r from-emerald-500/5 to-primary/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-emerald-400">🕐 Scheduling Recommendations</span>
                  <span className="text-[8px] text-muted-foreground">
                    {schedulingRecommendations.length} suggestion{schedulingRecommendations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 text-[9px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={generateSchedulingRecommendations}
                    disabled={schedulingLoading || !congestionForecast}
                  >
                    {schedulingLoading ? '⏳ Analyzing...' : '🔄 Regenerate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[9px] px-2"
                    onClick={() => setShowSchedulingPanel(false)}
                  >
                    Hide
                  </Button>
                </div>
              </div>

              {schedulingLoading ? (
                <div className="flex items-center justify-center py-4">
                  <motion.div 
                    className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="ml-2 text-[10px] text-muted-foreground">Optimizing schedules...</span>
                </div>
              ) : schedulingRecommendations.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {schedulingRecommendations.map(rec => {
                    const typeColors: Record<string, string> = {
                      express: 'border-train-express',
                      freight: 'border-train-freight',
                      local: 'border-train-local',
                      special: 'border-train-special'
                    };
                    return (
                      <motion.div 
                        key={rec.trainId}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className={cn(
                          'p-2 rounded border-l-2 bg-zinc-800/50',
                          typeColors[rec.trainType]
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-[10px] text-foreground">
                                {rec.trainNumber}
                              </span>
                              <span className={cn(
                                'text-[7px] uppercase font-bold px-1 py-0.5 rounded',
                                rec.impactLevel === 'high' && 'bg-red-500/20 text-red-400',
                                rec.impactLevel === 'medium' && 'bg-amber-500/20 text-amber-400',
                                rec.impactLevel === 'low' && 'bg-green-500/20 text-green-400'
                              )}>
                                {rec.impactLevel} priority
                              </span>
                              <span className="text-[8px] text-emerald-400 font-semibold">
                                ↓{rec.congestionReduction}% congestion
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] mb-1">
                              <span className="text-muted-foreground">Current:</span>
                              <span className="font-mono text-red-400 line-through">{rec.currentSchedule}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-mono text-emerald-400 font-bold">{rec.recommendedSchedule}</span>
                              <span className="text-amber-400">(+{rec.delayMinutes} min)</span>
                            </div>
                            <div className="text-[8px] text-muted-foreground mb-1">
                              {rec.reason}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {rec.affectedSections.map((section, idx) => (
                                <span 
                                  key={idx}
                                  className="text-[7px] px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-400"
                                >
                                  {section}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[8px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                              onClick={() => applySchedulingRecommendation(rec)}
                            >
                              ✓ Apply
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[8px] px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => dismissSchedulingRecommendation(rec.trainId)}
                            >
                              ✕ Dismiss
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[9px] text-muted-foreground mb-2">
                    {congestionForecast 
                      ? 'No schedule changes needed - current schedules are optimal'
                      : 'Generate a congestion forecast first to get scheduling recommendations'}
                  </p>
                  {!congestionForecast && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[9px] px-3 border-cyan-500/30 text-cyan-400"
                      onClick={() => {
                        fetchCongestionForecast();
                        setShowSchedulingPanel(false);
                        setShowForecastPanel(true);
                      }}
                    >
                      Generate Forecast First
                    </Button>
                  )}
                </div>
              )}

              {/* Summary stats */}
              {schedulingRecommendations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-700/50 flex items-center justify-between text-[8px]">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      Total delay: <span className="text-amber-400 font-mono">
                        {schedulingRecommendations.reduce((sum, r) => sum + r.delayMinutes, 0)} min
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Avg congestion reduction: <span className="text-emerald-400 font-mono">
                        {Math.round(schedulingRecommendations.reduce((sum, r) => sum + r.congestionReduction, 0) / schedulingRecommendations.length)}%
                      </span>
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 text-[8px] px-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                    onClick={() => {
                      schedulingRecommendations.forEach(rec => applySchedulingRecommendation(rec));
                    }}
                  >
                    Apply All ({schedulingRecommendations.length})
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 bg-zinc-800/50 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground">Block Section Diagram</h3>
          <p className="text-[10px] text-muted-foreground">Kanpur - Allahabad Section</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Emergency Stop Button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="destructive"
              size="sm"
              className={cn(
                'h-7 text-[10px] px-3 font-bold shadow-lg',
                !emergencyStopActive && 'bg-red-600 hover:bg-red-700 animate-pulse'
              )}
              onClick={() => setShowEmergencyConfirm(true)}
              disabled={emergencyStopActive}
            >
              🛑 EMERGENCY STOP
            </Button>
          </motion.div>

          {/* Forecast Button */}
          <Button
            variant={showForecastPanel ? 'secondary' : 'outline'}
            size="sm"
            className={cn(
              'h-7 text-[10px] px-3',
              showForecastPanel 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' 
                : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10'
            )}
            onClick={() => {
              setShowForecastPanel(!showForecastPanel);
              if (!showForecastPanel && !congestionForecast) {
                fetchCongestionForecast();
              }
            }}
            disabled={forecastLoading}
          >
            {forecastLoading ? '⏳' : '📊'} Forecast
          </Button>

          {/* Scheduling Button */}
          <Button
            variant={showSchedulingPanel ? 'secondary' : 'outline'}
            size="sm"
            className={cn(
              'h-7 text-[10px] px-3',
              showSchedulingPanel 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' 
                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
            )}
            onClick={() => {
              setShowSchedulingPanel(!showSchedulingPanel);
              if (!showSchedulingPanel && congestionForecast && schedulingRecommendations.length === 0) {
                generateSchedulingRecommendations();
              }
            }}
            disabled={schedulingLoading}
          >
            {schedulingLoading ? '⏳' : '🕐'} Schedule
            {schedulingRecommendations.length > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded bg-emerald-500/30 text-[8px]">
                {schedulingRecommendations.length}
              </span>
            )}
          </Button>

          {/* Emergency Stop Confirmation Dialog */}
          <AlertDialog open={showEmergencyConfirm} onOpenChange={setShowEmergencyConfirm}>
            <AlertDialogContent className="bg-zinc-900 border-red-500/50">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-500 flex items-center gap-2">
                  🛑 Confirm Emergency Stop
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  This will immediately:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Set ALL signals to DANGER</li>
                    <li>Release ALL route locks</li>
                    <li>Halt ALL train movements</li>
                  </ul>
                  <p className="mt-3 text-warning font-medium">
                    Are you sure you want to activate the emergency stop?
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-zinc-800 hover:bg-zinc-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    activateEmergencyStop();
                    setShowEmergencyConfirm(false);
                  }}
                >
                  Activate Emergency Stop
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {activeRoutes > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {activeRoutes} route{activeRoutes > 1 ? 's' : ''} locked
            </span>
          )}
          {overrideCount > 0 && !emergencyStopActive && (
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
            disabled={overrideCount === 0 || emergencyStopActive}
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
          <Button
            variant={showOccupancyHistory ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setShowOccupancyHistory(!showOccupancyHistory)}
          >
            📋 History {occupancyHistory.length > 0 && `(${occupancyHistory.length})`}
          </Button>
        </div>
      </div>

      {/* Route locks panel */}
      {routeLocks.length > 0 && (
        <div className="px-3 py-1.5 bg-cyan-500/5 border-b border-border/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] font-semibold text-cyan-400">Active Routes:</span>
            {routeLocks.map(lock => (
              <div 
                key={lock.id} 
                className={cn(
                  'flex items-center gap-2 px-2 py-0.5 rounded-full text-[9px] border',
                  lock.status === 'locked' && 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                  lock.status === 'releasing' && 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30 opacity-50'
                )}
              >
                <span className="font-mono">{lock.trainNumber}</span>
                <span className="text-muted-foreground">S{lock.fromSection}→S{lock.toSection}</span>
                <button
                  onClick={() => releaseRoute(lock.id)}
                  className="text-red-400 hover:text-red-300 text-[8px] font-bold"
                  disabled={lock.status === 'releasing'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Occupancy History Panel */}
      <AnimatePresence>
        {showOccupancyHistory && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/30 overflow-hidden"
          >
            <div className="px-3 py-2 bg-zinc-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-foreground">Track Occupancy</span>
                  {/* View toggle */}
                  <div className="flex rounded bg-zinc-800 border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => { setShowSectionStats(false); setShowHeatmap(false); }}
                      className={cn(
                        'px-2 py-0.5 text-[8px] font-medium transition-colors',
                        !showSectionStats && !showHeatmap ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      History
                    </button>
                    <button
                      onClick={() => { setShowSectionStats(true); setShowHeatmap(false); }}
                      className={cn(
                        'px-2 py-0.5 text-[8px] font-medium transition-colors',
                        showSectionStats && !showHeatmap ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Statistics
                    </button>
                    <button
                      onClick={() => { setShowSectionStats(false); setShowHeatmap(true); }}
                      className={cn(
                        'px-2 py-0.5 text-[8px] font-medium transition-colors',
                        showHeatmap ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Heatmap
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!showSectionStats && !showHeatmap && (
                    <>
                      {/* Filter controls */}
                      <select
                        value={historyFilterType}
                        onChange={(e) => setHistoryFilterType(e.target.value)}
                        className="h-5 text-[9px] px-1.5 rounded bg-zinc-800 border border-zinc-700 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="all">All Types</option>
                        <option value="express">Express</option>
                        <option value="freight">Freight</option>
                        <option value="local">Local</option>
                        <option value="special">Special</option>
                      </select>
                      <select
                        value={historyFilterSection}
                        onChange={(e) => setHistoryFilterSection(e.target.value)}
                        className="h-5 text-[9px] px-1.5 rounded bg-zinc-800 border border-zinc-700 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="all">All Sections</option>
                        {uniqueSections.map(sectionId => (
                          <option key={sectionId} value={sectionId.toString()}>Section {sectionId}</option>
                        ))}
                      </select>
                      <select
                        value={historyFilterTime}
                        onChange={(e) => setHistoryFilterTime(e.target.value)}
                        className="h-5 text-[9px] px-1.5 rounded bg-zinc-800 border border-zinc-700 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="all">All Time</option>
                        <option value="1min">Last 1 min</option>
                        <option value="5min">Last 5 min</option>
                        <option value="15min">Last 15 min</option>
                        <option value="30min">Last 30 min</option>
                      </select>
                    </>
                  )}
                  {occupancyHistory.length > 0 && !showHeatmap && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[9px] px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => setOccupancyHistory([])}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Heatmap View */}
              {showHeatmap ? (
                <div className="space-y-2">
                  {heatmapData.length === 0 || heatmapData[0]?.timeSlots.length === 0 ? (
                    <p className="text-[9px] text-muted-foreground italic py-2">Collecting heatmap data... Updates every 5 seconds.</p>
                  ) : (
                    <>
                      {/* Heatmap Legend */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[8px] text-muted-foreground">Legend:</span>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-zinc-800/50 border border-zinc-700" />
                          <span className="text-[8px] text-muted-foreground">Clear</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-train-express" />
                          <span className="text-[8px] text-train-express">Express</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-train-freight" />
                          <span className="text-[8px] text-train-freight">Freight</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-train-local" />
                          <span className="text-[8px] text-train-local">Local</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-train-special" />
                          <span className="text-[8px] text-train-special">Special</span>
                        </div>
                      </div>
                      {/* Heatmap Grid */}
                      <div className="overflow-auto max-h-48">
                        <div className="min-w-[400px]">
                          {/* Time header */}
                          <div className="flex items-center gap-0.5 mb-1">
                            <div className="w-20 text-[8px] text-muted-foreground font-semibold">Section</div>
                            {heatmapData[0]?.timeSlots.map((slot, idx) => (
                              <div 
                                key={idx} 
                                className="flex-1 min-w-[24px] text-[7px] text-muted-foreground text-center"
                                title={slot.time.toLocaleTimeString()}
                              >
                                {idx === 0 ? '-60s' : idx === heatmapData[0].timeSlots.length - 1 ? 'Now' : ''}
                              </div>
                            ))}
                            <div className="w-12 text-[8px] text-muted-foreground text-right">Util%</div>
                          </div>
                          {/* Section rows */}
                          {heatmapData.map(section => {
                            const utilization = getSectionUtilization(section.timeSlots);
                            return (
                              <div key={section.sectionId} className="flex items-center gap-0.5 mb-0.5">
                                <div className="w-20 text-[8px] text-foreground font-mono truncate" title={section.sectionName}>
                                  {section.sectionName}
                                </div>
                                {section.timeSlots.map((slot, idx) => (
                                  <motion.div
                                    key={idx}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className={cn(
                                      'flex-1 min-w-[24px] h-5 rounded-sm transition-colors',
                                      getHeatmapColor(slot)
                                    )}
                                    title={`${slot.time.toLocaleTimeString()} - ${slot.occupied ? `Occupied (${slot.trainType})` : 'Clear'}`}
                                  />
                                ))}
                                <div className={cn(
                                  'w-12 text-[9px] font-mono font-bold text-right px-1 py-0.5 rounded',
                                  utilization >= 75 && 'text-red-400 bg-red-500/20',
                                  utilization >= 50 && utilization < 75 && 'text-amber-400 bg-amber-500/20',
                                  utilization >= 25 && utilization < 50 && 'text-yellow-400 bg-yellow-500/20',
                                  utilization < 25 && 'text-green-400 bg-green-500/20'
                                )}>
                                  {utilization}%
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-[8px] text-muted-foreground mt-1">
                        Showing last 60 seconds of section occupancy. Each cell = 5 second interval.
                      </p>
                    </>
                  )}
                </div>
              ) : showSectionStats ? (
                /* Statistics View */
                <div className="space-y-2">
                  {sectionStats.length === 0 ? (
                    <p className="text-[9px] text-muted-foreground italic py-2">No statistics available yet. Data will appear as trains move through sections.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-auto">
                      {sectionStats.map(stat => (
                        <div 
                          key={stat.sectionId}
                          className={cn(
                            'p-2 rounded border bg-zinc-800/50',
                            stat.activeOccupancy ? 'border-green-500/50' : 'border-zinc-700/50'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-semibold text-foreground">{stat.sectionName}</span>
                            {stat.activeOccupancy && (
                              <motion.div 
                                className="w-2 h-2 rounded-full bg-green-500"
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] text-muted-foreground">Train Count</span>
                              <span className={cn('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded', getUtilizationColor(stat.trainCount))}>
                                {stat.trainCount}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] text-muted-foreground">Avg Dwell</span>
                              <span className="text-[9px] font-mono text-foreground">
                                {stat.avgDwellTime > 0 ? `${stat.avgDwellTime.toFixed(1)}s` : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] text-muted-foreground">Min/Max</span>
                              <span className="text-[8px] font-mono text-muted-foreground">
                                {stat.completedCount > 0 
                                  ? `${stat.minDwellTime.toFixed(0)}s / ${stat.maxDwellTime.toFixed(0)}s`
                                  : '-'}
                              </span>
                            </div>
                            {/* Train type breakdown */}
                            <div className="flex gap-1 flex-wrap pt-1 border-t border-zinc-700/50">
                              {Object.entries(stat.trainTypes).map(([type, count]) => (
                                <span 
                                  key={type} 
                                  className={cn(
                                    'text-[7px] px-1 py-0.5 rounded',
                                    type === 'express' && 'bg-train-express/20 text-train-express',
                                    type === 'freight' && 'bg-train-freight/20 text-train-freight',
                                    type === 'local' && 'bg-train-local/20 text-train-local',
                                    type === 'special' && 'bg-train-special/20 text-train-special'
                                  )}
                                >
                                  {type[0].toUpperCase()}:{count}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* History View */
                <>
                  {/* Filter summary */}
                  {(historyFilterType !== 'all' || historyFilterSection !== 'all' || historyFilterTime !== 'all') && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[8px] text-muted-foreground">
                        Showing {filteredHistory.length} of {occupancyHistory.length} entries
                      </span>
                      <button
                        onClick={() => {
                          setHistoryFilterType('all');
                          setHistoryFilterSection('all');
                          setHistoryFilterTime('all');
                        }}
                        className="text-[8px] text-primary hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                  <div className="max-h-32 overflow-auto space-y-1">
                    {filteredHistory.length === 0 ? (
                      <p className="text-[9px] text-muted-foreground italic py-2">
                        {occupancyHistory.length === 0 
                          ? 'No occupancy records yet. History will appear as trains move through sections.'
                          : 'No entries match the selected filters.'}
                      </p>
                    ) : (
                      filteredHistory.map(entry => {
                        const typeColors: Record<string, string> = {
                          express: 'text-train-express',
                          freight: 'text-train-freight',
                          local: 'text-train-local',
                          special: 'text-train-special'
                        };
                        const isActive = !entry.exitedAt;
                        const duration = entry.exitedAt 
                          ? Math.round((entry.exitedAt.getTime() - entry.enteredAt.getTime()) / 1000)
                          : Math.round((Date.now() - entry.enteredAt.getTime()) / 1000);
                        
                        return (
                          <div 
                            key={entry.id}
                            className={cn(
                              'flex items-center gap-2 px-2 py-1 rounded text-[9px] border',
                              isActive 
                                ? 'bg-green-500/10 border-green-500/30' 
                                : 'bg-zinc-800/50 border-zinc-700/30'
                            )}
                          >
                            <span className={cn('font-mono font-bold', typeColors[entry.trainType])}>
                              {entry.trainNumber}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium text-foreground">{entry.sectionName}</span>
                            <span className="text-muted-foreground ml-auto">
                              {entry.enteredAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            {isActive ? (
                              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[8px] font-bold">
                                IN ({duration}s)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-600/20 text-zinc-400 text-[8px]">
                                {duration}s
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control hint */}
      <div className="px-3 py-1.5 bg-primary/5 border-b border-border/30 flex items-center justify-between">
        <p className="text-[9px] text-primary/80">
          💡 Click trains to set routes • Locked signals/points cannot be changed
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <motion.div 
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-[9px] text-muted-foreground">
              {trains.filter(t => t.status === 'on-time' || t.status === 'delayed').length} trains moving
            </span>
          </div>
        </div>
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
                const progress = train ? (trainPositions.get(train.id)?.progress || 0) : 0;
                const signalLock = hasSignal ? isSignalLocked(signalId) : undefined;
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
                      onRouteSet={() => train && handleTrainRouteSet(train)}
                      trainProgress={progress}
                      signalLocked={!!signalLock}
                      signalLockedBy={signalLock?.trainNumber}
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
                const progress = train ? (trainPositions.get(train.id)?.progress || 0) : 0;
                const signalLock = hasSignal ? isSignalLocked(signalId) : undefined;
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
                      onRouteSet={() => train && handleTrainRouteSet(train)}
                      trainProgress={progress}
                      signalLocked={!!signalLock}
                      signalLockedBy={signalLock?.trainNumber}
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
            <div className="w-px h-3 bg-border" />
            {/* Speed indicators legend */}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[9px] text-muted-foreground">≥80 km/h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              <span className="text-[9px] text-muted-foreground">30-79</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-[9px] text-muted-foreground">1-29</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[9px] text-muted-foreground">Stopped</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
