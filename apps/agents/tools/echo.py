# apps/agents/tools/echo.py
"""Test tool: reads JSON from stdin, echoes it back with a wrapper."""

import sys
import json

data = json.loads(sys.stdin.read())
print(json.dumps({"echoed": data, "source": "python"}))
