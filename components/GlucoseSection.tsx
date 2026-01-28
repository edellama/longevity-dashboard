"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  LabelList,
} from "recharts";
import {
  LingoData,
  GlucoseReading,
  getGlucoseColor,
  formatGlucose,
  getTrendArrow,
  calculateTimeInRange,
  GLUCOSE_RANGES,
} from "@/lib/lingo";

interface GlucoseSectionProps {
  lingoData: LingoData | null;
}

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "365D", days: 365 },
] as const;

// Reusable trend chart component matching Exercise section style
interface GlucoseTrendChartProps {
  title: string;
  data: { date: string; value: number }[];
  color: string;
  average?: number | null;
  unit?: string;
  showOptimalRange?: boolean;
}

function GlucoseTrendChart({
  title,
  data,
  color,
  average,
  unit = "mg/dL",
  showOptimalRange = false,
}: GlucoseTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
          {title}
        </h3>
        <p className="text-slate-400 dark:text-slate-500 text-center py-8">
          No data available
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        {average != null && (
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Avg: {Math.round(average)} {unit}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showOptimalRange && (
            <ReferenceArea
              y1={70}
              y2={140}
              fill="#22c55e"
              fillOpacity={0.1}
              strokeOpacity={0}
            />
          )}
          <XAxis
            dataKey="date"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={showOptimalRange ? [50, 200] : ["auto", "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value: number) => [`${Math.round(value)} ${unit}`, title]}
          />
          {showOptimalRange && (
            <>
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
            </>
          )}
          {average != null && (
            <ReferenceLine
              y={average}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeOpacity={0.7}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${title.replace(/\s/g, "")})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TimeInRangeBarProps {
  readings: GlucoseReading[];
}

function TimeInRangeBar({ readings }: TimeInRangeBarProps) {
  const { inRange, belowRange, aboveRange } = calculateTimeInRange(readings);

  if (readings.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
          Time in Range
        </h3>
        <p className="text-slate-400 dark:text-slate-500 text-center py-4">
          No data available
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
        Time in Range
      </h3>
      <div className="flex h-6 rounded-full overflow-hidden mb-3">
        {belowRange > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${belowRange}%` }}
            title={`Low: ${belowRange}%`}
          />
        )}
        <div
          className="bg-green-500"
          style={{ width: `${inRange}%` }}
          title={`In Range: ${inRange}%`}
        />
        {aboveRange > 0 && (
          <div
            className="bg-amber-500"
            style={{ width: `${aboveRange}%` }}
            title={`High: ${aboveRange}%`}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Low: {belowRange}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          In Range: {inRange}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          High: {aboveRange}%
        </span>
      </div>
    </div>
  );
}

// Daily average bar chart
interface DailyAverageChartProps {
  readings: GlucoseReading[];
  days: number;
}

function DailyAverageChart({ readings, days }: DailyAverageChartProps) {
  const chartData = useMemo(() => {
    // Group by date
    const byDate = new Map<string, number[]>();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    for (const reading of readings) {
      const readingDate = new Date(reading.timestamp);
      if (readingDate < cutoff) continue;

      const dateKey = reading.timestamp.slice(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(reading.value);
    }

    // Calculate daily averages
    const result = Array.from(byDate.entries())
      .map(([date, values]) => ({
        date,
        dateFormatted: new Date(date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }, [readings, days]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
          Daily Average Glucose
        </h3>
        <p className="text-slate-400 dark:text-slate-500 text-center py-8">
          No data available
        </p>
      </div>
    );
  }

  const overallAvg = Math.round(
    chartData.reduce((sum, d) => sum + d.average, 0) / chartData.length
  );

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Daily Average Glucose
        </h3>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Avg: {overallAvg} mg/dL
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="dateFormatted"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[60, 160]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value: number, name: string) => {
              if (name === "average") return [`${value} mg/dL`, "Average"];
              return [value, name];
            }}
          />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={overallAvg} stroke="#94a3b8" strokeDasharray="5 5" strokeOpacity={0.7} />
          <Bar dataKey="average" fill="#22c55e" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="count"
              position="top"
              fill="#94a3b8"
              fontSize={9}
              formatter={(v: number) => `${v}`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function GlucoseSection({ lingoData }: GlucoseSectionProps) {
  const [rangeDays, setRangeDays] = useState<number>(7);

  const filteredReadings = useMemo(() => {
    if (!lingoData?.history) return [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);

    return lingoData.history.filter((reading) => {
      const readingTime = new Date(reading.timestamp);
      return readingTime >= cutoff;
    });
  }, [lingoData?.history, rangeDays]);

  // Calculate stats for current range
  const rangeStats = useMemo(() => {
    if (filteredReadings.length === 0) return null;
    const values = filteredReadings.map((r) => r.value);
    return {
      average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }, [filteredReadings]);

  // Prepare trend chart data (daily averages for the selected range)
  const trendChartData = useMemo(() => {
    if (filteredReadings.length === 0) return [];

    // Group by date and calculate daily average
    const byDate = new Map<string, number[]>();

    for (const reading of filteredReadings) {
      const dateKey = reading.timestamp.slice(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(reading.value);
    }

    return Array.from(byDate.entries())
      .map(([date, values]) => ({
        date: new Date(date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        rawDate: date,
        value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [filteredReadings]);

  if (!lingoData) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-6 text-center">
        <p className="text-slate-500 dark:text-slate-400 mb-2">
          No Lingo data available
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Export your data from{" "}
          <a
            href="https://www.libreview.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-500 hover:underline"
          >
            LibreView.com
          </a>{" "}
          and run:{" "}
          <code className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
            npm run import-lingo
          </code>
        </p>
      </div>
    );
  }

  const current = lingoData.current;

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

      {/* Current Reading + Stats Summary */}
      {(current || rangeStats) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {current && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Latest Reading
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-bold"
                  style={{ color: getGlucoseColor(current.value) }}
                >
                  {current.value}
                </span>
                <span className="text-sm text-slate-500">mg/dL</span>
                {current.trend && (
                  <span className="text-xl">{getTrendArrow(current.trend)}</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(current.timestamp).toLocaleString()}
              </p>
            </div>
          )}
          {rangeStats && (
            <>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Average ({rangeDays}D)
                </p>
                <span
                  className="text-3xl font-bold"
                  style={{ color: getGlucoseColor(rangeStats.average) }}
                >
                  {rangeStats.average}
                </span>
                <span className="text-sm text-slate-500 ml-1">mg/dL</span>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Range ({rangeDays}D)
                </p>
                <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">
                  {rangeStats.min} - {rangeStats.max}
                </span>
                <span className="text-sm text-slate-500 ml-1">mg/dL</span>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Readings ({rangeDays}D)
                </p>
                <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">
                  {rangeStats.count.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlucoseTrendChart
          title="Glucose Trend"
          data={trendChartData}
          color="#22c55e"
          average={rangeStats?.average}
          showOptimalRange={true}
        />
        <TimeInRangeBar readings={filteredReadings} />
      </div>

      {/* Daily Average Bar Chart */}
      <DailyAverageChart readings={lingoData.history} days={rangeDays} />

      {/* Data source info */}
      <div className="text-xs text-slate-400 dark:text-slate-500">
        {lingoData.source === "csv_import" ? (
          <>
            Imported from LibreView CSV |{" "}
            {lingoData.importedAt && `Last import: ${new Date(lingoData.importedAt).toLocaleString()}`}
          </>
        ) : (
          <>
            {lingoData.sensor?.serialNumber && `Sensor: ${lingoData.sensor.serialNumber} | `}
            Last updated: {new Date(lingoData.fetchedAt).toLocaleString()}
          </>
        )}
      </div>
    </div>
  );
}
