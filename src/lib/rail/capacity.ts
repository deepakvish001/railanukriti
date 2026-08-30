export const utilizationPercent = (used: number, capacity: number) => {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.max(0, (used / capacity) * 100));
};

export const remainingCapacity = (used: number, capacity: number) => Math.max(0, capacity - used);
