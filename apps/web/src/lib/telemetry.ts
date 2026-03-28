// Server-side OpenTelemetry initialization for Next.js
// Only runs on the server (Node.js runtime)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

const otelEnabled = process.env.OTEL_ENABLED === 'true';

export function initTelemetry(): void {
  if (!otelEnabled || typeof window !== 'undefined') return;
  const sdk = new NodeSDK({
    serviceName: 'sentinel-web',
    traceExporter: new ConsoleSpanExporter(),
  });
  sdk.start();
}
