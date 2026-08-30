export const normalizeConfidence = (value: number) => Math.min(1, Math.max(0, value));

export const confidenceLabel = (value: number) => {
  const score = normalizeConfidence(value);
  if (score >= 0.8) return "high" as const;
  if (score >= 0.5) return "medium" as const;
  return "low" as const;
};
