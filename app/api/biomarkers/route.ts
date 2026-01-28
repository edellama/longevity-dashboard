/**
 * API endpoint to read biomarker data directly from Excel file.
 * This allows real-time updates when the Excel file is modified.
 *
 * GET /api/biomarkers
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Disable caching so Excel changes are reflected immediately
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const NAME_COL = 0;
const RANGE_COL = 1;
// Value columns: odd indices starting at 3
const VALUE_COL_INDICES: number[] = [];
for (let col = 3; col < 200; col += 2) VALUE_COL_INDICES.push(col);

/** Convert Excel serial number to YYYY-MM-DD */
function excelSerialToISODate(serial: unknown): string | null {
  if (serial == null || serial === "" || (typeof serial === "number" && (Number.isNaN(serial) || serial < 1))) return null;
  if (typeof serial === "number") {
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Normalize cell to number or null */
function toNumber(val: unknown): number | null {
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

interface Measurement {
  date: string;
  value: number;
  provider: string;
}

interface Biomarker {
  name: string;
  optimalRange: string;
  measurements: Measurement[];
}

interface Category {
  name: string;
  biomarkers: Biomarker[];
}

async function parseExcelFile(filePath: string): Promise<{ categories: Category[] } | null> {
  if (!fs.existsSync(filePath)) {
    console.log("[API] Excel file not found:", filePath);
    return null;
  }

  try {
    // Dynamic import of xlsx to avoid bundling issues
    const XLSX = await import("xlsx");

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

    const providerRow = rows[1] || [];
    const dateRow = rows[2] || [];

    // Build list of { colIndex, provider, date } for value columns
    const valueColumns: { colIndex: number; provider: string; date: string }[] = [];
    for (const col of VALUE_COL_INDICES) {
      const providerCell = providerRow[col];
      const provider = (providerCell != null && providerCell !== "") ? String(providerCell).trim() : "";
      const date = excelSerialToISODate(dateRow[col]);
      if (date) valueColumns.push({ colIndex: col, provider, date });
    }

    const categories: Category[] = [];
    let currentCategory: Category | null = null;

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

      const measurements: Measurement[] = [];
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

    console.log("[API] Parsed Excel successfully:", categories.length, "categories");
    return { categories };
  } catch (error) {
    console.error("[API] Error parsing Excel:", error);
    return null;
  }
}

export async function GET() {
  try {
    // Look for Excel file in the project root
    const excelPath = path.join(process.cwd(), "biomarker_data.xlsx");
    console.log("[API] Looking for Excel at:", excelPath);

    const data = await parseExcelFile(excelPath);

    if (!data) {
      // Fallback to JSON file if Excel not found or parsing failed
      const jsonPath = path.join(process.cwd(), "public", "biomarker_data.json");
      console.log("[API] Falling back to JSON at:", jsonPath);

      if (fs.existsSync(jsonPath)) {
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        return NextResponse.json(jsonData, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }
      return NextResponse.json({ error: "No biomarker data found" }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[API] Error in GET handler:", error);
    return NextResponse.json(
      { error: "Failed to read biomarker data", details: String(error) },
      { status: 500 }
    );
  }
}
