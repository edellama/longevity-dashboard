"use client";

import { getCategoryStats, getCategoryStatusColor, Biomarker, BiomarkerCategory } from "@/lib/biomarkers";

interface CategoryCardProps {
  name: string;
  biomarkers: Biomarker[];
}

export default function CategoryCard({ name, biomarkers }: CategoryCardProps) {
  const stats = getCategoryStats({ id: "", name, biomarkers });
  const status = getCategoryStatusColor(stats);

  const colorClasses = {
    green: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10",
    yellow: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10",
    red: "border-l-rose-500 bg-rose-50/50 dark:bg-rose-900/10",
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-600 border-l-4 p-4 ${colorClasses[status]}`}
    >
      <div className="font-semibold text-slate-900 dark:text-white">{name}</div>
      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {stats.inRange} in range · {stats.outOfRange} out · {stats.noData} no data
      </div>
    </div>
  );
}
