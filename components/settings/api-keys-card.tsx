"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocalWorkspace } from "@/components/local-workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") return body.error;
  } catch {
    // Fall through to the generic message.
  }
  return fallback;
}

async function fetchKeys(organizationId: string): Promise<{ canManage: boolean; keys: ApiKey[] }> {
  const response = await fetch(`/api/api-keys?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response, "Unable to load API keys."));
  return (await response.json()) as { canManage: boolean; keys: ApiKey[] };
}

/** Live API key management for owners and admins (Make.com and other integrations). */
export function ApiKeysCard() {
  const { organizationId, ready } = useLocalWorkspace();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!ready || !organizationId) return;
    let active = true;
    void fetchKeys(organizationId)
      .then((body) => {
        if (!active) return;
        setKeys(body.keys);
        setCanManage(body.canManage);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load API keys.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [ready, organizationId, reloads]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, name }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Unable to create the API key."));
      const body = (await response.json()) as { key: string; apiKey: ApiKey };
      setKeys((current) => [body.apiKey, ...current]);
      setNewKey(body.key);
      setCopied(false);
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the API key.");
    } finally {
      setWorking(false);
    }
  }

  async function revoke(key: ApiKey) {
    if (!window.confirm(`Revoke "${key.name}"? Integrations using it stop working immediately.`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/api-keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await errorMessage(response, "Unable to revoke the API key."));
      setReloads((count) => count + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to revoke the API key.");
    }
  }

  async function copy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function closeCreate() {
    setCreating(false);
    setNewKey(null);
    setName("");
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-title-medium">{t("settings.tabApiKeys")}</h2>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            {t("settings.createKey")}
          </Button>
        )}
      </div>

      {!isSupabaseClientConfigured ? (
        <p className="text-body-medium text-on-surface-variant">API keys need Supabase to be configured.</p>
      ) : !ready || (organizationId && !loaded) ? (
        <div className="h-16 animate-pulse rounded-md bg-surface-container-high" />
      ) : !organizationId ? (
        <p className="text-body-medium text-on-surface-variant">Create an organization first.</p>
      ) : !canManage && !error ? (
        <p className="text-body-medium text-on-surface-variant">Only organization owners and admins can see and manage API keys.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-body-small text-on-surface-variant">
            Integrations such as Make.com send a key as <code className="font-mono">Authorization: Bearer sk_live_…</code>. {t("settings.keyNotice")}
          </p>
          {error && <Notice tone="danger">{error}</Notice>}
          {keys.length === 0 && !error && <p className="text-body-medium text-on-surface-variant">No API keys yet.</p>}
          {keys.map((key) => (
            <div key={key.id} className="flex items-start justify-between gap-3 rounded-md bg-surface-container p-4">
              <div className="min-w-0">
                <p className="truncate text-title-small">{key.name}</p>
                <p className="mt-1 font-mono text-body-medium text-on-surface-variant">{key.prefix}…</p>
                <p className="mt-1 text-body-small text-on-surface-variant">
                  Created {formatDateTime(key.createdAt)} · {t("settings.keyLastUsed")}: {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "never"}
                </p>
              </div>
              {key.revokedAt ? (
                <span className="inline-flex h-6 shrink-0 items-center rounded-sm bg-surface-container-highest px-2 text-label-medium text-on-surface-variant">
                  {t("settings.keyRevoked")}
                </span>
              ) : (
                <Button variant="danger" size="sm" onClick={() => revoke(key)}>{t("settings.revoke")}</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={creating} onClose={closeCreate} title={newKey ? "Copy your API key" : t("settings.createKey")}>
        {newKey ? (
          <div className="space-y-4">
            <Notice tone="warning" title="This is the only time the key is shown">
              Store it in Make (or your password manager) now. If you lose it, revoke it and create a new one.
            </Notice>
            <p className="break-all rounded-sm border border-outline-variant bg-surface px-3 py-3 font-mono text-body-medium">{newKey}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={closeCreate}>{t("common.close")}</Button>
              <Button variant="primary" onClick={copy}>
                <Icon name={copied ? "check" : "copy"} />
                {copied ? "Copied" : "Copy key"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-4">
            <Field label={t("settings.keyName")} htmlFor="api-key-name" hint="For example: Make.com contract automation">
              <Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required data-autofocus />
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={closeCreate}>{t("common.cancel")}</Button>
              <Button type="submit" variant="primary" disabled={working || !name.trim()}>
                {working ? t("common.loading") : t("settings.createKey")}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </Card>
  );
}
