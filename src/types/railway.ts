export type TrainType = 'express' | 'freight' | 'local' | 'special';
export type TrainStatus = 'on-time' | 'delayed' | 'halted' | 'approaching';
export type TrackStatus = 'clear' | 'occupied' | 'blocked';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface Train {
  id: string;
  number: string;
  name: string;
  type: TrainType;
  status: TrainStatus;
  priority: Priority;
  currentSection: number;
  destination: string;
  origin: string;
  scheduledTime: string;
  actualTime: string;
  delay: number; // in minutes
  speed: number; // km/h
  nextStation: string;
  eta: string;
}

export interface TrackSection {
  id: number;
  name: string;
  status: TrackStatus;
  occupiedBy: string | null;
  length: number; // km
  maxSpeed: number; // km/h
  gradient: number; // percentage
}

export interface AIRecommendation {
  id: string;
  type: 'precedence' | 'crossing' | 'reroute' | 'hold';
  trainId: string;
  action: string;
  reason: string;
  impact: string;
  confidence: number;
  timestamp: string;
}

export interface SectionMetrics {
  throughput: number;
  averageDelay: number;
  utilization: number;
  onTimePerformance: number;
  activeTrains: number;
  pendingConflicts: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  changes: {
    trainId: string;
    action: string;
  }[];
  projectedImpact: {
    throughputChange: number;
    delayChange: number;
  };
}
