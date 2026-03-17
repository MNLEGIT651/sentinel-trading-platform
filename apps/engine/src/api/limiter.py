"""Shared SlowAPI rate limiter instance.

Import this in both main.py and route files to avoid circular imports.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
