"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { FirebaseAuthGuard } from "@/components/firebase-auth-guard";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Unable to create the organization.";
        throw new Error(message);
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the organization.");
      setSubmitting(false);
    }
  }

  return (
    <FirebaseAuthGuard>
      <AuthPage title="Create your organization" subtitle="Set up the workspace that will own your documents and templates.">
        {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Organization name" htmlFor="organization-name">
            <Input id="organization-name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">{submitting ? "Creating…" : "Create organization"}</Button>
        </form>
      </AuthPage>
    </FirebaseAuthGuard>
  );
}
