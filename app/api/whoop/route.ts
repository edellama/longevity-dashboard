import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";
const WHOOP_PAGE_LIMIT = 25;

async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("whoop_access_token")?.value || null;
}

async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("whoop_refresh_token")?.value || null;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    console.log("[Whoop] No refresh token available");
    return null;
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Whoop] Missing OAuth credentials for token refresh");
    return null;
  }

  try {
    console.log("[Whoop] Attempting to refresh access token...");
    const response = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Whoop] Token refresh failed:", errorText);
      return null;
    }

    const tokenData = await response.json();
    const { access_token, refresh_token: new_refresh_token, expires_in } = tokenData;

    // Update cookies with new tokens
    const cookieStore = await cookies();
    cookieStore.set("whoop_access_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expires_in || 86400,
      path: "/",
    });

    if (new_refresh_token) {
      cookieStore.set("whoop_refresh_token", new_refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
    }

    console.log("[Whoop] Token refreshed successfully");
    return access_token;
  } catch (error) {
    console.error("[Whoop] Token refresh error:", error);
    return null;
  }
}

interface WhoopApiResponse {
  records?: unknown[];
  next_token?: string;
  [key: string]: unknown;
}

async function fetchWhoopData(endpoint: string, retryCount = 0): Promise<WhoopApiResponse> {
  let accessToken = await getAccessToken();

  if (!accessToken) {
    // Try to refresh if we have a refresh token
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }
  }

  const response = await fetch(`${WHOOP_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && retryCount === 0) {
      // Token expired, try to refresh and retry once
      console.log("[Whoop] Access token expired, attempting refresh...");
      const newToken = await refreshAccessToken();
      if (newToken) {
        return fetchWhoopData(endpoint, retryCount + 1);
      }
      throw new Error("Session expired - please log in again");
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
