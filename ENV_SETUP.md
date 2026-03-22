# Sentinel Trading Platform — Environment Variables Setup

## Quick Setup

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your credentials
# Use your favorite editor: nano, vim, VSCode, etc.
nano .env
```

## Required Environment Variables

Fill in each of these in your `.env` file:

### Supabase Configuration

```env
# Get from: https://app.supabase.com → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Polygon.io API (Market Data)

```env
# Get from: https://polygon.io/dashboard/api-keys
POLYGON_API_KEY=pk_your_api_key_here
```

### Anthropic Claude AI

```env
# Get from: https://console.anthropic.com/account/keys
ANTHROPIC_API_KEY=sk-ant-v0-your-key-here
```

### Alpaca Trading API

```env
# Get from: https://app.alpaca.markets/paper/settings/keys
ALPACA_API_KEY=your_api_key_here
ALPACA_SECRET_KEY=your_secret_key_here
```

## Optional Environment Variables

These have defaults but can be overridden:

```env
# Engine service (Python FastAPI)
LOG_LEVEL=info           # Options: debug, info, warning, error
PORT=8000                # Change if port conflicts

# Agents service (TypeScript Express)
# NODE_ENV=production    # Set automatically in compose
# PORT=3001              # Change if port conflicts

# Web service (Next.js)
# NODE_ENV=production    # Set automatically in compose
# NEXT_TELEMETRY_DISABLED=1  # Already set in Dockerfile
```

## Where to Find Each Key

### Supabase

1. Go to https://app.supabase.com
2. Select your project
3. Click "Settings" → "API"
4. Find:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### Polygon.io

1. Go to https://polygon.io/dashboard/api-keys
2. Copy your API Key
3. Set `POLYGON_API_KEY`

### Anthropic

1. Go to https://console.anthropic.com/account/keys
2. Create or copy an existing key
3. Set `ANTHROPIC_API_KEY`

### Alpaca

1. Go to https://app.alpaca.markets/paper/settings/keys
2. Copy:
   - API KEY → `ALPACA_API_KEY`
   - SECRET KEY → `ALPACA_SECRET_KEY`

## Validation

### Check if .env is loaded

```bash
# Start containers
docker compose up

# In another terminal, check logs for env vars being read
docker compose logs engine | grep -i "api\|key\|url"
```

### Test connection to external services

```bash
# Test Supabase
docker compose exec engine curl -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  https://your-project.supabase.co/rest/v1/

# Test Polygon.io
docker compose exec engine curl "https://api.polygon.io/v1/marketstatus?apikey=$POLYGON_API_KEY"
```

## Security Best Practices

⚠️ **IMPORTANT**: Follow these to protect your credentials

1. **Never commit .env to Git**
   - ✅ Already in `.gitignore` (should be there)
   - Verify: `git status | grep .env` (should NOT appear)

2. **Keep .env.example without real keys**
   - Use placeholder values
   - Only actual .env has real credentials

3. **Use different keys for dev/prod**
   - Development Alpaca account (paper trading)
   - Production account (if trading real money)
   - Separate Supabase projects

4. **Rotate keys regularly**
   - Change API keys monthly
   - Regenerate secrets after team changes

5. **Never share or expose in logs**
   - Keys should not appear in error messages
   - Check: `docker compose logs | grep -i "sk-\|pk_"`

6. **Use environment variables, not hardcoded values**
   - Already set up in docker-compose.yml
   - All services read from .env

## Troubleshooting

### "ERROR: NEXT_PUBLIC_SUPABASE_URL still contains placeholder value"

- **Cause**: Build validation enabled and URL still has "placeholder"
- **Fix**: Replace with real Supabase URL in .env
- **Or**: Set `VALIDATE_BUILD_ARGS=false` if intentional

### Services can't connect to external APIs

- **Check 1**: Verify .env file is in project root: `ls -la | grep .env`
- **Check 2**: Confirm values are filled (not empty or placeholder)
- **Check 3**: View logs: `docker compose logs engine`
- **Check 4**: Test curl from container: `docker compose exec engine curl https://api.polygon.io/...`

### "Connection refused" on localhost

- **Cause**: Service might not have API key; fails to start
- **Fix**: Check logs: `docker compose logs agents`
- **Check**: All required keys are in .env

### Env vars not being read in container

- **Check**: `docker compose config` shows values? (May show masked in output)
- **Fix**: Restart containers: `docker compose restart`
- **Verify**: `docker compose exec engine env | grep ANTHROPIC`

## Testing Individual Services

Once .env is filled in:

```bash
# Build all services
docker compose build

# Start all
docker compose up

# Test Engine (FastAPI)
curl http://localhost:8000/health

# Test Agents (Express)
curl http://localhost:3001/health

# Test Web (Next.js)
curl http://localhost:3000

# View logs to see if API calls succeed
docker compose logs engine
docker compose logs agents
docker compose logs web
```

## Multi-Environment Setup (Advanced)

For different environments (dev/staging/prod):

```bash
# Create environment-specific files
cp .env .env.development
cp .env .env.staging
cp .env .env.production

# Use specific env file when running
docker compose --env-file .env.production up

# Or set in Docker Compose override
# See: https://docs.docker.com/compose/file-includes/
```

## Production Deployment Notes

- Store .env securely (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate keys before deployment
- Use service accounts (not personal API keys)
- Monitor API usage for unusual activity
- Set up alerts for failed API calls
- Keep backup of active API keys (encrypted)
- Document key rotation schedule

---

**Last Updated**: Docker Optimization Pass  
**Status**: Ready for Configuration
