import type { Metadata } from "next";
import { getAuthOrRedirect } from "@/lib/redirect-auth";
import { getNotificaciones } from "@/lib/notificaciones/repository";
import { NotificacionesClient } from "@/components/notificaciones/notificaciones-client";

export const metadata: Metadata = {
  title: "Notificaciones",
};

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getAuthOrRedirect();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, no_leidas, total, page: pagina, totalPages } =
    await getNotificaciones(user.id, page);

  return (
    <NotificacionesClient
      items={items}
      no_leidas={no_leidas}
      total={total}
      page={pagina}
      totalPages={totalPages}
    />
  );
}
