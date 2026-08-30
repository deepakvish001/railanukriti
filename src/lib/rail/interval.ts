export type TimeInterval = { start: Date; end: Date };

export const isValidInterval = ({ start, end }: TimeInterval) => end.getTime() > start.getTime();

export const intervalsOverlap = (left: TimeInterval, right: TimeInterval) =>
  isValidInterval(left) && isValidInterval(right) && left.start < right.end && left.end > right.start;
