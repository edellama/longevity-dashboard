"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  fetchRecovery,
  fetchSleep,
  fetchWorkout,
  WhoopRecovery,
  WhoopSleep,
  WhoopWorkout,
} from "@/lib/whoop";
import { getReadinessSummary, colors } from "@/lib/theme";
import TodayMetricCard from "@/components/TodayMetricCard";
import TrendChart from "@/components/TrendChart";

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "365D", days: 365 },
] as const;

export default function Dashboard() {
  const router = useRouter();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [todayRecovery, setTodayRecovery] = useState<WhoopRecovery | null>(null);
  const [todaySleep, setTodaySleep] = useState<WhoopSleep | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<WhoopWorkout | null>(null);
  const [recoveryData, setRecoveryData] = useState<WhoopRecovery[]>([]);
  const [sleepData, setSleepData] = useState<WhoopSleep[]>([]);
  const [workoutData, setWorkoutData] = useState<WhoopWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      router.push("/login");
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - rangeDays);

        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        const [recovery, sleep, workout] = await Promise.all([
          fetchRecovery(startISO, endISO),
          fetchSleep(startISO, endISO),
          fetchWorkout(startISO, endISO),
        ]);

        setRecoveryData(recovery);
        setSleepData(sleep);
        setWorkoutData(workout);

        if (recovery.length > 0) setTodayRecovery(recovery[0]);
        if (sleep.length > 0) setTodaySleep(sleep[0]);
        if (workout.length > 0) setTodayWorkout(workout[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [rangeDays]);

  // Slice data to selected range for charts
  const chartRecovery = useMemo(
    () => recoveryData.slice(0, rangeDays).reverse(),
    [recoveryData, rangeDays]
  );
  const chartSleep = useMemo(
    () => sleepData.slice(0, rangeDays).reverse(),
    [sleepData, rangeDays]
  );
  const chartWorkout = useMemo(
    () => workoutData.slice(0, rangeDays).reverse(),
    [workoutData, rangeDays]
  );

  // 7-day averages for comparison
  const avg7 = useMemo(() => {
    const r = recoveryData.slice(0, 7);
    const s = sleepData.slice(0, 7);
    const w = workoutData.slice(0, 7);
    const recoveryAvg =
      r.length > 0
        ? r.reduce((sum, x) => sum + (x.score?.recovery_score ?? 0), 0) / r.length
        : null;
    let sleepAvg: number | null = null;
    if (s.length > 0) {
      const total = s.reduce((sum, x) => {
        const ss = x.score?.stage_summary;
        if (!ss) return sum;
        const hrs =
          (ss.total_light_sleep_time_milli +
            ss.total_slow_wave_sleep_time_milli +
            ss.total_rem_sleep_time_milli) /
          (1000 * 60 * 60);
        return sum + hrs;
      }, 0);
      sleepAvg = total / s.length;
    }
    const strainAvg =
      w.length > 0
        ? w.reduce((sum, x) => sum + (x.score?.strain ?? 0), 0) / w.length
        : null;
    const hrvAvg =
      r.length > 0
        ? r.reduce(
            (sum, x) => sum + (x.score?.hrv_rmssd_milli ?? 0) / 1000,
            0
          ) / r.length
        : null;
    return { recoveryAvg, sleepAvg, strainAvg, hrvAvg };
  }, [recoveryData, sleepData, workoutData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-rose-600 dark:text-rose-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const recoveryScore = todayRecovery?.score?.recovery_score ?? null;
  const hrv =
    todayRecovery?.score?.hrv_rmssd_milli != null
      ? (todayRecovery.score!.hrv_rmssd_milli / 1000).toFixed(1)
      : null;
  const sleepHours =
    todaySleep?.score?.stage_summary &&
    todaySleep.score.stage_summary.total_light_sleep_time_milli != null &&
    todaySleep.score.stage_summary.total_slow_wave_sleep_time_milli != null &&
    todaySleep.score.stage_summary.total_rem_sleep_time_milli != null
      ? (
          (todaySleep.score.stage_summary.total_light_sleep_time_milli +
            todaySleep.score.stage_summary.total_slow_wave_sleep_time_milli +
            todaySleep.score.stage_summary.total_rem_sleep_time_milli) /
          (1000 * 60 * 60)
        ).toFixed(1)
      : null;
  const sleepQuality = todaySleep?.score?.sleep_performance_percentage ?? null;
  const strain = todayWorkout?.score?.strain ?? null;

  const recoveryComparison =
    recoveryScore != null && avg7.recoveryAvg != null
      ? `${recoveryScore > avg7.recoveryAvg ? "↑" : "↓"} ${Math.abs(
          Math.round(recoveryScore - avg7.recoveryAvg)
        )}% vs 7d avg`
      : undefined;
  const recoveryComparisonBetter =
    recoveryScore != null && avg7.recoveryAvg != null
      ? recoveryScore > avg7.recoveryAvg
      : undefined;
  const hrvComparison =
    hrv != null && avg7.hrvAvg != null
      ? `${Number(hrv) > avg7.hrvAvg ? "↑" : "↓"} ${(
          Math.abs(Number(hrv) - avg7.hrvAvg) as number
        ).toFixed(1)} ms vs 7d avg`
      : undefined;
  const hrvComparisonBetter =
    hrv != null && avg7.hrvAvg != null
      ? Number(hrv) > avg7.hrvAvg
      : undefined;
  const sleepComparison =
    sleepHours != null && avg7.sleepAvg != null
      ? `${Number(sleepHours) > avg7.sleepAvg ? "↑" : "↓"} ${(
          Math.abs(Number(sleepHours) - avg7.sleepAvg) as number
        ).toFixed(1)}h vs 7d avg`
      : undefined;
  const sleepComparisonBetter =
    sleepHours != null && avg7.sleepAvg != null
      ? Number(sleepHours) > avg7.sleepAvg
      : undefined;
  const strainComparison =
    strain != null && avg7.strainAvg != null
      ? `${strain > avg7.strainAvg ? "↑" : "↓"} ${(
          Math.abs(strain - avg7.strainAvg) as number
        ).toFixed(1)} vs 7d avg`
      : undefined;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Longevity Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Your health metrics and trends
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="self-start sm:self-center px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
          >
            Logout
          </button>
        </div>

        {/* Readiness summary */}
        <div className="mb-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-600/50 shadow-md p-4 sm:p-5">
          <p className="text-slate-700 dark:text-slate-200 text-lg sm:text-xl font-medium">
            {getReadinessSummary(recoveryScore)}
          </p>
        </div>

        {/* Today's metrics – large and prominent */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Today
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <TodayMetricCard
              title="Recovery"
              value={recoveryScore != null ? `${recoveryScore}%` : "—"}
              comparison={recoveryComparison}
              comparisonBetter={recoveryComparisonBetter}
              recoveryScore={recoveryScore}
              borderColor={colors.primary}
            />
            <TodayMetricCard
              title="HRV"
              value={hrv != null ? `${hrv} ms` : "—"}
              comparison={hrvComparison}
              comparisonBetter={hrvComparisonBetter}
              borderColor="#0ea5e9"
            />
            <TodayMetricCard
              title="Sleep"
              value={sleepHours != null ? `${sleepHours}h` : "—"}
              comparison={sleepComparison}
              comparisonBetter={sleepComparisonBetter}
              borderColor="#a855f7"
            />
            <TodayMetricCard
              title="Strain"
              value={strain != null ? strain.toFixed(1) : "—"}
              comparison={strainComparison}
              borderColor="#f97316"
            />
          </div>
          {sleepQuality != null && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Sleep quality: {sleepQuality}%
            </p>
          )}
        </section>

        {/* Time range selector */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Range:
          </span>
          {TIME_RANGES.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setRangeDays(days)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                rangeDays === days
                  ? "bg-teal-600 text-white shadow-md"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Trend charts */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Trends
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <TrendChart
              title="Recovery Score"
              data={chartRecovery.map((r) => ({
                date: new Date(r.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                }),
                value: r.score?.recovery_score ?? 0,
              }))}
              color={colors.recoveryGood}
              yAxisLabel="Score"
            />
            <TrendChart
              title="HRV"
              data={chartRecovery.map((r) => ({
                date: new Date(r.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                }),
                value:
                  r.score?.hrv_rmssd_milli != null
                    ? r.score.hrv_rmssd_milli / 1000
                    : 0,
              }))}
              color="#0ea5e9"
              yAxisLabel="ms"
            />
            <TrendChart
              title="Sleep (hours)"
              data={chartSleep.map((s) => ({
                date: new Date(s.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                }),
                value:
                  s.score?.stage_summary &&
                  s.score.stage_summary.total_light_sleep_time_milli != null &&
                  s.score.stage_summary.total_slow_wave_sleep_time_milli != null &&
                  s.score.stage_summary.total_rem_sleep_time_milli != null
                    ? (s.score.stage_summary.total_light_sleep_time_milli +
                        s.score.stage_summary.total_slow_wave_sleep_time_milli +
                        s.score.stage_summary.total_rem_sleep_time_milli) /
                      (1000 * 60 * 60)
                    : 0,
              }))}
              color="#a855f7"
              yAxisLabel="Hours"
            />
            <TrendChart
              title="Strain"
              data={chartWorkout.map((w) => ({
                date: new Date(w.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                }),
                value: w.score?.strain ?? 0,
              }))}
              color="#f97316"
              yAxisLabel="Strain"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
