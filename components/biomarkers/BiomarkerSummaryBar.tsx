"use client";

import { BiomarkerDataStore, getLatestMeasurement, isValueInRange } from "@/lib/biomarkers";

interface BiomarkerSummaryBarProps {
  data: BiomarkerDataStore;
}

export default function BiomarkerSummaryBar({ data }: BiomarkerSummaryBarProps) {
  let total = 0;
  let optimal = 0;
  let outOfRange = 0;

  for (const category of data.categories) {
    for (const biomarker of category.biomarkers) {
      const latest = getLatestMeasurement(biomarker);
      if (!latest || latest.value == null) continue;

      total++;
      const inRange = isValueInRange(latest.value, biomarker.optimalRange);
      if (inRange === true) {
        optimal++;
      } else if (inRange === false) {
        outOfRange++;
      }
    }
  }

  const optimalPercent = total > 0 ? (optimal / total) * 100 : 0;
  const outOfRangePercent = total > 0 ? (outOfRange / total) * 100 : 0;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 p-6 mb-6">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">Biomarkers</h3>

      {/* Stats row */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="text-4xl font-light text-slate-700 dark:text-slate-200">{total}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Total</div>
        </div>
        <div>
          <div className="text-4xl font-light text-slate-700 dark:text-slate-200">{optimal}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Optimal</div>
        </div>
        <div>
          <div className="text-4xl font-light text-slate-700 dark:text-slate-200">{outOfRange}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Out of Range</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${optimalPercent}%` }}
        />
        <div
          className="bg-pink-400 transition-all duration-500"
          style={{ width: `${outOfRangePercent}%` }}
        />
      </div>
    </div>
  );
}
