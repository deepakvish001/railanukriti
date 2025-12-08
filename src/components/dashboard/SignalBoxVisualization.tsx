import { useState, useEffect, useRef } from 'react';
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

interface SignalBoxVisualizationProps {
  sections: TrackSection[];
  trains: Train[];
  selectedTrain: string | null;
  onTrainSelect: (id: string) => void;
}

type SignalStatus = 'clear' | 'caution' | 'danger';
type PointPosition = 'normal' | 'reverse';
type BlockStatus = 'line_clear' | 'occupied' | 'line_blocked';

interface SignalState {
  [key: string]: SignalStatus;
}

interface PointState {
  [key: string]: PointPosition;
}

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

// Block Instrument Gauge (like in the reference image)
const BlockInstrument = ({ 
  label, 
  status,
  onToggle
}: { 
  label: string;
  status: BlockStatus;
  onToggle?: () => void;
}) => {
  const getGaugeAngle = () => {
    switch(status) {
      case 'line_clear': return -45;
      case 'occupied': return 0;
      case 'line_blocked': return 45;
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        className="w-24 h-24 rounded-lg border-4 border-amber-800 bg-gradient-to-b from-amber-100 to-amber-200 relative overflow-hidden cursor-pointer shadow-lg"
        onClick={onToggle}
      >
        {/* Gauge background */}
        <div className="absolute inset-2 rounded bg-gradient-to-b from-white to-gray-100 border-2 border-gray-400">
          {/* Color zones */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            {/* Red zone */}
            <path d="M50 50 L20 20 A42 42 0 0 1 50 8 Z" fill="#ef4444" opacity="0.8" />
            {/* Yellow zone */}
            <path d="M50 50 L50 8 A42 42 0 0 1 80 20 Z" fill="#eab308" opacity="0.8" />
            {/* Green zone */}
            <path d="M50 50 L80 20 A42 42 0 0 1 92 50 Z" fill="#22c55e" opacity="0.8" />
            
            {/* Needle */}
            <motion.line
              x1="50" y1="50" x2="50" y2="15"
              stroke="#1a1a1a"
              strokeWidth="3"
              strokeLinecap="round"
              animate={{ rotate: getGaugeAngle() }}
              style={{ transformOrigin: '50px 50px' }}
              transition={{ type: 'spring', stiffness: 100 }}
            />
            <circle cx="50" cy="50" r="6" fill="#333" />
          </svg>
        </div>
        
        {/* Labels */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-between px-1 text-[6px] font-bold">
          <span className="text-red-600">BLOCKED</span>
          <span className="text-green-600">CLEAR</span>
        </div>
      </div>
      
      {/* Control buttons */}
      <div className="flex gap-1 mt-2">
        <button 
          className={cn(
            "px-2 py-1 text-[8px] font-bold border-2 rounded transition-all",
            status === 'occupied' 
              ? "bg-red-600 text-white border-red-800" 
              : "bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300"
          )}
        >
          OCCUP
        </button>
        <button 
          className={cn(
            "px-2 py-1 text-[8px] font-bold border-2 rounded transition-all",
            status === 'line_clear' 
              ? "bg-green-600 text-white border-green-800" 
              : "bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300"
          )}
        >
          CLEAR
        </button>
      </div>
      <button className="mt-1 px-2 py-1 text-[7px] font-bold bg-amber-700 text-white rounded border-2 border-amber-900 hover:bg-amber-600">
        LINE BLOCKED
      </button>
      <button className="mt-1 px-3 py-1 text-[7px] font-bold bg-blue-800 text-white rounded border-2 border-blue-900 hover:bg-blue-700">
        TELEGRAPH
      </button>
      <p className="text-[9px] font-semibold text-gray-600 mt-1">{label}</p>
    </div>
  );
};

// Signal Lever component (traditional style)
const SignalLever = ({ 
  number, 
  color,
  position,
  onToggle,
  locked = false,
  label
}: { 
  number: number;
  color: 'red' | 'yellow' | 'white' | 'blue' | 'black';
  position: 'normal' | 'reverse';
  onToggle: () => void;
  locked?: boolean;
  label?: string;
}) => {
  const colorClasses = {
    red: 'bg-gradient-to-b from-red-400 to-red-600 border-red-800',
    yellow: 'bg-gradient-to-b from-yellow-300 to-yellow-500 border-yellow-700',
    white: 'bg-gradient-to-b from-gray-100 to-gray-300 border-gray-500',
    blue: 'bg-gradient-to-b from-blue-400 to-blue-600 border-blue-800',
    black: 'bg-gradient-to-b from-gray-600 to-gray-800 border-gray-900',
  };

  return (
    <div className="flex flex-col items-center">
      {label && <span className="text-[7px] text-gray-500 mb-0.5 font-medium">L</span>}
      <button 
        onClick={onToggle}
        disabled={locked}
        className={cn(
          "relative w-4 h-16 rounded-sm border-2 transition-all cursor-pointer",
          colorClasses[color],
          locked && "opacity-50 cursor-not-allowed",
          position === 'reverse' && "shadow-inner"
        )}
      >
        {/* Lever handle */}
        <motion.div 
          className="absolute left-1/2 -translate-x-1/2 w-3 h-6 bg-gradient-to-b from-gray-700 to-gray-900 rounded-full border border-gray-500"
          animate={{ 
            top: position === 'normal' ? '2px' : 'calc(100% - 26px)'
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
      </button>
      <span className="text-[9px] font-bold mt-1 text-gray-700">{String(number).padStart(2, '0')}</span>
    </div>
  );
};

// Track Block Section (bottom panel style)
const TrackBlockSection = ({
  sections,
  signalOverrides,
  occupiedSections
}: {
  sections: number[];
  signalOverrides: SignalState;
  occupiedSections: Set<number>;
}) => {
  return (
    <div className="flex items-end gap-0.5 bg-gradient-to-t from-gray-700 to-gray-600 p-2 rounded">
      {sections.map((num) => {
        const signalId = `UP-S${num}`;
        const status = signalOverrides[signalId] || 'clear';
        const isOccupied = occupiedSections.has(num);
        
        return (
          <div key={num} className="flex flex-col items-center">
            {/* Signal indicator light */}
            <div className={cn(
              "w-2 h-3 rounded-sm mb-0.5 border border-gray-800",
              status === 'clear' && 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]',
              status === 'caution' && 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.8)]',
              status === 'danger' && 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
            )} />
            {/* Block */}
            <div className={cn(
              "w-6 h-8 rounded-sm border-2 flex items-center justify-center text-[8px] font-mono font-bold",
              isOccupied 
                ? "bg-red-500 border-red-700 text-white" 
                : "bg-gray-400 border-gray-600 text-gray-800"
            )}>
              {String(num).padStart(2, '0')}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Traditional Track Line View
const TraditionalTrackView = ({
  sections,
  trains,
  selectedTrain,
  onTrainSelect,
  signalOverrides,
  pointPositions,
  onSignalChange,
  onPointToggle,
  getSignalStatus,
  isSignalLocked,
  handleTrainRouteSet,
  trainPositions
}: {
  sections: TrackSection[];
  trains: Train[];
  selectedTrain: string | null;
  onTrainSelect: (id: string) => void;
  signalOverrides: SignalState;
  pointPositions: PointState;
  onSignalChange: (signalId: string, sectionId: number, status: SignalStatus) => void;
  onPointToggle: (pointId: string) => void;
  getSignalStatus: (signalId: string, section: TrackSection) => SignalStatus;
  isSignalLocked: (signalId: string) => RouteLock | undefined;
  handleTrainRouteSet: (train: Train) => void;
  trainPositions: Map<string, { progress: number; moving: boolean }>;
}) => {
  const getTrainAtSection = (sectionNum: number) => {
    return trains.find(t => t.currentSection === sectionNum);
  };

  const typeColors = {
    express: 'bg-cyan-500',
    freight: 'bg-amber-600',
    local: 'bg-green-600',
    special: 'bg-purple-500'
  };

  return (
    <div className="relative bg-gray-300 rounded-lg p-4">
      {/* Platform labels */}
      <div className="absolute top-2 left-4">
        <div className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded">Via Platform 2</div>
        <div className="px-3 py-1 bg-emerald-500/50 text-emerald-800 text-[10px] font-bold rounded mt-1">Via Platform 3</div>
      </div>
      <div className="absolute top-2 right-4">
        <div className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded">Via Platform 1</div>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-gray-800">Block Section Example</h2>
        <p className="text-sm text-gray-600">(with signal box levers)</p>
      </div>

      {/* Main track layout */}
      <svg viewBox="0 0 1000 250" className="w-full h-48">
        {/* Main horizontal line - UP */}
        <line x1="20" y1="100" x2="980" y2="100" stroke="#333" strokeWidth="3" />
        
        {/* Main horizontal line - DN */}
        <line x1="20" y1="180" x2="980" y2="180" stroke="#333" strokeWidth="3" />
        
        {/* Direction arrows */}
        <polygon points="10,100 25,95 25,105" fill="#333" />
        <polygon points="990,100 975,95 975,105" fill="#333" />
        <polygon points="10,180 25,175 25,185" fill="#333" />
        <polygon points="990,180 975,175 975,185" fill="#333" />

        {/* Platform area connections */}
        {/* Upper platform line */}
        <line x1="300" y1="100" x2="350" y2="60" stroke="#333" strokeWidth="2" />
        <line x1="350" y1="60" x2="650" y2="60" stroke="#333" strokeWidth="3" />
        <line x1="650" y1="60" x2="700" y2="100" stroke="#333" strokeWidth="2" />
        
        {/* Middle platform */}
        <line x1="400" y1="100" x2="450" y2="130" stroke="#333" strokeWidth="2" />
        <line x1="450" y1="130" x2="550" y2="130" stroke="#333" strokeWidth="3" />
        <line x1="550" y1="130" x2="600" y2="100" stroke="#333" strokeWidth="2" />
        
        {/* Platform labels */}
        <rect x="470" y="52" width="80" height="16" rx="2" fill="#4ade80" />
        <text x="510" y="64" textAnchor="middle" className="text-[10px] font-bold fill-white">Platforms 2/3</text>
        
        <rect x="460" y="155" width="60" height="14" rx="2" fill="#4ade80" />
        <text x="490" y="166" textAnchor="middle" className="text-[9px] font-bold fill-white">Platform 1</text>

        {/* Points/switches */}
        {/* Left points */}
        <circle cx="300" cy="100" r="4" fill={pointPositions['PT-1'] === 'reverse' ? '#f59e0b' : '#22c55e'} />
        <circle cx="400" cy="100" r="4" fill={pointPositions['PT-2'] === 'reverse' ? '#f59e0b' : '#22c55e'} />
        
        {/* Right points */}
        <circle cx="600" cy="100" r="4" fill={pointPositions['PT-3'] === 'reverse' ? '#f59e0b' : '#22c55e'} />
        <circle cx="700" cy="100" r="4" fill={pointPositions['PT-4'] === 'reverse' ? '#f59e0b' : '#22c55e'} />

        {/* Signals on track */}
        {sections.slice(0, 4).map((section, idx) => {
          const x = 80 + idx * 60;
          const signalId = `UP-S${section.id}`;
          const status = getSignalStatus(signalId, section);
          const train = getTrainAtSection(section.id);
          const progress = train ? (trainPositions.get(train.id)?.progress || 0) : 0;
          
          return (
            <g key={section.id}>
              {/* Signal post */}
              <line x1={x} y1="70" x2={x} y2="95" stroke="#333" strokeWidth="2" />
              <circle 
                cx={x} 
                cy="65" 
                r="8"
                fill={status === 'clear' ? '#22c55e' : status === 'caution' ? '#eab308' : '#ef4444'}
                stroke="#333"
                strokeWidth="1"
              />
              <text x={x} y={110} textAnchor="middle" className="text-[8px] font-mono fill-gray-700">
                {String(section.id).padStart(2, '0')}
              </text>
              
              {/* Train marker */}
              {train && (
                <g 
                  onClick={() => onTrainSelect(train.id)}
                  onDoubleClick={() => handleTrainRouteSet(train)}
                  className="cursor-pointer"
                >
                  <motion.circle 
                    cx={x + progress * 30} 
                    cy="100" 
                    r="10"
                    className={typeColors[train.type]}
                    fill={train.type === 'express' ? '#06b6d4' : train.type === 'freight' ? '#d97706' : train.type === 'local' ? '#16a34a' : '#a855f7'}
                    stroke={selectedTrain === train.id ? '#fff' : '#333'}
                    strokeWidth={selectedTrain === train.id ? 3 : 1}
                  />
                  <text x={x + progress * 30} y="104" textAnchor="middle" className="text-[7px] font-bold fill-white pointer-events-none">
                    {train.type[0].toUpperCase()}
                  </text>
                  {/* Speed indicator */}
                  <text x={x + progress * 30} y="120" textAnchor="middle" className="text-[7px] font-mono fill-gray-600">
                    {train.speed}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {sections.slice(4).map((section, idx) => {
          const x = 750 + idx * 60;
          const signalId = `UP-S${section.id}`;
          const status = getSignalStatus(signalId, section);
          const train = getTrainAtSection(section.id);
          const progress = train ? (trainPositions.get(train.id)?.progress || 0) : 0;
          
          return (
            <g key={section.id}>
              <line x1={x} y1="70" x2={x} y2="95" stroke="#333" strokeWidth="2" />
              <circle 
                cx={x} 
                cy="65" 
                r="8"
                fill={status === 'clear' ? '#22c55e' : status === 'caution' ? '#eab308' : '#ef4444'}
                stroke="#333"
                strokeWidth="1"
              />
              <text x={x} y={110} textAnchor="middle" className="text-[8px] font-mono fill-gray-700">
                {String(section.id).padStart(2, '0')}
              </text>
              
              {train && (
                <g 
                  onClick={() => onTrainSelect(train.id)}
                  onDoubleClick={() => handleTrainRouteSet(train)}
                  className="cursor-pointer"
                >
                  <motion.circle 
                    cx={x + progress * 30} 
                    cy="100" 
                    r="10"
                    fill={train.type === 'express' ? '#06b6d4' : train.type === 'freight' ? '#d97706' : train.type === 'local' ? '#16a34a' : '#a855f7'}
                    stroke={selectedTrain === train.id ? '#fff' : '#333'}
                    strokeWidth={selectedTrain === train.id ? 3 : 1}
                  />
                  <text x={x + progress * 30} y="104" textAnchor="middle" className="text-[7px] font-bold fill-white pointer-events-none">
                    {train.type[0].toUpperCase()}
                  </text>
                  <text x={x + progress * 30} y="120" textAnchor="middle" className="text-[7px] font-mono fill-gray-600">
                    {train.speed}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Point labels */}
        <text x="300" y="115" textAnchor="middle" className="text-[8px] fill-amber-700 font-bold">03</text>
        <text x="350" y="50" textAnchor="middle" className="text-[8px] fill-amber-700 font-bold">S</text>
        <text x="700" y="115" textAnchor="middle" className="text-[8px] fill-amber-700 font-bold">20</text>
      </svg>
    </div>
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
            const newProgress = (current.progress + 0.005) % 1;
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
  
  // Local signal states
  const [signalOverrides, setSignalOverrides] = useState<SignalState>({});
  
  // Point positions
  const [pointPositions, setPointPositions] = useState<PointState>({
    'PT-1': 'normal',
    'PT-2': 'normal',
    'PT-3': 'normal',
    'PT-4': 'normal',
  });

  // Route locks
  const [routeLocks, setRouteLocks] = useState<RouteLock[]>([]);
  const [emergencyStopActive, setEmergencyStopActive] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  // Check if signal is locked
  const isSignalLocked = (signalId: string): RouteLock | undefined => {
    return routeLocks.find(lock => lock.lockedSignals.includes(signalId) && lock.status === 'locked');
  };

  // Check if point is locked
  const isPointLocked = (pointId: string): RouteLock | undefined => {
    return routeLocks.find(lock => lock.lockedPoints.includes(pointId) && lock.status === 'locked');
  };

  // Set route for a train
  const setRoute = (train: Train, fromSection: number, toSection: number) => {
    const routeId = `R-${train.number}-${Date.now()}`;
    
    const lockedSignals: string[] = [];
    const lockedPoints: string[] = [];
    
    lockedSignals.push(`UP-S${fromSection}`);
    
    if (fromSection <= 4 && toSection >= 5) {
      lockedPoints.push('PT-1', 'PT-2');
    }
    
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
      logAction('route_conflict', 'route', `Route setting blocked for ${train.number}`, routeId, {});
      return false;
    }

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

    lockedSignals.forEach(signalId => {
      setSignalOverrides(prev => ({ ...prev, [signalId]: 'clear' }));
    });

    setSignalOverrides(prev => ({ ...prev, [`UP-S${toSection}`]: 'caution' }));

    logAction('route_set', 'route', `Route set for ${train.number}: Section ${fromSection} → ${toSection}`, routeId, {});
    toast.success(`Route set for ${train.number}`, { description: `Sections ${fromSection} → ${toSection} locked` });

    return true;
  };

  // Release route
  const releaseRoute = (routeId: string) => {
    const lock = routeLocks.find(l => l.id === routeId);
    if (!lock) return;

    setRouteLocks(prev => prev.map(l => l.id === routeId ? { ...l, status: 'releasing' as const } : l));

    lock.lockedSignals.forEach(signalId => {
      setSignalOverrides(prev => {
        const newState = { ...prev };
        delete newState[signalId];
        return newState;
      });
    });

    setTimeout(() => {
      setRouteLocks(prev => prev.filter(l => l.id !== routeId));
    }, 500);

    logAction('route_release', 'route', `Route released for ${lock.trainNumber}`, routeId, {});
    toast.info(`Route released for ${lock.trainNumber}`);
  };

  // Auto-release routes
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

  // Get signal status
  const getSignalStatus = (signalId: string, section: TrackSection): SignalStatus => {
    if (signalOverrides[signalId]) return signalOverrides[signalId];
    if (section.status === 'blocked') return 'danger';
    if (section.status === 'occupied') return 'caution';
    return 'clear';
  };

  // Handle signal change
  const handleSignalChange = (signalId: string, sectionId: number, newStatus: SignalStatus) => {
    const lock = isSignalLocked(signalId);
    if (lock) {
      toast.error(`Signal ${signalId} is locked`, { description: `Route locked for train ${lock.trainNumber}` });
      return;
    }

    setSignalOverrides(prev => ({ ...prev, [signalId]: newStatus }));
    logAction('signal_change', 'signal', `Signal ${signalId} manually set to ${newStatus.toUpperCase()}`, signalId, {});
    toast.success(`Signal ${signalId} set to ${newStatus.toUpperCase()}`);
  };

  // Handle point toggle
  const handlePointToggle = (pointId: string) => {
    const lock = isPointLocked(pointId);
    if (lock) {
      toast.error(`Point ${pointId} is locked`, { description: `Route locked for train ${lock.trainNumber}` });
      return;
    }

    const currentPosition = pointPositions[pointId] || 'normal';
    const newPosition: PointPosition = currentPosition === 'normal' ? 'reverse' : 'normal';
    
    setPointPositions(prev => ({ ...prev, [pointId]: newPosition }));
    logAction('point_change', 'point', `Point ${pointId} set to ${newPosition.toUpperCase()}`, pointId, {});
    toast.success(`Point ${pointId} set to ${newPosition.toUpperCase()}`);
  };

  // Handle train route set
  const handleTrainRouteSet = (train: Train) => {
    if (!train.currentSection) return;
    
    const existingRoute = routeLocks.find(l => l.trainId === train.id && l.status === 'locked');
    if (existingRoute) {
      toast.info(`Route already set for ${train.number}`);
      return;
    }

    const nextSection = train.currentSection + 1;
    if (nextSection <= 8) {
      setRoute(train, train.currentSection, nextSection);
    }
  };

  // Emergency stop
  const activateEmergencyStop = () => {
    setEmergencyStopActive(true);

    const allSignals: SignalState = {};
    sections.forEach(section => {
      allSignals[`UP-S${section.id}`] = 'danger';
      allSignals[`DN-S${section.id}`] = 'danger';
    });
    for (let i = 9; i <= 16; i++) {
      allSignals[`DN-S${i}`] = 'danger';
    }
    setSignalOverrides(allSignals);

    routeLocks.forEach(lock => {
      if (lock.status === 'locked') {
        setRouteLocks(prev => prev.filter(l => l.id !== lock.id));
      }
    });

    logAction('emergency_stop', 'system', 'EMERGENCY STOP ACTIVATED', 'system', {});
    toast.error('🚨 EMERGENCY STOP ACTIVATED', { duration: 10000 });
  };

  const resetEmergencyStop = () => {
    setEmergencyStopActive(false);
    setSignalOverrides({});
    logAction('emergency_reset', 'system', 'Emergency stop reset', 'system', {});
    toast.success('Emergency stop reset');
  };

  const resetAllSignals = () => {
    setSignalOverrides({});
    logAction('signal_reset', 'signal', 'All signals reset', 'all', {});
    toast.info('All signals reset to automatic');
  };

  const resetAllPoints = () => {
    setPointPositions({ 'PT-1': 'normal', 'PT-2': 'normal', 'PT-3': 'normal', 'PT-4': 'normal' });
    logAction('point_reset', 'point', 'All points reset', 'all', {});
    toast.info('All points reset');
  };

  const overrideCount = Object.keys(signalOverrides).length;
  const activeRoutes = routeLocks.filter(l => l.status === 'locked').length;
  const occupiedSections = new Set(trains.map(t => t.currentSection).filter(Boolean) as number[]);

  return (
    <div className={cn(
      'h-full flex flex-col rounded-lg overflow-hidden',
      emergencyStopActive ? 'ring-4 ring-red-500' : 'ring-1 ring-gray-400'
    )} style={{ backgroundColor: '#b8b8b8' }}>
      {/* Emergency Stop Banner */}
      {emergencyStopActive && (
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          className="bg-red-600 text-white px-4 py-2 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <motion.span 
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-lg"
            >🚨</motion.span>
            <span className="font-bold">EMERGENCY STOP ACTIVE</span>
          </div>
          <Button size="sm" variant="outline" className="border-white text-white hover:bg-white/20" onClick={resetEmergencyStop}>
            Reset
          </Button>
        </motion.div>
      )}

      {/* Header with controls */}
      <div className="bg-gradient-to-b from-gray-500 to-gray-600 px-4 py-2 flex items-center justify-between border-b-2 border-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-white text-sm font-bold">Block Section Control</span>
          {activeRoutes > 0 && (
            <span className="px-2 py-0.5 bg-cyan-500 text-white text-[10px] rounded font-bold">
              {activeRoutes} Route{activeRoutes > 1 ? 's' : ''} Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="destructive" 
            size="sm"
            className={cn("font-bold", !emergencyStopActive && "animate-pulse")}
            onClick={() => setShowEmergencyConfirm(true)}
            disabled={emergencyStopActive}
          >
            🛑 EMERGENCY
          </Button>
          <Button variant="secondary" size="sm" onClick={resetAllSignals} disabled={overrideCount === 0}>
            Reset Signals
          </Button>
          <Button variant="secondary" size="sm" onClick={resetAllPoints}>
            Reset Points
          </Button>
        </div>
      </div>

      {/* Emergency Stop Confirmation Dialog */}
      <AlertDialog open={showEmergencyConfirm} onOpenChange={setShowEmergencyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">🛑 Confirm Emergency Stop</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately set ALL signals to DANGER and release all route locks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { activateEmergencyStop(); setShowEmergencyConfirm(false); }}>
              Activate Emergency Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Route locks display */}
      {routeLocks.length > 0 && (
        <div className="bg-cyan-100 px-4 py-1.5 border-b border-cyan-300 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-cyan-800">Active Routes:</span>
          {routeLocks.map(lock => (
            <div key={lock.id} className="flex items-center gap-1 px-2 py-0.5 bg-cyan-200 rounded text-[10px] text-cyan-800 font-mono">
              {lock.trainNumber} S{lock.fromSection}→S{lock.toSection}
              <button onClick={() => releaseRoute(lock.id)} className="text-red-600 font-bold ml-1">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Left Block Instrument */}
        <div className="p-4 flex flex-col items-center justify-center border-r border-gray-400">
          <BlockInstrument label="Next Block Section" status={occupiedSections.size > 0 ? 'occupied' : 'line_clear'} />
        </div>

        {/* Center - Track diagram */}
        <div className="flex-1 p-4 overflow-auto">
          <TraditionalTrackView
            sections={sections}
            trains={trains}
            selectedTrain={selectedTrain}
            onTrainSelect={onTrainSelect}
            signalOverrides={signalOverrides}
            pointPositions={pointPositions}
            onSignalChange={handleSignalChange}
            onPointToggle={handlePointToggle}
            getSignalStatus={getSignalStatus}
            isSignalLocked={isSignalLocked}
            handleTrainRouteSet={handleTrainRouteSet}
            trainPositions={trainPositions}
          />

          {/* Signal Lever Panel */}
          <div className="mt-4 p-3 bg-gradient-to-b from-amber-200 to-amber-300 rounded-lg border-4 border-amber-700">
            <div className="flex items-end justify-center gap-1">
              {/* Platform supply labels */}
              <div className="mr-4">
                <div className="px-2 py-1 bg-cyan-600 text-white text-[8px] font-bold rounded mb-1">Platform 2 Supply</div>
              </div>

              {/* Signal Levers */}
              {Array.from({ length: 29 }, (_, i) => {
                const num = i + 1;
                const signalId = `UP-S${num}`;
                const status = signalOverrides[signalId] || 'clear';
                
                // Determine lever color based on function
                let color: 'red' | 'yellow' | 'white' | 'blue' | 'black' = 'red';
                if ([7, 8, 15, 20].includes(num)) color = 'yellow';
                if ([4, 5, 6, 9, 10, 11, 16, 17, 21, 22, 24, 25].includes(num)) color = 'white';
                if ([19, 28].includes(num)) color = 'blue';
                
                return (
                  <SignalLever
                    key={num}
                    number={num}
                    color={color}
                    position={status === 'clear' ? 'reverse' : 'normal'}
                    onToggle={() => handleSignalChange(signalId, num, status === 'clear' ? 'danger' : 'clear')}
                    locked={!!isSignalLocked(signalId)}
                    label="L"
                  />
                );
              })}

              {/* More platform supply labels */}
              <div className="ml-4">
                <div className="px-2 py-1 bg-cyan-600 text-white text-[8px] font-bold rounded mb-1">Platform 1 Supply</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Block Instrument */}
        <div className="p-4 flex flex-col items-center justify-center border-l border-gray-400">
          <BlockInstrument label="Next Block Section" status={occupiedSections.size > 0 ? 'occupied' : 'line_clear'} />
        </div>
      </div>

      {/* Footer legend */}
      <div className="bg-gray-600 px-4 py-2 flex items-center justify-center gap-6 text-[10px] text-white">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /> Clear</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Caution</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /> Danger</div>
        <span className="text-gray-400">|</span>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-cyan-500" /> Express</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-600" /> Freight</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-600" /> Local</div>
        <span className="text-gray-400">|</span>
        <span>Double-click train to set route</span>
      </div>
    </div>
  );
};
