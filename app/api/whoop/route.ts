import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";
const WHOOP_PAGE_LIMIT = 25;

async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("whoop_access_token")?.value || null;
}

async function fetchWhoopData(endpoint: string) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${WHOOP_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized - token may have expired");
    }
    throw new Error(`Whoop API error: ${response.statusText}`);
  }

  return response.json();
}

/** Fetch all pages for a collection endpoint (recovery, sleep, workout). */
async function fetchWhoopCollection(
  path: string,
  start: string | null,
  end: string | null
): Promise<{ records: unknown[] }> {
  const allRecords: unknown[] = [];
  let nextToken: string | null = null;

  do {
    const params = new URLSearchParams();
    if (start) params.append("start", start);
    if (end) params.append("end", end);
    params.append("limit", String(WHOOP_PAGE_LIMIT));
    if (nextToken) params.append("nextToken", nextToken);

    const queryParam = `?${params.toString()}`;
    const data = await fetchWhoopData(`${path}${queryParam}`);

    const records = data.records ?? [];
    allRecords.push(...records);

    nextToken = data.next_token ?? null;
  } while (nextToken);

  return { records: allRecords };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!type) {
      return NextResponse.json(
        { error: "Missing 'type' parameter" },
        { status: 400 }
      );
    }

    if (type === "profile") {
      const data = await fetchWhoopData("/user/profile/basic");
      return NextResponse.json(data);
    }

    const isCollection =
      type === "recovery" ||
      type === "sleep" ||
      type === "workout";

    if (isCollection) {
      const path =
        type === "recovery"
          ? "/recovery"
          : type === "sleep"
          ? "/activity/sleep"
          : "/activity/workout";

      const data = await fetchWhoopCollection(path, start, end);
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Whoop API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
