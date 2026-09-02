import { createClient } from "@/lib/supabase/server";

/**
 * Obtiene la sesión del usuario actual en Server Components / Actions
 */
export async function getServerSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Obtiene el usuario actual (wrapper sobre sesión)
 */
export async function getCurrentUser() {
  const session = await getServerSession();
  return session?.user ?? null;
}