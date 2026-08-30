# Contribution workflow

This guide defines the contribution workflow for **RailAnukriti**, a railway traffic optimisation and controller decision support application.

## Scope

The guidance covers branching, commits, validation evidence, reviews and operational assumptions. It applies to new features, maintenance changes and production operations.

## Principles

- Keep safety, privacy and user trust explicit in technical decisions.
- Prefer small reversible changes with clear validation evidence.
- Enforce access and data rules at trusted boundaries, not only in the interface.
- Keep operational behaviour observable without exposing sensitive information.
- Document assumptions, limitations and rollback steps.

## Implementation guidance

1. Identify the user or operational outcome before changing code.
2. Map affected routes, components, data stores and external services.
3. Define success, failure and recovery behaviour.
4. Add automated checks at the lowest useful layer.
5. Validate accessibility, security and performance impact.
6. Record configuration, migration and deployment implications.

## Review checklist

- [ ] The change has one focused purpose.
- [ ] Input, empty, loading, success and failure states are covered.
- [ ] Authorisation and data exposure were reviewed.
- [ ] Tests or repeatable manual checks demonstrate expected behaviour.
- [ ] Logs avoid credentials and personal or operationally sensitive data.
- [ ] Documentation and environment examples remain accurate.
- [ ] Rollback is possible without data loss.

## Ownership

The pull-request author documents the change. Reviewers validate domain assumptions and technical safety. Production changes require an identified operator and rollback owner.
