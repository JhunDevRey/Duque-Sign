"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { firebaseAuthMessage } from "@/lib/firebase/client-session";
import { firebaseAuthRequest, isFirebaseClientConfigured } from "@/lib/firebase/client";

export default function RegisterPage() {
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
      const user = await firebaseAuthRequest("signUp", {
        email: email.trim(),
        password,
        returnSecureToken: true,
      });
      const updatedUser = await firebaseAuthRequest("update", {
        idToken: user.idToken,
        displayName: name.trim(),
        returnSecureToken: true,
      });
      await firebaseAuthRequest("sendOobCode", {
        requestType: "VERIFY_EMAIL",
        idToken: updatedUser.idToken,
      });
      setComplete(true);
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
      setSubmitting(false);
    }
  }

  return (
    <AuthPage title="Create your account" subtitle="Use a verified email address to create an organization workspace.">
      {!isFirebaseClientConfigured ? (
        <Notice tone="warning" title="Firebase is not configured">
          Add your Firebase Web app settings to <code>.env.local</code> before creating accounts.
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
