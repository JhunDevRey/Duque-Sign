"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { DocumentSummary } from "@/lib/domain/types";
import {
  clearLocalWorkspace,
  loadLocalWorkspace,
  saveLocalWorkspace,
} from "@/lib/preview/local-workspace";
import { sampleDocuments } from "@/lib/preview/sample-data";
import { isFirebaseClientConfigured } from "@/lib/firebase/client";

type WorkspaceSnapshot = {
  documents: DocumentSummary[];
  organizationId: string | null;
  ready: boolean;
  error: string | null;
};

type WorkspaceContextValue = WorkspaceSnapshot & {
  createDraft: (document: DocumentSummary) => void;
  updateDocument: (id: string, update: Partial<DocumentSummary>) => void;
  clearWorkspace: () => void;
  refresh: () => Promise<void>;
};

const serverSnapshot: WorkspaceSnapshot = {
  documents: sampleDocuments,
  organizationId: null,
  ready: false,
  error: null,
};
let snapshot = serverSnapshot;
let loadStarted = false;
const listeners = new Set<() => void>();

function publish(nextSnapshot: WorkspaceSnapshot) {
  snapshot = nextSnapshot;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loadStarted && typeof window !== "undefined") {
    loadStarted = true;
    queueMicrotask(() => void refreshWorkspace());
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

function persistDocuments(documents: DocumentSummary[]) {
  if (isFirebaseClientConfigured) throw new Error("Cloud documents must be changed through the authenticated API.");
  try {
    saveLocalWorkspace({ documents });
    publish({ documents, organizationId: null, ready: true, error: null });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to save the local workspace.";
    publish({ ...snapshot, ready: true, error: message });
    throw new Error(message);
  }
}

function createDraft(document: DocumentSummary) {
  persistDocuments([document, ...snapshot.documents]);
}

function updateDocument(id: string, update: Partial<DocumentSummary>) {
  const existing = snapshot.documents.find((document) => document.id === id);
  if (!existing) throw new Error("Document not found in this browser workspace.");
  persistDocuments(snapshot.documents.map((document) => document.id === id ? { ...document, ...update } : document));
}

function clearWorkspace() {
  try {
    clearLocalWorkspace();
    publish({ documents: sampleDocuments, organizationId: null, ready: true, error: null });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to clear the local workspace.";
    publish({ ...snapshot, ready: true, error: message });
    throw new Error(message);
  }
}

export async function refreshWorkspace(): Promise<void> {
  if (!isFirebaseClientConfigured) {
    try {
      const stored = loadLocalWorkspace();
      publish({
        documents: stored?.documents ?? sampleDocuments,
        organizationId: null,
        ready: true,
        error: null,
      });
    } catch (cause) {
      publish({
        ...snapshot,
        ready: true,
        error: cause instanceof Error ? cause.message : "Unable to load the local workspace.",
      });
    }
    return;
  }

  publish({ ...snapshot, ready: false, error: null });
  try {
    const organizationResponse = await fetch("/api/organizations", { cache: "no-store" });
    if (!organizationResponse.ok) throw new Error("Unable to load organization memberships.");
    const organizationData: unknown = await organizationResponse.json();
    const organizations =
      typeof organizationData === "object" &&
      organizationData !== null &&
      "organizations" in organizationData &&
      Array.isArray(organizationData.organizations)
        ? organizationData.organizations
        : [];
    const first = organizations[0];
    const organizationId =
      typeof first === "object" && first !== null && "id" in first && typeof first.id === "string"
        ? first.id
        : null;
    if (!organizationId) {
      publish({ documents: [], organizationId: null, ready: true, error: null });
      return;
    }

    const documentResponse = await fetch(
      `/api/documents?organizationId=${encodeURIComponent(organizationId)}`,
      { cache: "no-store" },
    );
    if (!documentResponse.ok) throw new Error("Unable to load documents from Firebase.");
    const documentData: unknown = await documentResponse.json();
    const documents =
      typeof documentData === "object" &&
      documentData !== null &&
      "documents" in documentData &&
      Array.isArray(documentData.documents)
        ? (documentData.documents as DocumentSummary[])
        : [];
    publish({ documents, organizationId, ready: true, error: null });
  } catch (cause) {
    publish({
      ...snapshot,
      ready: true,
      error: cause instanceof Error ? cause.message : "Unable to load the Firebase workspace.",
    });
  }
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function LocalWorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = useMemo(
    () => ({ ...state, createDraft, updateDocument, clearWorkspace, refresh: refreshWorkspace }),
    [state],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useLocalWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useLocalWorkspace must be used within LocalWorkspaceProvider.");
  return value;
}
