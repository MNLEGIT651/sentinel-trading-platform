'use client';

import { Globe, Shield, Bot, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

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
            aria-label={showValue ? 'Hide value' : 'Show value'}
          >
            {showValue ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
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

interface BrokerSettingsProps {
  polygonKey: string;
  onPolygonKey: (v: string) => void;
  alpacaKey: string;
  onAlpacaKey: (v: string) => void;
  alpacaSecret: string;
  onAlpacaSecret: (v: string) => void;
  anthropicKey: string;
  onAnthropicKey: (v: string) => void;
  supabaseUrl: string;
  onSupabaseUrl: (v: string) => void;
  supabaseKey: string;
  onSupabaseKey: (v: string) => void;
}

export function BrokerSettings({
  polygonKey,
  onPolygonKey,
  alpacaKey,
  onAlpacaKey,
  alpacaSecret,
  onAlpacaSecret,
  anthropicKey,
  onAnthropicKey,
  supabaseUrl,
  onSupabaseUrl,
  supabaseKey,
  onSupabaseKey,
}: BrokerSettingsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-foreground">Market Data</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField
            label="Polygon.io API Key"
            description="Required for real-time and historical market data."
            value={polygonKey}
            onChange={onPolygonKey}
            placeholder="Enter your Polygon.io API key"
            masked
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            <CardTitle className="text-sm font-medium text-foreground">Broker (Alpaca)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField
            label="Alpaca API Key"
            description="Paper or live trading API key."
            value={alpacaKey}
            onChange={onAlpacaKey}
            placeholder="Enter Alpaca API key"
            masked
          />
          <SettingsField
            label="Alpaca Secret Key"
            value={alpacaSecret}
            onChange={onAlpacaSecret}
            placeholder="Enter Alpaca secret key"
            masked
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-400" />
            <CardTitle className="text-sm font-medium text-foreground">AI (Anthropic)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField
            label="Anthropic API Key"
            description="Required for AI agent functionality (Claude)."
            value={anthropicKey}
            onChange={onAnthropicKey}
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
            onChange={onSupabaseUrl}
            placeholder="https://your-project.supabase.co"
          />
          <SettingsField
            label="Supabase Service Role Key"
            value={supabaseKey}
            onChange={onSupabaseKey}
            placeholder="Enter service role key"
            masked
          />
        </CardContent>
      </Card>
    </div>
  );
}
