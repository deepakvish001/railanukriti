import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Train as TrainIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTrains } from '@/hooks/useRailwayData';
import { format, parse, addHours, differenceInMinutes, startOfHour } from 'date-fns';

const HOUR_WIDTH = 120; // pixels per hour
const ROW_HEIGHT = 44;
const VISIBLE_HOURS = 6;

const priorityColors: Record<string, string> = {
  critical: 'bg-destructive',
  high: 'bg-warning',
  medium: 'bg-primary',
  low: 'bg-muted-foreground',
};

const typeColors: Record<string, string> = {
  express: 'bg-primary',
  freight: 'bg-amber-600',
  local: 'bg-emerald-600',
  special: 'bg-purple-600',
};

interface TimeBarProps {
  scheduledTime: string;
  actualTime: string | null;
  eta: string | null;
  delay: number;
  startHour: number;
  trainType: string;
  trainName: string;
  trainNumber: string;
  status: string;
}

const TimeBar = ({ scheduledTime, actualTime, eta, delay, startHour, trainType, trainName, trainNumber, status }: TimeBarProps) => {
  // Parse times (format: HH:mm:ss)
  const parseTimeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const scheduledMinutes = parseTimeToMinutes(scheduledTime);
  const startMinutes = startHour * 60;
  const totalVisibleMinutes = VISIBLE_HOURS * 60;

  // Calculate positions
  const scheduledOffset = ((scheduledMinutes - startMinutes) / 60) * HOUR_WIDTH;
  const barWidth = 60; // Fixed width for the bar

  // Skip if outside visible range
  if (scheduledMinutes < startMinutes - 60 || scheduledMinutes > startMinutes + totalVisibleMinutes + 60) {
    return null;
  }

  const actualMinutes = actualTime ? parseTimeToMinutes(actualTime) : null;
  const actualOffset = actualMinutes ? ((actualMinutes - startMinutes) / 60) * HOUR_WIDTH : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-1/2 -translate-y-1/2 flex items-center">
            {/* Scheduled time bar */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: barWidth, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className={`h-6 rounded ${typeColors[trainType]} opacity-40 absolute`}
              style={{ left: scheduledOffset }}
            />
            
            {/* Actual/ETA time bar */}
            {(actualOffset !== null || delay > 0) && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: barWidth, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className={`h-6 rounded absolute ${delay > 5 ? 'bg-destructive' : delay > 0 ? 'bg-warning' : typeColors[trainType]}`}
                style={{ left: actualOffset ?? scheduledOffset + (delay / 60) * HOUR_WIDTH }}
              />
            )}

            {/* Scheduled marker */}
            <div
              className="absolute w-1 h-8 bg-foreground/50 rounded"
              style={{ left: scheduledOffset + barWidth / 2 }}
            />

            {/* Delay indicator */}
            {delay > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-1 text-[10px] font-mono font-bold text-destructive"
                style={{ left: scheduledOffset + barWidth + 4 }}
              >
                +{delay}m
              </motion.div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-3">
          <div className="space-y-1.5">
            <p className="font-medium text-sm">{trainName} ({trainNumber})</p>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">{trainType}</Badge>
              <Badge variant={status === 'on-time' ? 'default' : 'destructive'} className="text-[10px]">
                {status}
              </Badge>
            </div>
            <div className="text-xs space-y-0.5 pt-1 border-t border-border">
              <p><span className="text-muted-foreground">Scheduled:</span> {scheduledTime.slice(0, 5)}</p>
              {actualTime && <p><span className="text-muted-foreground">Actual:</span> {actualTime.slice(0, 5)}</p>}
              {eta && <p><span className="text-muted-foreground">ETA:</span> {eta.slice(0, 5)}</p>}
              {delay > 0 && <p className="text-destructive font-medium">Delay: {delay} min</p>}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const TrainScheduleGantt = () => {
  const { trains, loading } = useTrains();
  const [startHour, setStartHour] = useState(() => {
    const now = new Date();
    return Math.max(0, now.getHours() - 1);
  });

  const hours = useMemo(() => {
    return Array.from({ length: VISIBLE_HOURS + 1 }, (_, i) => (startHour + i) % 24);
  }, [startHour]);

  const sortedTrains = useMemo(() => {
    return [...trains].sort((a, b) => {
      // Sort by scheduled time
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
  }, [trains]);

  const handlePrev = () => setStartHour(h => Math.max(0, h - 2));
  const handleNext = () => setStartHour(h => Math.min(22, h + 2));

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Clock className="h-6 w-6 animate-pulse text-primary" />
          <span className="text-sm text-muted-foreground font-mono">Loading schedule...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 h-full flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Train Schedule</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrev} disabled={startHour === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono w-24 text-center">
            {String(startHour).padStart(2, '0')}:00 - {String((startHour + VISIBLE_HOURS) % 24).padStart(2, '0')}:00
          </span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNext} disabled={startHour >= 22}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-foreground/30" />
          <span className="text-muted-foreground">Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-muted-foreground">On-time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-warning" />
          <span className="text-muted-foreground">Minor delay</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span className="text-muted-foreground">Delayed</span>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex">
          {/* Train Names Column */}
          <div className="w-32 shrink-0 border-r border-border">
            {/* Time header spacer */}
            <div className="h-8 border-b border-border bg-muted/30" />
            
            {/* Train names */}
            {sortedTrains.map((train) => (
              <div
                key={train.id}
                className="h-11 flex items-center px-2 border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <TrainIcon className={`w-3 h-3 shrink-0 ${train.status === 'delayed' ? 'text-destructive' : 'text-primary'}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium truncate">{train.number}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{train.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-x-auto">
            {/* Hour headers */}
            <div className="flex h-8 border-b border-border bg-muted/30 sticky top-0">
              {hours.map((hour, i) => (
                <div
                  key={i}
                  className="shrink-0 flex items-center justify-center border-r border-border/30 text-xs font-mono text-muted-foreground"
                  style={{ width: HOUR_WIDTH }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Train rows */}
            {sortedTrains.map((train) => (
              <div
                key={train.id}
                className="relative h-11 border-b border-border/50 hover:bg-muted/20 transition-colors"
                style={{ width: hours.length * HOUR_WIDTH }}
              >
                {/* Hour grid lines */}
                {hours.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-r border-border/20"
                    style={{ left: i * HOUR_WIDTH }}
                  />
                ))}
                
                {/* Current time indicator */}
                {(() => {
                  const now = new Date();
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();
                  const startMinutes = startHour * 60;
                  const offset = ((currentMinutes - startMinutes) / 60) * HOUR_WIDTH;
                  if (offset >= 0 && offset <= VISIBLE_HOURS * HOUR_WIDTH) {
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-destructive/50 z-10"
                        style={{ left: offset }}
                      />
                    );
                  }
                  return null;
                })()}

                {/* Time bar */}
                <TimeBar
                  scheduledTime={train.scheduledTime}
                  actualTime={train.actualTime}
                  eta={train.eta}
                  delay={train.delay}
                  startHour={startHour}
                  trainType={train.type}
                  trainName={train.name}
                  trainNumber={train.number}
                  status={train.status}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
