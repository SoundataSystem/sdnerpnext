import { NextRequest, NextResponse } from "next/server";
import { getRoleOrRedirect } from "@/lib/redirect-auth";
import { getClientesCursor, type ClienteCursor } from "@/lib/ventas/repository";

export async function GET(request: NextRequest) {
  await getRoleOrRedirect("admin", "vendedor", "cajero");
  
  const { searchParams } = new URL(request.url);
  const busqueda = searchParams.get("q") || undefined;
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20),
  );
  
  // Parse cursor from searchParams if provided (input no confiable)
  const cursorParam = searchParams.get("cursor");
  let cursor: ClienteCursor | undefined;
  if (cursorParam) {
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(cursorParam));
      const c = parsed as Record<string, unknown> | null;
      if (
        typeof c !== "object" ||
        c === null ||
        typeof c.id !== "string" ||
        typeof c.nombre !== "string" ||
        typeof c.apellido !== "string"
      ) {
        return NextResponse.json({ error: "Cursor inválido" }, { status: 400 });
      }
      cursor = { id: c.id, nombre: c.nombre, apellido: c.apellido };
    } catch {
      return NextResponse.json({ error: "Cursor inválido" }, { status: 400 });
    }
  }

  try {
    const result = await getClientesCursor({
      pageSize,
      busqueda,
      cursor,
    });
    
    return NextResponse.json({
      items: result.items,
      nextCursor: result.nextCursor ? encodeURIComponent(JSON.stringify(result.nextCursor)) : null,
      prevCursor: result.prevCursor ? encodeURIComponent(JSON.stringify(result.prevCursor)) : null,
    });
  } catch (error) {
    console.error("Error searching clientes:", error);
    return NextResponse.json({ error: "Error al buscar clientes" }, { status: 500 });
  }
}