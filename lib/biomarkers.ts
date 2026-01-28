/**
 * Biomarker data structures for loading from JSON or Excel-derived data.
 * Structure: categories -> biomarkers -> measurements (date, value, provider, optimalRange)
 */

export interface Measurement {
  date: string; // ISO date YYYY-MM-DD
  value: number | null; // null or "X" means no data
  provider: string;
  optimalRange: string;
}

export interface Biomarker {
  id: string;
  name: string;
  optimalRange: string;
  unit?: string;
  measurements: Measurement[];
}

export interface BiomarkerCategory {
  id: string;
  name: string;
  biomarkers: Biomarker[];
}

export interface BiomarkerDataStore {
  categories: BiomarkerCategory[];
  lastUpdated?: string;
}

/** Shape of /public/biomarker_data.json (categories have name only; biomarkers have name, optimalRange, measurements) */
export interface BiomarkerDataFromJSON {
  categories: {
    name: string;
    biomarkers: {
      name: string;
      optimalRange: string;
      unit?: string;
      measurements: { date: string; value: number | null; provider: string }[];
    }[];
  }[];
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Convert JSON from /biomarker_data.json into BiomarkerDataStore (adds id, copies optimalRange onto each measurement). */
export function normalizeBiomarkerDataFromJSON(
  json: BiomarkerDataFromJSON
): BiomarkerDataStore {
  return {
    categories: json.categories.map((cat) => ({
      id: slug(cat.name),
      name: cat.name,
      biomarkers: cat.biomarkers.map((b) => ({
        id: slug(b.name),
        name: b.name,
        optimalRange: b.optimalRange,
        unit: b.unit,
        measurements: b.measurements.map((m) => ({
          date: m.date,
          value: m.value,
          provider: m.provider,
          optimalRange: b.optimalRange,
        })),
      })),
    })),
    lastUpdated: new Date().toISOString(),
  };
}

/** Fetch biomarker data from API (reads Excel directly) or fallback to JSON. */
export async function fetchBiomarkerData(): Promise<BiomarkerDataStore | null> {
  if (typeof window === "undefined") return null;
  try {
    // Try API first (reads Excel file directly for real-time updates)
    // Add cache-busting query param to prevent browser caching
    const apiRes = await fetch(`/api/biomarkers?t=${Date.now()}`);
    if (apiRes.ok) {
      const json = (await apiRes.json()) as BiomarkerDataFromJSON;
      if (json?.categories?.length) {
        console.log("[Biomarkers] Loaded from Excel API:", json.categories.length, "categories");
        return normalizeBiomarkerDataFromJSON(json);
      }
    }
    // Fallback to static JSON file
    const res = await fetch("/biomarker_data.json");
    if (!res.ok) return null;
    const json = (await res.json()) as BiomarkerDataFromJSON;
    if (!json?.categories?.length) return null;
    console.log("[Biomarkers] Loaded from static JSON:", json.categories.length, "categories");
    return normalizeBiomarkerDataFromJSON(json);
  } catch (err) {
    console.error("[Biomarkers] Failed to fetch:", err);
    return null;
  }
}

const BIOMARKER_STORAGE_KEY = "longevity-biomarker-data";

/** Format date as "Mon YY" e.g. "Sep 25", "Jun 17" */
export function formatDateMonYY(isoDate: string): string {
  const d = new Date(isoDate);
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear().toString().slice(-2);
  return `${month} ${year}`;
}

function parseOptimalRange(range: string): { min: number; max: number } | null {
  if (!range || range === "X") return null;
  const s = String(range).trim().replace(/,/g, "");
  if (s.toLowerCase() === "nan") return null;
  // "50-400" or "50 - 400": between min and max
  const dash = s.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (dash) return { min: Number(dash[1]), max: Number(dash[2]) };
  // "50<>90" or "2 <> 5" or "12<> 25": between min and max
  const between = s.match(/([\d.]+)\s*<>\s*([\d.]+)/);
  if (between) return { min: Number(between[1]), max: Number(between[2]) };
  // "<90": less than 90
  const lt = s.match(/<\s*([\d.]+)/);
  if (lt) return { min: 0, max: Number(lt[1]) };
  // ">3": greater than 3
  const gt = s.match(/>\s*([\d.]+)/);
  if (gt) return { min: Number(gt[1]), max: Number(gt[1]) * 2 };
  const single = s.match(/([\d.]+)/);
  if (single) {
    const v = Number(single[1]);
    return { min: v, max: v };
  }
  return null;
}

export function isValueInRange(
  value: number | null,
  optimalRange: string
): boolean | null {
  if (value == null || Number.isNaN(value)) return null;
  const range = parseOptimalRange(optimalRange);
  if (!range) return null;
  const inRange = value >= range.min && value <= range.max;
  const gtOnly = />\s*[\d.]+/.test(optimalRange);
  if (gtOnly) return value >= range.min;
  const ltOnly = /<\s*[\d.]+/.test(optimalRange);
  if (ltOnly) return value <= range.max;
  return inRange;
}

export function getLatestMeasurement(b: Biomarker): Measurement | undefined {
  if (!b.measurements.length) return undefined;
  return [...b.measurements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
}

export function getMeasurementsForChart(b: Biomarker): { date: string; value: number; inRange: boolean }[] {
  const range = parseOptimalRange(b.optimalRange);
  const gtOnly = />\s*[\d.]+/.test(b.optimalRange);
  const ltOnly = /<\s*[\d.]+/.test(b.optimalRange);
  return b.measurements
    .filter((m): m is Measurement & { value: number } => m.value != null && !Number.isNaN(m.value))
    .map((m) => {
      const v = m.value as number;
      let inRange = true;
      if (range) {
        if (gtOnly) inRange = v >= range.min;
        else if (ltOnly) inRange = v <= range.max;
        else inRange = v >= range.min && v <= range.max;
      }
      return { date: m.date, value: v, inRange };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getCategoryStats(category: BiomarkerCategory): {
  total: number;
  inRange: number;
  outOfRange: number;
  noData: number;
} {
  let inRange = 0,
    outOfRange = 0,
    noData = 0;
  for (const b of category.biomarkers) {
    const latest = getLatestMeasurement(b);
    if (!latest || latest.value == null) {
      noData++;
      continue;
    }
    const inOptimal = isValueInRange(latest.value, latest.optimalRange || b.optimalRange);
    if (inOptimal === null) noData++;
    else if (inOptimal) inRange++;
    else outOfRange++;
  }
  return {
    total: category.biomarkers.length,
    inRange,
    outOfRange,
    noData,
  };
}

export function getCategoryStatusColor(stats: {
  inRange: number;
  outOfRange: number;
  total: number;
}): "green" | "yellow" | "red" {
  if (stats.outOfRange === 0 && stats.inRange === stats.total) return "green";
  if (stats.outOfRange > stats.total / 2) return "red";
  return "yellow";
}

function msr(date: string, value: number, provider: string, optimalRange: string): Measurement {
  return { date, value, provider, optimalRange };
}

// Lab dates from Excel in chronological order (oldest → newest) for display left → right
const LAB_DATES: { date: string; provider: string }[] = [
  { date: "2017-06-22", provider: "Athlete Blood Test" },
  { date: "2017-10-20", provider: "Athlete Blood Test" },
  { date: "2022-11-29", provider: "Insidetracker" },
  { date: "2023-07-28", provider: "Insidetracker" },
  { date: "2023-12-12", provider: "Insidetracker" },
  { date: "2024-05-09", provider: "Insidetracker" },
  { date: "2024-08-30", provider: "Insidetracker" },
  { date: "2024-11-04", provider: "Superpower" },
  { date: "2024-12-26", provider: "Lifeforce" },
  { date: "2024-12-31", provider: "Blueprint" },
  { date: "2024-12-31", provider: "Function Health" },
  { date: "2025-03-05", provider: "Function Health" },
  { date: "2025-03-15", provider: "Lifeforce" },
  { date: "2025-03-22", provider: "Mito Health" },
  { date: "2025-04-16", provider: "Superpower" },
  { date: "2025-05-01", provider: "Eternal" },
  { date: "2025-06-29", provider: "Lifeforce" },
  { date: "2025-07-02", provider: "Blokes" },
  { date: "2025-07-02", provider: "AXO" },
  { date: "2025-07-22", provider: "Biograph" },
  { date: "2025-08-21", provider: "Ultrahuman" },
  { date: "2025-09-04", provider: "Lifeforce" },
];

function createSampleData(): BiomarkerDataStore {
  // Full history (all 22 dates) - plausible values with slight trend and 1–2 out-of-range points
  const fastingGlucoseVals = [96, 94, 91, 89, 88, 87, 86, 90, 88, 89, 88, 87, 86, 85, 86, 87, 86, 85, 84, 86, 85, 89];
  const triglyceridesVals = [142, 138, 128, 122, 118, 115, 112, 110, 108, 106, 105, 104, 102, 100, 98, 96, 95, 94, 93, 92, 90, 88];
  const hdlVals = [42, 44, 48, 50, 52, 54, 55, 56, 57, 58, 58, 59, 60, 60, 61, 62, 62, 63, 64, 64, 65, 66];
  const bloodPressureVals = [122, 120, 118, 117, 116, 115, 114, 116, 115, 114, 113, 112, 111, 110, 109, 108, 108, 107, 106, 105, 104, 103];
  const fastingInsulinVals = [8.2, 7.8, 7.2, 6.8, 6.5, 6.2, 6.0, 6.2, 5.9, 5.8, 5.6, 5.5, 5.4, 5.3, 5.2, 5.1, 5.0, 4.9, 4.8, 4.7, 4.6, 4.8];
  const homaIrVals = [1.95, 1.82, 1.62, 1.50, 1.42, 1.34, 1.28, 1.38, 1.28, 1.26, 1.22, 1.18, 1.15, 1.12, 1.10, 1.08, 1.06, 1.04, 1.02, 1.00, 0.98, 1.02];
  const hba1cVals = [5.7, 5.6, 5.5, 5.45, 5.4, 5.35, 5.3, 5.35, 5.3, 5.28, 5.25, 5.22, 5.20, 5.18, 5.16, 5.14, 5.12, 5.10, 5.08, 5.06, 5.04, 5.20];
  const astVals = [30, 28, 26, 25, 24, 23, 22, 23, 22, 21, 21, 20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 18];
  const altVals = [38, 36, 34, 32, 30, 29, 28, 29, 28, 27, 26, 25, 24, 24, 23, 22, 22, 21, 21, 20, 20, 22];
  const ggtVals = [26, 24, 22, 21, 20, 19, 18, 19, 18, 17, 17, 16, 16, 15, 15, 14, 14, 14, 13, 13, 12, 14];
  const apobVals = [98, 96, 94, 92, 90, 88, 86, 87, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73, 76];
  const ldlVals = [108, 105, 100, 97, 94, 92, 90, 91, 89, 88, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 79];
  const lpaVals = [28, 27, 26, 25, 24, 24, 23, 23, 22, 22, 21, 21, 20, 20, 19, 19, 18, 18, 17, 17, 16, 18];
  const hscrpVals = [1.1, 1.0, 0.85, 0.78, 0.72, 0.68, 0.64, 0.66, 0.62, 0.60, 0.58, 0.56, 0.54, 0.52, 0.50, 0.48, 0.46, 0.45, 0.44, 0.42, 0.40, 0.48];
  const homocysteineVals = [11.5, 11.0, 10.2, 9.8, 9.4, 9.0, 8.7, 8.9, 8.5, 8.4, 8.2, 8.0, 7.8, 7.6, 7.4, 7.2, 7.0, 6.9, 6.8, 6.6, 6.4, 7.0];
  const uricAcidVals = [6.0, 5.8, 5.5, 5.3, 5.2, 5.1, 5.0, 5.1, 5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4.0, 3.9, 3.8, 4.2];

  // Hormones: recent panels only (from 2022 onward = 20 dates)
  const recentOnly = LAB_DATES.slice(2);
  const freeTVals = [15, 15.5, 16, 16.5, 17, 17.2, 17.5, 17.8, 18, 18.2, 18.5, 18.8, 19, 19.2, 19.5, 19.8, 20, 20.2, 20.5, 20.8];
  const totalTVals = [465, 478, 492, 505, 518, 528, 538, 548, 558, 568, 578, 588, 598, 608, 618, 628, 638, 648, 658, 668];
  const cortisolVals = [17, 16.5, 16, 15.5, 15, 14.5, 14, 14.2, 13.8, 13.5, 13.2, 13, 12.8, 12.5, 12.2, 12, 11.8, 11.5, 11.2, 11];
  const dheaVals = [185, 192, 200, 208, 216, 224, 232, 238, 244, 250, 256, 262, 268, 274, 280, 286, 292, 298, 304, 310];
  const igf1Vals = [128, 132, 136, 140, 144, 148, 152, 155, 158, 161, 164, 167, 170, 173, 176, 179, 182, 185, 188, 191];

  const primary = [
    {
      id: "fasting-glucose",
      name: "Fasting Glucose",
      optimalRange: "70-99",
      unit: "mg/dL",
      measurements: LAB_DATES.map((lab, i) => msr(lab.date, fastingGlucoseVals[i]!, lab.provider, "70-99")),
    },
    {
      id: "triglycerides",
      name: "Triglycerides",
      optimalRange: "<150",
      unit: "mg/dL",
      measurements: LAB_DATES.map((lab, i) => msr(lab.date, triglyceridesVals[i]!, lab.provider, "<150")),
    },
    {
      id: "hdl",
      name: "HDL",
      optimalRange: ">40",
      unit: "mg/dL",
      measurements: LAB_DATES.map((lab, i) => msr(lab.date, hdlVals[i]!, lab.provider, ">40")),
    },
    {
      id: "blood-pressure",
      name: "Blood Pressure",
      optimalRange: "<120/80",
      unit: "mmHg",
      measurements: LAB_DATES.map((lab, i) => msr(lab.date, bloodPressureVals[i]!, lab.provider, "<120/80")),
    },
  ];

  const metabolic = [
    {
      id: "fasting-insulin",
      name: "Fasting Insulin",
      optimalRange: "4-8",
      unit: "µIU/mL",
      measurements: LAB_DATES.map((lab, i) => msr(lab.date, fastingInsulinVals[i]!, lab.provider, "4-8")),
    },
    {
      id: "homa-ir",
      name: "HOMA-IR",
      optimalRange: "<2",
      unit: "",
      measurements: LAB_DATES.map((lab, i) => msr(lab.date, homaIrVals[i]!, lab.provider, "<2")),
    },
    {
      id: "hba1c",
      name: "HbA1c",
      optimalRange: "<5.7",
      unit: "%",
      measurements: LAB_DATES.map((lab, i) => msr(lab.date, hba1cVals[i]!, lab.provider, "<5.7")),
    },
  ];

  const liver = [
    { id: "ast", name: "AST", optimalRange: "10-40", unit: "U/L", measurements: LAB_DATES.map((lab, i) => msr(lab.date, astVals[i]!, lab.provider, "10-40")) },
    { id: "alt", name: "ALT", optimalRange: "7-56", unit: "U/L", measurements: LAB_DATES.map((lab, i) => msr(lab.date, altVals[i]!, lab.provider, "7-56")) },
    { id: "ggt", name: "GGT", optimalRange: "9-48", unit: "U/L", measurements: LAB_DATES.map((lab, i) => msr(lab.date, ggtVals[i]!, lab.provider, "9-48")) },
  ];

  const heart = [
    { id: "apob", name: "ApoB", optimalRange: "<100", unit: "mg/dL", measurements: LAB_DATES.map((lab, i) => msr(lab.date, apobVals[i]!, lab.provider, "<100")) },
    { id: "ldl", name: "LDL", optimalRange: "<100", unit: "mg/dL", measurements: LAB_DATES.map((lab, i) => msr(lab.date, ldlVals[i]!, lab.provider, "<100")) },
    { id: "lpa", name: "Lp(a)", optimalRange: "<30", unit: "mg/dL", measurements: LAB_DATES.map((lab, i) => msr(lab.date, lpaVals[i]!, lab.provider, "<30")) },
  ];

  const inflammation = [
    { id: "hscrp", name: "hsCRP", optimalRange: "<1", unit: "mg/L", measurements: LAB_DATES.map((lab, i) => msr(lab.date, hscrpVals[i]!, lab.provider, "<1")) },
    { id: "homocysteine", name: "Homocysteine", optimalRange: "5-15", unit: "µmol/L", measurements: LAB_DATES.map((lab, i) => msr(lab.date, homocysteineVals[i]!, lab.provider, "5-15")) },
    { id: "uric-acid", name: "Uric Acid", optimalRange: "3.5-7.2", unit: "mg/dL", measurements: LAB_DATES.map((lab, i) => msr(lab.date, uricAcidVals[i]!, lab.provider, "3.5-7.2")) },
  ];

  const hormones = [
    { id: "free-testosterone", name: "Free Testosterone", optimalRange: "9-30", unit: "ng/dL", measurements: recentOnly.map((lab, i) => msr(lab.date, freeTVals[i]!, lab.provider, "9-30")) },
    { id: "total-testosterone", name: "Total Testosterone", optimalRange: "264-916", unit: "ng/dL", measurements: recentOnly.map((lab, i) => msr(lab.date, totalTVals[i]!, lab.provider, "264-916")) },
    { id: "cortisol", name: "Cortisol", optimalRange: "6-23", unit: "µg/dL", measurements: recentOnly.map((lab, i) => msr(lab.date, cortisolVals[i]!, lab.provider, "6-23")) },
    { id: "dhea-s", name: "DHEA-S", optimalRange: "71-375", unit: "µg/dL", measurements: recentOnly.map((lab, i) => msr(lab.date, dheaVals[i]!, lab.provider, "71-375")) },
    { id: "igf-1", name: "IGF-1", optimalRange: "75-212", unit: "ng/mL", measurements: recentOnly.map((lab, i) => msr(lab.date, igf1Vals[i]!, lab.provider, "75-212")) },
  ];

  const categories: BiomarkerCategory[] = [
    { id: "primary", name: "Primary", biomarkers: primary },
    { id: "metabolic", name: "Metabolic Health", biomarkers: metabolic },
    { id: "liver", name: "Liver", biomarkers: liver },
    { id: "heart", name: "Heart Health", biomarkers: heart },
    { id: "inflammation", name: "Inflammation", biomarkers: inflammation },
    { id: "hormones", name: "Hormones", biomarkers: hormones },
  ];
  return { categories, lastUpdated: new Date().toISOString() };
}

export function loadBiomarkerData(): BiomarkerDataStore {
  if (typeof window === "undefined") return createSampleData();
  try {
    const raw = localStorage.getItem(BIOMARKER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BiomarkerDataStore;
      if (parsed?.categories?.length) return parsed;
    }
  } catch (_) {}
  return createSampleData();
}

export function saveBiomarkerData(data: BiomarkerDataStore): void {
  if (typeof window === "undefined") return;
  try {
    data.lastUpdated = new Date().toISOString();
    localStorage.setItem(BIOMARKER_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

export function addMeasurementToStore(
  store: BiomarkerDataStore,
  payload: { date: string; provider: string; results: { biomarkerId: string; value: number | null }[] }
): BiomarkerDataStore {
  const next = JSON.parse(JSON.stringify(store)) as BiomarkerDataStore;
  for (const cat of next.categories) {
    for (const b of cat.biomarkers) {
      const r = payload.results.find((x) => x.biomarkerId === b.id);
      if (r === undefined) continue;
      b.measurements.push({
        date: payload.date,
        provider: payload.provider,
        value: r.value,
        optimalRange: b.optimalRange,
      });
    }
  }
  saveBiomarkerData(next);
  return next;
}

export function parseOptimalRangeForChart(range: string): { min: number; max: number } | null {
  return parseOptimalRange(range);
}
