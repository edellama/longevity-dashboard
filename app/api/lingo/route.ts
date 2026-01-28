import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "data", "lingo.json");

    // Check if file exists
    try {
      await fs.access(dataPath);
    } catch {
      return NextResponse.json(
        { error: "Lingo data not found. Run: npm run fetch-lingo" },
        { status: 404 }
      );
    }

    const fileContent = await fs.readFile(dataPath, "utf-8");
    const data = JSON.parse(fileContent);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error reading Lingo data:", error);
    return NextResponse.json(
      { error: "Failed to read Lingo data" },
      { status: 500 }
    );
  }
}
