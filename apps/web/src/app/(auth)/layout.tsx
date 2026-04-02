import { Shield } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — brand + features (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-gradient-to-br from-primary/10 via-background to-primary/5 border-r border-border p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <span className="font-mono text-sm font-bold tracking-[0.2em] text-foreground/80">
            SENTINEL
          </span>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground/90">
            Evidence-based systematic trading
          </h2>
          <div className="space-y-4">
            {[
              {
                title: 'AI-Powered Signals',
                desc: 'Quantitative strategies with agent orchestration',
              },
              { title: 'Risk Management', desc: 'Multi-layer controls with autonomous guardrails' },
              { title: 'Real-Time Analysis', desc: 'Live market data with regime detection' },
            ].map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground/80">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/50">Sentinel Trading Platform v0.1.0</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-foreground/80">
              SENTINEL
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
