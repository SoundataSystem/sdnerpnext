"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { zfd } from "zod-form-data";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSafeRedirectPath } from "@/lib/auth/redirect";

const loginSchema = zfd.formData({
  email: zfd.text(z.string().email("Email inválido")),
  password: zfd.text(z.string().min(1, "La contraseña es obligatoria")),
  redirectTo: zfd.text(z.string().optional()),
});

/**
 * Login con email/contraseña via Supabase Auth.
 * State Action: valida el FormData en el servidor y permite
 * registros de estado entre ejecuciones (prevResult).
 */
export const loginAction = actionClient
  .inputSchema(loginSchema)
  .stateAction(async ({ parsedInput }) => {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsedInput.email,
      password: parsedInput.password,
    });

    if (error) {
      return { ok: false as const, message: "Credenciales inválidas" };
    }

    if (!data.user) {
      return { ok: false as const, message: "No se pudo iniciar sesión" };
    }

    revalidatePath("/", "layout");

    const redirectTo = parsedInput.redirectTo
      ? isSafeRedirectPath(parsedInput.redirectTo)
        ? parsedInput.redirectTo
        : "/"
      : "/";

    redirect(redirectTo);
  });

/** Logout: limpia la sesión de Supabase y vuelve al login. */
export const logoutAction = actionClient.action(async () => {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
});