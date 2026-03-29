import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-xl rounded-xl border border-warning/30 bg-warning/5 p-6">
        <div className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Page not found
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center rounded-md bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
