import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { SoundProvider } from "@/hooks/useNotificationSound";
import { SplashScreen } from "@/components/SplashScreen";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Map from "./pages/Map";

// Dashboard pages
import Dashboard from "./pages/dashboard/Dashboard";
import FreightAnalysis from "./pages/dashboard/FreightAnalysis";
import AIPredictions from "./pages/dashboard/AIPredictions";
import KPIs from "./pages/dashboard/KPIs";
import Audit from "./pages/dashboard/Audit";
import Export from "./pages/dashboard/Export";
import DataImport from "./pages/dashboard/DataImport";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <SoundProvider>
              <AnimatePresence mode="wait">
                {showSplash && <SplashScreen key="splash" />}
              </AnimatePresence>
              
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Dashboard Routes */}
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/freight-analysis" element={<ProtectedRoute><FreightAnalysis /></ProtectedRoute>} />
                  <Route path="/ai-predictions" element={<ProtectedRoute><AIPredictions /></ProtectedRoute>} />
                  <Route path="/kpis" element={<ProtectedRoute><KPIs /></ProtectedRoute>} />
                  <Route path="/audit" element={<ProtectedRoute><Audit /></ProtectedRoute>} />
                  <Route path="/export" element={<ProtectedRoute><Export /></ProtectedRoute>} />
                  <Route path="/data-import" element={<ProtectedRoute><DataImport /></ProtectedRoute>} />
                  
                  {/* Map Route */}
                  <Route path="/map" element={<ProtectedRoute><Map /></ProtectedRoute>} />
                  
                  {/* Auth Route */}
                  <Route path="/auth" element={<Auth />} />
                  
                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </SoundProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
