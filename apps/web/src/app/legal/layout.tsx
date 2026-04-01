import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-foreground">
            Sentinel
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
