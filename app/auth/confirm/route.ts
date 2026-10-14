import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authLinkErrorPath, safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType);
}

// Token-hash flow for email links. Unlike /auth/callback it does not need a cookie from the
// browser that requested the email, so links work when opened in a mail app or another device.
// Email templates link here as: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/onboarding");

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(authLinkErrorPath(type === "recovery" ? "/reset-password" : next), url.origin));
}
