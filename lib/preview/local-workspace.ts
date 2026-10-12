import type { DocumentSummary } from "@/lib/domain/types";

const WORKSPACE_KEY = "duque-sign:local-workspace:v1";
const DATABASE_NAME = "duque-sign-local";
const FILES_STORE = "original-pdfs";

type LocalWorkspaceData = {
  documents: DocumentSummary[];
};

export function loadLocalWorkspace(): LocalWorkspaceData | null {
  const serialized = window.localStorage.getItem(WORKSPACE_KEY);
  if (!serialized) return null;

  const data: unknown = JSON.parse(serialized);
  if (
    typeof data !== "object" ||
    data === null ||
    !("documents" in data) ||
    !Array.isArray(data.documents)
  ) {
    throw new Error("Local workspace data is invalid. Clear this browser's local workspace and try again.");
  }
  return data as LocalWorkspaceData;
}

export function saveLocalWorkspace(data: LocalWorkspaceData): void {
  window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
}

export function clearLocalWorkspace(): void {
  window.localStorage.removeItem(WORKSPACE_KEY);
}

function openFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(FILES_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local PDF storage."));
  });
}

export async function storeOriginalPdf(documentId: string, file: File): Promise<void> {
  const database = await openFileDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(FILES_STORE, "readwrite");
      transaction.objectStore(FILES_STORE).put(file, documentId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save the PDF locally."));
      transaction.onabort = () => reject(transaction.error ?? new Error("PDF storage was interrupted."));
    });
  } finally {
    database.close();
  }
}

export async function readOriginalPdf(documentId: string): Promise<Blob | null> {
  const database = await openFileDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(FILES_STORE, "readonly").objectStore(FILES_STORE).get(documentId);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read the local PDF."));
    });
  } finally {
    database.close();
  }
}

export async function removeOriginalPdf(documentId: string): Promise<void> {
  const database = await openFileDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(FILES_STORE, "readwrite");
      transaction.objectStore(FILES_STORE).delete(documentId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to remove the local PDF."));
      transaction.onabort = () => reject(transaction.error ?? new Error("PDF removal was interrupted."));
    });
  } finally {
    database.close();
  }
}
