export const timetableVarianceMinutes = (planned: Date, observed: Date) =>
  Math.round((observed.getTime() - planned.getTime()) / 60_000);

export const isEarly = (variance: number) => variance < 0;
export const isDelayed = (variance: number) => variance > 0;
