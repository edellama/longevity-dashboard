/**
 * API endpoint to serve Garmin data from the JSON file.
 * The JSON file is created by running: npm run fetch-garmin
 *
 * GET /api/garmin
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const jsonPath = path.join(process.cwd(), "public", "garmin_data.json");

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json(
        {
          error: "Garmin data not found",
          message: "Run 'npm run garmin-setup' to configure Garmin, then 'npm run fetch-garmin' to fetch data.",
        },
        { status: 404 }
      );
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Garmin API] Error:", error);
    return NextResponse.json(
      { error: "Failed to read Garmin data" },
      { status: 500 }
    );
  }
}
