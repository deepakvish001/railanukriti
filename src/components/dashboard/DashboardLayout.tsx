import { ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/dashboard/Header';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Loader2, RefreshCw } from 'lucide-react';
import { useRealtimeSync, useGlobalRefresh } from '@/hooks/useRealtimeSync';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  isLoading?: boolean;
}

export const DashboardLayout = ({ children, title, isLoading = false }: DashboardLayoutProps) => {
  const [lastSync, setLastSync] = useState(new Date());
  const { refreshAll } = useGlobalRefresh();
  
  // Enable real-time sync across all pages with notifications
  useRealtimeSync({ showNotifications: true });

  // Update last sync time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSync(new Date());
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    refreshAll();
    setLastSync(new Date());
  };
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="absolute inset-0 h-10 w-10 animate-ping opacity-20 rounded-full bg-primary" />
          </div>
          <p className="text-muted-foreground font-mono text-sm">Loading section data...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-background flex w-full">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Header />
          
          <main className="flex-1 flex flex-col overflow-auto bg-gradient-to-br from-background via-background to-muted/10">
            {/* Page Title */}
            <div className="px-4 lg:px-6 py-3 border-b border-border/30 bg-card/30 backdrop-blur-sm shrink-0">
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-4 lg:p-6 overflow-auto">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {children}
              </motion.div>
            </div>
          </main>
          
          {/* Footer Status Bar */}
          <footer className="border-t border-border/30 bg-card/50 backdrop-blur-sm px-4 lg:px-6 py-2 shrink-0">
            <div className="flex items-center justify-between text-[10px] lg:text-xs text-muted-foreground">
              <div className="flex items-center gap-3 lg:gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Real-time Sync Active
                </span>
                <span className="hidden sm:inline text-border/50">•</span>
                <span className="hidden sm:inline">Last sync: {lastSync.toLocaleTimeString()}</span>
                <span className="hidden md:inline text-border/50">•</span>
                <span className="hidden md:inline">All pages synchronized</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualRefresh}
                  className="h-6 px-2 text-xs gap-1 hover:bg-primary/10"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="hidden sm:inline">Refresh All</span>
                </Button>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span>All systems operational</span>
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
