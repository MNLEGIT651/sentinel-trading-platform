import type { Metadata } from 'next';
import Link from 'next/link';
import { Newsreader, Sora } from 'next/font/google';
import { MarketPulse } from '@/components/shell/market-pulse';
import { Navigation } from '@/components/shell/navigation';
import './globals.css';

const display = Newsreader({
  variable: '--font-display',
  subsets: ['latin'],
});

const body = Sora({
  variable: '--font-body',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Codex Markets OS',
  description:
    'Advanced research-first public markets application with strategy intelligence, governance, and staged deployment controls.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <div className="app-shell">
          <aside className="side-rail">
            <div className="brand-block">
              <Link href="/" className="brand-link">
                <span className="brand-mark">Codex</span>
                <span className="brand-copy">Markets OS</span>
              </Link>
              <p className="brand-note">
                Advanced research operating system built from the blueprint, not from the dashboard
                fantasy.
              </p>
            </div>

            <Navigation />

            <div className="rail-panel">
              <span className="eyebrow">Build standard</span>
              <h3>High-trust by default</h3>
              <p>
                Research integrity, cost realism, and deployment governance are product features,
                not hidden documentation.
              </p>
            </div>
          </aside>

          <div className="content-shell">
            <header className="topbar">
              <div className="topbar-copy">
                <span className="eyebrow">Public markets / research-first system</span>
                <p>
                  Separate implementation in the `Codex` folder with its own runtime, routes, and
                  product thesis.
                </p>
              </div>
              <MarketPulse />
            </header>

            <div className="content-frame">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
