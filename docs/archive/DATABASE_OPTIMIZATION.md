# Database Optimization Guide

## Supabase PostgREST Optimization

Your engine uses PostgREST directly for performance. Here's how to maximize efficiency:

### 1. Implement Connection Pooling

**Current**: Each SupabaseDB instance creates new HTTP connections

**Recommended**: Use PgBouncer for connection pooling

In **supabase/config.toml**:

```toml
[db]
# Enable PgBouncer connection pooling
poolmode = "transaction"
max_client_conn = 100
pool_mode = "transaction"
```

Or use Supabase's built-in pooler (pg-pooler):

- Go to: Project Settings → Database → Connection Pooling
- Select: "Transaction" mode (recommended for PostgREST)
- Set pool size: 25-40

Then update **apps/engine/src/db.py**:

```python
# Use pooler connection string instead
SUPABASE_URL = "https://your-project.supabase.co"  # Standard
SUPABASE_POOLER_URL = "https://your-project.pooler.supabase.co"  # With pooling

# Use pooler URL for frequent queries
self._rest_url = os.getenv("SUPABASE_POOLER_URL", SUPABASE_URL) + "/rest/v1"
```

### 2. Add Indexes for Common Queries

Your **market_data** table needs indexes for performance:

```sql
-- Create these indexes in Supabase:
-- Go to: SQL Editor → New Query

-- Index on ticker (for filtering by ticker)
CREATE INDEX idx_market_data_ticker ON market_data(ticker);

-- Index on timeframe (for filtering by timeframe)
CREATE INDEX idx_market_data_timeframe ON market_data(timeframe);

-- Composite index for common filter combo
CREATE INDEX idx_market_data_ticker_timestamp
  ON market_data(ticker, timeframe, timestamp DESC);

-- Index on timestamp for date range queries
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp DESC);

-- Index on instrument_id (for joins)
CREATE INDEX idx_market_data_instrument_id ON market_data(instrument_id);
```

Execute in **Supabase SQL Editor** → save as migration

### 3. Optimize Common Queries

**Problem**: Current pagination has no indexes

**Before**:

```python
db.table("market_data").select("*").offset(1000).limit(100).execute()
# ❌ Scans all rows up to offset 1000
```

**After**: Use indexed columns

```python
last_id = request.query_params.get("after")  # Keyset pagination
rows = (
    db.table("market_data")
    .select("id,ticker,timestamp,open,high,low,close,volume")
    .gt("id", last_id)  # Use indexed column instead of offset
    .order("id")
    .limit(100)
    .execute()
)
```

### 4. Enable Query Caching

Add `Prefer: return=representation` header:

```python
from src.db import SupabaseDB

class CachedSupabaseDB(SupabaseDB):
    def table(self, name: str):
        """Access a table with caching headers."""
        base = super().table(name)
        # Add caching header for GET requests
        base = base._client.from_(name)
        # Set Prefer header to cache responses
        return base
```

Or use Redis caching layer:

```python
import redis
from functools import wraps

cache = redis.Redis(host='localhost', port=6379, decode_responses=True)

def cached_query(ttl_seconds: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"{func.__name__}:{args}:{kwargs}"
            cached = cache.get(cache_key)
            if cached:
                return json.loads(cached)
            result = await func(*args, **kwargs)
            cache.setex(cache_key, ttl_seconds, json.dumps(result))
            return result
        return wrapper
    return decorator

@cached_query(ttl_seconds=60)
async def get_latest_quotes(tickers: list[str]):
    return await _fetch_quotes(tickers)
```

### 5. Batch Operations

Instead of N queries, use bulk operations:

**Before**: N queries

```python
for ticker in tickers:
    data = db.table("market_data").select("*").eq("ticker", ticker).execute()
    # ❌ N database round-trips
```

**After**: Single query

```python
data = (
    db.table("market_data")
    .select("*")
    .in_("ticker", tickers)  # Single query for all tickers
    .execute()
)
```

### 6. Use SELECT() to Limit Columns

**Before**:

```python
db.table("market_data").select("*").execute()
# ❌ Retrieves all columns including unused ones
```

**After**:

```python
db.table("market_data").select(
    "id,ticker,timestamp,open,high,low,close,volume"
).execute()
# ✅ Only essential columns, smaller payload
```

### 7. Enable Row-Level Security (RLS)

Add RLS policies for security and performance:

```sql
-- Enable RLS on market_data table
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- Service role (engine) bypasses RLS
-- No policy needed for authenticated service role
```

### 8. Monitor Query Performance

Use **Supabase Dashboard** → **Database** → **Query Performance**

Or enable logs:

```python
# In config.py
LOG_LEVEL = "DEBUG"  # Enables query logging
```

### 9. Implement Pagination Correctly

**Keyset Pagination** (better than offset):

```python
class PaginationParams(BaseModel):
    after: int | None = None  # Last ID seen, not offset
    limit: int = Field(100, le=1000)

async def list_market_data(params: PaginationParams, db: SupabaseDB):
    query = db.table("market_data").select("id,ticker,timestamp,close")

    if params.after:
        query = query.gt("id", params.after)

    rows = query.order("id").limit(params.limit + 1).execute()

    has_more = len(rows.data) > params.limit
    data = rows.data[:params.limit]
    next_cursor = data[-1]["id"] if data else None

    return {
        "data": data,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }
```

### 10. Database Maintenance

Schedule regular maintenance:

```python
# Weekly vacuum
-- In Supabase SQL Editor, save as scheduled job:
VACUUM ANALYZE market_data;
VACUUM ANALYZE instruments;

# Monitor table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Monitoring Checklist

- [ ] Indexes created on: ticker, timeframe, timestamp, instrument_id
- [ ] Connection pooling enabled (pool size 25-40)
- [ ] Query performance dashboard monitored
- [ ] RLS enabled on sensitive tables
- [ ] SELECT lists optimized (no SELECT \*)
- [ ] Keyset pagination implemented
- [ ] Batch operations used instead of loops
- [ ] Cache layer evaluated for hot data
- [ ] Vacuum scheduled weekly
- [ ] Slow query log reviewed monthly

---

## Estimated Performance Improvements

| Optimization       | Impact                        | Implementation Time |
| ------------------ | ----------------------------- | ------------------- |
| Connection pooling | 30-40% faster                 | 1 hour              |
| Indexes            | 50-100x faster queries        | 30 min              |
| Keyset pagination  | 10x faster for large datasets | 2 hours             |
| Redis cache        | 100-1000x for cached reads    | 2 hours             |
| Query optimization | 20-50% faster                 | 1 hour              |
| Batch operations   | 5-10x fewer requests          | 1 hour              |

**Total potential: 10-50x performance improvement**

---

## Production Deployment

Before going live:

- [ ] Load test with 1000+ concurrent users
- [ ] Monitor query performance under load
- [ ] Set up alerts for slow queries (>100ms)
- [ ] Configure automatic backups
- [ ] Enable point-in-time recovery
- [ ] Document runbook for common issues
- [ ] Test failover procedures
