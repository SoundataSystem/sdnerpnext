// FASE 14 — Auditoría de seguridad funcional por rol.
// Escanea src/lib/actions/*.ts y verifica, para cada Server Action:
//   1. Que tenga guard de autorización (requireRole/requireUser) en el cuerpo.
//   2. Que los roles permitidos existan en el catálogo ROLES (roles.ts).
//   3. Que coincida con la matriz documentada §7 (roles esperados por módulo).
// Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/auditar-permisos.mts
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ROLES_VALIDOS } from "../src/lib/usuarios/roles";

const DIR = path.resolve("src/lib/actions");

// Acciones sin guard por diseño (auth: login/logout no requieren sesión previa).
const SIN_GUARD_INTENCIONAL = new Set(["loginAction", "logoutAction"]);

// Matriz esperada (doc §7), key = nombre de archivo.
const MATRIZ_ESPERADA: Record<string, { min: string[] }> = {
  "ventas-actions.ts": { min: ["admin", "vendedor", "cajero"] },
  "compras-actions.ts": { min: ["admin", "compra", "administracion", "recepcion_compras"] },
  "inventario-actions.ts": { min: ["admin", "deposito", "administracion", "logistica"] },
  "devoluciones-actions.ts": { min: ["admin"] },
  "servicios-actions.ts": { min: ["admin", "vendedor", "servicio_tecnico", "supervisor_tecnico"] },
  "cotizaciones-actions.ts": { min: ["admin", "vendedor", "cajero"] },
  "contabilidad-actions.ts": { min: ["admin", "contabilidad"] },
  "configuracion-actions.ts": { min: ["admin"] },
  "pegasus-actions.ts": { min: ["admin"] },
  "usuarios-actions.ts": { min: ["admin"] },
  "notificaciones-actions.ts": { min: [] },
};

interface Hallazgo {
  archivo: string;
  tipo: "sin_guard" | "rol_inexistente" | "matriz";
  detalle: string;
}

/** Devuelve los roles literales dentro de una expresión requireRole(...). */
function rolesDeExpr(expr: string, constantes: Record<string, string[]>): string[] {
  const rolesInline = [...expr.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  const refs = [...expr.matchAll(/\.\.\.(ROLES_[A-Z_]+)/g)].flatMap((x) => constantes[x[1]] ?? []);
  return [...rolesInline, ...refs];
}

/** Extrae el texto entre requireRole( y el paréntesis de cierre balanceado. */
function textoRequireRole(cuerpo: string): string | null {
  const idx = cuerpo.indexOf("requireRole(");
  if (idx < 0) return null;
  let depth = 0;
  for (let i = idx + "requireRole(".length; i < cuerpo.length; i++) {
    const ch = cuerpo[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      if (depth === 0) return cuerpo.slice(idx + "requireRole(".length, i);
      depth -= 1;
    }
  }
  return null;
}

/** Ventana del cuerpo de una action: desde su export hasta el próximo export/EOF. */
function cuerpoAction(lineas: string[], inicio: number): string {
  let fin = lineas.length;
  for (let i = inicio + 1; i < lineas.length; i++) {
    if (/^\s*export\s+const\s+\w+\s*=\s*actionClient/.test(lineas[i])) {
      fin = i;
      break;
    }
  }
  return lineas.slice(inicio, fin).join("\n");
}

async function main() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".ts"));
  const hallazgos: Hallazgo[] = [];
  const resumen: Array<{ archivo: string; acciones: number; conGuard: number; roles: string }> = [];

  for (const file of files) {
    const src = await readFile(path.join(DIR, file), "utf8");
    const lineas = src.split("\n");

    // Mapea constantes ROLES_* → array de roles.
    const constantes: Record<string, string[]> = {};
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(/const\s+(ROLES_[A-Z_]+)\s*=\s*\[/);
      if (m) {
        let texto = "";
        for (let j = i; j < lineas.length; j++) {
          texto += lineas[j];
          if (lineas[j].includes("]")) break;
        }
        constantes[m[1]] = [...texto.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
      }
    }

    const actions: Array<{ nombre: string; inicio: number }> = [];
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(/export\s+const\s+(\w+)\s*=\s*actionClient/);
      if (m) actions.push({ nombre: m[1], inicio: i });
    }

    const rolesEncontrados = new Set<string>();
    let conGuard = 0;

    for (const { nombre, inicio } of actions) {
      const cuerpo = cuerpoAction(lineas, inicio);
      const hasRole = /requireRole\(/.test(cuerpo);
      const hasUser = /requireUser\(/.test(cuerpo);
      const guard = hasRole || hasUser;

      if (guard && (hasRole || hasUser)) conGuard += 1;

      if (!guard) {
        if (!SIN_GUARD_INTENCIONAL.has(nombre)) {
          hallazgos.push({ archivo: file, tipo: "sin_guard", detalle: `${nombre}: sin requireRole/requireUser` });
        }
      } else if (hasRole) {
        const expr = textoRequireRole(cuerpo);
        if (expr !== null) {
          rolesDeExpr(expr, constantes).forEach((r) => {
            rolesEncontrados.add(r);
            if (!ROLES_VALIDOS.has(r)) {
              hallazgos.push({ archivo: file, tipo: "rol_inexistente", detalle: `${nombre}: rol "${r}" no existe en catálogo` });
            }
          });
        }
      }
    }

    // Comparación con matriz esperada: roles encontrados ⊇ min esperados.
    const esperado = MATRIZ_ESPERADA[file];
    if (esperado) {
      for (const r of esperado.min) {
        if (!rolesEncontrados.has(r)) {
          hallazgos.push({ archivo: file, tipo: "matriz", detalle: `falta rol "${r}" esperado en ${esperado.min.join(",")}` });
        }
      }
    }

    resumen.push({
      archivo: file,
      acciones: actions.length,
      conGuard,
      roles: [...rolesEncontrados].sort().join(","),
    });
  }

  console.log("\n=== MATRIZ REAL DE PERMISOS (por archivo) ===");
  for (const r of resumen) {
    console.log(`${r.archivo}: ${r.acciones} actions, ${r.conGuard} con guard`);
    if (r.roles) console.log(`  roles: ${r.roles}`);
  }

  console.log("\n=== HALLAZGOS ===");
  if (hallazgos.length === 0) {
    console.log("Ninguno. Todas las Server Actions tienen guard y roles válidos.");
  } else {
    for (const h of hallazgos) console.log(`[${h.tipo}] ${h.archivo}: ${h.detalle}`);
  }
  process.exitCode = hallazgos.length > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
