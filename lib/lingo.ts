/**
 * Lingo/LibreView glucose data types and utilities
 */

export interface GlucoseReading {
  timestamp: string;
  value: number; // mg/dL
  trend?: number;
  trendMessage?: string;
  isHigh?: boolean;
  isLow?: boolean;
  color?: number;
}

export interface GlucoseStats {
  average: number | null;
  min: number | null;
  max: number | null;
  count: number;
  inRange: number;
  high: number;
  low: number;
}

export interface SensorInfo {
  serialNumber?: string;
  status?: number;
  startDate?: string;
}

export interface PatientInfo {
  id?: string;
  firstName?: string;
  lastName?: string;
}

export interface LingoData {
  current: GlucoseReading | null;
  history: GlucoseReading[];
  stats: GlucoseStats;
  stats7d?: GlucoseStats;
  stats30d?: GlucoseStats;
  stats90d?: GlucoseStats;
  sensor?: SensorInfo;
  patient?: PatientInfo;
  source?: string;
  fetchedAt: string;
  importedAt?: string;
}

/**
 * Glucose ranges for categorization
 */
export const GLUCOSE_RANGES = {
  low: { min: 0, max: 70, label: "Low", color: "#ef4444" },
  optimal: { min: 70, max: 100, label: "Optimal", color: "#22c55e" },
  normal: { min: 100, max: 140, label: "Normal", color: "#84cc16" },
  elevated: { min: 140, max: 180, label: "Elevated", color: "#f59e0b" },
  high: { min: 180, max: 999, label: "High", color: "#ef4444" },
} as const;

/**
 * Get glucose category based on value
 */
export function getGlucoseCategory(value: number): keyof typeof GLUCOSE_RANGES {
  if (value < 70) return "low";
  if (value < 100) return "optimal";
  if (value < 140) return "normal";
  if (value < 180) return "elevated";
  return "high";
}

/**
 * Get color for a glucose value
 */
export function getGlucoseColor(value: number): string {
  const category = getGlucoseCategory(value);
  return GLUCOSE_RANGES[category].color;
}

/**
 * Format glucose value with unit
 */
export function formatGlucose(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value)} mg/dL`;
}

/**
 * Get trend arrow symbol
 */
export function getTrendArrow(trend?: number): string {
  switch (trend) {
    case 1:
      return "↑↑"; // Rising quickly
    case 2:
      return "↑"; // Rising
    case 3:
      return "↗"; // Rising slightly
    case 4:
      return "→"; // Stable
    case 5:
      return "↘"; // Falling slightly
    case 6:
      return "↓"; // Falling
    case 7:
      return "↓↓"; // Falling quickly
    default:
      return "";
  }
}

/**
 * Calculate time in range percentage
 */
export function calculateTimeInRange(readings: GlucoseReading[]): {
  inRange: number;
  belowRange: number;
  aboveRange: number;
} {
  if (readings.length === 0) {
    return { inRange: 0, belowRange: 0, aboveRange: 0 };
  }

  let inRange = 0;
  let belowRange = 0;
  let aboveRange = 0;

  for (const reading of readings) {
    if (reading.value < 70) {
      belowRange++;
    } else if (reading.value > 180) {
      aboveRange++;
    } else {
      inRange++;
    }
  }

  const total = readings.length;
  return {
    inRange: Math.round((inRange / total) * 100),
    belowRange: Math.round((belowRange / total) * 100),
    aboveRange: Math.round((aboveRange / total) * 100),
  };
}

/**
 * Fetch Lingo data from the API
 */
export async function fetchLingoData(): Promise<LingoData | null> {
  try {
    const response = await fetch("/api/lingo");
    if (!response.ok) {
      console.error("Failed to fetch Lingo data:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching Lingo data:", error);
    return null;
  }
}

/**
 * Group readings by day for charts
 */
export function groupReadingsByDay(
  readings: GlucoseReading[]
): Map<string, GlucoseReading[]> {
  const grouped = new Map<string, GlucoseReading[]>();

  for (const reading of readings) {
    if (!reading.timestamp) continue;
    const date = reading.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(reading);
  }

  return grouped;
}

/**
 * Calculate daily statistics
 */
export function calculateDailyStats(readings: GlucoseReading[]): {
  average: number;
  min: number;
  max: number;
  stdDev: number;
} | null {
  if (readings.length === 0) return null;

  const values = readings.map((r) => r.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const average = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Standard deviation
  const squaredDiffs = values.map((v) => Math.pow(v - average, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return {
    average: Math.round(average),
    min,
    max,
    stdDev: Math.round(stdDev),
  };
}
