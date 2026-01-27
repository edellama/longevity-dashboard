"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchRecovery, fetchSleep, fetchWorkout, WhoopRecovery, WhoopSleep, WhoopWorkout } from "@/lib/whoop";
import MetricCard from "@/components/MetricCard";
import TrendChart from "@/components/TrendChart";

export default function Dashboard() {
  const router = useRouter();
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

        // Calculate date range for 30 days (using ISO date-time format)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        // Fetch 30-day data
        const [recovery, sleep, workout] = await Promise.all([
          fetchRecovery(startISO, endISO),
          fetchSleep(startISO, endISO),
          fetchWorkout(startISO, endISO),
        ]);

        setRecoveryData(recovery);
        setSleepData(sleep);
        setWorkoutData(workout);

        // Get today's data (most recent)
        if (recovery.length > 0) {
          setTodayRecovery(recovery[0]);
        }
        if (sleep.length > 0) {
          setTodaySleep(sleep[0]);
        }
        if (workout.length > 0) {
          setTodayWorkout(workout[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const recoveryScore = todayRecovery?.score?.recovery_score ?? null;
  const hrv = todayRecovery?.score?.hrv_rmssd_milli 
    ? (todayRecovery.score.hrv_rmssd_milli / 1000).toFixed(1) 
    : null;
  const sleepHours = todaySleep?.score?.stage_summary?.total_light_sleep_time_milli && todaySleep?.score?.stage_summary?.total_slow_wave_sleep_time_milli && todaySleep?.score?.stage_summary?.total_rem_sleep_time_milli
    ? ((todaySleep.score.stage_summary.total_light_sleep_time_milli + 
        todaySleep.score.stage_summary.total_slow_wave_sleep_time_milli + 
        todaySleep.score.stage_summary.total_rem_sleep_time_milli) / (1000 * 60 * 60)).toFixed(1)
    : null;
  const sleepQuality = todaySleep?.score?.sleep_performance_percentage ?? null;
  const strain = todayWorkout?.score?.strain ?? null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Longevity Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your health metrics and trends
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Today's Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Recovery Score"
            value={recoveryScore !== null ? `${recoveryScore}%` : "N/A"}
            subtitle="Today"
            color="green"
          />
          <MetricCard
            title="HRV"
            value={hrv !== null ? `${hrv} ms` : "N/A"}
            subtitle="Heart Rate Variability"
            color="blue"
          />
          <MetricCard
            title="Sleep"
            value={sleepHours !== null ? `${sleepHours}h` : "N/A"}
            subtitle={sleepQuality !== null ? `${sleepQuality}% quality` : "No data"}
            color="purple"
          />
          <MetricCard
            title="Strain"
            value={strain !== null ? `${strain.toFixed(1)}` : "N/A"}
            subtitle="Today's workout strain"
            color="orange"
          />
        </div>

        {/* 30-Day Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TrendChart
            title="Recovery Score Trend"
            data={recoveryData.map((r) => ({
              date: new Date(r.created_at).toLocaleDateString(),
              value: r.score?.recovery_score ?? 0,
            }))}
            color="#10b981"
            yAxisLabel="Score"
          />
          <TrendChart
            title="HRV Trend"
            data={recoveryData.map((r) => ({
              date: new Date(r.created_at).toLocaleDateString(),
              value: r.score?.hrv_rmssd_milli 
                ? r.score.hrv_rmssd_milli / 1000 
                : 0,
            }))}
            color="#3b82f6"
            yAxisLabel="HRV (ms)"
          />
          <TrendChart
            title="Sleep Hours Trend"
            data={sleepData.map((s) => ({
              date: new Date(s.created_at).toLocaleDateString(),
              value: s.score?.stage_summary && s.score.stage_summary.total_light_sleep_time_milli && s.score.stage_summary.total_slow_wave_sleep_time_milli && s.score.stage_summary.total_rem_sleep_time_milli
                ? (s.score.stage_summary.total_light_sleep_time_milli + 
                   s.score.stage_summary.total_slow_wave_sleep_time_milli + 
                   s.score.stage_summary.total_rem_sleep_time_milli) / (1000 * 60 * 60)
                : 0,
            }))}
            color="#8b5cf6"
            yAxisLabel="Hours"
          />
          <TrendChart
            title="Strain Trend"
            data={workoutData.map((w) => ({
              date: new Date(w.created_at).toLocaleDateString(),
              value: w.score?.strain ?? 0,
            }))}
            color="#f97316"
            yAxisLabel="Strain"
          />
        </div>
      </div>
    </div>
  );
}
