"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createSupabaseBrowserClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

function InvalidConfirmationNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("auth_error") !== "confirmation") return null;
  return (
    <Notice tone="warning" title="That confirmation link didn't work" className="mb-4">
      It may have expired or already been used, or it was opened in a different browser from the one where you
      registered. If you already confirmed your email, sign in below. Otherwise, register again with the same email
      to get a new link.
    </Notice>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    setProgress("Checking your account…");
    try {
      const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      setProgress("Opening your workspace…");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <AuthPage title="Sign in" subtitle="Sign in to manage your organization's document workspace.">
      {!isSupabaseClientConfigured ? (
        <>
          <Notice tone="warning" title="Supabase is not configured">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> to enable accounts.
          </Notice>
        </>
      ) : (
        <>
          <Suspense fallback={null}><InvalidConfirmationNotice /></Suspense>
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
          {progress && (
            <Notice tone="accent" className="mb-4">
              <span role="status" aria-live="polite">{progress}</span>
            </Notice>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field label="Password" htmlFor="password"><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-title-small text-primary underline-offset-4 hover:underline">Forgot password?</Link>
            </div>
            <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">{submitting ? "Signing in…" : "Sign in"}</Button>
          </form>
          <p className="mt-5 text-center text-body-medium text-on-surface-variant">
            Don&apos;t have an account? <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">Create an account</Link>
          </p>
        </>
      )}
    </AuthPage>
  );
}
