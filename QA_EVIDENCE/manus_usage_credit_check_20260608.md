# Manus API Credit Check - 2026-06-08

## Scope

- Target: ConceptMaster CodeFair local app Manus API configuration.
- Method: Call official Manus `/v2/usage.list` with the local `.env` key.
- Secret handling: API key was read from `.env` for the request only. The key value is not printed or stored here.

## Result

- API status: `ok=true`
- Endpoint: `usage.list`
- Records checked: `129`
- Pages checked: `2`
- Truncated: `false`
- Grant credits: `33,500`
- Refund credits: `0`
- Cost credits: `-2,388`
- Net credits from usage history: `31,112`

## Latest Credit Changes

| UTC time | Type | Credits |
| --- | --- | ---: |
| 2026-06-08 04:17:03 | cost | -4 |
| 2026-06-08 04:16:48 | cost | -4 |
| 2026-06-08 04:03:19 | cost | -4 |
| 2026-06-08 04:03:18 | cost | -4 |
| 2026-06-07 05:24:29 | cost | -6 |

## Boundary

- The `31,112` number is derived from the complete `usage.list` credit-change history returned by the Manus API.
- This is not a screenshot or separate verification of a logged-in billing dashboard.
- The API key remains excluded from this evidence file.
