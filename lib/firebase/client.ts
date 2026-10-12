"use client";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export const isFirebaseClientConfigured = Boolean(
  apiKey &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

export type FirebaseAuthUser = {
  idToken: string;
  localId: string;
  email: string;
  displayName?: string;
  emailVerified?: boolean;
};

function firebaseError(result: unknown): Error {
  const code =
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null &&
    "message" in result.error &&
    typeof result.error.message === "string"
      ? result.error.message
      : "UNKNOWN";
  return Object.assign(new Error(code), { code });
}

export async function firebaseAuthRequest(
  action: "signUp" | "signInWithPassword" | "update" | "sendOobCode",
  payload: Record<string, string | boolean>,
): Promise<FirebaseAuthUser> {
  if (!apiKey) {
    throw new Error("Firebase is not configured. Copy .env.example to .env.local and add your Firebase Web app settings.");
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const result: unknown = await response.json();
  if (!response.ok) throw firebaseError(result);
  return result as FirebaseAuthUser;
}

export async function getFirebaseEmailVerified(idToken: string): Promise<boolean> {
  if (!apiKey) {
    throw new Error("Firebase is not configured. Copy .env.example to .env.local and add your Firebase Web app settings.");
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  const result: unknown = await response.json();
  if (!response.ok) throw firebaseError(result);
  if (
    typeof result !== "object" ||
    result === null ||
    !("users" in result) ||
    !Array.isArray(result.users) ||
    result.users.length !== 1 ||
    typeof result.users[0] !== "object" ||
    result.users[0] === null ||
    !("emailVerified" in result.users[0]) ||
    typeof result.users[0].emailVerified !== "boolean"
  ) {
    throw new Error("Firebase did not return account verification status.");
  }
  return result.users[0].emailVerified;
}
