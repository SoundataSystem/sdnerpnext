"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { formatGs } from "@/lib/ventas/calculos";
import { registrarImpresionTicketAction } from "@/lib/actions/ventas-actions";
import type { OrdenDTO } from "@/lib/ventas/repository";

type Formato = "ticket" | "factura";

const MONO = "font-mono";
const W = 28;

function fmt(n: number): string {
  if (!n && n !== 0) return "0";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function c(text: string): string {
  const pad = Math.max(0, W - text.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}
function lr(left: string, right: string): string {
  const total = left.length + right.length;
  if (total >= W) {
    const available = W - right.length - 1;
    return left.substring(0, available) + " " + right;
  }
  return left + " ".repeat(W - total) + right;
}
function ln(char = "-"): string {
  return char.repeat(W);
}
function t(text: string | null | undefined, max = W): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.substring(0, max - 3) + "...";
}
function wrap(text: string, max = W): string[] {
  if (!text) return [""];
  if (text.length <= max) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    lines.push(remaining.substring(0, max));
    remaining = remaining.substring(max);
  }
  return lines;
}
function refId(id: string): string {
  if (!id) return "------";
  return id.replace(/-/g, "").slice(-6).toUpperCase();
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  // PROD QA usa hora local; para paridad exacta con Vercel (UTC) vs PY (UTC-3) usamos America/Asuncion
  const dd = String(d.toLocaleString("es-PY", { day: "2-digit", timeZone: "America/Asuncion" }).split("/")[0]).padStart(2, "0");
  // Simplificado: usar toLocaleString con timeZone y extraer partes
  const fmt = new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return c(`${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`);
}
function parsePaymentInfo(obs: string | null | undefined): { condicion: string; metodo: string; delivery: number } {
  if (!obs) return { condicion: "", metodo: "", delivery: 0 };
  const parts = obs.split("|").map((s) => s.trim());
  let condicion = "";
  let metodo = "";
  let delivery = 0;
  for (const part of parts) {
    const up = part.toUpperCase();
    if (up.includes("TAX FREE")) continue;
    if (up.startsWith("DELIVERY:")) {
      delivery = parseInt(part.replace(/^DELIVERY:/i, ""), 10) || 0;
    } else if (up === "CONTADO" || up === "CRÉDITO" || up.includes("VENTAS WEB") || up.includes("POR MAYOR")) {
      condicion = part;
    } else if (up.startsWith("PAGO:")) {
      metodo = part.replace(/^Pago:\s*/i, "");
    }
  }
  return { condicion, metodo, delivery };
}

export function TicketClient({ orden }: { orden: OrdenDTO }) {
  const router = useRouter();
  const [formato, setFormato] = useState<Formato>("ticket");
  const imprimir = useAction(registrarImpresionTicketAction);
  const contentRef = useRef<HTMLDivElement>(null);

  const isTaxFree = (orden.observaciones || "").toUpperCase().includes("TAX FREE");
  const isIvaIncluido = orden.is_tax_included || (orden.observaciones || "").toUpperCase().includes("IVA INCLUIDO");
  const moneda = (orden.moneda as "GS" | "USD") || "GS";
  const costoOp = orden.costo_operativo ?? 0;
  const subtotal = orden.items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);
  const subtotalSinIva = isIvaIncluido ? Math.round(subtotal / 1.1) : subtotal;
  const iva = isTaxFree ? 0 : isIvaIncluido ? subtotal - subtotalSinIva : Math.round((subtotal * 10) / 100);
  const totalFinal = orden.total ?? (isIvaIncluido ? subtotal : subtotal + iva);
  const paymentInfo = parsePaymentInfo(orden.observaciones);

  const ticketLineas = useMemo(() => {
    const fmtM = (v: number) => (moneda === "USD" ? `$${v.toFixed(2)}` : `Gs. ${fmt(v)}`);
    const lines: string[] = [];
    lines.push(c("SOUNDATA ERP"));
    lines.push(c("ORDEN VTA"));
    lines.push(c(orden.numero_orden));
    lines.push(ln());
    lines.push(lr("Ref:", refId(orden.id)));
    lines.push(ln());
    const clienteNombre = t(`${orden.cliente_nombre || ""}`.trim(), W);
    if (clienteNombre) lines.push(clienteNombre);
    if (orden.cliente_cedula) {
      const docLabel = orden.cliente_tipo_documento || "Doc";
      lines.push(lr(docLabel + ":", t(orden.cliente_cedula, W - (docLabel.length + 2))));
    }
    if (orden.cliente_telefono) {
      const tel = orden.cliente_telefono.replace(/\D/g, "");
      lines.push(lr("Tel:", tel.substring(Math.max(0, tel.length - 10))));
    }
    if (orden.vendedor_nombre) {
      lines.push(`Vend: ${t(`${orden.vendedor_nombre} (${orden.vendedor_codigo || ""})`, W - 6)}`);
    }
    if (orden.sucursal) lines.push(`Suc: ${orden.sucursal}`);
    lines.push(ln());
    orden.items.forEach((item) => {
      const codigo = item.producto_codigo ?? "";
      const nombre = item.producto_nombre ?? "";
      const nombreLinea = codigo ? `${codigo} ${nombre}` : nombre;
      wrap(nombreLinea, W).forEach((l) => lines.push(l));
      if (item.serial) lines.push(`SN: ${t(item.serial, W - 4)}`);
      lines.push(
        lr(
          `  ${item.cantidad} x ${moneda === "USD" ? item.precio_unitario.toFixed(2) : fmt(item.precio_unitario)}`,
          moneda === "USD" ? `$${(item.cantidad * item.precio_unitario).toFixed(2)}` : fmt(item.cantidad * item.precio_unitario),
        ),
      );
    });
    if (paymentInfo.delivery > 0) {
      lines.push(lr("19681 Costo Delivery", `Gs. ${fmt(paymentInfo.delivery)}`));
    }
    lines.push(ln());
    if (isIvaIncluido) {
      lines.push(lr("Subtotal s/IVA", fmtM(subtotalSinIva)));
      lines.push(lr("IVA 10%", fmtM(iva)));
    } else {
      lines.push(lr("Subtotal", fmtM(subtotal)));
      if (!isTaxFree && iva > 0) lines.push(lr("IVA 10%", fmtM(iva)));
    }
    if (isTaxFree) lines.push(c("TAX FREE"));
    if (!isTaxFree && costoOp > 0) {
      lines.push(lr("Neto producto", fmtM(totalFinal - costoOp)));
      lines.push(lr("Costo operativo", fmtM(costoOp)));
    }
    lines.push(ln("="));
    lines.push(lr("TOTAL:", fmtM(totalFinal)));
    lines.push(ln("="));
    if (paymentInfo.condicion) lines.push(lr("Condición:", paymentInfo.condicion));
    if (paymentInfo.metodo) {
      lines.push(lr("Método:", t(paymentInfo.metodo, W - 8)));
    }
    if (paymentInfo.condicion || paymentInfo.metodo) lines.push(ln());
    if (orden.observaciones) {
      const extras = orden.observaciones
        .split("|")
        .map((s: string) => s.trim())
        .filter((s: string) => {
          const up = s.toUpperCase();
          return (
            !up.includes("TAX FREE") &&
            !up.includes("IVA INCLUIDO") &&
            up !== "CONTADO" &&
            up !== "CRÉDITO" &&
            !up.includes("VENTAS WEB") &&
            !up.includes("POR MAYOR") &&
            !up.startsWith("PAGO:") &&
            !up.startsWith("DELIVERY:")
          );
        });
      if (extras.length > 0) {
        const extraText = t(extras.join(", "), W);
        if (extraText) {
          lines.push(extraText);
          lines.push(ln());
        }
      }
    }
    lines.push(fmtDateTime(orden.created_at));
    lines.push(ln());
    lines.push(c("TICKET INTERNO SIN VALOR FISCAL"));
    return lines;
  }, [orden, moneda, isTaxFree, isIvaIncluido, subtotal, subtotalSinIva, iva, totalFinal, costoOp, paymentInfo]);

  const fecha = useMemo(
    () =>
      new Date(orden.created_at).toLocaleString("es-PY", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Asuncion",
      }),
    [orden.created_at],
  );
  const ivaFactura = Math.max(0, orden.total - orden.subtotal);

  const getTicketHtml = useCallback(() => {
    if (!contentRef.current) return "";
    const pre = contentRef.current.querySelector("pre");
    const text = pre ? pre.textContent || "" : ticketLineas.join("\n");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket</title><style>
      @page { size: 58mm auto; margin: 0; }
      body { font-family: monospace; font-size: 9px; line-height: 1.2; color: #000; background: #fff; width: 58mm; padding: 1mm; margin: 0; }
      pre { margin: 0; padding: 0; font-family: monospace; font-size: 9px; line-height: 1.2; white-space: pre; word-wrap: normal; overflow: visible; }
    </style></head><body><pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;
  }, [ticketLineas]);

  const handlePrint = useCallback(() => {
    imprimir.execute({ id: orden.id, formato });
    const html = getTicketHtml();
    if (!html) return;
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 2000);
    }, 500);
  }, [getTicketHtml, imprimir, orden.id, formato]);

  const handleDownloadPdf = useCallback(async () => {
    if (!contentRef.current) return;
    const pre = contentRef.current.querySelector("pre");
    if (!pre) return;
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.width = "219px";
    container.style.backgroundColor = "#fff";
    container.style.fontFamily = "monospace";
    container.style.fontSize = "9px";
    container.style.lineHeight = "1.2";
    container.style.padding = "1mm";
    container.style.whiteSpace = "pre";
    container.textContent = pre.textContent || "";
    document.body.appendChild(container);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff", logging: false });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 58;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [58, imgHeight] });
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`ticket-${orden.numero_orden}.pdf`);
    } finally {
      if (document.body.contains(container)) document.body.removeChild(container);
    }
  }, [orden.numero_orden]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/ventas/ordenes/${orden.id}`)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{orden.numero_orden}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Ticket de impresión</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700">
            <button onClick={() => setFormato("ticket")} className={`rounded-l-lg px-3 py-2 text-sm font-medium ${formato === "ticket" ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-300"}`}>Ticket 58mm</button>
            <button onClick={() => setFormato("factura")} className={`rounded-r-lg px-3 py-2 text-sm font-medium ${formato === "factura" ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-300"}`}>Factura A4</button>
          </div>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          {formato === "ticket" && (
            <button onClick={handleDownloadPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              <Download className="h-4 w-4" /> PDF
            </button>
          )}
        </div>
      </div>

      <style>{`
        ${formato === "ticket" ? `@page { size: 58mm auto; margin: 0; } #print-sheet { width: 58mm; padding: 1mm; }` : `@page { margin: 8mm; }`}
        @media print {
          body * { visibility: hidden; }
          #print-sheet, #print-sheet * { visibility: visible; }
          #print-sheet { position: absolute; left: 0; top: 0; margin: 0; }
        }
      `}</style>

      <div id="print-sheet" className="bg-white text-zinc-900 shadow-sm dark:shadow-none">
        {formato === "ticket" ? (
          <div ref={contentRef} className="mx-auto w-[58mm] px-[1mm] bg-white">
            <pre className={`${MONO} whitespace-pre text-black text-[9px] leading-[1.2] m-0 p-0`}>{ticketLineas.join("\n")}</pre>
          </div>
        ) : (
          <div className="mx-auto max-w-[210mm] p-8">
            <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4">
              <div>
                <h2 className="text-2xl font-bold">SOUNDATA ERP</h2>
                <p className="mt-1 text-sm text-zinc-600">FACTURA</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono font-semibold">{orden.numero_orden}</p>
                <p className="text-zinc-600">{fecha}</p>
                {orden.numero_factura && <p className="mt-1 text-zinc-600">N° Factura: {orden.numero_factura}</p>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">Cliente</p>
                <p>{orden.cliente_nombre}</p>
                {orden.sucursal && <p>Sucursal: {orden.sucursal}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold">Vendedor</p>
                <p>{orden.vendedor_nombre ?? "—"}</p>
              </div>
            </div>
            <table className="mt-6 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-zinc-900 text-left">
                  <th className="py-2 font-semibold">Código</th>
                  <th className="py-2 font-semibold">Producto</th>
                  <th className="py-2 text-right font-semibold">Cant.</th>
                  <th className="py-2 text-right font-semibold">Precio</th>
                  <th className="py-2 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orden.items.map((it) => (
                  <tr key={it.id} className="border-b border-zinc-200">
                    <td className="py-2 font-mono text-xs">{it.producto_codigo ?? "—"}</td>
                    <td className="py-2">{it.producto_nombre}{it.serial && <span className="ml-2 text-xs text-zinc-500">S/N {it.serial}</span>}</td>
                    <td className="py-2 text-right">{it.cantidad}</td>
                    <td className="py-2 text-right">{formatGs(it.precio_unitario)}</td>
                    <td className="py-2 text-right font-medium">{formatGs(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatGs(orden.subtotal)}</span></div>
                {ivaFactura > 0 && <div className="flex justify-between"><span>IVA (10%)</span><span>{formatGs(ivaFactura)}</span></div>}
                {orden.is_tax_included && <p className="text-xs text-zinc-500">IVA incluido en el total</p>}
                <div className="flex justify-between border-t border-zinc-900 pt-2 text-base font-bold"><span>Total</span><span>{formatGs(orden.total)}</span></div>
              </div>
            </div>
            {orden.observaciones && <p className="mt-6 border-t border-zinc-200 pt-3 text-xs text-zinc-500">{orden.observaciones}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
