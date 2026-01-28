"use client";

import { BiomarkerDataStore, getLatestMeasurement, isValueInRange, formatDateMonYY } from "@/lib/biomarkers";

interface BiomarkerSummaryTableProps {
  data: BiomarkerDataStore;
  onBiomarkerClick?: (categoryId: string, biomarkerId: string) => void;
}

interface BiomarkerRow {
  name: string;
  biomarkerId: string;
  categoryId: string;
  value: number;
  unit: string;
  optimalRange: string;
  date: string;
  inRange: boolean | null;
}

interface CategoryGroup {
  name: string;
  categoryId: string;
  rows: BiomarkerRow[];
}

/** Format value to max 2 decimal places */
function formatValue(val: number): string {
  if (Number.isInteger(val)) return String(val);
  return val.toFixed(2).replace(/\.?0+$/, ""); // Remove trailing zeros
}

export default function BiomarkerSummaryTable({ data, onBiomarkerClick }: BiomarkerSummaryTableProps) {
  const groups: CategoryGroup[] = [];

  for (const category of data.categories) {
    const rows: BiomarkerRow[] = [];

    for (const biomarker of category.biomarkers) {
      const latest = getLatestMeasurement(biomarker);
      if (!latest || latest.value == null) continue;

      const inRange = isValueInRange(latest.value, biomarker.optimalRange);

      rows.push({
        name: biomarker.name,
        biomarkerId: biomarker.id,
        categoryId: category.id,
        value: latest.value,
        unit: biomarker.unit || "",
        optimalRange: biomarker.optimalRange,
        date: latest.date,
        inRange,
      });
    }

    // Sort rows within category: out of range first, then alphabetically
    rows.sort((a, b) => {
      if (a.inRange !== b.inRange) {
        if (a.inRange === false) return -1;
        if (b.inRange === false) return 1;
      }
      return a.name.localeCompare(b.name);
    });

    if (rows.length > 0) {
      groups.push({ name: category.name, categoryId: category.id, rows });
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-600/50 overflow-hidden mb-6">
      <div className="p-4 border-b border-slate-200 dark:border-slate-600">
        <h3 className="font-semibold text-slate-900 dark:text-white">Summary of Biomarkers</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Click any biomarker to see its trend chart</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Biomarker</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Value</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Optimal</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Date</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <>
                {/* Category header row */}
                <tr key={`header-${group.name}`} className="bg-slate-100 dark:bg-slate-700">
                  <td colSpan={4} className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    {group.name}
                  </td>
                </tr>
                {/* Biomarker rows */}
                {group.rows.map((row, idx) => (
                  <tr
                    key={`${group.name}-${row.name}`}
                    onClick={() => onBiomarkerClick?.(row.categoryId, row.biomarkerId)}
                    className={`border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${
                      idx % 2 === 0 ? "bg-white dark:bg-slate-800/50" : "bg-slate-50/50 dark:bg-slate-800/30"
                    }`}
                  >
                    <td className="px-4 py-2 pl-6">
                      <span
                        className={`font-medium ${
                          row.inRange === true
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.inRange === false
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`font-semibold ${
                          row.inRange === true
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.inRange === false
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {formatValue(row.value)}
                        {row.unit && <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">{row.unit}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{row.optimalRange}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{formatDateMonYY(row.date)}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
