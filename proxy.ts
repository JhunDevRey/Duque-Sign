import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (!data.user || error) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const unauthorized = NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
      unauthorized.cookies.delete("duque_session");
      unauthorized.cookies.delete("__Host-duque_session");
      return unauthorized;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.delete("duque_session");
    redirect.cookies.delete("__Host-duque_session");
    return redirect;
  }
  response.cookies.delete("duque_session");
  response.cookies.delete("__Host-duque_session");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/documents/:path*",
    "/templates/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/onboarding",
    "/api/organizations",
    "/api/auth/session",
  ],
};
