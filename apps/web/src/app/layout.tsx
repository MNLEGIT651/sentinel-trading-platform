import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, DM_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  title: {
    default: 'Sentinel Trading Platform',
    template: '%s | Sentinel',
  },
  description: 'Autonomous stock trading command center',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Sentinel Trading Platform',
    description: 'Autonomous stock trading command center',
    type: 'website',
    siteName: 'Sentinel',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sentinel Trading Platform',
    description: 'Autonomous stock trading command center',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <QueryProvider>{children}</QueryProvider>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
