import { useState, useEffect, useRef, useCallback } from 'react';
import { Train } from '@/types/railway';

interface AnimatedTrainPosition {
  trainId: string;
  progress: number; // 0-1 within current section
  targetProgress: number;
  velocity: number; // pixels per frame
  smoothX: number;
  smoothY: number;
  direction: 'up' | 'down';
  isMoving: boolean;
  trail: number[]; // Last N positions for trail effect
}

interface UseTrainAnimationOptions {
  interpolationSpeed?: number; // 0-1, how fast to interpolate
  trailLength?: number;
  updateRate?: number; // ms between updates
}

export const useTrainAnimation = (
  trains: Train[],
  options: UseTrainAnimationOptions = {}
) => {
  const {
    interpolationSpeed = 0.08,
    trailLength = 10,
    updateRate = 16, // ~60fps
  } = options;

  const [positions, setPositions] = useState<Map<string, AnimatedTrainPosition>>(new Map());
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());
  const previousTrainsRef = useRef<Map<string, Train>>(new Map());

  // Smooth lerp function with easing
  const lerp = useCallback((start: number, end: number, t: number) => {
    // Use ease-out cubic for smoother deceleration
    const easeT = 1 - Math.pow(1 - t, 3);
    return start + (end - start) * easeT;
  }, []);

  // Calculate target position based on train speed and status
  const calculateTargetProgress = useCallback((train: Train, currentProgress: number) => {
    if (train.status === 'halted' || train.speed === 0) {
      return currentProgress; // Stay in place
    }

    // Speed-based movement rate (normalized)
    const speedFactor = train.speed / 120; // Assuming max speed of 120 km/h
    const baseIncrement = 0.002 * speedFactor;
    
    // Add slight variation for realism
    const variation = 1 + (Math.sin(Date.now() / 1000 + train.id.charCodeAt(0)) * 0.1);
    
    return (currentProgress + baseIncrement * variation) % 1;
  }, []);

  // Main animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateRef.current;
      
      if (deltaTime >= updateRate) {
        lastUpdateRef.current = now;
        
        setPositions(prevPositions => {
          const newPositions = new Map(prevPositions);
          
          trains.forEach(train => {
            const existing = newPositions.get(train.id);
            const prevTrain = previousTrainsRef.current.get(train.id);
            
            // Detect section change for smooth transition
            const sectionChanged = prevTrain && prevTrain.currentSection !== train.currentSection;
            
            if (existing) {
              // Calculate new target
              const newTarget = calculateTargetProgress(train, existing.progress);
              
              // Smooth interpolation towards target
              const newProgress = lerp(
                existing.progress,
                sectionChanged ? 0 : newTarget,
                interpolationSpeed
              );
              
              // Update velocity for momentum-based animation
              const newVelocity = lerp(
                existing.velocity,
                (train.speed / 120) * 2, // Normalize velocity
                0.1
              );
              
              // Update trail (shift old positions, add current)
              const newTrail = [...existing.trail.slice(-(trailLength - 1)), existing.progress];
              
              newPositions.set(train.id, {
                ...existing,
                progress: newProgress,
                targetProgress: newTarget,
                velocity: newVelocity,
                smoothX: lerp(existing.smoothX, newProgress * 100, 0.12),
                smoothY: lerp(existing.smoothY, 0, 0.1),
                isMoving: train.speed > 0 && train.status !== 'halted',
                trail: newTrail,
              });
            } else {
              // Initialize new train position
              newPositions.set(train.id, {
                trainId: train.id,
                progress: 0.5,
                targetProgress: 0.5,
                velocity: 0,
                smoothX: 50,
                smoothY: 0,
                direction: train.currentSection ? (train.currentSection % 2 === 0 ? 'up' : 'down') : 'up',
                isMoving: train.speed > 0,
                trail: Array(trailLength).fill(0.5),
              });
            }
          });
          
          // Remove positions for trains that no longer exist
          newPositions.forEach((_, trainId) => {
            if (!trains.find(t => t.id === trainId)) {
              newPositions.delete(trainId);
            }
          });
          
          return newPositions;
        });
        
        // Update previous trains reference
        previousTrainsRef.current = new Map(trains.map(t => [t.id, t]));
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [trains, calculateTargetProgress, lerp, interpolationSpeed, trailLength, updateRate]);

  // Get animated position for a specific train
  const getTrainPosition = useCallback((trainId: string): AnimatedTrainPosition | undefined => {
    return positions.get(trainId);
  }, [positions]);

  // Get all animated positions
  const getAllPositions = useCallback(() => {
    return positions;
  }, [positions]);

  // Get interpolated X position (0-100) for CSS
  const getInterpolatedX = useCallback((trainId: string): number => {
    const pos = positions.get(trainId);
    return pos ? pos.smoothX : 50;
  }, [positions]);

  // Get trail positions for a train
  const getTrail = useCallback((trainId: string): number[] => {
    const pos = positions.get(trainId);
    return pos ? pos.trail : [];
  }, [positions]);

  // Check if train is actively moving
  const isTrainMoving = useCallback((trainId: string): boolean => {
    const pos = positions.get(trainId);
    return pos ? pos.isMoving : false;
  }, [positions]);

  return {
    positions,
    getTrainPosition,
    getAllPositions,
    getInterpolatedX,
    getTrail,
    isTrainMoving,
  };
};
