import { prisma } from "@/lib/prisma";

let seq = 0;
function unico(prefijo: string): string {
  seq += 1;
  return `${prefijo}_${seq}_${Date.now()}`;
}

export interface UsuarioFixture {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  vendedor_codigo: string | null;
}

export async function crearVendedor(
  overrides: Partial<Parameters<typeof prisma.usuario.create>[0]["data"]> = {},
): Promise<UsuarioFixture> {
  const data = {
    email: unico("vendedor") + "@test.local",
    nombre: "Vendedor",
    apellido: "Prueba",
    rol: "vendedor" as const,
    vendedor_codigo: "V001",
    activo: true,
    ...overrides,
  };
  const u = await prisma.usuario.create({ data });
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    apellido: u.apellido,
    vendedor_codigo: u.vendedor_codigo,
  };
}

export async function crearCliente(
  overrides: Partial<Parameters<typeof prisma.cliente.create>[0]["data"]> = {},
): Promise<{ id: string }> {
  const data = {
    nombre: "Cliente",
    apellido: "Prueba",
    cedula: unico("C"),
    telefono: "0000000",
    email: unico("cliente") + "@test.local",
    ...overrides,
  };
  const c = await prisma.cliente.create({ data });
  return { id: c.id };
}

export async function crearProducto(
  overrides: Partial<Parameters<typeof prisma.producto.create>[0]["data"]> = {},
): Promise<{ id: string; codigo: string; nombre: string }> {
  const codigo = unico("P");
  const data = {
    codigo,
    nombre: `Producto ${codigo}`,
    precio_base: 1000,
    activo: true,
    stock_total: 0,
    ...overrides,
  };
  const p = await prisma.producto.create({ data });
  return { id: p.id, codigo: p.codigo ?? codigo, nombre: p.nombre };
}

export async function crearDeposito(
  overrides: Partial<Parameters<typeof prisma.deposito.create>[0]["data"]> = {},
): Promise<{ id: string; nombre: string }> {
  const nombre = `Deposito ${unico("D")}`;
  const data = {
    nombre,
    columna_stock: `col_${seq}`,
    activo: true,
    ...overrides,
  };
  const d = await prisma.deposito.create({ data });
  return { id: d.id, nombre: d.nombre };
}

export async function setStock(
  productoId: string,
  depositoId: string,
  stock: number,
): Promise<void> {
  await prisma.productoDeposito.create({
    data: { producto_id: productoId, deposito_id: depositoId, stock },
  });
  await prisma.producto.update({
    where: { id: productoId },
    data: { stock_total: stock },
  });
}

export async function crearConfiguracion(
  overrides: Partial<Parameters<typeof prisma.configuracionSistema.create>[0]["data"]> = {},
): Promise<{ id: string }> {
  const data = {
    costo_operativo_global: 0,
    porcentaje_comision_vendedor: 0,
    tipo_cambio_usd: 7500,
    ...overrides,
  };
  const c = await prisma.configuracionSistema.create({ data });
  return { id: c.id };
}

export async function crearMetodoPago(
  overrides: Partial<Parameters<typeof prisma.metodoPago.create>[0]["data"]> = {},
): Promise<{ id: string; nombre: string }> {
  const nombre = unico("METODO");
  const data = {
    nombre,
    porcentaje_costo: 0,
    activo: true,
    ...overrides,
  };
  const m = await prisma.metodoPago.create({ data });
  return { id: m.id, nombre: m.nombre };
}

/**
 * Crea el plan de cuentas mínimo que usa el asiento de cobro de ventas
 * (códigos 1.1.01 caja, 1.1.03 cuentas por cobrar, 4.1.01 ventas).
 */
export async function crearPlanCuentaVentas(): Promise<void> {
  const cuentas: Array<{ codigo: string; nombre: string; tipo: "activo" | "ingreso" }> = [
    { codigo: "1.1.01", nombre: "Caja", tipo: "activo" },
    { codigo: "1.1.03", nombre: "Cuentas por Cobrar", tipo: "activo" },
    { codigo: "4.1.01", nombre: "Ventas", tipo: "ingreso" },
  ];
  for (const c of cuentas) {
    await prisma.planCuenta.create({
      data: { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, nivel: 1, activo: true },
    });
  }
}
