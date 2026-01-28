/**
 * Import biomarker data from Excel to public/biomarker_data.json
 *
 * Prerequisite: npm install (installs xlsx)
 *
 * Excel structure (0-based indices):
 * - Row 0: Empty
 * - Row 1: Provider names in columns 1, 3, 5... ("Optimal" in col 1, "Lifeforce" in col 3, etc.)
 * - Row 2: Dates as Excel serial numbers in columns 3, 5, 7...
 * - Row 3+: Category header (single cell in col 0) OR biomarker row (col 0 = name, col 1 = optimal range, cols 3,5,7... = values)
 *
 * Value columns: indices 3, 5, 7, 9, 11... (odd starting at 3)
 * Skip empty, "X", or non-numeric cells.
 *
 * Run: npm run import-biomarkers
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const CATEGORY_HEADERS = new Set([
  "Primary",
  "Metabolic Health",
  "Liver",
  "Vitamins",
  "Heart Health",
  "Kidney",
  "Inflammation",
  "Hormones",
  "Toxins",
  "Nutrients / Minerals",
]);

// Column indices: 0-based. Name=0, Optimal range=1; value columns at 3, 5, 7, 9, 11...
const NAME_COL = 0;
const RANGE_COL = 1;
// Value columns: odd indices starting at 3
const VALUE_COL_INDICES = [];
for (let col = 3; col < 200; col += 2) VALUE_COL_INDICES.push(col);

const INPUT_PATH = path.join(__dirname, "..", "biomarker_data.xlsx");
const OUTPUT_PATH = path.join(__dirname, "..", "public", "biomarker_data.json");

/** Convert Excel serial number to YYYY-MM-DD */
function excelSerialToISODate(serial) {
  if (serial == null || serial === "" || (typeof serial === "number" && (Number.isNaN(serial) || serial < 1))) return null;
  if (typeof serial === "number") {
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Normalize cell to number or null (empty / "X" / non-numeric = null) */
function toNumber(val) {
  if (val == null || val === "") return null;
  if (typeof val === "string") {
    const s = val.trim().toUpperCase();
    if (s === "X" || s === "") return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  return null;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error("Excel file not found:", INPUT_PATH);
    process.exit(1);
  }

  const workbook = XLSX.readFile(INPUT_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const providerRow = rows[1] || [];
  const dateRow = rows[2] || [];

  // Build list of { colIndex, provider, date } for value columns (3, 5, 7, 9, ...)
  const valueColumns = [];
  for (const col of VALUE_COL_INDICES) {
    const provider = (providerRow[col] != null && providerRow[col] !== "") ? String(providerRow[col]).trim() : null;
    const date = excelSerialToISODate(dateRow[col]);
    if (date) valueColumns.push({ colIndex: col, provider: provider || "", date });
  }

  const categories = [];
  let currentCategory = null;

  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] || [];
    const nameCell = row[NAME_COL];
    const name = nameCell != null ? String(nameCell).trim() : "";
    const optimalRange = row[RANGE_COL] != null ? String(row[RANGE_COL]).trim() : "";

    if (!name) continue;

    if (CATEGORY_HEADERS.has(name)) {
      currentCategory = { name, biomarkers: [] };
      categories.push(currentCategory);
      continue;
    }

    if (!currentCategory) continue;

    const measurements = [];
    for (const { colIndex, provider, date } of valueColumns) {
      const raw = row[colIndex];
      const num = toNumber(raw);
      if (num !== null) measurements.push({ date, value: num, provider });
    }

    measurements.sort((a, b) => a.date.localeCompare(b.date));

    currentCategory.biomarkers.push({
      name,
      optimalRange: optimalRange || "",
      measurements,
    });
  }

  const out = { categories };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", OUTPUT_PATH);
  console.log("Categories:", categories.length);
  console.log(
    "Biomarkers:",
    categories.reduce((sum, c) => sum + c.biomarkers.length, 0)
  );
}

main();
