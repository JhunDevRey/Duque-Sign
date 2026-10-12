"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createSupabaseBrowserClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/login?confirmed=1");
      const { data, error: signUpError } = await createSupabaseBrowserClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: callback.toString(),
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your account.");
      setSubmitting(false);
    }
  }

  return (
    <AuthPage title="Create your account" subtitle="Use a verified email address to create an organization workspace.">
      {!isSupabaseClientConfigured ? (
        <Notice tone="warning" title="Supabase is not configured">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> before creating accounts.
        </Notice>
      ) : complete ? (
        <>
          <Notice tone="success" title="Check your inbox">
            We sent an email verification link to {email}. Verify your address, then sign in to create your organization.
          </Notice>
          <Link href="/login" className="mt-5 inline-flex text-sm text-accent hover:underline">Go to sign in</Link>
        </>
      ) : (
        <>
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name" htmlFor="name"><Input id="name" autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field label="Password" hint="At least 12 characters." htmlFor="password"><Input id="password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
            <Field label="Confirm password" htmlFor="confirmation"><Input id="confirmation" type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
            <Button type="submit" variant="primary" disabled={submitting} className="w-full">{submitting ? "Creating account…" : "Create account"}</Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </>
      )}
    </AuthPage>
  );
}
