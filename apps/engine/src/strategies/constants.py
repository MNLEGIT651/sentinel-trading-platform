"""Named constants for strategy signal strength calculations.

Each constant controls how raw indicator values are normalized into a
[0, 1] signal strength. Documenting their purpose here makes tuning
explicit rather than hidden in arithmetic expressions.
"""

# ── RSI Momentum ────────────────────────────────────────────────────

# The RSI range used to normalize the depth of oversold/overbought
# penetration into a [0, 1] scale. RSI theoretically ranges 0–100,
# but the practical range beyond the threshold is roughly 0–30 points,
# so dividing by 30 maps that depth to approximately [0, 1].
RSI_NORMALIZATION_RANGE = 30.0

# Baseline signal strength for RSI recovery/reversal signals.
# Even a shallow crossover of the oversold/overbought threshold
# should produce a meaningful signal, so we start at 0.3.
RSI_BASELINE_STRENGTH = 0.3

# ── Rate of Change Momentum ────────────────────────────────────────

# ROC strength is calculated as current_roc / (threshold * multiplier).
# A multiplier of 3 means ROC must be 3× the threshold to reach
# maximum strength (1.0). This prevents weak momentum from scoring high.
ROC_STRENGTH_MULTIPLIER = 3

# ── OBV Divergence ──────────────────────────────────────────────────

# Scales the OBV percentage change into signal strength.
# A multiplier of 5 means a 20% OBV divergence maps to strength 1.0.
OBV_DIVERGENCE_STRENGTH_MULTIPLIER = 5

# Floor for OBV divergence signal strength. Even a mild divergence
# at a price extreme is worth noting.
OBV_MIN_SIGNAL_STRENGTH = 0.2

# ── Bollinger Band Reversion ───────────────────────────────────────

# Baseline strength when price touches a Bollinger Band. A touch
# alone is moderately significant.
BB_BASELINE_STRENGTH = 0.4

# Scales band penetration depth into additional strength above baseline.
# A multiplier of 3 means penetrating 1/3 of the band width beyond
# the band reaches the maximum signal strength.
BB_PENETRATION_MULTIPLIER = 3

# ── Z-Score Reversion ──────────────────────────────────────────────

# The z-score divisor for strength normalization. A z-score of 4.0
# maps to maximum strength (1.0). Standard entry is at z=2.0,
# giving a base strength of 0.5.
ZSCORE_STRENGTH_DIVISOR = 4.0

# ── RSI Mean Reversion ─────────────────────────────────────────────

# The RSI range used to normalize the depth past the extreme threshold.
# The practical extreme zone is about 20 RSI points deep (e.g., RSI 0–20
# for oversold), so dividing by 20 normalizes that depth to [0, 1].
RSI_EXTREME_NORMALIZATION_RANGE = 20.0

# Baseline strength for extreme RSI mean reversion signals.
# Higher than standard RSI signals because double-timeframe confirmation
# is a stronger indicator.
RSI_EXTREME_BASELINE_STRENGTH = 0.4

# Tolerance for the slow RSI when checking extreme overbought/oversold.
# The slow RSI is allowed to be within this many points of the threshold
# to still qualify as confirming the signal.
RSI_SLOW_TOLERANCE = 10

# ── Data Validation ─────────────────────────────────────────────────

# Extra bars required beyond the indicator period to ensure stable
# indicator output. Most indicators need a warmup of at least their
# period length; the extra 5 bars provide margin.
MIN_BARS_PADDING = 5
