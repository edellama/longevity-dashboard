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

interface BiomarkerDetailChartProps {
  biomarker: Biomarker;
  onClose: () => void;
}

export default function BiomarkerDetailChart({ biomarker, onClose }: BiomarkerDetailChartProps) {
  const points = getMeasurementsForChart(biomarker);
  const range = parseOptimalRangeForChart(biomarker.optimalRange);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const latestInRange = latest?.inRange ?? null;

  const yMin = points.length ? Math.min(...points.map((p) => p.value)) : 0;
  const yMax = points.length ? Math.max(...points.map((p) => p.value)) : 100;
  const padding = (yMax - yMin) * 0.25 || 1;

  let domainMin = Math.floor(yMin - padding);
  let domainMax = Math.ceil(yMax + padding);

  if (range) {
    domainMin = Math.min(domainMin, Math.floor(range.min * 0.8));
    domainMax = Math.max(domainMax, Math.ceil(range.max * 1.2));
  }

  const formatTick = (v: number) =>
    Number.isInteger(v) ? String(v) : v.toFixed(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                {biomarker.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Optimal: {biomarker.optimalRange}
                {biomarker.unit ? ` ${biomarker.unit}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {latest != null && (
            <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-sm text-slate-600 dark:text-slate-400">Latest: </span>
              <span
                className={`text-lg font-semibold ${
                  latestInRange === true
                    ? "text-emerald-600 dark:text-emerald-400"
                    : latestInRange === false
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {formatTick(latest.value)}
                {biomarker.unit ? ` ${biomarker.unit}` : ""}
              </span>
              <span
                className={`ml-2 text-sm ${
                  latestInRange === true
                    ? "text-emerald-600 dark:text-emerald-400"
                    : latestInRange === false
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500"
                }`}
              >
                {latestInRange === true ? "✓ In range" : latestInRange === false ? "✗ Out of range" : ""}
              </span>
            </div>
          )}

          {points.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-dashed border-slate-200 dark:border-slate-600">
              <p className="text-slate-500 dark:text-slate-400">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={points}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
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
          )}

          {/* Measurement history */}
          {points.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">History</h4>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="text-left py-1">Date</th>
                      <th className="text-right py-1">Value</th>
                      <th className="text-right py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-1 text-slate-600 dark:text-slate-400">{formatDateMonYY(p.date)}</td>
                        <td className="py-1 text-right text-slate-800 dark:text-slate-200">
                          {formatTick(p.value)}{biomarker.unit ? ` ${biomarker.unit}` : ""}
                        </td>
                        <td className="py-1 text-right">
                          <span className={p.inRange ? "text-emerald-600" : "text-rose-600"}>
                            {p.inRange ? "✓" : "✗"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
