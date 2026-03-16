'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Key, Shield, Bell, Palette, Save, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ConnectionStatusPanel,
  type ServiceStatuses,
} from '@/components/settings/connection-status';
import { BrokerSettings } from '@/components/settings/broker-settings';
import { RiskSettings } from '@/components/settings/risk-settings';
import { ScheduleSettings } from '@/components/settings/schedule-settings';
import { ToggleField } from '@/components/settings/toggle-field';

const STORAGE_KEY = 'sentinel:settings';

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
      const data = (await r.json()) as ServiceStatuses;
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
        if (typeof s.requireConfirmation === 'boolean')
          setRequireConfirmation(s.requireConfirmation);
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

      <ConnectionStatusPanel
        serviceStatus={serviceStatus}
        checkingConnections={checkingConnections}
        onCheckConnections={checkConnections}
      />

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

        <TabsContent value="api-keys">
          <BrokerSettings
            polygonKey={polygonKey}
            onPolygonKey={setPolygonKey}
            alpacaKey={alpacaKey}
            onAlpacaKey={setAlpacaKey}
            alpacaSecret={alpacaSecret}
            onAlpacaSecret={setAlpacaSecret}
            anthropicKey={anthropicKey}
            onAnthropicKey={setAnthropicKey}
            supabaseUrl={supabaseUrl}
            onSupabaseUrl={setSupabaseUrl}
            supabaseKey={supabaseKey}
            onSupabaseKey={setSupabaseKey}
          />
        </TabsContent>

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
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">Trading Mode</CardTitle>
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
                <CardTitle className="text-sm font-medium text-foreground">Environment</CardTitle>
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
