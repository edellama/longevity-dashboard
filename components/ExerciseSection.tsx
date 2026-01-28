"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";
import {
  GarminData,
  GarminActivity,
  categorizeActivity,
} from "@/lib/garmin";

interface ExerciseSectionProps {
  garminData: GarminData | null;
}

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "365D", days: 365 },
] as const;

const CATEGORY_COLORS = {
  running: "#ef4444", // red
  cycling: "#3b82f6", // blue
  swimming: "#06b6d4", // cyan
  other: "#8b5cf6", // purple
};

// Reusable TrendChart component for Exercise metrics
function ExerciseTrendChart({
  title,
  data,
  color,
  yAxisLabel,
  valueFormatter,
  avgFormatter,
}: {
  title: string;
  data: { date: string; value: number }[];
  color: string;
  yAxisLabel: string;
  valueFormatter?: (value: number) => string;
  avgFormatter?: (value: number) => string;
}) {
  const periodAvg =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.value, 0) / data.length
      : null;

  const defaultFormatter = (v: number) => v.toFixed(1);
  const formatValue = valueFormatter || defaultFormatter;
  const formatAvg = avgFormatter || ((v: number) => `Avg: ${formatValue(v)}`);

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        {periodAvg != null && (
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">
            {formatAvg(periodAvg)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`gradient-exercise-${title.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={true}
            horizontal={true}
            className="dark:opacity-40"
          />
          <XAxis
            dataKey="date"
            stroke="#64748b"
            tick={{ fill: "#64748b", fontSize: 12 }}
            angle={-35}
            textAnchor="end"
            height={56}
            tickLine={{ stroke: "#94a3b8" }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: "#64748b", fontSize: 12 }}
            width={36}
            tickLine={{ stroke: "#94a3b8" }}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              style: { fill: "#64748b", fontSize: 12 },
            }}
          />
          {periodAvg != null && (
            <ReferenceLine
              y={periodAvg}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeOpacity={0.8}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "none",
              borderRadius: "12px",
              color: "#f1f5f9",
              padding: "12px 16px",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            }}
            labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
            formatter={(value: unknown) => [formatValue(Number(value)), "Value"]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#gradient-exercise-${title.replace(/\s/g, "-")})`}
            dot={{ fill: color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ExerciseSection({ garminData }: ExerciseSectionProps) {
  const [rangeDays, setRangeDays] = useState<number>(30);

  const {
    weightData,
    workoutData,
    totalTimeData,
    caloriesData,
    runningData,
    swimmingData,
    cyclingData,
    otherData,
    weeklyData,
  } = useMemo(() => {
    if (!garminData) {
      return {
        weightData: [],
        workoutData: [],
        totalTimeData: [],
        caloriesData: [],
        runningData: [],
        swimmingData: [],
        cyclingData: [],
        otherData: [],
        weeklyData: [],
      };
    }

    // Filter data by date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rangeDays);
    const startDateStr = startDate.toISOString().slice(0, 10);

    // Filter activities by date range
    const filteredActivities = garminData.activities.filter(
      (a) => a.date >= startDateStr
    );

    // Filter weight by date range
    const filteredWeight = (garminData.weight || []).filter(
      (w) => w.date >= startDateStr
    );

    // Weight chart data
    const weightData = filteredWeight
      .map((w) => ({
        date: new Date(w.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        value: w.weight,
        rawDate: w.date,
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    // Daily aggregation for activities
    const dailyMap = new Map<string, {
      workouts: number;
      totalTime: number;
      calories: number;
      running: number;
      swimming: number;
      cycling: number;
      other: number;
    }>();

    for (const activity of filteredActivities) {
      const dateKey = activity.date;
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          workouts: 0,
          totalTime: 0,
          calories: 0,
          running: 0,
          swimming: 0,
          cycling: 0,
          other: 0,
        });
      }
      const day = dailyMap.get(dateKey)!;
      day.workouts += 1;
      day.totalTime += (activity.duration || 0) / 60; // minutes
      day.calories += activity.activeCalories || activity.calories || 0;

      const category = categorizeActivity(activity.type);
      day[category] += 1;
    }

    const sortedDates = Array.from(dailyMap.keys()).sort();

    const workoutData = sortedDates.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyMap.get(d)!.workouts,
    }));

    const totalTimeData = sortedDates.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyMap.get(d)!.totalTime,
    }));

    const caloriesData = sortedDates.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyMap.get(d)!.calories,
    }));

    const runningData = sortedDates.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyMap.get(d)!.running,
    }));

    const swimmingData = sortedDates.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyMap.get(d)!.swimming,
    }));

    const cyclingData = sortedDates.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyMap.get(d)!.cycling,
    }));

    const otherData = sortedDates.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyMap.get(d)!.other,
    }));

    // Weekly aggregation for bar charts
    const weeklyMap = new Map<string, {
      running: number;
      cycling: number;
      swimming: number;
      other: number;
      sessions: number;
      runningCal: number;
      cyclingCal: number;
      swimmingCal: number;
      otherCal: number;
    }>();

    for (const activity of filteredActivities) {
      const date = new Date(activity.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          running: 0,
          cycling: 0,
          swimming: 0,
          other: 0,
          sessions: 0,
          runningCal: 0,
          cyclingCal: 0,
          swimmingCal: 0,
          otherCal: 0,
        });
      }
      const week = weeklyMap.get(weekKey)!;
      const category = categorizeActivity(activity.type);
      week[category] += (activity.duration || 0) / 60;
      week[`${category}Cal` as keyof typeof week] += (activity.activeCalories || activity.calories || 0) as number;
      week.sessions += 1;
    }

    const weeklyData = Array.from(weeklyMap.entries())
      .map(([weekKey, data]) => ({
        weekKey,
        week: new Date(weekKey).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        ...data,
      }))
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

    return {
      weightData,
      workoutData,
      totalTimeData,
      caloriesData,
      runningData,
      swimmingData,
      cyclingData,
      otherData,
      weeklyData,
    };
  }, [garminData, rangeDays]);

  if (!garminData) {
    return (
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-6">
        <p className="text-slate-500 dark:text-slate-400 text-center py-8">
          No exercise data available. Run <code className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">npm run fetch-garmin</code> to load data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Weekly Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity Bar Chart - Minutes */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-4">Weekly Exercise (minutes)</h4>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={weeklyData} margin={{ top: 25, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="week"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value: number, name: string) => {
                  const labelMap: Record<string, string> = {
                    running: "Running",
                    cycling: "Cycling",
                    swimming: "Swimming",
                    other: "Other",
                  };
                  return [`${Math.round(value)} min`, labelMap[name] || name];
                }}
              />
              <Bar dataKey="running" stackId="a" fill={CATEGORY_COLORS.running} />
              <Bar dataKey="cycling" stackId="a" fill={CATEGORY_COLORS.cycling} />
              <Bar dataKey="swimming" stackId="a" fill={CATEGORY_COLORS.swimming} />
              <Bar dataKey="other" stackId="a" fill={CATEGORY_COLORS.other} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="sessions"
                  position="top"
                  formatter={(value: number) => `${value} sessions`}
                  style={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Activity Calories Chart */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4">
          <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-4">Weekly Exercise (calories)</h4>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={weeklyData} margin={{ top: 25, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="week"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value: number, name: string) => {
                  const labelMap: Record<string, string> = {
                    runningCal: "Running",
                    cyclingCal: "Cycling",
                    swimmingCal: "Swimming",
                    otherCal: "Other",
                  };
                  return [`${Math.round(value)} cal`, labelMap[name] || name];
                }}
              />
              <Bar dataKey="runningCal" stackId="a" fill={CATEGORY_COLORS.running} />
              <Bar dataKey="cyclingCal" stackId="a" fill={CATEGORY_COLORS.cycling} />
              <Bar dataKey="swimmingCal" stackId="a" fill={CATEGORY_COLORS.swimming} />
              <Bar dataKey="otherCal" stackId="a" fill={CATEGORY_COLORS.other} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="sessions"
                  position="top"
                  formatter={(value: number) => `${value} sessions`}
                  style={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Charts - 2x4 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExerciseTrendChart
          title="Weight"
          data={weightData}
          color="#10b981"
          yAxisLabel="kg"
          valueFormatter={(v) => `${v.toFixed(1)} kg`}
          avgFormatter={(v) => `Avg: ${v.toFixed(1)} kg`}
        />
        <ExerciseTrendChart
          title="Total Workouts"
          data={workoutData}
          color="#f97316"
          yAxisLabel="Sessions"
          valueFormatter={(v) => `${Math.round(v)} sessions`}
          avgFormatter={(v) => `Avg: ${v.toFixed(1)}/day`}
        />
        <ExerciseTrendChart
          title="Total Time"
          data={totalTimeData}
          color="#8b5cf6"
          yAxisLabel="Minutes"
          valueFormatter={(v) => `${Math.round(v)} min`}
          avgFormatter={(v) => `Avg: ${Math.round(v)} min/day`}
        />
        <ExerciseTrendChart
          title="Active Calories"
          data={caloriesData}
          color="#ec4899"
          yAxisLabel="Calories"
          valueFormatter={(v) => `${Math.round(v)} cal`}
          avgFormatter={(v) => `Avg: ${Math.round(v)} cal/day`}
        />
        <ExerciseTrendChart
          title="Running Sessions"
          data={runningData}
          color={CATEGORY_COLORS.running}
          yAxisLabel="Sessions"
          valueFormatter={(v) => `${Math.round(v)} sessions`}
          avgFormatter={(v) => `Avg: ${v.toFixed(1)}/day`}
        />
        <ExerciseTrendChart
          title="Swimming Sessions"
          data={swimmingData}
          color={CATEGORY_COLORS.swimming}
          yAxisLabel="Sessions"
          valueFormatter={(v) => `${Math.round(v)} sessions`}
          avgFormatter={(v) => `Avg: ${v.toFixed(1)}/day`}
        />
        <ExerciseTrendChart
          title="Cycling Sessions"
          data={cyclingData}
          color={CATEGORY_COLORS.cycling}
          yAxisLabel="Sessions"
          valueFormatter={(v) => `${Math.round(v)} sessions`}
          avgFormatter={(v) => `Avg: ${v.toFixed(1)}/day`}
        />
        <ExerciseTrendChart
          title="Other Sessions"
          data={otherData}
          color={CATEGORY_COLORS.other}
          yAxisLabel="Sessions"
          valueFormatter={(v) => `${Math.round(v)} sessions`}
          avgFormatter={(v) => `Avg: ${v.toFixed(1)}/day`}
        />
      </div>
    </div>
  );
}
