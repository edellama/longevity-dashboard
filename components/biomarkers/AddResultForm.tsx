"use client";

import { useState } from "react";
import {
  BiomarkerDataStore,
  Biomarker,
  addMeasurementToStore,
} from "@/lib/biomarkers";

interface AddResultFormProps {
  data: BiomarkerDataStore;
  onSave: (next: BiomarkerDataStore) => void;
  onClose: () => void;
}

export default function AddResultForm({
  data,
  onSave,
  onClose,
}: AddResultFormProps) {
  const [date, setDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [provider, setProvider] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const allBiomarkers: { id: string; name: string; unit?: string }[] = [];
  data.categories.forEach((cat) => {
    cat.biomarkers.forEach((b) =>
      allBiomarkers.push({ id: b.id, name: b.name, unit: b.unit })
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const results = allBiomarkers.map((b) => {
      const v = values[b.id]?.trim();
      const num = v === "" || v === "X" ? null : Number(v);
      return {
        biomarkerId: b.id,
        value: num != null && !Number.isNaN(num) ? num : null,
      };
    });
    const next = addMeasurementToStore(data, {
      date,
      provider: provider || "Manual",
      results,
    });
    onSave(next);
    onClose();
  };

  const setValue = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-600">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Add lab result
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Provider
            </label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. LabCorp, Quest"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Results (leave blank or X for no data)
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allBiomarkers.map((b) => (
                <div key={b.id} className="flex items-center gap-2">
                  <label className="w-40 text-sm text-slate-600 dark:text-slate-400 shrink-0">
                    {b.name}
                    {b.unit ? ` (${b.unit})` : ""}
                  </label>
                  <input
                    type="text"
                    value={values[b.id] ?? ""}
                    onChange={(e) => setValue(b.id, e.target.value)}
                    placeholder="X"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
