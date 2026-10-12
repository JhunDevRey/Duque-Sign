import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { uid: data.user.id, email: data.user.email ?? null, name: data.user.user_metadata.full_name ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    console.error("Supabase session lookup failed", cause);
    return NextResponse.json({ error: "Unable to verify the session." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Supabase sign-out failed", cause);
    return NextResponse.json({ error: "Unable to sign out." }, { status: 503 });
  }
}
