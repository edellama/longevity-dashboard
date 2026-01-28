import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "lingo.json");

interface HealthAutoExportReading {
  date: string; // ISO timestamp
  qty: number; // glucose value
  units?: string; // "mg/dL" or "mmol/L"
  source?: string;
}

interface HealthAutoExportPayload {
  data: {
    metrics: Array<{
      name: string;
      units: string;
      data: HealthAutoExportReading[];
    }>;
  };
}

interface StoredReading {
  timestamp: string;
  value: number;
  isHigh: boolean;
  isLow: boolean;
  source?: string;
}

interface StoredData {
  current: StoredReading | null;
  history: StoredReading[];
  stats: Record<string, number | null>;
  source: string;
  fetchedAt: string;
}

/**
 * POST /api/glucose/webhook
 * Receives glucose data from Health Auto Export app
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("Received glucose webhook:", JSON.stringify(payload).slice(0, 500));

    // Parse the incoming data - Health Auto Export sends data in various formats
    const newReadings: StoredReading[] = [];

    // Handle Health Auto Export format
    if (payload.data?.metrics) {
      for (const metric of payload.data.metrics) {
        if (metric.name?.toLowerCase().includes("glucose") ||
            metric.name?.toLowerCase().includes("blood_glucose")) {
          for (const reading of metric.data || []) {
            let value = reading.qty;

            // Convert mmol/L to mg/dL if needed
            if (metric.units === "mmol/L" || reading.units === "mmol/L") {
              value = Math.round(value * 18);
            }

            newReadings.push({
              timestamp: reading.date,
              value: Math.round(value),
              isHigh: value > 180,
              isLow: value < 70,
              source: reading.source || "Health Auto Export",
            });
          }
        }
      }
    }

    // Handle simple array format
    else if (Array.isArray(payload)) {
      for (const reading of payload) {
        let value = reading.qty || reading.value || reading.glucose;
        if (!value) continue;

        // Convert if mmol/L
        if (reading.units === "mmol/L" || value < 35) {
          value = Math.round(value * 18);
        }

        newReadings.push({
          timestamp: reading.date || reading.timestamp,
          value: Math.round(value),
          isHigh: value > 180,
          isLow: value < 70,
          source: reading.source || "Health Auto Export",
        });
      }
    }

    // Handle single reading format
    else if (payload.qty || payload.value || payload.glucose) {
      let value = payload.qty || payload.value || payload.glucose;

      if (payload.units === "mmol/L" || value < 35) {
        value = Math.round(value * 18);
      }

      newReadings.push({
        timestamp: payload.date || payload.timestamp || new Date().toISOString(),
        value: Math.round(value),
        isHigh: value > 180,
        isLow: value < 70,
        source: payload.source || "Health Auto Export",
      });
    }

    if (newReadings.length === 0) {
      console.log("No glucose readings found in payload");
      return NextResponse.json({
        success: true,
        message: "No glucose readings found",
        received: 0
      });
    }

    // Load existing data
    let existingData: StoredData = {
      current: null,
      history: [],
      stats: {},
      source: "health_auto_export",
      fetchedAt: new Date().toISOString(),
    };

    try {
      const fileContent = await fs.readFile(DATA_PATH, "utf-8");
      existingData = JSON.parse(fileContent);
    } catch {
      // File doesn't exist yet, use defaults
      console.log("No existing data file, creating new one");
    }

    // Merge new readings with existing (avoid duplicates by timestamp)
    const existingTimestamps = new Set(
      existingData.history.map((r) => r.timestamp)
    );

    let addedCount = 0;
    for (const reading of newReadings) {
      if (!existingTimestamps.has(reading.timestamp)) {
        existingData.history.push(reading);
        existingTimestamps.add(reading.timestamp);
        addedCount++;
      }
    }

    // Sort by timestamp (newest first)
    existingData.history.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Update current reading (most recent)
    if (existingData.history.length > 0) {
      existingData.current = existingData.history[0];
    }

    // Recalculate stats
    const values = existingData.history.map((r) => r.value);
    if (values.length > 0) {
      existingData.stats = {
        average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
        inRange: values.filter((v) => v >= 70 && v <= 180).length,
        high: values.filter((v) => v > 180).length,
        low: values.filter((v) => v < 70).length,
      };
    }

    existingData.fetchedAt = new Date().toISOString();
    existingData.source = "health_auto_export";

    // Save updated data
    const dataDir = path.dirname(DATA_PATH);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(existingData, null, 2));

    console.log(`Added ${addedCount} new glucose readings. Total: ${existingData.history.length}`);

    return NextResponse.json({
      success: true,
      message: `Received ${newReadings.length} readings, added ${addedCount} new`,
      total: existingData.history.length,
      current: existingData.current?.value,
    });
  } catch (error) {
    console.error("Error processing glucose webhook:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/glucose/webhook
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Glucose webhook endpoint ready",
    usage: "POST glucose data from Health Auto Export to this endpoint",
  });
}
