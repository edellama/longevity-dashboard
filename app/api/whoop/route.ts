import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";

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

    let endpoint = "";
    const params = new URLSearchParams();
    
    if (start) {
      params.append("start", start);
    }
    if (end) {
      params.append("end", end);
    }
    
    const queryString = params.toString();
    const queryParam = queryString ? `?${queryString}` : "";

    switch (type) {
      case "recovery":
        endpoint = `/recovery${queryParam}`;
        break;
      case "sleep":
        endpoint = `/activity/sleep${queryParam}`;
        break;
      case "workout":
        endpoint = `/activity/workout${queryParam}`;
        break;
      case "profile":
        endpoint = "/user/profile/basic";
        break;
      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 }
        );
    }

    const data = await fetchWhoopData(endpoint);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Whoop API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
