import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
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

/** The signed-in user plus a Supabase client that runs queries under that user's RLS policies. */
export async function getSession(): Promise<{ supabase: SupabaseClient<Database>; user: SessionUser }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new UnauthenticatedError();
  return {
    supabase,
    user: {
      uid: data.user.id,
      email: data.user.email,
      name: typeof data.user.user_metadata.full_name === "string" ? data.user.user_metadata.full_name : undefined,
    },
  };
}
