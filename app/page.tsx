import { auth0, hasAuth0Config } from "@/lib/auth0";
import Dashboard from "./components/Dashboard";

export default async function Home() {
  const session =
    hasAuth0Config() && auth0 ? await auth0.getSession() : null;
  const userEmail = session?.user?.email ?? session?.user?.name ?? null;

  return <Dashboard userEmail={userEmail} />;
}
