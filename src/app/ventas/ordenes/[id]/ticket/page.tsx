import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getOrden } from "@/lib/ventas/repository";
import { TicketClient } from "@/components/ventas/ticket-client";

export const metadata: Metadata = {
  title: "Imprimir Ticket / Factura",
};

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  const { id } = await params;
  const orden = await getOrden(id);
  if (!orden) notFound();

  return <TicketClient orden={orden} />;
}