import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("whoop_access_token");

  if (!accessToken) {
    redirect("/login");
  }

  return <Dashboard />;
}
