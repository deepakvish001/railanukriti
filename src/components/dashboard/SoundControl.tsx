import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotificationSound } from '@/hooks/useNotificationSound';

export const SoundControl = () => {
  const { settings, setEnabled, setVolume, playSound } = useNotificationSound();
  const [open, setOpen] = useState(false);

  const VolumeIcon = settings.enabled
    ? settings.volume > 0.5
      ? Volume2
      : settings.volume > 0
        ? Volume1
        : VolumeX
    : VolumeX;

  const handleToggle = () => {
    const newEnabled = !settings.enabled;
    setEnabled(newEnabled);
    if (newEnabled) {
      playSound('info');
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const testSound = (type: 'critical' | 'warning' | 'success' | 'info') => {
    playSound(type);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 relative"
          title="Sound Settings"
        >
          <VolumeIcon className="h-4 w-4" />
          {!settings.enabled && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Alert Sounds</span>
            <Button
              variant={settings.enabled ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={handleToggle}
            >
              {settings.enabled ? 'On' : 'Off'}
            </Button>
          </div>

          <AnimatePresence>
            {settings.enabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Volume Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Volume</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {Math.round(settings.volume * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[settings.volume]}
                    onValueChange={handleVolumeChange}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* Test Sounds */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Test Sounds</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-destructive/10 hover:bg-destructive/20 border-destructive/30"
                      onClick={() => testSound('critical')}
                    >
                      Critical
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-warning/10 hover:bg-warning/20 border-warning/30"
                      onClick={() => testSound('warning')}
                    >
                      Warning
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-success/10 hover:bg-success/20 border-success/30"
                      onClick={() => testSound('success')}
                    >
                      Success
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => testSound('info')}
                    >
                      Info
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
};
