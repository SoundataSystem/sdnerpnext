// Seed inicial para el módulo de Ventas/Caja/Clientes.
// Idempotente: inserta solo si no existe. Uso:
//   node scripts/seed-ventas.mjs
import pg from "pg";

const csRaw = process.env.DATABASE_URL;
if (!csRaw) {
  console.error("Definí DATABASE_URL (y ejecutá desde la raíz del proyecto).");
  process.exit(1);
}
const connectionString = csRaw.trim();

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function exists(table, column, value) {
  const r = await client.query(
    `SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`,
    [value],
  );
  return r.rowCount > 0;
}

const cuentas = [
  { codigo: "1.1.01", nombre: "Caja", tipo: "activo", nivel: 3 },
  { codigo: "1.1.03", nombre: "Clientes (Cuentas por Cobrar)", tipo: "activo", nivel: 3 },
  { codigo: "1.1.02", nombre: "Bancos", tipo: "activo", nivel: 3 },
  { codigo: "4.1.01", nombre: "Ingresos por Ventas", tipo: "ingreso", nivel: 3 },
  { codigo: "5.1.01", nombre: "Costo de Ventas", tipo: "gasto", nivel: 3 },
];

const productos = [
  {
    codigo: "LAP-1001",
    nombre: 'Laptop Lenovo ThinkPad E14',
    precio_base: 4500000,
    stock_total: 12,
  },
  {
    codigo: "MON-2001",
    nombre: 'Monitor LG 24" Full HD',
    precio_base: 1250000,
    stock_total: 25,
  },
  {
    codigo: "TEC-3001",
    nombre: 'Teclado Logitech K120',
    precio_base: 180000,
    stock_total: 80,
  },
  {
    codigo: "MOU-3002",
    nombre: 'Mouse Inalámbrico Logitech M185',
    precio_base: 95000,
    stock_total: 95,
  },
  {
    codigo: "IMP-4001",
    nombre: 'Impresora Epson EcoTank L3250',
    precio_base: 1800000,
    stock_total: 8,
  },
];

async function main() {
  await client.connect();

  for (const c of cuentas) {
    if (!(await exists("plan_cuentas", "codigo", c.codigo))) {
      await client.query(
        `INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, activo)
         VALUES ($1, $2, $3::text::"TipoCuenta", $4, true)`,
        [c.codigo, c.nombre, c.tipo, c.nivel],
      );
      console.log("plan_cuentas +", c.codigo);
    }
  }

  const metodos = ["efectivo", "tarjeta", "transferencia", "cheque"];
  for (const m of metodos) {
    if (!(await exists("metodos_pago", "nombre", m))) {
      await client.query(
        `INSERT INTO metodos_pago (nombre, activo, porcentaje_costo) VALUES ($1, true, 0)`,
        [m],
      );
      console.log("metodos_pago +", m);
    }
  }

  for (const p of productos) {
    if (!(await exists("productos", "codigo", p.codigo))) {
      await client.query(
        `INSERT INTO productos (codigo, nombre, activo, precio_base, stock_total, stock_soundata)
         VALUES ($1, $2, true, $3, $4, $4)`,
        [p.codigo, p.nombre, p.precio_base, p.stock_total],
      );
      console.log("productos +", p.codigo);
    }
  }

  const cedulaDemo = "3500000-0";
  if (!(await exists("clientes", "cedula", cedulaDemo))) {
    await client.query(
      `INSERT INTO clientes (nombre, apellido, cedula, telefono, email, ciudad, pais, tipo_documento)
       VALUES ('Cliente', 'Demo', $1, '0981000000', 'demo@example.com', 'Asunción', 'Paraguay', 'CI')`,
      [cedulaDemo],
    );
    console.log("clientes + Cliente Demo");
  }

  console.log("Seed completado.");
  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});