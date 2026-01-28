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
} from "@/lib/biomarkers";

interface BiomarkerDetailChartProps {
  biomarker: Biomarker;
  onClose: () => void;
}

export default function BiomarkerDetailChart({
  biomarker,
  onClose,
}: BiomarkerDetailChartProps) {
  const points = getMeasurementsForChart(biomarker);
  const range = parseOptimalRangeForChart(biomarker.optimalRange);

  if (points.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {biomarker.name}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ✕
            </button>
          </div>
          <p className="text-slate-600 dark:text-slate-400">No measurement history yet.</p>
        </div>
      </div>
    );
  }

  const yMin = Math.min(...points.map((p) => p.value));
  const yMax = Math.max(...points.map((p) => p.value));
  const padding = (yMax - yMin) * 0.2 || 1;
  const domainMin = Math.floor(yMin - padding);
  const domainMax = Math.ceil(yMax + padding);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-600">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {biomarker.name}
            </h3>
            <p className="text-sm text-slate-500">
              Optimal: {biomarker.optimalRange}
              {biomarker.unit ? ` ${biomarker.unit}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            ✕
          </button>
        </div>
        <div className="p-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              {range && (
                <ReferenceArea
                  y1={range.min}
                  y2={range.max}
                  fill="#059669"
                  fillOpacity={0.15}
                  strokeOpacity={0}
                />
              )}
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
              />
              <YAxis
                domain={[domainMin, domainMax]}
                tick={{ fill: "#64748b", fontSize: 11 }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => [
                  `${value}${biomarker.unit ? ` ${biomarker.unit}` : ""}`,
                  "Value",
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={(props) => {
                  const inRange = points[props.index]?.inRange;
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill={inRange ? "#059669" : "#dc2626"}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
