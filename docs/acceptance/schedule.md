# Schedule view acceptance specification

## Outcome

For RailAnukriti, planned and observed movements remain comparable and time-zone explicit.

## Primary scenario

**Given** an authorised or eligible user with valid input and an available service,

**When** the user completes the schedule view workflow,

**Then** the application persists or presents the intended result exactly once and provides clear confirmation.

## Acceptance criteria

- [ ] Loading, empty, success and failure states are distinguishable.
- [ ] Validation identifies the affected field or record without losing safe user input.
- [ ] Keyboard focus and screen-reader context move to meaningful feedback.
- [ ] Access is enforced by trusted server or database rules where data is involved.
- [ ] Repeated submissions do not create unintended duplicate records.
- [ ] Times, quantities and status labels include sufficient context.
- [ ] Logs and analytics exclude credentials and sensitive record contents.
- [ ] A recoverable provider failure offers a safe retry path.

## Negative scenarios

1. Required input is missing or malformed.
2. The user lacks permission for the requested record.
3. The record changed after the page loaded.
4. Network connectivity fails before confirmation.
5. The provider returns a partial or delayed response.
6. The route is opened directly without prerequisite state.

## Test evidence

Include the lowest useful automated test, a screenshot or recording for visible behaviour, and redacted request or database evidence for persistence changes.

## Done

The workflow is complete only when acceptance, accessibility, authorisation, failure recovery and documentation checks pass.
