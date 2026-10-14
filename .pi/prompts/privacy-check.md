# Privacy check

For any schema, API, or storage code under review, verify against the Tally privacy invariants:

1. Shared data has NO user ID, device ID, or location trail (store ID only).
2. Private data (trips, baskets, budgets) lives in a separate schema and never joins shared data.
3. Receipt images discarded after line-item extraction; shelf photos never stored whole (cropped tags only, linked to confirmed prices).
4. Consent line + opt-out for contributing present on any capture flow.

List violations with file:line, then propose the minimal fix.
