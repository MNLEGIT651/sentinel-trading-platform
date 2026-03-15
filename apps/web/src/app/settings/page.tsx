'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Key,
  Server,
  Shield,
  Bell,
  Palette,
  Save,
  Check,
  AlertTriangle,
  Globe,
  Database,
  Bot,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────

type ServiceStatus = 'connected' | 'disconnected' | 'not_configured' | 'checking';

interface ServiceStatuses {
  engine: ServiceStatus;
  polygon: ServiceStatus;
  supabase: ServiceStatus;
  anthropic: ServiceStatus;
  alpaca: ServiceStatus;
}

const STORAGE_KEY = 'sentinel:settings';

// ── Input field helper ────────────────────────────────────────────────

function SettingsField({
  label,
  description,
  value,
  onChange,
  type = 'text',
  placeholder,
  masked = false,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  masked?: boolean;
}) {
  const [showValue, setShowValue] = useState(!masked);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {masked && (
          <button
            onClick={() => setShowValue((v) => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showValue ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <input
        type={masked && !showValue ? 'password' : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between py-2">
      <div className="space-y-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  );
}

// ── Status indicator ──────────────────────────────────────────────────

function ConnectionStatus({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: React.ElementType;
  status: ServiceStatus;
}) {
  const config: Record<ServiceStatus, { color: string; badge: string; text: string }> = {
    connected: {
      color: 'text-profit',
      badge: 'bg-profit/15 text-profit border-profit/30',
      text: 'Connected',
    },
    disconnected: {
      color: 'text-loss',
      badge: 'bg-loss/15 text-loss border-loss/30',
      text: 'Disconnected',
    },
    not_configured: {
      color: 'text-amber-400',
      badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      text: 'Not Configured',
    },
    checking: {
      color: 'text-muted-foreground',
      badge: 'bg-muted/30 text-muted-foreground border-border',
      text: 'Checking…',
    },
  };

  const c = config[status];

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2.5">
        {status === 'checking' ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <Icon className={cn('h-4 w-4', c.color)} />
        )}
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <Badge className={cn('border text-[10px]', c.badge)}>{c.text}</Badge>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [checkingConnections, setCheckingConnections] = useState(false);

  const [serviceStatus, setServiceStatus] = useState<ServiceStatuses>({
    engine: 'checking',
    polygon: 'checking',
    supabase: 'checking',
    anthropic: 'checking',
    alpaca: 'checking',
  });

  // API Keys
  const [polygonKey, setPolygonKey] = useState('');
  const [alpacaKey, setAlpacaKey] = useState('');
  const [alpacaSecret, setAlpacaSecret] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  // Risk settings
  const [maxPosition, setMaxPosition] = useState('5');
  const [maxSector, setMaxSector] = useState('20');
  const [dailyLossLimit, setDailyLossLimit] = useState('2');
  const [softDrawdown, setSoftDrawdown] = useState('10');
  const [hardDrawdown, setHardDrawdown] = useState('15');
  const [maxPositions, setMaxPositions] = useState('20');

  // Notification preferences
  const [alertCritical, setAlertCritical] = useState(true);
  const [alertWarning, setAlertWarning] = useState(true);
  const [alertInfo, setAlertInfo] = useState(false);
  const [alertSound, setAlertSound] = useState(true);
  const [agentNotifications, setAgentNotifications] = useState(true);
  const [tradeNotifications, setTradeNotifications] = useState(true);

  // Trading
  const [paperMode, setPaperMode] = useState(true);
  const [autoTrading, setAutoTrading] = useState(false);
  const [requireConfirmation, setRequireConfirmation] = useState(true);

  const checkConnections = useCallback(async () => {
    setCheckingConnections(true);
    try {
      const r = await fetch('/api/settings/status');
      const data = await r.json() as ServiceStatuses;
      setServiceStatus(data);
    } catch {
      setServiceStatus({
        engine: 'disconnected',
        polygon: 'not_configured',
        supabase: 'not_configured',
        anthropic: 'not_configured',
        alpaca: 'not_configured',
      });
    } finally {
      setCheckingConnections(false);
    }
  }, []);

  // Load persisted settings from localStorage and fetch real service status
  useEffect(() => {
    // Hydrate fields from localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.polygonKey === 'string') setPolygonKey(s.polygonKey);
        if (typeof s.alpacaKey === 'string') setAlpacaKey(s.alpacaKey);
        if (typeof s.alpacaSecret === 'string') setAlpacaSecret(s.alpacaSecret);
        if (typeof s.anthropicKey === 'string') setAnthropicKey(s.anthropicKey);
        if (typeof s.supabaseUrl === 'string') setSupabaseUrl(s.supabaseUrl);
        if (typeof s.supabaseKey === 'string') setSupabaseKey(s.supabaseKey);
        if (typeof s.maxPosition === 'string') setMaxPosition(s.maxPosition);
        if (typeof s.maxSector === 'string') setMaxSector(s.maxSector);
        if (typeof s.dailyLossLimit === 'string') setDailyLossLimit(s.dailyLossLimit);
        if (typeof s.softDrawdown === 'string') setSoftDrawdown(s.softDrawdown);
        if (typeof s.hardDrawdown === 'string') setHardDrawdown(s.hardDrawdown);
        if (typeof s.maxPositions === 'string') setMaxPositions(s.maxPositions);
        if (typeof s.alertCritical === 'boolean') setAlertCritical(s.alertCritical);
        if (typeof s.alertWarning === 'boolean') setAlertWarning(s.alertWarning);
        if (typeof s.alertInfo === 'boolean') setAlertInfo(s.alertInfo);
        if (typeof s.alertSound === 'boolean') setAlertSound(s.alertSound);
        if (typeof s.agentNotifications === 'boolean') setAgentNotifications(s.agentNotifications);
        if (typeof s.tradeNotifications === 'boolean') setTradeNotifications(s.tradeNotifications);
        if (typeof s.paperMode === 'boolean') setPaperMode(s.paperMode);
        if (typeof s.autoTrading === 'boolean') setAutoTrading(s.autoTrading);
        if (typeof s.requireConfirmation === 'boolean') setRequireConfirmation(s.requireConfirmation);
      }
    } catch {
      // Ignore corrupt storage
    }

    checkConnections();
  }, [checkConnections]);

  const handleSave = () => {
    // Persist all settings to localStorage
    const settings = {
      polygonKey,
      alpacaKey,
      alpacaSecret,
      anthropicKey,
      supabaseUrl,
      supabaseKey,
      maxPosition,
      maxSector,
      dailyLossLimit,
      softDrawdown,
      hardDrawdown,
      maxPositions,
      alertCritical,
      alertWarning,
      alertInfo,
      alertSound,
      agentNotifications,
      tradeNotifications,
      paperMode,
      autoTrading,
      requireConfirmation,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">
              Configure API keys, risk parameters, and preferences
            </p>
          </div>
        </div>
        <Button onClick={handleSave} size="sm">
          {saved ? (
            <>
              <Check className="h-4 w-4 text-profit" />
              <span className="ml-1.5">Saved</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span className="ml-1.5">Save Changes</span>
            </>
          )}
        </Button>
      </div>

      {/* Connection Status */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Service Status
            </CardTitle>
            <button
              onClick={checkConnections}
              disabled={checkingConnections}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', checkingConnections && 'animate-spin')} />
              {checkingConnections ? 'Checking...' : 'Test'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <ConnectionStatus icon={Server} label="Quant Engine (FastAPI)" status={serviceStatus.engine} />
          <ConnectionStatus icon={Globe} label="Polygon.io Market Data" status={serviceStatus.polygon} />
          <ConnectionStatus icon={Database} label="Supabase Database" status={serviceStatus.supabase} />
          <ConnectionStatus icon={Bot} label="Claude AI (Anthropic)" status={serviceStatus.anthropic} />
          <ConnectionStatus icon={Shield} label="Alpaca Broker" status={serviceStatus.alpaca} />
        </CardContent>
      </Card>

      <Tabs defaultValue="api-keys" className="space-y-3">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="api-keys">
            <Key className="h-3.5 w-3.5 mr-1.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="risk">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Risk
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-3.5 w-3.5 mr-1.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="trading">
            <Palette className="h-3.5 w-3.5 mr-1.5" />
            Trading
          </TabsTrigger>
        </TabsList>

        {/* ── API Keys ─────────────────────────────────────────────── */}
        <TabsContent value="api-keys">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  <CardTitle className="text-sm font-medium text-foreground">
                    Market Data
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingsField
                  label="Polygon.io API Key"
                  description="Required for real-time and historical market data."
                  value={polygonKey}
                  onChange={setPolygonKey}
                  placeholder="Enter your Polygon.io API key"
                  masked
                />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <CardTitle className="text-sm font-medium text-foreground">
                    Broker (Alpaca)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingsField
                  label="Alpaca API Key"
                  description="Paper or live trading API key."
                  value={alpacaKey}
                  onChange={setAlpacaKey}
                  placeholder="Enter Alpaca API key"
                  masked
                />
                <SettingsField
                  label="Alpaca Secret Key"
                  value={alpacaSecret}
                  onChange={setAlpacaSecret}
                  placeholder="Enter Alpaca secret key"
                  masked
                />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-violet-400" />
                  <CardTitle className="text-sm font-medium text-foreground">
                    AI (Anthropic)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingsField
                  label="Anthropic API Key"
                  description="Required for AI agent functionality (Claude)."
                  value={anthropicKey}
                  onChange={setAnthropicKey}
                  placeholder="sk-ant-..."
                  masked
                />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-sky-400" />
                  <CardTitle className="text-sm font-medium text-foreground">
                    Database (Supabase)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingsField
                  label="Supabase URL"
                  description="Your Supabase project URL."
                  value={supabaseUrl}
                  onChange={setSupabaseUrl}
                  placeholder="https://your-project.supabase.co"
                />
                <SettingsField
                  label="Supabase Service Role Key"
                  value={supabaseKey}
                  onChange={setSupabaseKey}
                  placeholder="Enter service role key"
                  masked
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Risk Parameters ──────────────────────────────────────── */}
        <TabsContent value="risk">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">
                  Position Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingsField
                  label="Max Position Size (%)"
                  description="Maximum percentage of portfolio for a single position."
                  value={maxPosition}
                  onChange={setMaxPosition}
                  type="number"
                />
                <SettingsField
                  label="Max Sector Exposure (%)"
                  description="Maximum allocation to any one sector."
                  value={maxSector}
                  onChange={setMaxSector}
                  type="number"
                />
                <SettingsField
                  label="Max Open Positions"
                  description="Maximum number of concurrent positions."
                  value={maxPositions}
                  onChange={setMaxPositions}
                  type="number"
                />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-sm font-medium text-foreground">
                    Circuit Breakers
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingsField
                  label="Daily Loss Limit (%)"
                  description="Halt trading when daily loss exceeds this threshold."
                  value={dailyLossLimit}
                  onChange={setDailyLossLimit}
                  type="number"
                />
                <SettingsField
                  label="Soft Drawdown Halt (%)"
                  description="Reduce position sizes when drawdown hits this level."
                  value={softDrawdown}
                  onChange={setSoftDrawdown}
                  type="number"
                />
                <SettingsField
                  label="Hard Drawdown Halt (%)"
                  description="Liquidate all positions at this drawdown level."
                  value={hardDrawdown}
                  onChange={setHardDrawdown}
                  type="number"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <TabsContent value="notifications">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">
                Alert Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 divide-y divide-border/50">
              <ToggleField
                label="Critical Alerts"
                description="Risk limit breaches, circuit breaker activations, system failures."
                checked={alertCritical}
                onChange={setAlertCritical}
              />
              <ToggleField
                label="Warning Alerts"
                description="Approaching limits, unusual market conditions, high volatility."
                checked={alertWarning}
                onChange={setAlertWarning}
              />
              <ToggleField
                label="Info Alerts"
                description="Strategy signals, agent scan completions, routine updates."
                checked={alertInfo}
                onChange={setAlertInfo}
              />
              <ToggleField
                label="Sound Notifications"
                description="Play audio alerts for critical events."
                checked={alertSound}
                onChange={setAlertSound}
              />
              <ToggleField
                label="Agent Notifications"
                description="Notifications when AI agents complete their analysis cycles."
                checked={agentNotifications}
                onChange={setAgentNotifications}
              />
              <ToggleField
                label="Trade Notifications"
                description="Alert on order submissions, fills, and cancellations."
                checked={tradeNotifications}
                onChange={setTradeNotifications}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Trading ──────────────────────────────────────────────── */}
        <TabsContent value="trading">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">
                  Trading Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 divide-y divide-border/50">
                <ToggleField
                  label="Paper Trading Mode"
                  description="Use simulated orders instead of real broker. Recommended during development."
                  checked={paperMode}
                  onChange={setPaperMode}
                />
                <ToggleField
                  label="Auto Trading"
                  description="Allow agents to submit orders automatically. When off, orders require manual approval."
                  checked={autoTrading}
                  onChange={setAutoTrading}
                />
                <ToggleField
                  label="Require Confirmation"
                  description="Show confirmation dialog before executing trades."
                  checked={requireConfirmation}
                  onChange={setRequireConfirmation}
                />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">
                  Environment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <div className="bg-muted/30 px-3 py-1.5">
                    <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      System Information
                    </p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {[
                      ['Platform', 'Sentinel Trading v0.1.0'],
                      ['Engine', 'FastAPI (Python 3.14)'],
                      ['Dashboard', 'Next.js 15 + React 19'],
                      ['Agents', 'Claude SDK (TypeScript)'],
                      ['Database', 'Supabase (PostgreSQL 15)'],
                      ['Broker', 'Alpaca Markets API'],
                      ['Market Data', 'Polygon.io REST + WebSocket'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-xs font-mono text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
