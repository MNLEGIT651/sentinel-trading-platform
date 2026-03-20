---
name: Trading Cycle
version: 1
---

# Trading Cycle

## Sequence

1. market_sentinel — assess market conditions
2. strategy_analyst — generate signals (after market data available)
3. risk_monitor — check portfolio risk (after positions known)
4. execution_monitor — execute approved trades (after risk approval)

## Halt Conditions

- If risk_monitor sets halted=true, skip execution_monitor
- If market_sentinel detects crisis regime, run risk_monitor immediately

## On-Demand Agents

- research — triggered by specific ticker requests, not part of regular cycle
