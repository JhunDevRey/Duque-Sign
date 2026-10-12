"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { firebaseAuthMessage, establishServerSession, getPostLoginPath } from "@/lib/firebase/client-session";
import {
  firebaseAuthRequest,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    setProgress("Checking your account with Firebase…");
    try {
      const user = await firebaseAuthRequest("signInWithPassword", {
        email: email.trim(),
        password,
        returnSecureToken: true,
      });
      setProgress("Creating your secure session…");
      await establishServerSession(user.idToken);
      setProgress("Loading your organization…");
      const destination = await getPostLoginPath();
      setProgress("Opening your workspace…");
      window.location.assign(destination);
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <AuthPage title="Sign in" subtitle="Sign in to manage your organization's document workspace.">
      {!isFirebaseClientConfigured ? (
        <>
          <Notice tone="warning" title="Firebase is not configured">
            Add your Firebase Web app settings to <code>.env.local</code> to enable accounts. Local browser preview remains available.
          </Notice>
          <Link href="/dashboard" className="mt-5 inline-flex text-sm text-accent hover:underline">Continue to local workspace</Link>
        </>
      ) : (
        <>
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
              <Link href="/forgot-password" className="text-sm text-accent hover:underline">Forgot password?</Link>
            </div>
            <Button type="submit" variant="primary" disabled={submitting} className="w-full">{submitting ? "Signing in…" : "Sign in"}</Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            Don&apos;t have an account? <Link href="/register" className="text-accent hover:underline">Create an account</Link>
          </p>
        </>
      )}
    </AuthPage>
  );
}
