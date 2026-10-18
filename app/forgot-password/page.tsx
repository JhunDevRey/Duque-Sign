"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createSupabaseBrowserClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

function InvalidLinkNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "link_invalid") return null;
  return (
    <Notice tone="warning" title="That reset link didn't work" className="mb-4">
      It may have expired or already been used, or it was opened in a different browser from the one where you
      requested it. Request a new link below and open it in this browser.
    </Notice>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/reset-password");
      const { error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: redirectTo.toString() },
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the password reset email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPage title="Reset your password" subtitle="Enter the email address associated with your account.">
      {!isSupabaseClientConfigured ? (
        <Notice tone="warning" title="Supabase is not configured">Configure Supabase Auth before requesting a password reset.</Notice>
      ) : sent ? (
        <Notice tone="success" title="If the account exists, a reset email was sent.">
          Check your inbox and follow the password reset link.
        </Notice>
      ) : (
        <>
          <Suspense fallback={null}><InvalidLinkNotice /></Suspense>
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">{submitting ? "Sending…" : "Send reset link"}</Button>
          </form>
        </>
      )}
      <p className="mt-5 text-center text-body-medium"><Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link></p>
    </AuthPage>
  );
}
