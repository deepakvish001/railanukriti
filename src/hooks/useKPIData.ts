import { useMemo } from 'react';
import { Train } from '@/types/railway';
import { useMetricsHistory, MetricsDataPoint } from './useMetricsHistory';

export interface TrainPerformanceKPIs {
  onTimePerformance: number;
  avgDelayPassenger: number;
  avgDelayFreight: number;
  maxDelay: number;
  maxDelayTrain: string;
  scheduleAdherence: number;
}

export interface SpeedTravelKPIs {
  avgSpeedExpress: number;
  avgSpeedFreight: number;
  avgSpeedLocal: number;
  speedVariance: number;
  avgSectionTravelTime: number;
  avgHaltTime: number;
  scheduledHaltTime: number;
}

export interface DisruptionKPIs {
  delayBySignalFailure: number;
  delayByTrackBlock: number;
  delayByWeather: number;
  delayByOther: number;
  affectedDistance: number;
  avgRecoveryTime: number;
  trainsAffected: number;
}

export interface OperationalKPIs {
  passengerDelayRatio: number;
  freightDelayRatio: number;
  trainDensity: number;
  sectionUtilization: number;
  congestionIndex: number;
}

export interface PredictiveKPIs {
  predictionAccuracy: number;
  delayPredictionAccuracy: number;
  scenarioImpactScore: number;
  bottleneckRisk: number;
}

export interface AllKPIs {
  trainPerformance: TrainPerformanceKPIs;
  speedTravel: SpeedTravelKPIs;
  disruption: DisruptionKPIs;
  operational: OperationalKPIs;
  predictive: PredictiveKPIs;
}

// Generate realistic KPI data based on trains and metrics
export const useKPIData = (trains: Train[], metricsHistory: MetricsDataPoint[]): AllKPIs => {
  return useMemo(() => {
    const passengerTrains = trains.filter(t => t.type === 'express' || t.type === 'local');
    const freightTrains = trains.filter(t => t.type === 'freight');
    
    const avgDelayPassenger = passengerTrains.length > 0
      ? passengerTrains.reduce((sum, t) => sum + t.delay, 0) / passengerTrains.length
      : 0;
    
    const avgDelayFreight = freightTrains.length > 0
      ? freightTrains.reduce((sum, t) => sum + t.delay, 0) / freightTrains.length
      : 0;

    const maxDelayTrain = trains.reduce((max, t) => t.delay > max.delay ? t : max, trains[0] || { delay: 0, number: 'N/A' });
    
    const onTimeTrains = trains.filter(t => t.delay <= 5).length;
    const onTimePerformance = trains.length > 0 ? (onTimeTrains / trains.length) * 100 : 100;

    // Speed calculations
    const expressSpeeds = trains.filter(t => t.type === 'express').map(t => t.speed);
    const freightSpeeds = trains.filter(t => t.type === 'freight').map(t => t.speed);
    const localSpeeds = trains.filter(t => t.type === 'local').map(t => t.speed);
    
    const avgSpeedExpress = expressSpeeds.length > 0 ? expressSpeeds.reduce((a, b) => a + b, 0) / expressSpeeds.length : 0;
    const avgSpeedFreight = freightSpeeds.length > 0 ? freightSpeeds.reduce((a, b) => a + b, 0) / freightSpeeds.length : 0;
    const avgSpeedLocal = localSpeeds.length > 0 ? localSpeeds.reduce((a, b) => a + b, 0) / localSpeeds.length : 0;

    const allSpeeds = trains.map(t => t.speed);
    const avgSpeed = allSpeeds.length > 0 ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length : 0;
    const speedVariance = allSpeeds.length > 0 
      ? Math.sqrt(allSpeeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / allSpeeds.length)
      : 0;

    // Metrics-based calculations
    const avgUtilization = metricsHistory.length > 0
      ? metricsHistory.reduce((sum, m) => sum + m.utilization, 0) / metricsHistory.length
      : 75;
    
    const avgThroughput = metricsHistory.length > 0
      ? metricsHistory.reduce((sum, m) => sum + m.throughput, 0) / metricsHistory.length
      : 18;

    const totalConflicts = metricsHistory.reduce((sum, m) => sum + m.pendingConflicts, 0);

    // Simulated disruption data (in real app, this would come from a disruptions table)
    const disruptionBreakdown = {
      signal: 35,
      track: 25,
      weather: 20,
      other: 20,
    };

    const totalDelay = trains.reduce((sum, t) => sum + t.delay, 0);

    return {
      trainPerformance: {
        onTimePerformance: Math.round(onTimePerformance * 10) / 10,
        avgDelayPassenger: Math.round(avgDelayPassenger * 10) / 10,
        avgDelayFreight: Math.round(avgDelayFreight * 10) / 10,
        maxDelay: maxDelayTrain?.delay || 0,
        maxDelayTrain: maxDelayTrain?.number || 'N/A',
        scheduleAdherence: Math.round((100 - (totalDelay / (trains.length || 1)) * 2) * 10) / 10,
      },
      speedTravel: {
        avgSpeedExpress: Math.round(avgSpeedExpress),
        avgSpeedFreight: Math.round(avgSpeedFreight),
        avgSpeedLocal: Math.round(avgSpeedLocal),
        speedVariance: Math.round(speedVariance * 10) / 10,
        avgSectionTravelTime: Math.round(280 / (avgSpeed || 60) * 60), // 280km section
        avgHaltTime: 12 + Math.random() * 5,
        scheduledHaltTime: 10,
      },
      disruption: {
        delayBySignalFailure: Math.round(totalDelay * disruptionBreakdown.signal / 100),
        delayByTrackBlock: Math.round(totalDelay * disruptionBreakdown.track / 100),
        delayByWeather: Math.round(totalDelay * disruptionBreakdown.weather / 100),
        delayByOther: Math.round(totalDelay * disruptionBreakdown.other / 100),
        affectedDistance: Math.round(45 + Math.random() * 30),
        avgRecoveryTime: Math.round(8 + Math.random() * 7),
        trainsAffected: trains.filter(t => t.delay > 5).length,
      },
      operational: {
        passengerDelayRatio: avgDelayFreight > 0 ? Math.round((avgDelayPassenger / avgDelayFreight) * 100) / 100 : 0,
        freightDelayRatio: avgDelayPassenger > 0 ? Math.round((avgDelayFreight / avgDelayPassenger) * 100) / 100 : 0,
        trainDensity: Math.round(avgThroughput / 4 * 10) / 10,
        sectionUtilization: Math.round(avgUtilization * 10) / 10,
        congestionIndex: Math.round((totalConflicts / (metricsHistory.length || 1)) * 100) / 100,
      },
      predictive: {
        predictionAccuracy: 87 + Math.random() * 8,
        delayPredictionAccuracy: 82 + Math.random() * 10,
        scenarioImpactScore: 65 + Math.random() * 25,
        bottleneckRisk: Math.min(100, totalConflicts * 5 + 15),
      },
    };
  }, [trains, metricsHistory]);
};
