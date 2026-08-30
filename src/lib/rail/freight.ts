export type FreightFactors = { delayMinutes: number; criticalCargo: boolean; pathCongestion: number };

export const freightPriorityScore = ({ delayMinutes, criticalCargo, pathCongestion }: FreightFactors) =>
  Math.max(0, delayMinutes) + (criticalCargo ? 50 : 0) + Math.max(0, pathCongestion) * 10;
