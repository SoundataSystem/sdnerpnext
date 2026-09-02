import type { Metadata } from "next";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getTickets } from "@/lib/servicios/repository";
import { getClientes } from "@/lib/ventas/repository";
import { TicketsClient } from "@/components/servicios/tickets-client";

export const metadata: Metadata = {
  title: "Soporte",
};

export default async function TicketsPage() {
  await getRoleOrRedirect("admin", "vendedor", "servicio_tecnico", "supervisor_tecnico");
  const [tickets, clientes] = await Promise.all([
    getTickets(),
    getClientes(),
  ]);

  return <TicketsClient tickets={tickets} clientes={clientes} />;
}
