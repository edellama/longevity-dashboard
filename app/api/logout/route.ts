import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  
  // Clear Whoop tokens
  cookieStore.delete("whoop_access_token");
  cookieStore.delete("whoop_refresh_token");

  return NextResponse.json({ success: true });
}
