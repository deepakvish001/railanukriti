export const headwayMinutes = (leadingDeparture: Date, followingArrival: Date) =>
  Math.round((followingArrival.getTime() - leadingDeparture.getTime()) / 60_000);

export const meetsMinimumHeadway = (actualMinutes: number, minimumMinutes: number) =>
  actualMinutes >= Math.max(0, minimumMinutes);
