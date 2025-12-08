import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { SoundProvider } from "@/hooks/useNotificationSound";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Map from "./pages/Map";
import NotFound from "./pages/NotFound";

// Dashboard pages
import Dashboard from "./pages/dashboard/Dashboard";
import Recommendations from "./pages/dashboard/Recommendations";
import Predictions from "./pages/dashboard/Predictions";
import Conflicts from "./pages/dashboard/Conflicts";
import Alerts from "./pages/dashboard/Alerts";
import Schedule from "./pages/dashboard/Schedule";
import Simulation from "./pages/dashboard/Simulation";
import KPIs from "./pages/dashboard/KPIs";
import Charts from "./pages/dashboard/Charts";
import Analytics from "./pages/dashboard/Analytics";
import Audit from "./pages/dashboard/Audit";
import Export from "./pages/dashboard/Export";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SoundProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Dashboard Routes */}
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
                <Route path="/predictions" element={<ProtectedRoute><Predictions /></ProtectedRoute>} />
                <Route path="/conflicts" element={<ProtectedRoute><Conflicts /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
                <Route path="/simulation" element={<ProtectedRoute><Simulation /></ProtectedRoute>} />
                <Route path="/kpis" element={<ProtectedRoute><KPIs /></ProtectedRoute>} />
                <Route path="/charts" element={<ProtectedRoute><Charts /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/audit" element={<ProtectedRoute><Audit /></ProtectedRoute>} />
                <Route path="/export" element={<ProtectedRoute><Export /></ProtectedRoute>} />
                
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

export default App;
