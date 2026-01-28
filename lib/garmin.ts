/**
 * Garmin data types and utilities
 */

export interface GarminDailySummary {
  date: string;
  steps: number;
  calories: number;
  activeCalories: number;
  distance: number;
  floors: number;
  restingHeartRate: number | null;
  minHeartRate: number | null;
  maxHeartRate: number | null;
  averageStress: number | null;
  bodyBattery: number | null;
}

export interface GarminSleepData {
  date: string;
  sleepSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSleepSeconds: number;
  sleepScore: number | null;
}

export interface GarminHeartRate {
  date: string;
  restingHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
}

export interface GarminActivity {
  date: string;
  name: string;
  type: string;
  parentType?: number;
  duration: number;
  distance: number | null;
  calories: number | null;
  activeCalories: number | null;
  averageHR: number | null;
  maxHR: number | null;
  averageSpeed: number | null;
}

export interface GarminWeight {
  date: string;
  weight: number; // in kg
  bmi: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
}

export interface GarminData {
  fetchedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  dailySummaries: GarminDailySummary[];
  sleepData: GarminSleepData[];
  heartRate: GarminHeartRate[];
  activities: GarminActivity[];
  weight: GarminWeight[];
}

// Exercise category types
export type ExerciseCategory = "running" | "cycling" | "swimming" | "other";

/**
 * Categorize activity type into Running, Cycling, Swimming, or Other
 */
export function categorizeActivity(type: string): ExerciseCategory {
  const t = type.toLowerCase();

  // Running activities
  if (
    t.includes("running") ||
    t.includes("run") ||
    t.includes("treadmill") ||
    t === "track_running" ||
    t === "trail_running" ||
    t === "virtual_run"
  ) {
    return "running";
  }

  // Cycling activities
  if (
    t.includes("cycling") ||
    t.includes("biking") ||
    t.includes("bike") ||
    t === "indoor_cycling" ||
    t === "road_biking" ||
    t === "mountain_biking" ||
    t === "virtual_ride" ||
    t === "gravel_cycling"
  ) {
    return "cycling";
  }

  // Swimming activities
  if (
    t.includes("swimming") ||
    t.includes("swim") ||
    t === "lap_swimming" ||
    t === "open_water_swimming" ||
    t === "pool_swimming"
  ) {
    return "swimming";
  }

  return "other";
}

/**
 * Get activities grouped by category
 */
export function getActivitiesByCategory(data: GarminData): {
  running: GarminActivity[];
  cycling: GarminActivity[];
  swimming: GarminActivity[];
  other: GarminActivity[];
} {
  const grouped = {
    running: [] as GarminActivity[],
    cycling: [] as GarminActivity[],
    swimming: [] as GarminActivity[],
    other: [] as GarminActivity[],
  };

  for (const activity of data.activities) {
    const category = categorizeActivity(activity.type);
    grouped[category].push(activity);
  }

  return grouped;
}

/**
 * Calculate exercise stats for a category
 */
export function calculateExerciseStats(activities: GarminActivity[]): {
  count: number;
  totalDuration: number; // in seconds
  totalCalories: number;
  totalDistance: number; // in meters
  avgDuration: number;
  avgCalories: number;
} {
  const count = activities.length;
  const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const totalCalories = activities.reduce((sum, a) => sum + (a.activeCalories || a.calories || 0), 0);
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);

  return {
    count,
    totalDuration,
    totalCalories,
    totalDistance,
    avgDuration: count > 0 ? totalDuration / count : 0,
    avgCalories: count > 0 ? totalCalories / count : 0,
  };
}

/**
 * Get the latest weight record
 */
export function getLatestWeight(data: GarminData): GarminWeight | null {
  if (!data.weight || !data.weight.length) return null;
  // Sort by date descending and get the first
  const sorted = [...data.weight].sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0];
}

/**
 * Fetch Garmin data from the API endpoint (reads from JSON file)
 */
export async function fetchGarminData(): Promise<GarminData | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch(`/api/garmin?t=${Date.now()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("[Garmin] Failed to fetch data:", error);
    return null;
  }
}

/**
 * Format seconds to hours and minutes string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format distance in meters to km
 */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format weight in kg to display string
 */
export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

/**
 * Format sleep duration from seconds to "Xh Ym" format
 */
export function formatSleepDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Get the latest daily summary (most recent date)
 */
export function getLatestSummary(data: GarminData): GarminDailySummary | null {
  if (!data.dailySummaries || !data.dailySummaries.length) return null;
  const sorted = [...data.dailySummaries].sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0];
}

/**
 * Get the latest sleep data (most recent date)
 */
export function getLatestSleep(data: GarminData): GarminSleepData | null {
  if (!data.sleepData || !data.sleepData.length) return null;
  const sorted = [...data.sleepData].sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0];
}

/**
 * Get today's daily summary
 */
export function getTodaySummary(data: GarminData): GarminDailySummary | null {
  if (!data.dailySummaries || !data.dailySummaries.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return data.dailySummaries.find(s => s.date === today) || null;
}

/**
 * Format steps with commas
 */
export function formatSteps(steps: number): string {
  return steps.toLocaleString();
}

/**
 * Calculate averages for key metrics
 */
export function calculateAverages(data: GarminData): {
  avgSteps: number;
  avgSleepHours: number;
  avgRestingHR: number;
  avgStress: number;
} {
  const summaries = data.dailySummaries || [];
  const sleepRecords = data.sleepData || [];

  const avgSteps = summaries.length > 0
    ? Math.round(summaries.reduce((sum, s) => sum + s.steps, 0) / summaries.length)
    : 0;

  const avgSleepHours = sleepRecords.length > 0
    ? +(sleepRecords.reduce((sum, s) => sum + s.sleepSeconds, 0) / sleepRecords.length / 3600).toFixed(1)
    : 0;

  const hrRecords = summaries.filter(s => s.restingHeartRate != null);
  const avgRestingHR = hrRecords.length > 0
    ? Math.round(hrRecords.reduce((sum, s) => sum + (s.restingHeartRate || 0), 0) / hrRecords.length)
    : 0;

  const stressRecords = summaries.filter(s => s.averageStress != null);
  const avgStress = stressRecords.length > 0
    ? Math.round(stressRecords.reduce((sum, s) => sum + (s.averageStress || 0), 0) / stressRecords.length)
    : 0;

  return { avgSteps, avgSleepHours, avgRestingHR, avgStress };
}
