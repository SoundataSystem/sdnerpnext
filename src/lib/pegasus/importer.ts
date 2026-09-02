import "server-only";
import { prisma } from "@/lib/prisma";
import { filasAObjetos, parseCSV, normalizarEncabezado, detectarCabecera, valorDe, num } from "./parser";
import {
  parsearNombreApellido,
  limpiarTelefono,
  parsearRUC,
  parsearFechaPegasus,
  mapearPlazoPago,
} from "./pegasus-utils";
import { CLAVES_TIPO } from "./constantes";
import { Prisma, type TipoImportacionPegasus } from "@/generated/prisma/client";

export interface RegistroSnapshots {
  clientes?: Array<{ id: string; antes: Record<string, unknown> }>;
  proveedores?: Array<{ id: string; antes: Record<string, unknown> }>;
  productos?: Array<{ id: string; antes: Record<string, unknown> }>;
  stock?: Array<{ id: string; antes: Record<string, unknown> }>;
}

export interface ResultadoImportacion {
  filas_total: number;
  filas_ok: number;
  filas_warning: number;
  filas_error: number;
  log: string[];
  creados: {
    clientes: string[];
    proveedores: string[];
    productos: string[];
    seriales: string[];
  };
  actualizados: RegistroSnapshots;
}

function ok(log: string[], fila: number, detalle: string) {
  log.push(`Fila ${fila}: OK — ${detalle}`);
}
function warning(log: string[], fila: number, detalle: string) {
  log.push(`Fila ${fila}: AVISO — ${detalle}`);
}
function error(log: string[], fila: number, detalle: string) {
  log.push(`Fila ${fila}: ERROR — ${detalle}`);
}

const TAM_LOTE = 100;
const PARALELISMO = 6;

/**
 * Escribe en lotes dentro de transacciones ($transaction -> un solo round-trip por lote)
 * con paralelismo acotado, para no agotar el timeout del serverless en archivos grandes.
 * Si una transacción falla, reintenta fila por fila para conservar el log por línea.
 */
async function escribirLotes<T>(
  items: T[],
  operacion: (item: T) => Prisma.PrismaPromise<unknown>,
  alExito: (item: T, resultado: unknown) => void,
  alError: (item: T, e: unknown) => void,
): Promise<void> {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += TAM_LOTE) {
    lotes.push(items.slice(i, i + TAM_LOTE));
  }
  if (lotes.length === 0) return;
  let indice = 0;
  const worker = async () => {
    while (indice < lotes.length) {
      const lote = lotes[indice++];
      try {
        const resultados = await prisma.$transaction(lote.map(operacion));
        resultados.forEach((r, i) => alExito(lote[i], r));
      } catch {
        for (const item of lote) {
          try {
            const r = await operacion(item);
            alExito(item, r);
          } catch (e) {
            alError(item, e);
          }
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELISMO, lotes.length) }, () => worker()));
}

type ClaveSimple = { id: string; [k: string]: unknown };

function mapaPor<T extends ClaveSimple, K extends keyof T>(
  filas: T[],
  key: K,
): Map<string, T> {
  const mapa = new Map<string, T>();
  for (const f of filas) {
    const v = f[key] as unknown;
    if (typeof v === "string" && v && !mapa.has(v)) mapa.set(v, f);
  }
  return mapa;
}

/** Valores JSON-serializables de una fila (Decimal/Date → primitivos). */
function aValoresSerializables(fila: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fila)) {
    if (v === null || v === undefined) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "object" && "toNumber" in (v as object)) {
      out[k] = (v as { toNumber(): number }).toNumber();
    } else out[k] = v;
  }
  return out;
}

/**
 * Snapshot previo de las filas que la importación va a MODIFICAR, para poder
 * revertir updates (P2-5). Consulta por lotes (IN) y devuelve un Map id → valores
 * serializables con todos los campos pedidos (Decimal/Date → primitivos).
 */
async function capturarSnapshots(
  filas: Array<{ id: string }>,
  buscar: (ids: string[]) => Promise<Array<{ id: string; [k: string]: unknown }>>,
): Promise<Map<string, Record<string, unknown>>> {
  const mapa = new Map<string, Record<string, unknown>>();
  const ids = filas.map((f) => f.id);
  for (let i = 0; i < ids.length; i += TAM_LOTE) {
    const lote = ids.slice(i, i + TAM_LOTE);
    const registros = await buscar(lote);
    for (const r of registros) mapa.set(r.id, aValoresSerializables(r));
  }
  return mapa;
}

/** Columnas de stock por depósito que existen en el modelo `Producto`. */
const STOCK_DEPOSITOS = [
  "stock_copaco",
  "stock_espana",
  "stock_eusebio_ayala",
  "stock_faltantes",
  "stock_faltantes_espana",
  "stock_juan_del_castillo",
  "stock_local_18",
  "stock_obsoletos",
  "stock_regalos",
  "stock_rma",
  "stock_servicio_tec_vans",
  "stock_servicio_tecnico",
  "stock_salon_espana",
  "stock_salon_ventas",
  "stock_soundata",
  "stock_subsuelo",
  "stock_uso_interno_espana",
  "stock_vidriera_a3c",
] as const;

type StockDepositos = Partial<Record<(typeof STOCK_DEPOSITOS)[number], number>>;

function stockDepositosDe(datos: Record<string, string>): StockDepositos {
  const out: StockDepositos = {};
  for (const k of STOCK_DEPOSITOS) {
    const v = num(valorDe(datos, [k]));
    if (v !== null) out[k] = v;
  }
  return out;
}

interface DatosCliente {
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  email: string;
  direccion?: string;
  ciudad?: string;
  ruc?: string;
  pais: string;
  tipo_documento: string;
  code?: string;
  tax_id?: string;
  codigo_pegasus?: string;
  client_type?: string;
  sales_condition?: string;
  salesperson_code?: string;
  price_type?: string;
  zone?: string;
  codigo_vendedor?: string;
  condicion_venta_pegasus?: string;
}

interface PendienteCliente {
  fila: number;
  nombre: string;
  codigoPegasus: string | null;
  existenteId: string | null;
  data: DatosCliente;
}

// Helpers de parseo de clientes (misma lógica que PROD QA).
function direccionRaw(datos: Record<string, string>): string | null {
  return valorDe(datos, ["direccion", "address", "domicilio", "dir"]);
}

function ciudadDe(datos: Record<string, string>): string | undefined {
  let ciudad: string | null = valorDe(datos, ["ciudad", "city", "poblacion", "localidad"]) || null;
  if (ciudad?.toUpperCase() === "EXTRANJERO") ciudad = null;
  if (!ciudad) {
    const zona = valorDe(datos, ["zona", "zone"]);
    if (zona) ciudad = zona;
  }
  return ciudad ?? undefined;
}

function paisDe(datos: Record<string, string>): string {
  const ciudad = valorDe(datos, ["ciudad", "city", "poblacion", "localidad"]) ?? "";
  const pais = valorDe(datos, ["pais", "country"]);
  if (ciudad.toUpperCase() === "EXTRANJERO") return "EXTRANJERO";
  return pais ?? "Paraguay";
}

function tipoDocDe(datos: Record<string, string>, ruc: string | null | undefined): string {
  const t = valorDe(datos, ["tipo_documento", "tipo_cedula", "document_type"]);
  if (t) return t;
  return ruc ? "RUC" : "CI";
}

function condVentaPegasus(datos: Record<string, string>): string | undefined {
  const cond = valorDe(datos, ["cond_venta", "condicion_venta", "condicion_venta_pegasus"]) ?? "";
  if (!cond) return undefined;
  return cond.toLowerCase().includes("credito") ? "30DIAS" : "CONTADO";
}

const camposClienteSnapshot = {
  id: true,
  nombre: true,
  apellido: true,
  cedula: true,
  telefono: true,
  email: true,
  direccion: true,
  ciudad: true,
  ruc: true,
  pais: true,
  tipo_documento: true,
  code: true,
  tax_id: true,
  client_type: true,
  sales_condition: true,
  salesperson_code: true,
  price_type: true,
  zone: true,
  codigo_vendedor: true,
  condicion_venta_pegasus: true,
  codigo_pegasus: true,
} as const;

async function importarClientes(
  filas: Awaited<ReturnType<typeof filasAObjetos>>,
  resultado: ResultadoImportacion,
) {
  const validas: Array<{
    fila: number;
    datos: Record<string, string>;
    nombre: string;
    apellido: string | null;
    cedula: string | null;
    ruc: string | null;
    codigoPegasus: string | null;
  }> = [];
  for (const f of filas) {
    const nombreCompleto = valorDe(f.datos, ["nombre", "nombre_cliente", "nombre_del_cliente", "cliente", "razon_social", "name", "nombres", "nombre_comercial"]);
    if (!nombreCompleto) {
      error(resultado.log, f.fila, "falta nombre/razon_social");
      resultado.filas_error++;
      continue;
    }
    const { nombre, apellido } = parsearNombreApellido(nombreCompleto);
    const rucParsed = parsearRUC(valorDe(f.datos, ["ruc", "tax_id", "id_fiscal", "documento", "doc"]) ?? "");
    validas.push({
      fila: f.fila,
      datos: f.datos,
      nombre,
      apellido: apellido || valorDe(f.datos, ["apellido", "apellidos", "nombre_apellido"]),
      cedula: rucParsed.cedula ?? valorDe(f.datos, ["cedula", "documento", "documento_identidad", "ci", "nro_documento"]),
      ruc: rucParsed.ruc,
      codigoPegasus: valorDe(f.datos, ["codigo_pegasus", "codigo", "cod", "id_cliente", "code", "codigo_cliente", "cod_cliente"]),
    });
  }
  const codigosPegasus = [...new Set(validas.map((x) => x.codigoPegasus).filter((c): c is string => !!c))];
  const cedulas = [...new Set(validas.map((x) => x.cedula).filter((c): c is string => !!c))];
  let existentes: Array<{ id: string; codigo_pegasus: string | null; cedula: string }> = [];
  if (codigosPegasus.length || cedulas.length) {
    existentes = await prisma.cliente.findMany({
      where: {
        OR: [
          ...(codigosPegasus.length ? [{ codigo_pegasus: { in: codigosPegasus } }] : []),
          ...(cedulas.length ? [{ cedula: { in: cedulas } }] : []),
        ],
      },
      select: { id: true, codigo_pegasus: true, cedula: true },
    });
  }
  const porPegasus = mapaPor(existentes, "codigo_pegasus");
  const porCedula = mapaPor(existentes, "cedula");
  const vistosPegasus = new Set<string>();
  const vistosCedula = new Set<string>();
  const pendientes: PendienteCliente[] = [];
  for (const x of validas) {
    if (x.codigoPegasus) {
      if (vistosPegasus.has(x.codigoPegasus)) {
        error(resultado.log, x.fila, "código pegasus duplicado en el archivo");
        resultado.filas_error++;
        continue;
      }
      vistosPegasus.add(x.codigoPegasus);
    }
    if (x.cedula && vistosCedula.has(x.cedula)) {
      error(resultado.log, x.fila, "cédula/documento duplicado en el archivo");
      resultado.filas_error++;
      continue;
    }
    if (x.cedula) vistosCedula.add(x.cedula);
    const existente = x.codigoPegasus
      ? porPegasus.get(x.codigoPegasus)
      : x.cedula
        ? porCedula.get(x.cedula)
        : null;
    pendientes.push({
      fila: x.fila,
      nombre: x.nombre,
      codigoPegasus: x.codigoPegasus,
      existenteId: existente?.id ?? null,
      data: {
        nombre: x.nombre,
        apellido: x.apellido ?? "",
        cedula: x.cedula ?? "",
        telefono: limpiarTelefono(valorDe(x.datos, ["telefono", "telefono_1", "phone", "movil", "celular", "tel"]) ?? "") ?? "",
        email: valorDe(x.datos, ["email", "correo", "correo_electronico", "mail"]) ?? "",
        direccion: (!direccionRaw(x.datos) || direccionRaw(x.datos)!.includes("CV:"))
          ? undefined
          : direccionRaw(x.datos) ?? undefined,
        ciudad: ciudadDe(x.datos),
        ruc: x.ruc ?? undefined,
        pais: paisDe(x.datos),
        tipo_documento: tipoDocDe(x.datos, x.ruc),
        code: valorDe(x.datos, ["code"]) ?? undefined,
        tax_id: valorDe(x.datos, ["ruc", "tax_id"]) ?? undefined,
        client_type: valorDe(x.datos, ["tipo_cliente", "client_type"]) ?? undefined,
        sales_condition: valorDe(x.datos, ["cond_venta", "condicion_venta", "sales_condition", "condicion"]) ?? undefined,
        salesperson_code: valorDe(x.datos, ["cod_vdor", "codigo_vendedor", "salesperson_code", "vendedor", "cod_vendedor", "cod_vdor"]) ?? undefined,
        price_type: valorDe(x.datos, ["tipo_de_precio", "tipo_precio", "price_type"]) ?? undefined,
        zone: valorDe(x.datos, ["zona", "zone"]) ?? undefined,
        codigo_vendedor: valorDe(x.datos, ["cod_vdor", "codigo_vendedor", "cod_vendedor"]) ?? undefined,
        condicion_venta_pegasus: condVentaPegasus(x.datos),
        ...(x.codigoPegasus ? { codigo_pegasus: x.codigoPegasus } : {}),
      },
    });
  }
  const aCrear = pendientes.filter((p) => !p.existenteId);
  const aActualizar = pendientes.filter((p) => p.existenteId);
  const snapshots = await capturarSnapshots(
    aActualizar.map((p) => ({ id: p.existenteId! })),
    (ids) =>
      prisma.cliente.findMany({
        where: { id: { in: ids } },
        select: { ...camposClienteSnapshot },
      }),
  );
  await escribirLotes(
    aCrear,
    (p) => prisma.cliente.create({ data: p.data }),
    (p, r) => {
      resultado.creados.clientes.push((r as { id: string }).id);
      ok(resultado.log, p.fila, `cliente "${p.nombre}" creado`);
      resultado.filas_ok++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
  await escribirLotes(
    aActualizar,
    (p) => prisma.cliente.update({ where: { id: p.existenteId! }, data: p.data }),
    (p) => {
      resultado.actualizados.clientes = resultado.actualizados.clientes ?? [];
      resultado.actualizados.clientes.push({
        id: p.existenteId!,
        antes: snapshots.get(p.existenteId!) ?? {},
      });
      warning(resultado.log, p.fila, `cliente "${p.nombre}" actualizado`);
      resultado.filas_warning++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
}

interface DatosProveedor {
  supplier: string;
  tax?: string;
  phone?: string;
  address?: string;
  document_type?: string;
  condition_description?: string;
  term?: string;
  plazo_pago?: string;
  tipo_documento_pegasus?: string;
  fecha_vencimiento_autorizacion?: Date;
  tiene_acuerdo_comercial?: boolean;
  codigo_pegasus?: string;
}

interface PendienteProveedor {
  fila: number;
  supplier: string;
  codigoPegasus: string | null;
  existenteId: string | null;
  data: DatosProveedor;
}

// Helpers de parseo de proveedores (misma lógica que PROD QA).
function rucProveedor(datos: Record<string, string>): string | null {
  const raw = valorDe(datos, ["tax", "ruc", "documento", "id_fiscal", "ruc_dni", "cuit"]);
  if (!raw) return null;
  const limpio = raw.replace(/-/g, "").trim();
  if (!/^\d+$/.test(limpio)) return null;
  if (limpio.length < 5 || limpio.length > 20) return null;
  if (limpio === "00000000" || limpio === "11111111") return null;
  return limpio;
}

const MAPA_TIPO_DOC_PROVEEDOR: Record<string, string> = {
  "fc contado": "FACTURA_CONTADO",
  "fc credito": "FACTURA_CREDITO",
  importaciones: "IMPORTACION",
};

function tipoDocProveedor(datos: Record<string, string>): string | null {
  const raw = valorDe(datos, ["tipo_documento_pegasus", "tip_doc", "document_type", "tipo_documento", "tipo_doc"]) ?? "";
  if (!raw) return null;
  return MAPA_TIPO_DOC_PROVEEDOR[raw.toLowerCase()] ?? null;
}

function condicionProveedor(datos: Record<string, string>): string | undefined {
  const cond = valorDe(datos, ["condition_description", "condicion", "condicion_pago", "cond"]) ?? "";
  if (!cond) return undefined;
  return cond.toLowerCase() === "importaciones" ? "IMPORTACION" : "CONTADO";
}

function plazoProveedor(datos: Record<string, string>): string | undefined {
  const plazo = valorDe(datos, ["term", "plazo", "plazo_pago", "condicion_pago"]) ?? "";
  if (!plazo) return undefined;
  return mapearPlazoPago(plazo);
}

function vencimientoProveedor(datos: Record<string, string>): Date | null {
  const raw = valorDe(datos, ["vencimiento", "vencim", "venc", "fecha_vencimiento_autorizacion"]);
  if (!raw) return null;
  const parsed = parsearFechaPegasus(raw);
  if (!parsed || isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function tieneAcuerdoProveedor(datos: Record<string, string>): boolean | undefined {
  const raw = valorDe(datos, ["acuerdo", "acuer"]) ?? "";
  if (!raw) return undefined;
  return raw === "1";
}

const camposProveedorSnapshot = {
  id: true,
  supplier: true,
  tax: true,
  phone: true,
  address: true,
  document_type: true,
  condition_description: true,
  term: true,
  plazo_pago: true,
  tipo_documento_pegasus: true,
  fecha_vencimiento_autorizacion: true,
  tiene_acuerdo_comercial: true,
  codigo_pegasus: true,
} as const;

async function importarProveedores(
  filas: Awaited<ReturnType<typeof filasAObjetos>>,
  resultado: ResultadoImportacion,
) {
  const validas: Array<{
    fila: number;
    datos: Record<string, string>;
    supplier: string;
    codigoPegasus: string | null;
  }> = [];
  for (const f of filas) {
    const supplier = valorDe(f.datos, ["supplier", "nombre_proveedor", "proveedor", "razon_social", "raz_social", "nombre", "empresa", "name"]);
    if (!supplier) {
      error(resultado.log, f.fila, "falta nombre/supplier");
      resultado.filas_error++;
      continue;
    }
    let razonSocial = supplier;
    const parenMatch = razonSocial.match(/\((.+?)\)/);
    if (parenMatch) razonSocial = razonSocial.replace(/\(.+?\)/, "").trim();
    validas.push({
      fila: f.fila,
      datos: f.datos,
      supplier: razonSocial,
      codigoPegasus: valorDe(f.datos, ["codigo_pegasus", "codigo", "cod", "id_proveedor", "code", "código"]),
    });
  }
  const codigosPegasus = [...new Set(validas.map((x) => x.codigoPegasus).filter((c): c is string => !!c))];
  const suppliers = [...new Set(validas.map((x) => x.supplier))];
  let existentes: Array<{ id: string; codigo_pegasus: string | null; supplier: string | null }> = [];
  if (codigosPegasus.length || suppliers.length) {
    existentes = await prisma.proveedor.findMany({
      where: {
        OR: [
          ...(codigosPegasus.length ? [{ codigo_pegasus: { in: codigosPegasus } }] : []),
          ...(suppliers.length ? [{ supplier: { in: suppliers } }] : []),
        ],
      },
      select: { id: true, codigo_pegasus: true, supplier: true },
    });
  }
  const porPegasus = mapaPor(existentes, "codigo_pegasus");
  const porSupplier = mapaPor(existentes, "supplier");
  const vistosPegasus = new Set<string>();
  const vistosSupplier = new Set<string>();
  const pendientes: PendienteProveedor[] = [];
  for (const x of validas) {
    if (x.codigoPegasus) {
      if (vistosPegasus.has(x.codigoPegasus)) {
        error(resultado.log, x.fila, "código pegasus duplicado en el archivo");
        resultado.filas_error++;
        continue;
      }
      vistosPegasus.add(x.codigoPegasus);
    }
    if (vistosSupplier.has(x.supplier)) {
      error(resultado.log, x.fila, "proveedor duplicado en el archivo");
      resultado.filas_error++;
      continue;
    }
    vistosSupplier.add(x.supplier);
    const existente = x.codigoPegasus
      ? porPegasus.get(x.codigoPegasus)
      : porSupplier.get(x.supplier);
    pendientes.push({
      fila: x.fila,
      supplier: x.supplier,
      codigoPegasus: x.codigoPegasus,
      existenteId: existente?.id ?? null,
      data: {
        supplier: x.supplier,
        tax: rucProveedor(x.datos) ?? undefined,
        phone: limpiarTelefono(valorDe(x.datos, ["phone", "telefono", "movil", "celular"]) ?? "") ?? undefined,
        address: valorDe(x.datos, ["address", "direccion", "domicilio"]) ?? undefined,
        tipo_documento_pegasus: tipoDocProveedor(x.datos) ?? undefined,
        condition_description: condicionProveedor(x.datos),
        term: plazoProveedor(x.datos),
        plazo_pago: plazoProveedor(x.datos),
        fecha_vencimiento_autorizacion: vencimientoProveedor(x.datos) ?? undefined,
        tiene_acuerdo_comercial: tieneAcuerdoProveedor(x.datos),
        ...(x.codigoPegasus ? { codigo_pegasus: x.codigoPegasus } : {}),
      },
    });
  }
  const aCrear = pendientes.filter((p) => !p.existenteId);
  const aActualizar = pendientes.filter((p) => p.existenteId);
  const snapshots = await capturarSnapshots(
    aActualizar.map((p) => ({ id: p.existenteId! })),
    (ids) =>
      prisma.proveedor.findMany({
        where: { id: { in: ids } },
        select: { ...camposProveedorSnapshot },
      }),
  );
  await escribirLotes(
    aCrear,
    (p) => prisma.proveedor.create({ data: p.data }),
    (p, r) => {
      resultado.creados.proveedores.push((r as { id: string }).id);
      ok(resultado.log, p.fila, `proveedor "${p.supplier}" creado`);
      resultado.filas_ok++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
  await escribirLotes(
    aActualizar,
    (p) => prisma.proveedor.update({ where: { id: p.existenteId! }, data: p.data }),
    (p) => {
      resultado.actualizados.proveedores = resultado.actualizados.proveedores ?? [];
      resultado.actualizados.proveedores.push({
        id: p.existenteId!,
        antes: snapshots.get(p.existenteId!) ?? {},
      });
      warning(resultado.log, p.fila, `proveedor "${p.supplier}" actualizado`);
      resultado.filas_warning++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
}

interface FilaProducto {
  fila: number;
  datos: Record<string, string>;
  nombre: string;
  codigo: string | null;
  codigoPegasus: string | null;
}

async function precargarProductos(filas: FilaProducto[]) {
  const codigos = [...new Set(filas.map((x) => x.codigo).filter((c): c is string => !!c))];
  const pegas = [...new Set(filas.map((x) => x.codigoPegasus).filter((c): c is string => !!c))];
  if (codigos.length === 0 && pegas.length === 0) {
    return {
      porCodigo: new Map<string, { id: string }>(),
      porPegasus: new Map<string, { id: string }>(),
    };
  }
  const existentes = await prisma.producto.findMany({
    where: {
      OR: [
        ...(codigos.length ? [{ codigo: { in: codigos } }] : []),
        ...(pegas.length ? [{ codigo_pegasus: { in: pegas } }] : []),
      ],
    },
    select: { id: true, codigo: true, codigo_pegasus: true },
  });
  const porCodigo = new Map<string, { id: string }>();
  const porPegasus = new Map<string, { id: string }>();
  for (const p of existentes) {
    if (p.codigo) porCodigo.set(p.codigo, { id: p.id });
    if (p.codigo_pegasus) porPegasus.set(p.codigo_pegasus, { id: p.id });
  }
  return { porCodigo, porPegasus };
}

function buscarProductoEn(
  codigo: string | null,
  codigoPegasus: string | null,
  porCodigo: Map<string, { id: string }>,
  porPegasus: Map<string, { id: string }>,
): { id: string } | null {
  if (codigo) {
    const e = porCodigo.get(codigo);
    if (e) return e;
  }
  if (codigoPegasus) {
    const e = porPegasus.get(codigoPegasus);
    if (e) return e;
  }
  return null;
}

interface DatosProducto extends StockDepositos {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  precio_base: number;
  purchase_cost: number;
  stock_total: number;
  stock_minimo?: number;
  stock_maximo?: number;
  barcode?: string;
  cate?: string;
  subcate?: string;
  no?: string;
  codigo_pegasus?: string;
}

interface PendienteProducto {
  fila: number;
  nombre: string;
  codigoPegasus: string | null;
  existenteId: string | null;
  data: DatosProducto;
}

const camposProductoSnapshot = {
  id: true,
  nombre: true,
  codigo: true,
  descripcion: true,
  precio_base: true,
  purchase_cost: true,
  stock_total: true,
  stock_minimo: true,
  stock_maximo: true,
  barcode: true,
  cate: true,
  subcate: true,
  no: true,
  codigo_pegasus: true,
  ...Object.fromEntries(STOCK_DEPOSITOS.map((c) => [c, true])),
} as const;

async function importarProductos(
  filas: Awaited<ReturnType<typeof filasAObjetos>>,
  resultado: ResultadoImportacion,
) {
  const validas: FilaProducto[] = [];
  for (const f of filas) {
    const nombre = valorDe(f.datos, [
      "nombre",
      "nombre_producto",
      "descripcion",
      "descripcion_de_producto",
      "descripcion_breve",
      "descripcion_corta",
      "producto",
      "articulo",
      "detalle",
      "name",
    ]);
    if (!nombre) {
      error(resultado.log, f.fila, "falta nombre");
      resultado.filas_error++;
      continue;
    }
    const codigo = valorDe(f.datos, [
      "codigo",
      "codigo_articulo",
      "cod_articulo",
      "codigo_de_articulo",
      "codigo_producto",
      "cod_producto",
      "cod",
      "code",
      "sku",
      "no",
      "no_articulo",
      "cod_art",
      "referencia",
      "ref",
      "id_articulo",
      "codigo_art",
    ]);
    const codigoPegasus = valorDe(f.datos, ["codigo_pegasus", "id_pegasus", "cod_pegasus", "codigo_p", "id_pegasus_codigo"]);
    if (!codigo && !codigoPegasus) {
      error(resultado.log, f.fila, "falta código del producto");
      resultado.filas_error++;
      continue;
    }
    validas.push({ fila: f.fila, datos: f.datos, nombre, codigo, codigoPegasus });
  }
  const { porCodigo, porPegasus } = await precargarProductos(validas);
  const vistosCodigo = new Set<string>();
  const vistosPegasus = new Set<string>();
  const pendientes: PendienteProducto[] = [];
  for (const x of validas) {
    if (x.codigo) {
      if (vistosCodigo.has(x.codigo)) {
        error(resultado.log, x.fila, "código duplicado en el archivo");
        resultado.filas_error++;
        continue;
      }
      vistosCodigo.add(x.codigo);
    }
    if (x.codigoPegasus) {
      if (vistosPegasus.has(x.codigoPegasus)) {
        error(resultado.log, x.fila, "código pegasus duplicado en el archivo");
        resultado.filas_error++;
        continue;
      }
      vistosPegasus.add(x.codigoPegasus);
    }
    const existente = buscarProductoEn(x.codigo, x.codigoPegasus, porCodigo, porPegasus);
    const stockDeps = stockDepositosDe(x.datos);
    const stockTotal = num(valorDe(x.datos, ["stock", "stock_total", "existencia", "existencias", "cantidad", "unidades"]));
    const stockTotalFinal =
      stockTotal ??
      (Object.keys(stockDeps).length > 0
        ? Object.values(stockDeps).reduce((a, b) => a + b, 0)
        : 0);
    pendientes.push({
      fila: x.fila,
      nombre: x.nombre,
      codigoPegasus: x.codigoPegasus,
      existenteId: existente?.id ?? null,
      data: {
        nombre: x.nombre,
        codigo: x.codigo ?? undefined,
        no: valorDe(x.datos, ["no", "no_articulo", "n_articulo"]) ?? undefined,
        descripcion: valorDe(x.datos, ["descripcion", "description", "detalle"]) ?? undefined,
        precio_base: num(valorDe(x.datos, ["precio", "precio_unit", "precio_unitario", "precio_base", "precio_venta", "precio_de_venta", "precio_publico", "pvp", "venta", "precio_lista", "lista"])) ?? 0,
        purchase_cost: num(valorDe(x.datos, ["costo", "costo_unit", "costo_unitario", "purchase_cost", "precio_costo", "costo_importacion", "costo_de_importacion", "costo_promedio", "costo_medio", "costo_promedio_ponderado", "c_unitario"])) ?? 0,
        stock_total: stockTotalFinal,
        stock_minimo: num(valorDe(x.datos, ["stock_minimo", "minimo", "stock_min"])) ?? undefined,
        stock_maximo: num(valorDe(x.datos, ["stock_maximo", "maximo", "stock_max"])) ?? undefined,
        barcode: valorDe(x.datos, ["barcode", "codigo_barra", "codigo_de_barras", "bar_code", "sku", "ean"]) ?? undefined,
        cate: valorDe(x.datos, ["categoria", "cate", "grupo"]) ?? undefined,
        subcate: valorDe(x.datos, ["subcategoria", "subcate", "subgrupo"]) ?? undefined,
        ...stockDeps,
        ...(x.codigoPegasus ? { codigo_pegasus: x.codigoPegasus } : {}),
      },
    });
  }
  const aCrear = pendientes.filter((p) => !p.existenteId);
  const aActualizar = pendientes.filter((p) => p.existenteId);
  const snapshots = await capturarSnapshots(
    aActualizar.map((p) => ({ id: p.existenteId! })),
    (ids) =>
      prisma.producto.findMany({
        where: { id: { in: ids } },
        select: { ...camposProductoSnapshot },
      }),
  );
  await escribirLotes(
    aCrear,
    (p) => prisma.producto.create({ data: p.data }),
    (p, r) => {
      resultado.creados.productos.push((r as { id: string }).id);
      ok(resultado.log, p.fila, `producto "${p.nombre}" creado`);
      resultado.filas_ok++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
  await escribirLotes(
    aActualizar,
    (p) => prisma.producto.update({ where: { id: p.existenteId! }, data: p.data }),
    (p) => {
      resultado.actualizados.productos = resultado.actualizados.productos ?? [];
      resultado.actualizados.productos.push({
        id: p.existenteId!,
        antes: snapshots.get(p.existenteId!) ?? {},
      });
      warning(resultado.log, p.fila, `producto "${p.nombre}" actualizado`);
      resultado.filas_warning++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
}

interface PendienteStock {
  fila: number;
  clave: string;
  productoId: string | null;
  stock: number;
  minimo: number | null;
  datos: Record<string, string>;
}

const camposStockSnapshot = {
  id: true,
  stock_total: true,
  stock_minimo: true,
  ...Object.fromEntries(STOCK_DEPOSITOS.map((c) => [c, true])),
} as const;

async function importarStock(
  filas: Awaited<ReturnType<typeof filasAObjetos>>,
  resultado: ResultadoImportacion,
) {
  const validas: Array<{
    fila: number;
    datos: Record<string, string>;
    nombre: string;
    codigo: string | null;
    codigoPegasus: string | null;
    stock: number;
    minimo: number | null;
  }> = [];
  for (const f of filas) {
    const codigo = valorDe(f.datos, [
      "codigo",
      "codigo_articulo",
      "cod_articulo",
      "codigo_de_articulo",
      "codigo_producto",
      "cod_producto",
      "cod",
      "code",
      "sku",
      "no",
      "no_articulo",
      "cod_art",
      "referencia",
      "ref",
      "id_articulo",
      "codigo_art",
    ]);
    const codigoPegasus = valorDe(f.datos, ["codigo_pegasus", "id_pegasus", "cod_pegasus", "codigo_p"]);
    const stock = num(valorDe(f.datos, [
      "stock",
      "stock_total",
      "stock_actual",
      "stock_fisico",
      "existencia",
      "existencias",
      "cantidad",
      "cant",
      "unidades",
      "qty",
      "saldo",
    ]));
    if (!codigo && !codigoPegasus) {
      error(resultado.log, f.fila, "falta código");
      resultado.filas_error++;
      continue;
    }
    if (stock === null) {
      error(resultado.log, f.fila, "falta stock/cantidad");
      resultado.filas_error++;
      continue;
    }
    validas.push({
      fila: f.fila,
      datos: f.datos,
      nombre: "",
      codigo,
      codigoPegasus,
      stock,
      minimo: num(valorDe(f.datos, ["stock_minimo", "stock_min", "minimo", "min"])),
    });
  }
  const { porCodigo, porPegasus } = await precargarProductos(validas);
  const vistos = new Set<string>();
  const pendientes: PendienteStock[] = [];
  for (const x of validas) {
    const clave = x.codigo ?? x.codigoPegasus!;
    if (vistos.has(clave)) {
      error(resultado.log, x.fila, "código duplicado en el archivo");
      resultado.filas_error++;
      continue;
    }
    vistos.add(clave);
    const producto = buscarProductoEn(x.codigo, x.codigoPegasus, porCodigo, porPegasus);
    if (!producto) {
      error(resultado.log, x.fila, "producto no encontrado");
      resultado.filas_error++;
      continue;
    }
    pendientes.push({ fila: x.fila, clave, productoId: producto.id, stock: x.stock, minimo: x.minimo, datos: x.datos });
  }
  const snapshots = await capturarSnapshots(
    pendientes.filter((p) => p.productoId).map((p) => ({ id: p.productoId! })),
    (ids) =>
      prisma.producto.findMany({
        where: { id: { in: ids } },
        select: { ...camposStockSnapshot },
      }),
  );
  await escribirLotes(
    pendientes,
    (p) =>
      prisma.producto.update({
        where: { id: p.productoId! },
        data: {
          stock_total: p.stock,
          ...(p.minimo !== null ? { stock_minimo: p.minimo } : {}),
          ...stockDepositosDe(p.datos),
        },
      }),
    (p) => {
      resultado.actualizados.stock = resultado.actualizados.stock ?? [];
      resultado.actualizados.stock.push({
        id: p.productoId!,
        antes: snapshots.get(p.productoId!) ?? {},
      });
      ok(resultado.log, p.fila, `stock del producto ${p.clave} = ${p.stock}`);
      resultado.filas_ok++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
}

interface PendienteSerial {
  fila: number;
  productoId: string;
  serial: string;
  deposito: string | null;
}

async function importarSeriales(
  filas: Awaited<ReturnType<typeof filasAObjetos>>,
  resultado: ResultadoImportacion,
) {
  const validas: Array<{
    fila: number;
    datos: Record<string, string>;
    nombre: string;
    codigo: string | null;
    codigoPegasus: string | null;
    serial: string;
  }> = [];
  for (const f of filas) {
    const serial = valorDe(f.datos, ["serial", "serie", "numero_serie", "nro_serie", "imei"]);
    if (!serial) {
      error(resultado.log, f.fila, "falta serial");
      resultado.filas_error++;
      continue;
    }
    const codigo = valorDe(f.datos, ["codigo", "code", "cod", "codigo_articulo", "sku"]);
    const codigoPegasus = valorDe(f.datos, ["codigo_pegasus"]);
    if (!codigo && !codigoPegasus) {
      error(resultado.log, f.fila, "falta código del producto");
      resultado.filas_error++;
      continue;
    }
    validas.push({ fila: f.fila, datos: f.datos, nombre: "", codigo, codigoPegasus, serial });
  }
  const { porCodigo, porPegasus } = await precargarProductos(validas);
  const vistosSerial = new Set<string>();
  const pendientes: PendienteSerial[] = [];
  for (const x of validas) {
    if (vistosSerial.has(x.serial)) {
      error(resultado.log, x.fila, "serial duplicado en el archivo");
      resultado.filas_error++;
      continue;
    }
    vistosSerial.add(x.serial);
    const producto = buscarProductoEn(x.codigo, x.codigoPegasus, porCodigo, porPegasus);
    if (!producto) {
      error(resultado.log, x.fila, "producto no encontrado");
      resultado.filas_error++;
      continue;
    }
    pendientes.push({
      fila: x.fila,
      productoId: producto.id,
      serial: x.serial,
      deposito: valorDe(x.datos, ["deposito", "almacen", "bodega"]),
    });
  }
  const seriales = [...new Set(pendientes.map((p) => p.serial))];
  let existentesSeriales: string[] = [];
  if (seriales.length > 0) {
    const duplicados = await prisma.productoSerie.findMany({
      where: { serial: { in: seriales } },
      select: { serial: true },
    });
    existentesSeriales = duplicados.map((d) => d.serial);
  }
  const existentesSet = new Set(existentesSeriales);
  const pendientesFinal = pendientes.filter((p) => {
    if (existentesSet.has(p.serial)) {
      warning(resultado.log, p.fila, `serial ${p.serial} ya registrado`);
      resultado.filas_warning++;
      return false;
    }
    return true;
  });
  await escribirLotes(
    pendientesFinal,
    (p) =>
      prisma.productoSerie.create({
        data: {
          producto_id: p.productoId,
          serial: p.serial,
          deposito: p.deposito ?? undefined,
          activo: true,
        },
      }),
    (p) => {
      resultado.creados.seriales.push(p.serial);
      ok(resultado.log, p.fila, `serial ${p.serial} registrado`);
      resultado.filas_ok++;
    },
    (p, e) => {
      error(resultado.log, p.fila, (e as Error).message.slice(0, 200));
      resultado.filas_error++;
    },
  );
}

const IMPORTADORES: Record<
  TipoImportacionPegasus,
  (filas: Awaited<ReturnType<typeof filasAObjetos>>, r: ResultadoImportacion) => Promise<void>
> = {
  clientes: importarClientes,
  proveedores: importarProveedores,
  productos: importarProductos,
  stock: importarStock,
  seriales: importarSeriales,
};

export async function ejecutarImportacion(
  tipo: TipoImportacionPegasus,
  contenido: string,
  filaInicio = 0,
): Promise<ResultadoImportacion> {
  const filasRaw = parseCSV(contenido);
  const idxCabecera = detectarCabecera(filasRaw, new Set(CLAVES_TIPO[tipo]));
  const h = idxCabecera >= 0 ? idxCabecera : 0;
  const cabeceraNorm = filasRaw.length > 0 ? filasRaw[h].map(normalizarEncabezado) : [];
  const filas = filasAObjetos(contenido, h).map((f) => ({ ...f, fila: f.fila + filaInicio }));
  const resultado: ResultadoImportacion = {
    filas_total: filas.length,
    filas_ok: 0,
    filas_warning: 0,
    filas_error: 0,
    log: [],
    creados: { clientes: [], proveedores: [], productos: [], seriales: [] },
    actualizados: {},
  };
  resultado.log.push(
    `Cabecera detectada (normalizada): ${cabeceraNorm.join(" | ") || "(vacía)"}`,
  );
  if (filas.length === 0) {
    resultado.log.push("No se encontraron filas para importar.");
    resultado.filas_error++;
    return resultado;
  }
  await IMPORTADORES[tipo](filas, resultado);
  return resultado;
}

/**
 * Procesa un lote de filas (chunked import). El cliente envía "cuerpo" (líneas de datos)
 * más la "cabecera" para que el parser mapee las columnas, y acumula el resultado global
 * entre llamadas. Mantiene cada request chico y por debajo de los límites de body/timeout.
 */
export async function procesarLote(
  tipo: TipoImportacionPegasus,
  cabecera: string,
  cuerpo: string,
  filaInicio = 0,
): Promise<ResultadoImportacion> {
  const contenido = cabecera.trim() ? `${cabecera.trim()}\n${cuerpo}` : cuerpo;
  return ejecutarImportacion(tipo, contenido, filaInicio);
}

export async function revertirImportacion(importacionId: string) {
  const imp = await prisma.importacionPegasus.findUnique({
    where: { id: importacionId },
  });
  if (!imp) throw new Error("Importación no encontrada");
  if (imp.estado !== "completada" && imp.estado !== "parcial") {
    throw new Error("Solo se pueden revertir importaciones completadas o parciales");
  }
  const detalle = (imp.log_detalle ?? {}) as {
    creados?: {
      clientes?: string[];
      proveedores?: string[];
      productos?: string[];
      seriales?: string[];
    };
    actualizados?: RegistroSnapshots;
  };
  const creados = detalle.creados ?? {};
  const actualizados = detalle.actualizados ?? {};

  let eliminados = 0;
  await prisma.$transaction(async (tx) => {
    // 1) Seriales creados por la importación → eliminar.
    if (creados.seriales?.length) {
      const r = await tx.productoSerie.deleteMany({ where: { serial: { in: creados.seriales } } });
      eliminados += r.count;
    }
    // 2) Restaurar valores previos de los registros actualizados (P2-5).
    for (const u of actualizados.clientes ?? []) {
      await tx.cliente.update({ where: { id: u.id }, data: u.antes });
    }
    for (const u of actualizados.proveedores ?? []) {
      await tx.proveedor.update({ where: { id: u.id }, data: u.antes });
    }
    for (const u of actualizados.productos ?? []) {
      await tx.producto.update({ where: { id: u.id }, data: u.antes });
    }
    for (const u of actualizados.stock ?? []) {
      await tx.producto.update({ where: { id: u.id }, data: u.antes });
    }
    // 3) Eliminar registros creados por la importación.
    // Secuencial: mismas queries comparten el cliente de la tx (pg deprecó
    // query() concurrente sobre un cliente ocupado).
    let eliminadosCreados = 0;
    if (creados.clientes?.length) {
      const r = await tx.cliente.deleteMany({ where: { id: { in: creados.clientes } } });
      eliminadosCreados += r.count;
    }
    if (creados.proveedores?.length) {
      const r = await tx.proveedor.deleteMany({ where: { id: { in: creados.proveedores } } });
      eliminadosCreados += r.count;
    }
    if (creados.productos?.length) {
      const r = await tx.producto.deleteMany({ where: { id: { in: creados.productos } } });
      eliminadosCreados += r.count;
    }
    eliminados += eliminadosCreados;
    await tx.importacionPegasus.update({
      where: { id: importacionId },
      data: { estado: "revertida" },
    });
  });

  const serialesEliminados = creados.seriales?.length ?? 0;
  const updatesRestaurados =
    (actualizados.clientes?.length ?? 0) +
    (actualizados.proveedores?.length ?? 0) +
    (actualizados.productos?.length ?? 0) +
    (actualizados.stock?.length ?? 0);
  return {
    eliminados,
    seriales: serialesEliminados,
    restaurados: updatesRestaurados,
  };
}

export { NOMBRES_TIPO, CAMPOS_TIPO } from "./constantes";