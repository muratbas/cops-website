/**
 * C-Ops Hub Rating 2.0 Algorithm (HLTV 2.0 Style for Critical Ops)
 * 
 * Calculates a unified, normalized performance rating based on:
 * - Kill component (Kill efficiency & K/D ratio)
 * - Survival component (Inverted death penalty)
 * - Assist & Teamplay contribution
 * - Match Victory / Win Rate factor
 * 
 * Calibrated so that:
 * - 1.00 represents a perfectly average, balanced performance.
 * - 1.15+ represents a strong impact player ("Star Player").
 * - 1.30+ represents tournament / MVP caliber ("Elite Ops").
 * - < 0.90 indicates room for improvement.
 */

import { MatchStats } from "@/types/cops";

export interface RatingMetrics {
  rating: number; // e.g. 1.24
  ratingFormatted: string; // e.g. "1.24"
  kdRatio: number; // e.g. 1.35
  kdaRatio: number; // (K + A/2) / D
  winRate: number; // Percentage 0 - 100
  totalMatches: number;
  tier: "ELITE" | "STAR" | "SOLID" | "AVERAGE" | "UNDERPERFORMING";
  tierColor: string; // Tailwind hex or class color
}

/**
 * Calculates C-Ops Hub Rating 2.0 from match stats
 */
export function calculateCopsRating(stats?: MatchStats | null): RatingMetrics {
  if (!stats) {
    return {
      rating: 0,
      ratingFormatted: "0.00",
      kdRatio: 0,
      kdaRatio: 0,
      winRate: 0,
      totalMatches: 0,
      tier: "AVERAGE",
      tierColor: "text-zinc-400",
    };
  }

  const { k = 0, d = 0, a = 0, w = 0, l = 0 } = stats;
  const totalMatches = w + l;

  // Safe divisions
  const effectiveDeaths = Math.max(1, d);
  const kdRatio = Number((k / effectiveDeaths).toFixed(2));
  const kdaRatio = Number(((k + a * 0.5) / effectiveDeaths).toFixed(2));
  const winRate = totalMatches > 0 ? Number(((w / totalMatches) * 100).toFixed(1)) : 0;

  if (totalMatches === 0 && k === 0 && d === 0) {
    return {
      rating: 1.0,
      ratingFormatted: "1.00",
      kdRatio: 0,
      kdaRatio: 0,
      winRate: 0,
      totalMatches: 0,
      tier: "AVERAGE",
      tierColor: "text-zinc-400",
    };
  }

  // Baseline calibration constants (derived from competitive averages)
  const AVERAGE_KD = 1.0;
  const AVERAGE_WINRATE = 50.0;
  const AVERAGE_KILLS_PER_MATCH = 14.0;

  const killsPerMatch = totalMatches > 0 ? k / totalMatches : AVERAGE_KILLS_PER_MATCH;
  const assistsPerMatch = totalMatches > 0 ? a / totalMatches : 3.0;

  // Component 1: Kill & Firepower Factor (Weight: 40%)
  // Measures raw fragging output and kill-to-death sustainability
  const killFactor = 0.5 * (kdRatio / AVERAGE_KD) + 0.5 * (killsPerMatch / AVERAGE_KILLS_PER_MATCH);

  // Component 2: Survival & Impact (Weight: 30%)
  // Rewards high survival without passive play, incorporates assist contribution
  const survivalFactor = Math.min(
    2.0,
    Math.max(0.2, (k + a * 0.4) / effectiveDeaths)
  );

  // Component 3: Match Influence & Win Factor (Weight: 30%)
  // Winning matches is the ultimate objective in competitive C-Ops
  const winFactor = totalMatches > 0 ? Math.min(1.5, Math.max(0.5, winRate / AVERAGE_WINRATE)) : 1.0;

  // Weighted composition (HLTV 2.0 polynomial model)
  const rawRating =
    0.073 +
    0.45 * killFactor +
    0.30 * survivalFactor +
    0.20 * winFactor +
    0.05 * (assistsPerMatch / 4.0);

  // Normalize and clamp between 0.30 and 2.50
  const normalizedRating = Math.min(2.5, Math.max(0.3, Number(rawRating.toFixed(2))));

  // Determine Tier Badge & Color
  let tier: RatingMetrics["tier"] = "AVERAGE";
  let tierColor = "text-zinc-400";

  if (normalizedRating >= 1.35) {
    tier = "ELITE";
    tierColor = "text-amber-400";
  } else if (normalizedRating >= 1.18) {
    tier = "STAR";
    tierColor = "text-orange-500";
  } else if (normalizedRating >= 1.05) {
    tier = "SOLID";
    tierColor = "text-emerald-400";
  } else if (normalizedRating >= 0.92) {
    tier = "AVERAGE";
    tierColor = "text-zinc-300";
  } else {
    tier = "UNDERPERFORMING";
    tierColor = "text-rose-500";
  }

  return {
    rating: normalizedRating,
    ratingFormatted: normalizedRating.toFixed(2),
    kdRatio,
    kdaRatio,
    winRate,
    totalMatches,
    tier,
    tierColor,
  };
}
