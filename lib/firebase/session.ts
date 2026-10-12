import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  uid: string;
  email?: string;
  name?: string;
};

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sign in to continue.");
    this.name = "UnauthenticatedError";
  }
}

export async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new UnauthenticatedError();
  return {
    uid: data.user.id,
    email: data.user.email,
    name: typeof data.user.user_metadata.full_name === "string" ? data.user.user_metadata.full_name : undefined,
  };
}
