from functools import lru_cache

from src.config import Settings


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
