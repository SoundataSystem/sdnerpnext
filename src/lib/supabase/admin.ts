import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PLACEHOLDER = "poner-la-service-role-key-aqui";

export function isServiceRoleConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(key && key !== PLACEHOLDER);
}

/**
 * Cliente de Supabase con permisos de administración (service role).
 * Solo se usa en Server Actions del lado admin (nunca expone la clave).
 */
export function getAdminClient(): SupabaseClient {
  if (!isServiceRoleConfigured()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada. Agrega la clave de servicio en el archivo .env",
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
