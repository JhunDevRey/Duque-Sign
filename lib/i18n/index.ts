import { en, type Messages } from "./en";

// Builds a union of dot-separated keys ("nav.documents", "signing.progress", ...).
type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

const messages: Messages = en;

/** Looks up a UI string and fills `{placeholder}` values. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let node: unknown = messages;
  for (const part of splitKey(key)) {
    node = (node as Record<string, unknown>)[part];
  }
  const template = typeof node === "string" ? node : key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

// Keys like "auditActions.document.created" have dots inside the final segment,
// so only the first dot separates the section from the entry.
function splitKey(key: string): string[] {
  const i = key.indexOf(".");
  return i === -1 ? [key] : [key.slice(0, i), key.slice(i + 1)];
}

/** Looks up a dynamic key (e.g. an audit action from data) with a fallback. */
export function tDynamic(section: keyof Messages, entry: string, fallback = entry): string {
  const value = (messages[section] as Record<string, string>)[entry];
  return typeof value === "string" ? value : fallback;
}
