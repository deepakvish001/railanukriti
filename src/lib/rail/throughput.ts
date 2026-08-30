export const trainsPerHour = (trainCount: number, windowMinutes: number) => {
  if (windowMinutes <= 0) return 0;
  return (Math.max(0, trainCount) * 60) / windowMinutes;
};

export const throughputChangePercent = (before: number, after: number) =>
  before <= 0 ? 0 : ((after - before) / before) * 100;
