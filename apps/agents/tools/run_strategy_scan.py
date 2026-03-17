#!/usr/bin/env python3
"""Strategy scan tool — calls the engine API."""

import sys
import json
import urllib.request
import os

ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:8000")
DEFAULT_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY"]


def main():
    data = json.loads(sys.stdin.read())
    tickers = data.get("tickers") or DEFAULT_TICKERS
    strategies = data.get("strategies", [])

    payload = json.dumps({"tickers": tickers, "days": 90, "min_strength": 0.3}).encode()
    req = urllib.request.Request(
        f"{ENGINE_URL}/api/strategies/scan",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return

    signals = result.get("signals", [])
    if strategies:
        signals = [s for s in signals if s.get("strategy_name") in strategies]

    print(
        json.dumps(
            {
                "signals": signals,
                "total_signals": len(signals),
                "tickers_scanned": result.get("tickers_scanned", len(tickers)),
                "strategies_run": result.get("strategies_run", 0),
                "errors": result.get("errors", []),
                "source": "python",
            }
        )
    )


if __name__ == "__main__":
    main()
