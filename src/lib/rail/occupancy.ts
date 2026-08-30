export type OccupancyState = "clear" | "reserved" | "occupied" | "blocked";

export const isMovementAllowed = (state: OccupancyState) => state === "clear" || state === "reserved";
export const occupancyPriority = (state: OccupancyState) => ({ clear: 0, reserved: 1, occupied: 2, blocked: 3 })[state];
