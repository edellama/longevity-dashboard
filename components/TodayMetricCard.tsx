"use client";

import { getRecoveryZone, getRecoveryColor, colors } from "@/lib/theme";

interface TodayMetricCardProps {
  title: string;
  value: string;
  comparison?: string; // e.g. "↑ 5% vs 7d avg"
  comparisonBetter?: boolean; // true = show green, false = show red, undefined = neutral
  recoveryScore?: number | null; // only for recovery card - drives left border color
  borderColor?: string;
}

export default function TodayMetricCard({
  title,
  value,
  comparison,
  comparisonBetter,
  recoveryScore,
  borderColor,
}: TodayMetricCardProps) {
  const zone = recoveryScore !== undefined ? getRecoveryZone(recoveryScore) : null;
  const accentColor = zone ? getRecoveryColor(zone) : borderColor ?? colors.primary;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-lg border border-slate-200/80 dark:border-slate-600/50 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-800/90"
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: accentColor,
      }}
    >
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
        {title}
      </p>
      <p className="mt-2 text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white">
        {value}
      </p>
      {comparison && (
        <p
          className={`mt-2 text-sm font-medium ${
            comparisonBetter === true
              ? "text-emerald-600 dark:text-emerald-400"
              : comparisonBetter === false
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {comparison}
        </p>
      )}
    </div>
  );
}
