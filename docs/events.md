# Sentinel Domain Events

Canonical reference for every domain event emitted across the Sentinel Trading
Platform. Each event name follows the `<domain>.<entity>.<action>` convention.

---

## Event Categories

### Market Events

| Event                              | Description                                                             |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `market.quote.updated`             | New price data received for an instrument                               |
| `market.bar.closed`                | A candlestick bar completed                                             |
| `market.regime.changed`            | Market regime transitioned (bull / bear / sideways / volatile / crisis) |
| `market.volatility.spike_detected` | Abnormal volatility detected                                            |

### Strategy Events

| Event                  | Description                 |
| ---------------------- | --------------------------- |
| `signal.run.started`   | Strategy scan initiated     |
| `signal.run.completed` | Strategy scan finished      |
| `signal.generated`     | New trading signal produced |

### Recommendation Events

| Event                         | Description                     |
| ----------------------------- | ------------------------------- |
| `recommendation.created`      | New recommendation from signal  |
| `recommendation.risk_blocked` | Blocked by risk policy          |
| `recommendation.approved`     | Approved by operator or policy  |
| `recommendation.rejected`     | Rejected by operator            |
| `recommendation.submitted`    | Order submitted to broker       |
| `recommendation.filled`       | Order fully filled              |
| `recommendation.failed`       | Order failed or broker rejected |

### Risk / Governance Events

| Event                       | Description                       |
| --------------------------- | --------------------------------- |
| `risk.policy.updated`       | Risk policy version changed       |
| `risk.halt.triggered`       | Trading halt activated            |
| `risk.halt.cleared`         | Trading halt removed              |
| `operator.override.applied` | Operator overrode system decision |

### Execution Events

| Event                    | Description           |
| ------------------------ | --------------------- |
| `order.submitted`        | Broker order placed   |
| `order.partially_filled` | Partial fill received |
| `order.filled`           | Full fill received    |
| `order.cancelled`        | Order cancelled       |
| `order.rejected`         | Broker rejected order |

---

## Recommendation State Machine

The full lifecycle of a recommendation is governed by a finite state machine
defined in `packages/shared/src/state-machine.ts`.

```text
                        ┌──────────────┐
                        │   detected   │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   analyzed   │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
               ┌────────│ risk_checked │────────┐
               │        └──────────────┘        │
               ▼                                ▼
     ┌─────────────────┐              ┌──────────────┐
     │ pending_approval │              │ risk_blocked │ ■
     └────────┬────────┘              └──────────────┘
         ┌────┴────┐
         ▼         ▼
   ┌──────────┐ ┌──────────┐
   │ approved │ │ rejected │ ■
   └────┬─────┘ └──────────┘
        │
        ▼
   ┌───────────┐
   │ submitted │◄─────────────────────┐
   └─────┬─────┘                      │ retry
     ┌───┼───────┬──────────┐         │
     ▼   ▼       ▼          ▼         │
 ┌──────┐ ┌───────────────┐ ┌──────┐ │
 │filled│ │partially_filled│ │failed│─┘
 └──┬───┘ └───────┬───────┘ └──────┘
    │         ┌────┴────┐
    │         ▼         ▼
    │     ┌──────┐ ┌─────────┐
    │     │filled│ │cancelled│ ■
    │     └──┬───┘ └─────────┘
    │        │
    ▼        ▼
 ┌──────────┐
 │ reviewed │ ■
 └──────────┘

  ■ = terminal state (no outbound transitions)
```

### Transition Table

| From               | Valid Targets                                       |
| ------------------ | --------------------------------------------------- |
| `detected`         | `analyzed`                                          |
| `analyzed`         | `risk_checked`                                      |
| `risk_checked`     | `pending_approval`, `risk_blocked`                  |
| `pending_approval` | `approved`, `rejected`                              |
| `approved`         | `submitted`                                         |
| `rejected`         | _(terminal)_                                        |
| `risk_blocked`     | _(terminal)_                                        |
| `submitted`        | `filled`, `partially_filled`, `cancelled`, `failed` |
| `partially_filled` | `filled`, `cancelled`                               |
| `filled`           | `reviewed`                                          |
| `cancelled`        | _(terminal)_                                        |
| `failed`           | `submitted` (retry)                                 |
| `reviewed`         | _(terminal)_                                        |

---

## Event Storage

Events are stored in the `recommendation_events` table with the following
key columns:

| Column         | Description                                           |
| -------------- | ----------------------------------------------------- |
| `event_type`   | One of the recommendation events listed above         |
| `actor_type`   | `'system'` \| `'operator'` \| `'agent'` \| `'broker'` |
| `payload_json` | Event-specific data (JSONB)                           |

Each row captures a single state transition or side-effect, forming an
append-only audit log for the recommendation's lifecycle.
