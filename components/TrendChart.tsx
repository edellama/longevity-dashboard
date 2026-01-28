"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TrendChartProps {
  title: string;
  data: { date: string; value: number }[];
  color: string;
  yAxisLabel: string;
}

function formatValue(value: number, label: string): string {
  if (label === "Score") return `${Math.round(value)}%`;
  if (label === "ms") return `${value.toFixed(1)} ms`;
  if (label === "Hours") return `${value.toFixed(1)}h`;
  return value.toFixed(1);
}

export default function TrendChart({
  title,
  data,
  color,
  yAxisLabel,
}: TrendChartProps) {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        {title}
      </h3>
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
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              style: { fill: "#64748b", fontSize: 12 },
            }}
          />
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
