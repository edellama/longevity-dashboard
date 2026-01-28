"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import {
  Biomarker,
  getMeasurementsForChart,
  parseOptimalRangeForChart,
  formatDateMonYY,
} from "@/lib/biomarkers";

interface BiomarkerTrendChartProps {
  biomarker: Biomarker;
}

export default function BiomarkerTrendChart({ biomarker }: BiomarkerTrendChartProps) {
  const points = getMeasurementsForChart(biomarker);
  const range = parseOptimalRangeForChart(biomarker.optimalRange);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const latestInRange = latest?.inRange ?? null;

  const yMin = points.length ? Math.min(...points.map((p) => p.value)) : 0;
  const yMax = points.length ? Math.max(...points.map((p) => p.value)) : 100;
  const padding = (yMax - yMin) * 0.25 || 1;

  // Calculate domain to include optimal range bounds for better visualization
  let domainMin = Math.floor(yMin - padding);
  let domainMax = Math.ceil(yMax + padding);

  // Ensure optimal range is visible in the chart
  if (range) {
    domainMin = Math.min(domainMin, Math.floor(range.min * 0.8));
    domainMax = Math.max(domainMax, Math.ceil(range.max * 1.2));
  }

  if (points.length === 0) {
    return (
      <div
        id={`biomarker-chart-${biomarker.id}`}
        className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4 sm:p-6 scroll-mt-4"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {biomarker.name}
          </h3>
          <span className="text-sm text-slate-400">Optimal: {biomarker.optimalRange}</span>
        </div>
        <div className="h-[280px] flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-dashed border-slate-200 dark:border-slate-600">
          <p className="text-slate-500 dark:text-slate-400">No data</p>
        </div>
      </div>
    );
  }

  const formatTick = (v: number) =>
    Number.isInteger(v) ? String(v) : v.toFixed(1);

  return (
    <div
      id={`biomarker-chart-${biomarker.id}`}
      className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4 sm:p-6 scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {biomarker.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Optimal: {biomarker.optimalRange}
            {biomarker.unit ? ` ${biomarker.unit}` : ""}
          </p>
        </div>
        {latest != null && (
          <span
            className={`text-sm font-medium shrink-0 ${
              latestInRange === true
                ? "text-emerald-600 dark:text-emerald-400"
                : latestInRange === false
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Latest: {formatTick(latest.value)}
            {biomarker.unit ? ` ${biomarker.unit}` : ""}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={points}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          {/* Green shaded optimal zone - more visible like the reference */}
          {range && (
            <ReferenceArea
              y1={Math.max(range.min, domainMin)}
              y2={Math.min(range.max, domainMax)}
              fill="#10b981"
              fillOpacity={0.25}
              strokeOpacity={0}
            />
          )}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            className="dark:opacity-40"
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 12 }}
            angle={-35}
            textAnchor="end"
            height={56}
            tickLine={{ stroke: "#94a3b8" }}
            tickFormatter={(d) => formatDateMonYY(d)}
          />
          <YAxis
            domain={[domainMin, domainMax]}
            tick={{ fill: "#64748b", fontSize: 12 }}
            width={36}
            tickLine={{ stroke: "#94a3b8" }}
            tickFormatter={formatTick}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "none",
              borderRadius: "12px",
              color: "#f1f5f9",
              padding: "12px 16px",
            }}
            labelFormatter={(d) => formatDateMonYY(d)}
            formatter={(value: number) => [
              `${value}${biomarker.unit ? ` ${biomarker.unit}` : ""}`,
              "Value",
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0f766e"
            strokeWidth={2}
            dot={(props) => {
              const inRange = points[props.index]?.inRange;
              // Green for in-range, red for out-of-range (matching reference design)
              const fillColor = inRange ? "#10b981" : "#ef4444";
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={5}
                  fill={fillColor}
                  stroke="#fff"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 7, fill: "#0f766e", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
