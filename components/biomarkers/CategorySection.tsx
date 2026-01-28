"use client";

import { useState } from "react";
import {
  Biomarker,
  getLatestMeasurement,
  isValueInRange,
} from "@/lib/biomarkers";
import CategoryCard from "./CategoryCard";
import BiomarkerDetailChart from "./BiomarkerDetailChart";

interface CategorySectionProps {
  category: { id: string; name: string; biomarkers: Biomarker[] };
}

function formatValue(value: number | null, unit?: string): string {
  if (value == null || Number.isNaN(value)) return "—";
  const u = unit ? ` ${unit}` : "";
  return `${value}${u}`;
}

export default function CategorySection({ category }: CategorySectionProps) {
  const [open, setOpen] = useState(false);
  const [selectedBiomarker, setSelectedBiomarker] = useState<Biomarker | null>(null);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <span className="font-semibold text-slate-900 dark:text-white">
            {category.name}
          </span>
          <span className="text-slate-500">
            {open ? "▼" : "▶"}
          </span>
        </button>
        {open && (
          <div className="border-t border-slate-200 dark:border-slate-600">
            <div className="p-4 pt-0">
              <CategoryCard name={category.name} biomarkers={category.biomarkers} />
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-600">
              {category.biomarkers.map((b) => {
                const latest = getLatestMeasurement(b);
                const inRange = latest
                  ? isValueInRange(latest.value, latest.optimalRange || b.optimalRange)
                  : null;
                const prev = b.measurements
                  .filter((m) => m.value != null)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[1];
                const trend =
                  latest?.value != null && prev?.value != null
                    ? (latest.value as number) - (prev.value as number)
                    : null;

                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedBiomarker(b)}
                      className="w-full flex items-center justify-between py-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {b.name}
                      </span>
                      <div className="flex items-center gap-3">
                        {trend != null && (
                          <span
                            className={`text-xs ${
                              trend > 0 ? "text-amber-600" : trend < 0 ? "text-emerald-600" : "text-slate-500"
                            }`}
                          >
                            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
                          </span>
                        )}
                        <span
                          className={
                            inRange === true
                              ? "text-emerald-600 dark:text-emerald-400"
                              : inRange === false
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-slate-500"
                          }
                        >
                          {formatValue(latest?.value ?? null, b.unit)}
                        </span>
                        <span className="text-xs text-slate-400">{b.optimalRange}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {selectedBiomarker && (
        <BiomarkerDetailChart
          biomarker={selectedBiomarker}
          onClose={() => setSelectedBiomarker(null)}
        />
      )}
    </>
  );
}
