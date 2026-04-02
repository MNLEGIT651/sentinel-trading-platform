import { Shield, Lock } from 'lucide-react';

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

        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground/90">
              Evidence-based systematic trading
            </h2>
            <p className="text-sm text-muted-foreground/70">
              A professional-grade platform for quantitative strategy development and execution.
            </p>
          </div>
          <div className="space-y-5">
            {[
              {
                title: 'AI-Powered Signals',
                desc: 'Quantitative strategies with agent orchestration',
              },
              { title: 'Risk Management', desc: 'Multi-layer controls with autonomous guardrails' },
              { title: 'Real-Time Analysis', desc: 'Live market data with regime detection' },
            ].map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <div className="mt-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/80">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
          <Lock className="h-3 w-3" />
          <span>256-bit encryption &middot; SOC 2 aligned &middot; v0.1.0</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-sentinel-in">
          {/* Mobile brand header */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
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
