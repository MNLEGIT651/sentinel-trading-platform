#!/usr/bin/env python3
"""Deep technical analysis tool — calls the engine API."""

import sys
import json
import urllib.request
import os

ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:8000")


def main():
    data = json.loads(sys.stdin.read())
    ticker = data.get("ticker", "").upper()
    depth = data.get("depth", "standard")

    payload = json.dumps(
        {"tickers": [ticker], "days": 90, "min_strength": 0.0}
    ).encode()
    req = urllib.request.Request(
        f"{ENGINE_URL}/api/strategies/scan",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": str(e), "ticker": ticker}))
        return

    signals = result.get("signals", [])
    longs = [s for s in signals if s.get("direction") == "long"]
    shorts = [s for s in signals if s.get("direction") == "short"]
    avg = sum(s.get("strength", 0) for s in signals) / max(len(signals), 1)
    bias = (
        "bullish"
        if len(longs) > len(shorts)
        else "bearish"
        if len(shorts) > len(longs)
        else "neutral"
    )

    print(
        json.dumps(
            {
                "ticker": ticker,
                "depth": depth,
                "signals": signals,
                "summary": {
                    "total_signals": len(signals),
                    "long_signals": len(longs),
                    "short_signals": len(shorts),
                    "avg_strength": round(avg, 4),
                    "trend_bias": bias,
                },
                "source": "python",
            }
        )
    )


if __name__ == "__main__":
    main()
