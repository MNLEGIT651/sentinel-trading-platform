#!/usr/bin/env python3
"""Risk assessment tool — calls the engine API."""

import sys
import json
import urllib.request
import os

ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:8000")


def main():
    json.loads(sys.stdin.read())  # consume stdin

    try:
        with urllib.request.urlopen(
            f"{ENGINE_URL}/api/portfolio/account", timeout=10
        ) as resp:
            account = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": f"Failed to get account: {e}"}))
        return

    try:
        with urllib.request.urlopen(
            f"{ENGINE_URL}/api/portfolio/positions", timeout=10
        ) as resp:
            positions = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": f"Failed to get positions: {e}"}))
        return

    pos_map = {}
    for p in positions:
        mv = p.get("market_value") or (p.get("quantity", 0) * p.get("avg_price", 0))
        pos_map[p.get("instrument_id", "")] = mv

    payload = json.dumps(
        {
            "equity": account.get("equity", 0),
            "cash": account.get("cash", 0),
            "peak_equity": account.get("initial_capital", account.get("equity", 0)),
            "daily_starting_equity": account.get(
                "initial_capital", account.get("equity", 0)
            ),
            "positions": pos_map,
            "position_sectors": {},
        }
    ).encode()
    req = urllib.request.Request(
        f"{ENGINE_URL}/api/risk/assess",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": f"Risk assessment failed: {e}"}))
        return

    print(
        json.dumps(
            {
                "equity": result.get("equity", 0),
                "drawdown": result.get("drawdown", 0),
                "daily_pnl": result.get("daily_pnl", 0),
                "halted": result.get("halted", False),
                "alerts": result.get("alerts", []),
                "concentrations": result.get("concentrations", {}),
                "source": "python",
            }
        )
    )


if __name__ == "__main__":
    main()
