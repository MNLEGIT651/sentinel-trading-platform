'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Settings, Shield, Bell, Activity, Lock, Save, Check, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { LoadingButton } from '@/components/ui/loading-button';
import { ErrorState } from '@/components/ui/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  ConnectionStatusPanel,
  type ServiceStatuses,
} from '@/components/settings/connection-status';
import { markPageVisited } from '@/components/dashboard/setup-progress';
import { TOAST_DURATION } from '@/lib/constants';
import { RiskSettings } from '@/components/settings/risk-settings';
import { ScheduleSettings } from '@/components/settings/schedule-settings';
import { SecuritySettings } from '@/components/settings/security-settings';
import { ToggleField } from '@/components/settings/toggle-field';
import { useTradingPolicy, policyValue } from '@/hooks/use-trading-policy';
import { useSystemControlsQuery } from '@/hooks/queries/use-system-controls-query';

/** localStorage key for notification preferences (UI-only, not policy). */
const NOTIFICATION_STORAGE_KEY = 'sentinel:notification-prefs';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [activeTab, setActiveTab] = useState('risk');

  const [serviceStatus, setServiceStatus] = useState<ServiceStatuses>({
    engine: 'checking',
    agents: 'checking',
    polygon: 'checking',
    supabase: 'checking',
    anthropic: 'checking',
    alpaca: 'checking',
  });

  // ── Server-backed trading policy ────────────────────────────────────
  const {
    policy,
    loading: policyLoading,
    saving: policySaving,
    error: policyError,
    updatePolicy,
  } = useTradingPolicy();

  // ── Server-backed system controls (read-only on this page) ─────────
  const { data: systemControls } = useSystemControlsQuery();

  // Local form state mirrors the DB policy, updated on load
  const [maxPosition, setMaxPosition] = useState('5');
  const [maxSector, setMaxSector] = useState('20');
  const [dailyLossLimit, setDailyLossLimit] = useState('2');
  const [softDrawdown, setSoftDrawdown] = useState('10');
  const [hardDrawdown, setHardDrawdown] = useState('15');
  const [maxPositions, setMaxPositions] = useState('20');
  const [paperMode, setPaperMode] = useState(true);
  const [autoTrading, setAutoTrading] = useState(false);
  const [requireConfirmation, setRequireConfirmation] = useState(true);

  // Sync form state when policy loads from server
  useEffect(() => {
    if (policy) {
      setMaxPosition(String(policyValue(policy, 'max_position_pct')));
      setMaxSector(String(policyValue(policy, 'max_sector_pct')));
      setDailyLossLimit(String(policyValue(policy, 'daily_loss_limit_pct')));
      setSoftDrawdown(String(policyValue(policy, 'soft_drawdown_pct')));
      setHardDrawdown(String(policyValue(policy, 'hard_drawdown_pct')));
      setMaxPositions(String(policyValue(policy, 'max_open_positions')));
      setPaperMode(policyValue(policy, 'paper_trading'));
      setAutoTrading(policyValue(policy, 'auto_trading'));
      setRequireConfirmation(policyValue(policy, 'require_confirmation'));
    }
  }, [policy]);

  // ── Notification preferences (localStorage only) ───────────────────
  const [alertCritical, setAlertCritical] = useState(true);
  const [alertWarning, setAlertWarning] = useState(true);
  const [alertInfo, setAlertInfo] = useState(false);
  const [alertSound, setAlertSound] = useState(true);
  const [agentNotifications, setAgentNotifications] = useState(true);
  const [tradeNotifications, setTradeNotifications] = useState(true);

  const checkConnections = useCallback(async () => {
    setCheckingConnections(true);
    try {
      const r = await fetch('/api/settings/status');
      const data = (await r.json()) as ServiceStatuses;
      setServiceStatus(data);
    } catch {
      setServiceStatus({
        engine: 'disconnected',
        agents: 'disconnected',
        polygon: 'not_configured',
        supabase: 'not_configured',
        anthropic: 'not_configured',
        alpaca: 'not_configured',
      });
    } finally {
      setCheckingConnections(false);
    }
  }, []);

  useEffect(() => {
    markPageVisited('settings');
  }, []);

  // Load notification preferences from localStorage + check connections
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.alertCritical === 'boolean') setAlertCritical(s.alertCritical);
        if (typeof s.alertWarning === 'boolean') setAlertWarning(s.alertWarning);
        if (typeof s.alertInfo === 'boolean') setAlertInfo(s.alertInfo);
        if (typeof s.alertSound === 'boolean') setAlertSound(s.alertSound);
        if (typeof s.agentNotifications === 'boolean') setAgentNotifications(s.agentNotifications);
        if (typeof s.tradeNotifications === 'boolean') setTradeNotifications(s.tradeNotifications);
      } else {
        // Migrate old combined storage → notification prefs only
        const legacy = localStorage.getItem('sentinel:settings');
        if (legacy) {
          const s = JSON.parse(legacy) as Record<string, unknown>;
          if (typeof s.alertCritical === 'boolean') setAlertCritical(s.alertCritical);
          if (typeof s.alertWarning === 'boolean') setAlertWarning(s.alertWarning);
          if (typeof s.alertInfo === 'boolean') setAlertInfo(s.alertInfo);
          if (typeof s.alertSound === 'boolean') setAlertSound(s.alertSound);
          if (typeof s.agentNotifications === 'boolean')
            setAgentNotifications(s.agentNotifications);
          if (typeof s.tradeNotifications === 'boolean')
            setTradeNotifications(s.tradeNotifications);
        }
      }
    } catch {
      // Ignore corrupt storage
    }

    checkConnections();
  }, [checkConnections]);

  const handleSave = async () => {
    // Save notification preferences to localStorage
    const notificationPrefs = {
      alertCritical,
      alertWarning,
      alertInfo,
      alertSound,
      agentNotifications,
      tradeNotifications,
    };
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notificationPrefs));

    // Save policy to server
    const success = await updatePolicy({
      max_position_pct: Number(maxPosition),
      max_sector_pct: Number(maxSector),
      daily_loss_limit_pct: Number(dailyLossLimit),
      soft_drawdown_pct: Number(softDrawdown),
      hard_drawdown_pct: Number(hardDrawdown),
      max_open_positions: Number(maxPositions),
      paper_trading: paperMode,
      auto_trading: autoTrading,
      require_confirmation: requireConfirmation,
    });

    if (success) {
      // Clean up old combined localStorage key
      localStorage.removeItem('sentinel:settings');
      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), TOAST_DURATION);
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-4 px-4 py-3 md:p-4 page-enter">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-heading-page text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">
                Service connections, risk parameters, and preferences
              </p>
            </div>
          </div>
          <LoadingButton
            onClick={handleSave}
            size="sm"
            loading={policySaving}
            disabled={policyLoading}
            aria-label="Save settings"
          >
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
          </LoadingButton>
        </div>

        {policyError && <ErrorState variant="inline" title="Policy Error" message={policyError} />}

        <ConnectionStatusPanel
          serviceStatus={serviceStatus}
          checkingConnections={checkingConnections}
          onCheckConnections={checkConnections}
        />

        {policyLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Spinner size="md" className="mr-2" />
            <span className="text-sm">Loading settings…</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 px-4 md:px-0">
            <div className="md:hidden">
              <div className="-mx-3 overflow-x-auto px-3 pb-1 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div
                  role="tablist"
                  aria-label="Settings categories"
                  className="inline-flex min-w-full gap-2"
                >
                  {[
                    { value: 'risk', label: 'Risk', icon: Shield },
                    { value: 'notifications', label: 'Alerts', icon: Bell },
                    { value: 'trading', label: 'Trading', icon: Activity },
                    { value: 'security', label: 'Security', icon: Lock },
                  ].map(({ value, label, icon: Icon }) => {
                    const isActive = activeTab === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(value)}
                        className={cn(
                          'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <TabsList className="hidden w-full bg-muted/50 md:inline-flex md:w-fit">
              <TabsTrigger value="risk" className="gap-1 text-xs sm:text-sm">
                <Shield className="h-3.5 w-3.5" />
                <span className="sm:inline">Risk</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1 text-xs sm:text-sm">
                <Bell className="h-3.5 w-3.5" />
                <span className="sm:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="trading" className="gap-1 text-xs sm:text-sm">
                <Activity className="h-3.5 w-3.5" />
                <span className="sm:inline">Trading</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-1 text-xs sm:text-sm">
                <Lock className="h-3.5 w-3.5" />
                <span className="sm:inline">Security</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="risk">
              <RiskSettings
                maxPosition={maxPosition}
                onMaxPosition={setMaxPosition}
                maxSector={maxSector}
                onMaxSector={setMaxSector}
                dailyLossLimit={dailyLossLimit}
                onDailyLossLimit={setDailyLossLimit}
                softDrawdown={softDrawdown}
                onSoftDrawdown={setSoftDrawdown}
                hardDrawdown={hardDrawdown}
                onHardDrawdown={setHardDrawdown}
                maxPositions={maxPositions}
                onMaxPositions={setMaxPositions}
              />
            </TabsContent>

            <TabsContent value="notifications">
              <ScheduleSettings
                alertCritical={alertCritical}
                onAlertCritical={setAlertCritical}
                alertWarning={alertWarning}
                onAlertWarning={setAlertWarning}
                alertInfo={alertInfo}
                onAlertInfo={setAlertInfo}
                alertSound={alertSound}
                onAlertSound={setAlertSound}
                agentNotifications={agentNotifications}
                onAgentNotifications={setAgentNotifications}
                tradeNotifications={tradeNotifications}
                onTradeNotifications={setTradeNotifications}
              />
            </TabsContent>

            {/* ── Trading ──────────────────────────────────────────────── */}
            <TabsContent value="trading">
              {/* System-wide mode banner */}
              {systemControls && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-3">
                  <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                    System-wide mode is{' '}
                    <span className="font-semibold text-foreground">
                      {systemControls.global_mode.toUpperCase()}
                    </span>
                    {systemControls.trading_halted && (
                      <span className="text-red-500 font-semibold"> (HALTED)</span>
                    )}
                    . This is managed on the{' '}
                    <a
                      href="/system-controls"
                      className="underline text-primary hover:text-primary/80"
                    >
                      System Controls
                    </a>{' '}
                    page and takes precedence over per-user settings below.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 stagger-grid">
                <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
                      Trading Mode
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 divide-y divide-border/25">
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

                <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
                      Environment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="overflow-hidden rounded-md border border-border/30">
                      <div className="bg-muted/30 px-3 py-1.5">
                        <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                          System Information
                        </p>
                      </div>
                      <div className="divide-y divide-border/25">
                        {[
                          ['Platform', 'Sentinel Trading v0.1.0'],
                          ['Engine', 'FastAPI (Python 3.12)'],
                          ['Dashboard', 'Next.js 16 + React 19'],
                          ['Agents', 'Claude SDK (TypeScript)'],
                          ['Database', 'Supabase (PostgreSQL 15)'],
                          ['Broker', 'Alpaca Markets API'],
                          ['Market Data', 'Polygon.io REST + WebSocket'],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                          >
                            <span className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                              {label}
                            </span>
                            <span className="text-sm font-mono leading-relaxed text-foreground sm:text-right sm:text-[0.9375rem]">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2">
                      <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                        API keys are configured via environment variables in{' '}
                        <code className="font-mono text-foreground">.env</code>. Risk limits and
                        trading mode are saved to the database and synced across devices.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="security">
              <SecuritySettings />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ErrorBoundary>
  );
}
