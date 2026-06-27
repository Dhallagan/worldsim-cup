import { NextResponse } from "next/server";
import { auth0, hasAuth0Config } from "./lib/auth0";

export async function proxy(request: Request) {
  if (!hasAuth0Config() || !auth0) {
    return NextResponse.next();
  }

  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|deck.html).*)"],
};
