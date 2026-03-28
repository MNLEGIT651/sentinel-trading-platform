/**
 * OpenTelemetry bootstrap for the Sentinel Agents service.
 *
 * Opt-in via OTEL_ENABLED=true. When enabled, the SDK auto-instruments
 * Express, HTTP, and other Node.js libraries. A ConsoleSpanExporter is
 * used by default; swap in the OTLP exporter for production collectors.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

const otelEnabled = process.env.OTEL_ENABLED === 'true';

let sdk: NodeSDK | null = null;

export function initTelemetry(): void {
  if (!otelEnabled) return;

  sdk = new NodeSDK({
    serviceName: 'sentinel-agents',
    traceExporter: new ConsoleSpanExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
}

export function shutdownTelemetry(): Promise<void> {
  return sdk?.shutdown() ?? Promise.resolve();
}
