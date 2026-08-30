export type AuditMetadata = { action: string; actorId: string; occurredAt: string; correlationId?: string };

export const buildAuditMetadata = (action: string, actorId: string, correlationId?: string): AuditMetadata => ({
  action: action.trim(), actorId: actorId.trim(), occurredAt: new Date().toISOString(), correlationId,
});
