"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
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
      const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your password.");
      setSubmitting(false);
    }
  }

  return (
    <AuthPage title="Choose a new password" subtitle="Set a new password for your account.">
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 12 characters." htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmation">
          <Input id="confirmation" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Updating…" : "Set password"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">Back to sign in</Link>
      </p>
    </AuthPage>
  );
}
