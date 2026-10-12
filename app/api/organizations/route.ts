import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", authData.user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (membership) return errorResponse("You already belong to an organization.", 409);

    const admin = createSupabaseAdminClient();
    const { data: organization, error: createOrganizationError } = await admin
      .from("organizations")
      .insert({ name: name.trim(), created_by: authData.user.id })
      .select("id, name")
      .single();
    if (createOrganizationError) throw createOrganizationError;

    const { error: membershipInsertError } = await admin
      .from("organization_members")
      .insert({
        organization_id: organization.id,
        user_id: authData.user.id,
        role: "owner",
      });
    if (membershipInsertError) {
      const { error: rollbackError } = await admin.from("organizations").delete().eq("id", organization.id);
      if (rollbackError) console.error("Failed to clean up incomplete organization creation", rollbackError);
      throw membershipInsertError;
    }

    return NextResponse.json({
      organization: { id: organization.id, name: organization.name, role: "owner" },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Organization creation failed", cause);
    return errorResponse("Unable to create the organization. Check Supabase server configuration.", 503);
  }
}
