#!/usr/bin/env tsx
/**
 * Limpia tags legacy DELIVERY:<monto> de observaciones.
 * - Si shipping_fee es NULL/0 y el tag existe → copia el monto a shipping_fee
 * - En todos los casos → elimina el tag del texto (deja observaciones limpias)
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/limpiar-delivery-tags.mts          # dry-run
 *   npx tsx --env-file=.env scripts/limpiar-delivery-tags.mts --apply  # aplica
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { parseDeliveryDeObservaciones, sinDeliveryEnObservaciones } from "../src/lib/ventas/calculos";

const DRY = !process.argv.includes("--apply");

async function main() {
  const ordenes = await prisma.orden.findMany({
    where: { observaciones: { contains: "DELIVERY", mode: "insensitive" } },
    select: { id: true, numero_orden: true, observaciones: true, shipping_fee: true },
  });
  console.log(`Encontradas ${ordenes.length} órdenes con tag DELIVERY`);
  let migradas = 0;
  let limpiadas = 0;
  for (const o of ordenes) {
    const tagMonto = parseDeliveryDeObservaciones(o.observaciones);
    const shippingFee = Number(o.shipping_fee ?? 0);
    // Limpieza amplia: cualquier fragmento que contenga DELIVERY (cubre tags malformados)
    const obsLimpiaStrict = sinDeliveryEnObservaciones(o.observaciones) || null;
    const obsLimpiaBroad = (o.observaciones ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter((p) => !p.toUpperCase().includes("DELIVERY"))
      .join(" | ") || null;
    const obsLimpia = obsLimpiaBroad?.length !== (o.observaciones ?? "").length ? obsLimpiaBroad : obsLimpiaStrict;
    const obsCambia = (obsLimpia ?? "") !== (o.observaciones ?? "");
    const feeCambia = shippingFee === 0 && tagMonto > 0;
    if (!obsCambia && !feeCambia) {
      console.log(`- ${o.numero_orden} ${o.id.slice(0, 8)} SKIP: obs="${o.observaciones}" tag=${tagMonto}`);
      continue;
    }
    console.log(
      `- ${o.numero_orden} ${o.id.slice(0, 8)} shipping_fee=${shippingFee} tag=${tagMonto} -> obs ${obsCambia ? "limpia" : "igual"} fee ${feeCambia ? "migra" : "igual"}`,
    );
    if (!DRY) {
      await prisma.orden.update({
        where: { id: o.id },
        data: {
          ...(feeCambia ? { shipping_fee: tagMonto } : {}),
          ...(obsCambia ? { observaciones: obsLimpia } : {}),
        },
      });
      if (feeCambia) migradas++;
      if (obsCambia) limpiadas++;
    }
  }
  if (DRY) {
    console.log(`\nDRY RUN: ${ordenes.length} candidatas. Ejecuta con --apply para aplicar.`);
  } else {
    console.log(`\nAplicado: ${migradas} shipping_fee migrados, ${limpiadas} observaciones limpiadas.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
