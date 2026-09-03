import { NextRequest, NextResponse } from "next/server";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");

  const { searchParams } = new URL(request.url);
  const busqueda = searchParams.get("busqueda")?.trim() ?? "";

  const where = busqueda && busqueda.length >= 2
    ? {
        OR: [
          { nombre: { contains: busqueda, mode: "insensitive" as const } },
          { apellido: { contains: busqueda, mode: "insensitive" as const } },
          { cedula: { contains: busqueda } },
          { telefono: { contains: busqueda } },
          { ruc: { contains: busqueda } },
        ],
      }
    : busqueda
      ? {} // <2 chars -> 0, but export should return 0
      : undefined;

  // Si no hay búsqueda, exporta todos (como PROD QA getAll)
  const filter = !busqueda || busqueda.length < 2 ? undefined : where;

  // Para export, límite alto (43k) - paginado en memoria si hace falta
  const BATCH = 5000;
  let all: Array<Record<string, unknown>> = [];
  let skip = 0;
  let batch: Array<Record<string, unknown>> = [];
  do {
    batch = await prisma.cliente.findMany({
      where: filter as never,
      orderBy: [{ nombre: "asc" }],
      skip,
      take: BATCH,
      select: {
        nombre: true,
        apellido: true,
        tipo_documento: true,
        cedula: true,
        ruc: true,
        telefono: true,
        email: true,
        direccion: true,
        ciudad: true,
        pais: true,
      },
    });
    all = all.concat(batch);
    skip += BATCH;
  } while (batch.length === BATCH && all.length < 50000);

  return NextResponse.json({ total: all.length, items: all });
}
