export type Severity = "info" | "warning" | "high" | "critical";

const rank: Record<Severity, number> = { info: 0, warning: 1, high: 2, critical: 3 };

export const compareSeverity = (a: Severity, b: Severity) => rank[b] - rank[a];
export const isEscalationRequired = (severity: Severity) => rank[severity] >= rank.high;
