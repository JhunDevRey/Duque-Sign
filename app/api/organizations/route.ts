import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return errorResponse("Sign in to continue.", 401);

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", authData.user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) {
      return NextResponse.json({ organizations: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", membership.organization_id)
      .maybeSingle();
    if (organizationError) throw organizationError;
    return NextResponse.json({
      organizations: organization ? [{ ...organization, role: membership.role }] : [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Organization lookup failed", cause);
    return errorResponse("Unable to load organization membership.", 503);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin.", 403);

  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return errorResponse("Sign in to continue.", 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON request body.", 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return errorResponse("Organization details are invalid.", 400);
    }
    const bodyRecord = body as Record<string, unknown>;
    if (Object.keys(bodyRecord).some((key) => key !== "name")) {
      return errorResponse("Only the organization name can be provided.", 400);
    }
    const name = bodyRecord.name;
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
      return errorResponse("Organization name must be 2–120 characters.", 400);
    }

    // Creates the organization and owner membership atomically (supabase/migrations/003_create_organization.sql).
    const { data: created, error: createError } = await supabase
      .rpc("create_organization", { p_name: name.trim() })
      .single();
    if (createError?.code === "23505") return errorResponse("You already belong to an organization.", 409);
    if (createError?.code === "22023") return errorResponse("Organization name must be 2–120 characters.", 400);
    if (createError) throw createError;

    return NextResponse.json({
      organization: { id: created.id, name: created.name, role: created.role },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Organization creation failed", cause);
    return errorResponse("Unable to create the organization. Check Supabase server configuration.", 503);
  }
}
