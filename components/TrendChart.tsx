"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface TrendChartProps {
  title: string;
  data: { date: string; value: number }[];
  color: string;
  yAxisLabel: string;
  /** Optional Y-axis domain e.g. [20, 130] for HRV (ms) */
  yAxisDomain?: [number, number];
}

function formatValue(value: number, label: string): string {
  if (label === "Score") return `${Math.round(value)}%`;
  if (label === "ms") return `${value.toFixed(1)} ms`;
  if (label === "Hours") return `${value.toFixed(1)}h`;
  return value.toFixed(1);
}

function formatAvgLabel(value: number, yAxisLabel: string): string {
  if (yAxisLabel === "Score") return `Avg: ${Math.round(value)}%`;
  if (yAxisLabel === "ms") return `Avg: ${value.toFixed(1)} ms`;
  if (yAxisLabel === "Hours") return `Avg: ${value.toFixed(1)}h`;
  return `Avg: ${value.toFixed(1)}`;
}

export default function TrendChart({
  title,
  data,
  color,
  yAxisLabel,
  yAxisDomain,
}: TrendChartProps) {
  const periodAvg =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.value, 0) / data.length
      : null;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        {periodAvg != null && (
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">
            {formatAvgLabel(periodAvg, yAxisLabel)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`gradient-${title.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
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
            domain={yAxisDomain ?? ["auto", "auto"]}
            allowDataOverflow={!!yAxisDomain}
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
            formatter={(value: unknown) =>
              [formatValue(Number(value), yAxisLabel), "Value"]
            }
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#gradient-${title.replace(/\s/g, "-")})`}
            dot={{ fill: color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
