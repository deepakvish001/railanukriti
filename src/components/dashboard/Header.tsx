import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Clock, Shield, LogOut, User, Wifi, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { SoundControl } from './SoundControl';
import railanukritiLogo from '@/assets/railanukriti-logo.png';

export const Header = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; role: string | null } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('full_name, role')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    }
  }, [user]);

  const timeString = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateString = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Controller';

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        {/* Left Section - Logo & Branding */}
        <div className="flex items-center gap-4 lg:gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 bg-card shadow-md flex items-center justify-center">
                <img src={railanukritiLogo} alt="IRCTC" className="w-8 h-8 object-contain" />
              </div>
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-primary tracking-tight">
                RailAnukriti
              </h1>
            </div>
          </motion.div>

          {/* Status Indicators */}
          <div className="hidden md:flex items-center gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20"
            >
              <Radio className="w-3 h-3 text-success animate-pulse" />
              <span className="text-[10px] font-semibold text-success uppercase tracking-wide">Live</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20"
            >
              <Zap className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-medium text-primary">AI Active</span>
            </motion.div>
          </div>
        </div>

        {/* Right Section - System Status, Time, User */}
        <div className="flex items-center gap-3 lg:gap-4">
          {/* System Status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/50 border border-border"
          >
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-success" />
              <span className="text-[10px] text-muted-foreground">Interlock</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-success" />
              <span className="text-[10px] text-muted-foreground">Signal</span>
            </div>
          </motion.div>

          {/* Time Display */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border"
          >
            <Clock className="w-3.5 h-3.5 text-primary hidden sm:block" />
            <div className="text-right">
              <p className="font-mono text-sm lg:text-base font-bold text-foreground tabular-nums leading-none">
                {timeString}
              </p>
              <p className="text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{dateString}</p>
            </div>
          </motion.div>

          <div className="h-6 w-px bg-border hidden sm:block" />

          <SoundControl />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 px-2 h-9 hover:bg-muted">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-semibold text-foreground leading-none">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{profile?.role || 'Controller'}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card border-border">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem 
                onClick={signOut}
                className="text-destructive focus:text-destructive cursor-pointer mx-1 rounded-md"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
