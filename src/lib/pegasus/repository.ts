import "server-only";
import { prisma } from "@/lib/prisma";

export async function getImportaciones(limit = 50) {
  const [importaciones, total] = await Promise.all([
    prisma.importacionPegasus.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        usuario: { select: { nombre: true, apellido: true, email: true } },
      },
    }),
    prisma.importacionPegasus.count(),
  ]);
  return {
    total,
    importaciones: importaciones.map((i) => ({
      ...i,
      created_at: i.created_at.toISOString(),
    })),
  };
}
