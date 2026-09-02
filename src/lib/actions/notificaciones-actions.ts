"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { requireUser } from "@/lib/auth";
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from "@/lib/notificaciones/repository";

export const marcarNotificacionLeidaAction = actionClient
  .inputSchema(z.object({ id: z.string() }))
  .action(async ({ parsedInput }) => {
    const user = await requireUser();
    await marcarNotificacionLeida(parsedInput.id, user.id);
    revalidatePath("/notificaciones");
    return { ok: true };
  });

export const marcarTodasNotificacionesLeidasAction = actionClient.action(
  async () => {
    const user = await requireUser();
    await marcarTodasLeidas(user.id);
    revalidatePath("/notificaciones");
    return { ok: true };
  },
);
