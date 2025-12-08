import { motion } from 'framer-motion';
import { Activity, Radio, Clock, Shield } from 'lucide-react';

export const Header = () => {
  const currentTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full pulse-live" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Section Control <span className="text-primary">AI</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Northern Railway • Kanpur Division
              </p>
            </div>
          </motion.div>

          <div className="h-8 w-px bg-border" />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-success/10 border border-success/20"
          >
            <Radio className="w-3.5 h-3.5 text-success animate-pulse-subtle" />
            <span className="text-xs font-medium text-success">SYSTEM ACTIVE</span>
          </motion.div>
        </div>

        <div className="flex items-center gap-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span className="text-xs">Interlocking: OK</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">Signal System: Active</span>
            </div>
          </motion.div>

          <div className="h-8 w-px bg-border" />

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3"
          >
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="text-right">
              <p className="font-mono text-lg font-semibold text-foreground tabular-nums">
                {currentTime}
              </p>
              <p className="text-xs text-muted-foreground">{currentDate}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
};
