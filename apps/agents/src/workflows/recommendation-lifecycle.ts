/**
 * Recommendation Lifecycle Workflow
 * Steps: risk_check → auto_execution_check → submit_order → confirm_fill
 *
 * After the risk check passes, the auto-execution evaluator determines
 * whether the recommendation can be auto-approved based on the active
 * risk policy. If so the recommendation is approved with actor_type='policy'
 * and proceeds to order submission. Otherwise it stays as pending_approval
 * for an operator.
 */

import { registerWorkflow, createWorkflowJob } from '../workflow-runner.js';
import { EngineClient } from '../engine-client.js';
import { markFilled, markRiskBlocked, atomicApprove } from '../recommendations-store.js';
import { logger } from '../logger.js';
import {
  evaluateAutoExecution,
  fetchActivePolicy,
  fetchSystemControls,
  logAutoExecutionDecision,
} from '../auto-execution.js';
import {
  getActiveExperiment,
  isShadowPhase,
  isExecutionPhase,
  ShadowTracker,
  BoundedExecutor,
} from '../experiment/index.js';

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
          nextStep: 'auto_execution_check',
        };
      },
    },
    {
      name: 'auto_execution_check',
      handler: async (_jobId, input, stepOutput) => {
        const {
          recommendation_id,
          ticker,
          quantity: origQty,
          price,
        } = input as {
          recommendation_id: string;
          ticker: string;
          quantity: number;
          price?: number;
        };
        const adjustedShares = (stepOutput.adjusted_shares as number) ?? origQty;

        // ── Experiment shadow mode: record shadow fill, skip real execution ──
        const experiment = await getActiveExperiment();
        if (experiment && isShadowPhase(experiment)) {
          const tracker = new ShadowTracker(experiment.id);
          const marketPrice = price ?? 100;

          try {
            const shadowOrderId = await tracker.recordShadowFill({
              recommendationId: recommendation_id,
              symbol: ticker,
              side: ((input as Record<string, unknown>).side as 'buy' | 'sell') ?? 'buy',
              quantity: adjustedShares,
              marketPrice,
            });

            logger.info('workflow.shadow_fill.recorded', {
              recommendation_id,
              experimentId: experiment.id,
              shadowOrderId,
              ticker,
              marketPrice,
            });

            return {
              output: {
                auto_executed: false,
                auto_reason: `Shadow mode: recorded hypothetical fill at $${marketPrice}`,
                shadow_order_id: shadowOrderId,
                experiment_phase: 'week1_shadow',
              },
              nextStep: null, // workflow ends — no real execution
            };
          } catch (err) {
            logger.error('workflow.shadow_fill.failed', {
              recommendation_id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // ── Experiment execution mode: use bounded executor ──
        if (experiment && isExecutionPhase(experiment)) {
          const executor = new BoundedExecutor(experiment.id, {
            maxDailyTrades: experiment.max_daily_trades,
            maxPositionValue: experiment.max_position_value,
            signalStrengthThreshold: experiment.signal_strength_threshold,
            maxTotalExposure: experiment.max_total_exposure,
          });

          const evaluation = await executor.evaluate({
            id: recommendation_id,
            signal_strength: (input as Record<string, unknown>).signal_strength as
              | number
              | undefined,
            quantity: adjustedShares,
            price: price ?? null,
            ticker,
          });

          if (!evaluation.allowed) {
            logger.info('workflow.bounded_exec.blocked', {
              recommendation_id,
              experimentId: experiment.id,
              reason: evaluation.reason,
            });

            return {
              output: {
                auto_executed: false,
                auto_reason: `Experiment bounds: ${evaluation.reason}`,
                experiment_phase: 'week2_execution',
                bounded_checks: evaluation.checks,
              },
              nextStep: null,
            };
          }

          // Bounded check passed — proceed to normal auto-execution evaluation
          logger.info('workflow.bounded_exec.passed', {
            recommendation_id,
            experimentId: experiment.id,
          });
        }

        // ── Standard auto-execution evaluation ──

        // Fetch live policy and system controls
        const [policy, systemControls] = await Promise.all([
          fetchActivePolicy(),
          fetchSystemControls(),
        ]);

        if (!policy) {
          logger.info('workflow.auto_execution_check.no_policy', { recommendation_id });
          return {
            output: { auto_executed: false, auto_reason: 'No active risk policy found' },
            nextStep: null, // leave as pending_approval for operator
          };
        }

        const decision = await evaluateAutoExecution(
          {
            id: recommendation_id,
            signal_strength: (input as Record<string, unknown>).signal_strength as
              | number
              | undefined,
            quantity: adjustedShares,
            price: price ?? null,
            ticker,
          },
          policy,
          systemControls,
        );

        // Always log the decision for audit trail
        await logAutoExecutionDecision(recommendation_id, decision);

        if (decision.canAutoExecute) {
          // Auto-approve the recommendation
          const claimed = await atomicApprove(recommendation_id);
          if (!claimed) {
            logger.warn('workflow.auto_execution_check.claim_failed', { recommendation_id });
            return {
              output: {
                auto_executed: false,
                auto_reason: 'Could not claim recommendation for auto-approval',
              },
              nextStep: null,
            };
          }

          logger.info('workflow.auto_execution_check.approved', {
            recommendation_id,
            policyVersion: decision.policyVersion,
            reason: decision.reason,
          });

          return {
            output: {
              auto_executed: true,
              auto_reason: decision.reason,
              policy_version: decision.policyVersion,
              auto_checks: decision.checks,
            },
            nextStep: 'submit_order',
          };
        }

        // Cannot auto-execute — leave pending for operator
        logger.info('workflow.auto_execution_check.denied', {
          recommendation_id,
          reason: decision.reason,
          policyVersion: decision.policyVersion,
        });

        return {
          output: {
            auto_executed: false,
            auto_reason: decision.reason,
            policy_version: decision.policyVersion,
            auto_checks: decision.checks,
          },
          nextStep: null, // workflow ends; operator must approve manually
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

        // Record to experiment_orders if an experiment is in execution phase
        const experiment = await getActiveExperiment();
        if (experiment && isExecutionPhase(experiment)) {
          const executor = new BoundedExecutor(experiment.id, {
            maxDailyTrades: experiment.max_daily_trades,
            maxPositionValue: experiment.max_position_value,
            signalStrengthThreshold: experiment.signal_strength_threshold,
            maxTotalExposure: experiment.max_total_exposure,
          });
          try {
            await executor.recordExecution({
              recommendationId: recommendation_id,
              symbol: ticker,
              side,
              quantity,
              orderType: 'market',
              brokerOrderId: order.order_id,
              fillPrice: order.fill_price ?? undefined,
              fillQuantity: order.fill_quantity ?? undefined,
              status: order.status,
            });
          } catch (err) {
            logger.warn('workflow.submit_order.experiment_record_failed', {
              recommendation_id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

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
