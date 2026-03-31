'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function CollapsibleJson({ label, data }: { label: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-900/50 p-2 text-xs text-gray-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
