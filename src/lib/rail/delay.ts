export const delayMinutes = (scheduled: Date, actual: Date) =>
  Math.max(0, Math.round((actual.getTime() - scheduled.getTime()) / 60_000));

export const delayBand = (minutes: number) => {
  if (minutes >= 60) return "critical" as const;
  if (minutes >= 30) return "high" as const;
  if (minutes >= 10) return "moderate" as const;
  return "low" as const;
};
