"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  GarminData,
  fetchGarminData,
  formatSleepDuration,
  getLatestSummary,
  getLatestSleep,
  calculateAverages,
} from "@/lib/garmin";

export default function GarminDashboard() {
  const [data, setData] = useState<GarminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const garminData = await fetchGarminData();
        if (garminData) {
          setData(garminData);
        } else {
          setError("No Garmin data available");
        }
      } catch (err) {
        setError("Failed to load Garmin data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Garmin Connect
        </h3>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Garmin Connect
        </h3>
        <div className="text-center py-8">
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error || "No Garmin data available"}
          </p>
          <div className="text-sm text-slate-400 dark:text-slate-500">
            <p>To set up Garmin integration, run:</p>
            <code className="block mt-2 bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded">
              npm run garmin-setup
            </code>
            <p className="mt-2">Then fetch data with:</p>
            <code className="block mt-2 bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded">
              npm run fetch-garmin
            </code>
          </div>
        </div>
      </div>
    );
  }

  const latestSummary = getLatestSummary(data);
  const latestSleep = getLatestSleep(data);
  const averages = calculateAverages(data);

  // Prepare chart data (oldest to newest)
  const stepsChartData = data.dailySummaries
    .filter((d) => d.steps > 0)
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      steps: d.steps,
    }));

  const sleepChartData = data.sleepData
    .filter((d) => d.sleepSeconds > 0)
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      hours: +(d.sleepSeconds / 3600).toFixed(1),
      score: d.sleepScore,
    }));

  const hrChartData = data.dailySummaries
    .filter((d) => d.restingHeartRate)
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      rhr: d.restingHeartRate,
    }));

  return (
    <div className="space-y-6">
      {/* Header with last updated */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Garmin Connect
        </h3>
        <span className="text-xs text-slate-400">
          Data from {data.dateRange.start} to {data.dateRange.end}
        </span>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Steps</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {latestSummary?.steps.toLocaleString() || "—"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Avg: {averages.avgSteps.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sleep</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {latestSleep ? formatSleepDuration(latestSleep.sleepSeconds) : "—"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Score: {latestSleep?.sleepScore || "—"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Resting HR</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {latestSummary?.restingHeartRate || "—"} <span className="text-sm font-normal">bpm</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Avg: {averages.avgRestingHR} bpm
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Stress</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {latestSummary?.averageStress || "—"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Avg: {averages.avgStress}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Steps Chart */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-4">Daily Steps</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stepsChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value: number) => [value.toLocaleString(), "Steps"]}
              />
              <Bar dataKey="steps" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sleep Chart */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-4">Sleep Duration</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sleepChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
                domain={[4, 10]}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value: number, name: string) => [
                  name === "hours" ? `${value}h` : value,
                  name === "hours" ? "Sleep" : "Score",
                ]}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: "#8b5cf6", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Resting Heart Rate Chart */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-4">Resting Heart Rate</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hrChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value: number) => [`${value} bpm`, "Resting HR"]}
              />
              <Line
                type="monotone"
                dataKey="rhr"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: "#ef4444", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activities */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-4">Recent Activities</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {data.activities.length === 0 ? (
              <p className="text-sm text-slate-400">No recent activities</p>
            ) : (
              data.activities.slice(0, 5).map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {activity.name || activity.type}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {activity.duration ? `${Math.round(activity.duration / 60)} min` : "—"}
                    </p>
                    {activity.averageHR && (
                      <p className="text-xs text-slate-400">
                        {activity.averageHR} bpm avg
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
