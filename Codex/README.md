# Codex

Advanced clean-room version of the stock trading app.

## Positioning

This project is not a clone of `Sentinel`. It is a stricter product:

- research-first
- data-lineage aware
- validation and execution controls visible in the UI
- staged deployment instead of live-trading theater

## Routes

- `/` overview and operating thesis
- `/lab` interactive strategy lab
- `/controls` launch gates and execution governance
- `/sources` source ledger and repo intelligence

## Commands

From Windows `cmd.exe` in this environment:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

Default dev port: `3200`
