import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/dashboard/Header';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

interface MinimalDashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const MinimalDashboardLayout = ({ children, title }: MinimalDashboardLayoutProps) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-background flex w-full">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Header />
          
          <main className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/10">
            {/* Page Content */}
            <div className="flex-1 p-4 lg:p-6 overflow-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full"
              >
                <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-full flex flex-col">
                  <div className="px-4 py-3 border-b border-border/30 bg-muted/20 shrink-0">
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                  </div>
                  <div className="flex-1 p-4 lg:p-6 overflow-auto">
                    {children}
                  </div>
                </div>
              </motion.div>
            </div>
          </main>
          
          {/* Footer Status Bar */}
          <footer className="border-t border-border/30 bg-card/50 backdrop-blur-sm px-4 lg:px-6 py-2">
            <div className="flex items-center justify-between text-[10px] lg:text-xs text-muted-foreground">
              <div className="flex items-center gap-3 lg:gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Synced
                </span>
                <span className="hidden sm:inline text-border/50">•</span>
                <span className="hidden sm:inline">Network: Connected</span>
                <span className="hidden md:inline text-border/50">•</span>
                <span className="hidden md:inline">TMS Integration: Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span>All systems operational</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MinimalDashboardLayout;
