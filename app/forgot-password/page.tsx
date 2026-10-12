"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { firebaseAuthMessage } from "@/lib/firebase/client-session";
import { firebaseAuthRequest, isFirebaseClientConfigured } from "@/lib/firebase/client";

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
      try {
        await firebaseAuthRequest("sendOobCode", {
          requestType: "PASSWORD_RESET",
          email: email.trim(),
        });
      } catch (cause) {
        if (!(cause instanceof Error) || !cause.message.includes("EMAIL_NOT_FOUND")) throw cause;
      }
      setSent(true);
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPage title="Reset your password" subtitle="Enter the email address associated with your account.">
      {!isFirebaseClientConfigured ? (
        <Notice tone="warning" title="Firebase is not configured">Configure Firebase Auth before requesting a password reset.</Notice>
      ) : sent ? (
        <Notice tone="success" title="If the account exists, a reset email was sent.">
          Check your inbox and follow the password reset link.
        </Notice>
      ) : (
        <>
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Button type="submit" variant="primary" disabled={submitting} className="w-full">{submitting ? "Sending…" : "Send reset link"}</Button>
          </form>
        </>
      )}
      <p className="mt-5 text-center text-sm"><Link href="/login" className="text-accent hover:underline">Back to sign in</Link></p>
    </AuthPage>
  );
}
