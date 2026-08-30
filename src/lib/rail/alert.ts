export type AlertState = "new" | "acknowledged" | "resolved";

export const canAcknowledge = (state: AlertState) => state === "new";
export const canResolve = (state: AlertState) => state !== "resolved";
export const nextAlertState = (state: AlertState) => state === "new" ? "acknowledged" : "resolved";
