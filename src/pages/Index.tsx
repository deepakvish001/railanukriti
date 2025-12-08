import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/dashboard/Header';
import { MetricsPanel } from '@/components/dashboard/MetricsPanel';
import { TrackVisualization } from '@/components/dashboard/TrackVisualization';
import { TrainList } from '@/components/dashboard/TrainList';
import { AIRecommendations } from '@/components/dashboard/AIRecommendations';
import { TrainDetails } from '@/components/dashboard/TrainDetails';
import { mockTrains, mockTrackSections, mockRecommendations, mockMetrics } from '@/data/mockData';
import { Train } from '@/types/railway';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [trains, setTrains] = useState(mockTrains);
  const [metrics, setMetrics] = useState(mockMetrics);

  const selectedTrain = selectedTrainId 
    ? trains.find(t => t.id === selectedTrainId) || null 
    : null;

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTrains(prev => prev.map(train => {
        if (train.status === 'halted') return train;
        
        // Randomly adjust speed slightly
        const speedChange = (Math.random() - 0.5) * 5;
        const newSpeed = Math.max(0, Math.min(150, train.speed + speedChange));
        
        return {
          ...train,
          speed: Math.round(newSpeed),
        };
      }));

      // Update metrics slightly
      setMetrics(prev => ({
        ...prev,
        throughput: prev.throughput + (Math.random() > 0.5 ? 0 : Math.random() > 0.5 ? 1 : -1),
        averageDelay: Math.max(0, prev.averageDelay + (Math.random() - 0.5) * 0.5),
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Helmet>
        <title>Section Control AI | Railway Traffic Management</title>
        <meta name="description" content="AI-powered train traffic control system for maximizing section throughput and minimizing delays on Indian Railways." />
      </Helmet>
      
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main className="flex-1 p-6 space-y-6 overflow-hidden">
          {/* Metrics Row */}
          <MetricsPanel metrics={metrics} />

          {/* Main Content */}
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-320px)]">
            {/* Train List */}
            <div className="col-span-3">
              <TrainList
                trains={trains}
                selectedTrain={selectedTrainId}
                onTrainSelect={setSelectedTrainId}
              />
            </div>

            {/* Center Panel - Track Visualization & AI Recommendations */}
            <div className="col-span-6 flex flex-col gap-6">
              <TrackVisualization
                sections={mockTrackSections}
                trains={trains}
                selectedTrain={selectedTrainId}
                onTrainSelect={setSelectedTrainId}
              />
              <div className="flex-1 min-h-0">
                <AIRecommendations recommendations={mockRecommendations} />
              </div>
            </div>

            {/* Right Panel - Train Details or Placeholder */}
            <div className="col-span-3">
              {selectedTrain ? (
                <TrainDetails
                  train={selectedTrain}
                  onClose={() => setSelectedTrainId(null)}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card border border-border rounded-lg p-6 h-full flex flex-col items-center justify-center text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                      />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    Select a Train
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-[200px]">
                    Click on a train from the list or track visualization to view details and send commands
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </main>

        {/* Footer Status Bar */}
        <footer className="border-t border-border bg-card/50 px-6 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Last sync: Just now</span>
              <span>•</span>
              <span>Network: Connected</span>
              <span>•</span>
              <span>TMS Integration: Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
