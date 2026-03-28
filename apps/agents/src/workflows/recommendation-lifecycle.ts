/**
 * Recommendation Lifecycle Workflow
 * Steps: risk_check → submit_order → confirm_fill
 */

import { registerWorkflow, createWorkflowJob } from '../workflow-runner.js';
import { EngineClient } from '../engine-client.js';
import { markFilled, markRiskBlocked } from '../recommendations-store.js';
import { logger } from '../logger.js';

const engineClient = new EngineClient();

registerWorkflow({
  type: 'recommendation_lifecycle',
  steps: [
    {
      name: 'risk_check',
      handler: async (_jobId, input) => {
        const { recommendation_id, ticker, side, quantity, price } = input as {
          recommendation_id: string;
          ticker: string;
          side: 'buy' | 'sell';
          quantity: number;
          price?: number;
        };

        // Fetch live portfolio state required by pre-trade check
        const [account, positions] = await Promise.all([
          engineClient.getAccount(),
          engineClient.getPositions(),
        ]);

        const positionMap: Record<string, number> = {};
        const sectorMap: Record<string, string> = {};
        for (const p of positions) {
          positionMap[p.instrument_id] = p.quantity;
        }

        const result = await engineClient.preTradeCheck({
          ticker,
          shares: quantity,
          price: price ?? (account.equity > 0 ? 100 : 100),
          side,
          equity: account.equity,
          cash: account.cash,
          peak_equity: account.equity, // best available approximation
          daily_starting_equity: account.equity,
          positions: positionMap,
          position_sectors: sectorMap,
        });

        if (!result.allowed) {
          await markRiskBlocked(recommendation_id, result.reason ?? 'Risk check failed');
          logger.info('workflow.risk_check.blocked', { recommendation_id, reason: result.reason });
          return {
            output: { risk_allowed: false, risk_reason: result.reason },
            nextStep: null, // workflow ends
          };
        }

        return {
          output: {
            risk_allowed: true,
            adjusted_shares: result.adjusted_shares ?? quantity,
            risk_reason: result.reason,
          },
          nextStep: 'submit_order',
        };
      },
    },
    {
      name: 'submit_order',
      handler: async (_jobId, input, stepOutput) => {
        const { recommendation_id, ticker, side } = input as {
          recommendation_id: string;
          ticker: string;
          side: 'buy' | 'sell';
        };
        const quantity = (stepOutput.adjusted_shares as number) ?? (input.quantity as number);

        const order = await engineClient.submitOrder({
          symbol: ticker,
          side,
          order_type: 'market',
          quantity,
          time_in_force: 'day',
        });

        logger.info('workflow.submit_order.done', {
          recommendation_id,
          order_id: order.order_id,
          status: order.status,
        });

        return {
          output: {
            order_id: order.order_id,
            order_status: order.status,
            fill_price: order.fill_price,
          },
          nextStep: 'confirm_fill',
        };
      },
    },
    {
      name: 'confirm_fill',
      handler: async (_jobId, input, stepOutput) => {
        const recommendationId = input.recommendation_id as string;
        const orderId = stepOutput.order_id as string;

        if (orderId) {
          await markFilled(recommendationId, orderId);
          logger.info('workflow.confirm_fill.done', { recommendationId, orderId });
        }

        return {
          output: { filled: true },
          nextStep: null,
        };
      },
    },
  ],
});

/** Helper to kick off a recommendation lifecycle workflow. */
export async function startRecommendationWorkflow(params: {
  recommendationId: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
}): Promise<string | null> {
  return createWorkflowJob({
    workflowType: 'recommendation_lifecycle',
    idempotencyKey: `rec-${params.recommendationId}`,
    inputData: {
      recommendation_id: params.recommendationId,
      ticker: params.ticker,
      side: params.side,
      quantity: params.quantity,
      price: params.price,
    },
    recommendationId: params.recommendationId,
  });
}
