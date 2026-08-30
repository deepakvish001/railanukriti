# Credential rotation runbook

This runbook helps RailAnukriti operators rotate public configuration and server secrets.

## Trigger

Use this procedure when monitoring, a user report, a security alert or an operational review indicates that normal behaviour may be compromised.

## Immediate actions

1. Confirm the signal using an independent source.
2. Assign an incident owner and record the start time.
3. Limit impact using the smallest reversible containment action.
4. Preserve relevant evidence without copying sensitive data into public channels.
5. Communicate known impact, uncertainty and the next update time.

## Investigation

- Identify affected users, records, routes and integrations.
- Compare the last known healthy deployment and configuration.
- Review redacted application, provider and database events.
- Reproduce only in an isolated environment when production data is involved.
- Separate root cause from symptoms and contributing conditions.

## Recovery

1. Apply a reviewed fix or rollback.
2. Verify critical workflows and data integrity.
3. Monitor for recurrence and secondary effects.
4. Notify affected stakeholders through approved channels.
5. Close temporary access or emergency configuration changes.

## Evidence checklist

- [ ] Incident timeline and owner recorded
- [ ] User and data impact assessed
- [ ] Containment was reversible
- [ ] Secrets and personal data remain protected
- [ ] Recovery checks passed
- [ ] Follow-up actions have owners and due dates

## Escalation

Escalate immediately when safety, authentication, personal data, financial records, irreversible data loss or widespread service availability may be affected.
