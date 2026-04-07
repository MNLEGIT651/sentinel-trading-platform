# Compass Research Brief

Date: 2026-03-14

## Objective

Translate the attached blueprint and current primary sources into a tighter product direction for a web app. The result is `Compass`: a research-first public markets application built around evidence, controls, and staged deployment rather than a premature live-trading cockpit.

## What The PDF Clearly Says

The attached PDF makes five points that matter more than any dashboard aesthetic:

1. There is no empirically supported "bulletproof" trading strategy in public markets.
2. Robust design comes from combining differentiated return sources, not from one clever signal.
3. Backtests are easy to fool with data reuse, leakage, and selection bias.
4. Trading costs and execution quality are part of the strategy, not a post-processing adjustment.
5. Risk overlays, diversification, and stress testing are mandatory because every anomaly has ugly regimes.

The most actionable synthesis in the PDF is a three-layer stack:

- Return-source layer: value, momentum, trend, and carefully constrained mean-reversion/stat-arb
- Risk layer: equalized risk contribution, volatility targeting, drawdown controls
- Implementation layer: order selection, cost modeling, and execution controls

## Additional Research

### Factor diversification remains one of the strongest design ideas

The AQR paper "Value and Momentum Everywhere" argues that value and momentum are pervasive across asset classes and that combining them improves the Sharpe ratio because their return streams are negatively correlated in important periods.

Product implication:

- the app should compare and combine strategy families
- it should not present one strategy as "the system"

Source:

- AQR: https://www.aqr.com/Insights/Research/Journal-Article/Value-and-Momentum-Everywhere

### Trend following is useful, but regime dependent

The SSRN listing for "Time Series Momentum" reinforces the cross-asset case for trend signals while still implying a need for broad diversification and risk controls.

Product implication:

- trend belongs in the research stack
- trend should be shown with its drawdown and chop risk, not just its upside narrative

Source:

- SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1789463

### Overfitting is a first-order product problem

Bailey, Borwein, Lopez de Prado, and Zhu's work on the probability of backtest overfitting is directly aligned with the PDF's warning about data snooping and selection bias.

Product implication:

- the app must track validation protocol
- the app must surface holdout usage and search breadth
- research status should be as visible as P&L

Source:

- Probability of Backtest Overfitting: https://www.davidhbailey.com/dhbpapers/probability.pdf

### Official data lineage matters

The SEC's EDGAR system and the CFTC's Commitments of Traders reports are official sources that fit the PDF's recommendation to prefer timestamped, auditable data whenever possible.

Product implication:

- fundamentals and filings should be tied to availability dates
- slow-moving official datasets should be treated as state variables, not timing toys

Sources:

- SEC EDGAR: https://www.sec.gov/submit-filings/about-edgar
- CFTC COT: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm

### Best execution is not optional

FINRA Rule 5310 remains the core best-execution rule for broker-dealers. That matters because any app that gets close to routing live orders has to treat execution quality as governance, not convenience.

Product implication:

- live execution should be gated behind paper trading and post-trade review
- execution analytics need a home in the product

Source:

- FINRA Rule 5310: https://www.finra.org/rules-guidance/rulebooks/finra-rules/5310

### Current retail paper-trading infrastructure exists, but that is not the bottleneck

As of 2026-03-14, Alpaca's official docs still provide paper trading and market data APIs. That means retail-grade execution plumbing is available. The harder problem remains research quality, data hygiene, and cost realism.

Product implication:

- do not center the first version of the app on broker connectivity
- center it on evidence capture, validation state, and launch gates

Sources:

- Alpaca paper trading docs: https://docs.alpaca.markets/docs/paper-trading
- Alpaca market data docs: https://docs.alpaca.markets/docs/market-data-1

## Translation Into Product Scope

Claude's repo aims at a broad trading platform. The evidence supports a narrower first release.

Compass will prioritize:

- strategy family comparison
- research pipeline visibility
- data lineage and source quality
- execution and cost assumptions
- launch gates before automation

Compass will defer:

- live order routing
- AI agents making market decisions
- broad multi-page platform sprawl
- claims of autonomous alpha generation

## Product Thesis

The first trustworthy app is not "a live trading terminal."

The first trustworthy app is:

- a strategy evidence board
- a validation ledger
- a risk and cost control surface
- a paper-trading readiness gate

That thesis drives the separate `apps/compass` project.
