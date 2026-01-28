// Clean longevity dashboard palette
export const colors = {
  // Recovery zones
  recoveryGood: "#059669",   // green-600
  recoveryMid: "#d97706",    // amber-600
  recoveryLow: "#dc2626",    // red-600
  // Chart & UI
  primary: "#0f766e",       // teal-800
  primaryLight: "#14b8a6",  // teal-500
  accent: "#64748b",        // slate-500
  surface: "#f8fafc",
  surfaceDark: "#1e293b",
  border: "#e2e8f0",
  borderDark: "#334155",
  text: "#0f172a",
  textMuted: "#64748b",
  textDark: "#f1f5f9",
  textMutedDark: "#94a3b8",
};

export type RecoveryZone = "good" | "mid" | "low" | "unknown";

export function getRecoveryZone(score: number | null): RecoveryZone {
  if (score === null || score === undefined) return "unknown";
  if (score > 66) return "good";
  if (score >= 33) return "mid";
  return "low";
}

export function getRecoveryColor(zone: RecoveryZone): string {
  switch (zone) {
    case "good": return colors.recoveryGood;
    case "mid": return colors.recoveryMid;
    case "low": return colors.recoveryLow;
    default: return colors.accent;
  }
}

export function getReadinessSummary(recoveryScore: number | null): string {
  if (recoveryScore === null || recoveryScore === undefined) {
    return "Connect your Whoop to see your readiness.";
  }
  if (recoveryScore > 66) {
    return "You're well recovered. Good day for intensity.";
  }
  if (recoveryScore >= 33) {
    return "Moderate recovery. Consider medium effort or rest.";
  }
  return "Focus on recovery today. Light activity only.";
}
