"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Search, Package, ShoppingCart } from "lucide-react";
import { crearOrdenAction, crearClienteAction } from "@/lib/actions/ventas-actions";
import { formatGs } from "@/lib/compras/calculos";
import type { ClienteDTO, ProductoVentaDTO, VendedorDTO, MetodoPagoVentaDTO, ConfigVentasDTO } from "@/lib/ventas/repository";

const formatPrecio = (n: number) => {
  if (!n) return "";
  const [int, dec] = n.toString().split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (dec ? "," + dec : "");
};
const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

const TIPOS_VENTA = [
  { value: "contado", label: "Contado" },
  { value: "credito", label: "Crédito" },
  { value: "web", label: "Ventas Web" },
  { value: "mayor", label: "Por Mayor" },
] as const;

interface LineaProducto { id: string; producto_id: string; nombre: string; codigo?: string; cantidad: number; precio_unitario: number; serial?: string; }

const IVA_PORCENTAJE = 10;
function obtenerStock(p: ProductoVentaDTO): number { return Number((p as any).stock_total ?? (p as any).stock ?? 0); }
function badgeStock(stock: number) { if (stock > 5) return "success" as const; if (stock > 0) return "warning" as const; return "danger" as const; }
function productoEmoji(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("tv") || n.includes("televisor") || n.includes("led") || n.includes("smart tv")) return "📺";
  if (n.includes("celular") || n.includes("smartphone") || n.includes("iphone") || (n.includes("samsung") && (n.includes("a") || n.includes("s")) && !n.includes("tv"))) return "📱";
  if (n.includes("aire") || n.includes("acondicionado") || n.includes("inverter") || n.includes("split")) return "❄️";
  if (n.includes("heladera") || n.includes("refrigerador") || n.includes("freezer")) return "🧊";
  if (n.includes("cocina") || n.includes("horno") || n.includes("anafe")) return "🍳";
  if (n.includes("lavarropa") || n.includes("lavadora")) return "👕";
  if (n.includes("licuadora") || n.includes("batidora")) return "🥤";
  if (n.includes("microondas")) return "🔥";
  if (n.includes("notebook") || n.includes("laptop") || n.includes("computadora")) return "💻";
  if (n.includes("tablet") || n.includes("ipad")) return "📟";
  if (n.includes("parlante") || n.includes("audio")) return "🔊";
  if (n.includes("ventilador")) return "🌀";
  if (n.includes("cargador") || n.includes("cable") || n.includes("adaptador")) return "🔌";
  if (n.includes("funda") || n.includes("case")) return "🛡️";
  return "📦";
}

export function OrdenFormClient({ clientes, productos, vendedores, metodosPago, configVentas, vendedorActualId, vendedorActualNombre }: {
  clientes: ClienteDTO[]; productos: ProductoVentaDTO[]; vendedores: VendedorDTO[]; metodosPago: MetodoPagoVentaDTO[]; configVentas: ConfigVentasDTO; vendedorActualId: string; vendedorActualNombre: string;
}) {
  const router = useRouter();
  const [clienteResults, setClienteResults] = useState<ClienteDTO[]>([]);
  const [searchingCliente, setSearchingCliente] = useState(false);
  const [clienteData, setClienteData] = useState<ClienteDTO | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [clienteBusqueda, setClienteBusqueda] = useState("");
  const [showClientes, setShowClientes] = useState(false);
  const [clienteSelectedIdx, setClienteSelectedIdx] = useState(0);
  const [tipoVenta, setTipoVenta] = useState("contado");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaProducto[]>([]);
  const [preciosEditando, setPreciosEditando] = useState<Record<string,string>>({});
  const [busqueda, setBusqueda] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioPersonalizado, setPrecioPersonalizado] = useState(0);
  const [taxFree, setTaxFree] = useState(false);
  const [ivaIncluido, setIvaIncluido] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [costoDelivery, setCostoDelivery] = useState(0);
  const [moneda, setMoneda] = useState<"GS"|"USD">("GS");
  const [tipoCambio, setTipoCambio] = useState(configVentas.tipo_cambio_usd || 7500);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoVentaDTO|null>(metodosPago[0] ?? null);
  const [vendedorSucursal, setVendedorSucursal] = useState<{vendedor_codigo:string,vendedor_nombre:string,sucursal:"ESPAÑA"|"PALMA"|""}>({ vendedor_codigo:"", vendedor_nombre:"", sucursal:"" });
  const [showDropdown,setShowDropdown]=useState(false);
  const [selectedIdx,setSelectedIdx]=useState(0);
  const [showCrearCliente,setShowCrearCliente]=useState(false);
  const [creandoCliente,setCreandoCliente]=useState(false);
  const [nuevoCliente,setNuevoCliente]=useState({ nombre:"", apellido:"", cedula:"", tipo_documento:"CI", telefono:"", email:"", direccion:"", ciudad:"", ruc:"", pais:"Paraguay" });
  const inputRef=useRef<HTMLInputElement>(null);
  const dropdownRef=useRef<HTMLDivElement>(null);
  const clienteInputRef=useRef<HTMLInputElement>(null);
  const clienteDropdownRef=useRef<HTMLDivElement>(null);
  const claveIdempotencia=useRef<string>(crypto.randomUUID());

  const crearOrder = useAction(crearOrdenAction, {
    onSuccess:(res)=>{ claveIdempotencia.current=crypto.randomUUID(); toast.success("Venta registrada"); router.push(`/ventas/ordenes/${res.data?.id}`); },
    onError:(err)=> toast.error(err.error.serverError ?? "Error al crear la orden")
  });
  const crearCli = useAction(crearClienteAction, {
    onSuccess:(res)=>{ const id=res.data?.id; if(id){ setClienteId(id); const c=clientes.find(x=>x.id===id) || { id, nombre:nuevoCliente.nombre, apellido:nuevoCliente.apellido, cedula:nuevoCliente.cedula, telefono:nuevoCliente.telefono, email:nuevoCliente.email, direccion:nuevoCliente.direccion, ciudad:nuevoCliente.ciudad, ruc:nuevoCliente.ruc, pais:nuevoCliente.pais, tipo_documento:nuevoCliente.tipo_documento, created_at:new Date().toISOString() } as ClienteDTO; setClienteData(c as any); } setShowCrearCliente(false); toast.success("Cliente creado y seleccionado"); setCreandoCliente(false); },
    onError:(err)=>{ toast.error(err.error.serverError ?? "Error al crear cliente"); setCreandoCliente(false); }
  });

  const resultados = useMemo(()=>{
    if(!productos || !busqueda.trim()) return [];
    const q=busqueda.toLowerCase();
    return productos.filter(p=> (p.codigo && String(p.codigo).toLowerCase().includes(q)) || p.nombre.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q)) ).slice(0,20);
  },[busqueda,productos]);

  useEffect(()=>{ if(!clienteId){ setClienteData(null); return; } const c=clientes.find(x=>x.id===clienteId); if(c) setClienteData(c); else fetch(`/api/ventas/clientes/search?busqueda=${encodeURIComponent(clienteId)}`).then(r=>r.json()).then(()=>{}).catch(()=>{}); },[clienteId, clientes]);

  const agregarProducto = (p?: ProductoVentaDTO, precioForzado?: number)=>{
    const prod = p || (resultados.length>0? resultados[selectedIdx]: null);
    if(!prod || cantidad<1) return;
    const precioBase = moneda==="USD"?0:(prod.precio_base||0);
    const precio = precioForzado ?? (precioPersonalizado>0? precioPersonalizado: precioBase);
    setLineas(prev=>{
      const existente=prev.find(l=>l.producto_id===prod.id);
      if(existente){ const nuevaCant=existente.cantidad+cantidad; toast.info(`Cantidad de ${prod.nombre} actualizada a ${nuevaCant}`); return prev.map(l=> l.producto_id===prod.id? {...l, cantidad:nuevaCant}:l); }
      const nuevaLinea:LineaProducto={ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, producto_id:prod.id, nombre:prod.nombre, codigo:prod.codigo ?? undefined, cantidad, precio_unitario:precio };
      return [...prev, nuevaLinea];
    });
    setBusqueda(""); setCantidad(1); setPrecioPersonalizado(0); setShowDropdown(false); inputRef.current?.focus();
  };
  const eliminarLinea = (id:string)=> setLineas(prev=> prev.filter(l=> l.id!==id));

  const subtotal = useMemo(()=> lineas.reduce((s,l)=> s + l.cantidad*l.precio_unitario,0),[lineas]);
  const iva = useMemo(()=>{
    if(taxFree || tipoVenta==="mayor") return 0;
    if(ivaIncluido) return subtotal - Math.round(subtotal/(1+IVA_PORCENTAJE/100));
    return Math.round(subtotal*IVA_PORCENTAJE/100);
  },[subtotal,taxFree,ivaIncluido,tipoVenta]);
  const subtotalSinIva = useMemo(()=>{ if(ivaIncluido) return Math.round(subtotal/(1+IVA_PORCENTAJE/100)); return subtotal; },[subtotal,ivaIncluido]);
  const deliveryEnMoneda = useMemo(()=>{ if(!delivery) return 0; if(moneda==="USD") return 0; return costoDelivery; },[delivery,costoDelivery,moneda]);
  const totalCalculado = useMemo(()=> subtotal + (ivaIncluido?0:iva) + deliveryEnMoneda,[subtotal,iva,ivaIncluido,deliveryEnMoneda]);
  const [totalCobrado,setTotalCobrado]=useState(0);
  const totalEditadoManual=useRef(false);
  useEffect(()=>{ if(!totalEditadoManual.current) setTotalCobrado(totalCalculado); },[totalCalculado]);
  const porcentajeCostoActual = metodoPago?.porcentaje_costo ?? 0;
  const costoPago = useMemo(()=>{ if(porcentajeCostoActual===0) return 0; return Math.round(totalCobrado*porcentajeCostoActual/(100+porcentajeCostoActual)); },[totalCobrado,porcentajeCostoActual]);
  const netoPago = useMemo(()=> totalCobrado - costoPago,[totalCobrado,costoPago]);

  const crearOrden = async()=>{
    if(!clienteId || lineas.length===0) return;
    if(!vendedorSucursal.vendedor_codigo || !vendedorSucursal.sucursal){ toast.warning("Selecciona vendedor y sucursal"); return; }
    const vendedorSel = vendedores.find(v=> v.vendedor_codigo===vendedorSucursal.vendedor_codigo);
    try{
      await crearOrder.executeAsync({
        clave_idempotencia: claveIdempotencia.current,
        cliente_id: clienteId,
        vendedor_id: vendedorSel?.id,
        items: lineas.map(l=> ({ producto_id:l.producto_id, cantidad:l.cantidad, precio_unitario:l.precio_unitario, serial:l.serial||undefined })),
        observaciones: `${taxFree?"TAX FREE | ":""}${ivaIncluido?"IVA INCLUIDO | ":""}${delivery?`DELIVERY:${costoDelivery} | `:""}${tipoVenta==="credito"?"CRÉDITO":tipoVenta==="web"?"VENTAS WEB":tipoVenta==="mayor"?"POR MAYOR":"CONTADO"}${metodoPago?` | Pago: ${metodoPago.nombre}`:""}${observaciones?` | ${observaciones}`:""}`,
        is_tax_included: ivaIncluido,
        sucursal: vendedorSucursal.sucursal,
        moneda, tipo_venta: (delivery?"delivery": taxFree?"tax_free": ivaIncluido?"iva_incluido": tipoVenta) as any,
        costo_delivery: deliveryEnMoneda,
        metodo_pago: metodoPago?.nombre ?? "",
      } as any);
    }catch(e:unknown){ toast.error((e instanceof Error? e.message:String(e))||"Error al crear la orden"); }
  };

  const buscarCliente = async(termino:string)=>{
    if(!termino.trim()){ setClienteResults([]); return; }
    setSearchingCliente(true); setShowClientes(true);
    try{
      const res = await fetch(`/api/ventas/clientes/search?busqueda=${encodeURIComponent(termino.trim())}&pageSize=20`);
      const data = await res.json();
      // API returns {items} or array
      const list = Array.isArray(data)? data: data.items ?? data.clientes ?? [];
      // map to ClienteDTO shape if needed
      setClienteResults(list.map((c:any)=> ({ id:c.id, nombre:c.nombre, apellido:c.apellido, cedula:c.cedula||c.documento, telefono:c.telefono, email:c.email, direccion:c.direccion, ciudad:c.ciudad, ruc:c.ruc, pais:c.pais, tipo_documento:c.tipo_documento||"CI", created_at:c.created_at })));
    }catch{}
    setSearchingCliente(false);
  };

  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      if(dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) setShowDropdown(false);
      if(clienteDropdownRef.current && !clienteDropdownRef.current.contains(e.target as Node) && clienteInputRef.current && !clienteInputRef.current.contains(e.target as Node)) setShowClientes(false);
    };
    document.addEventListener("mousedown",h); return()=> document.removeEventListener("mousedown",h);
  },[]);
  useEffect(()=>{ if(metodosPago && metodosPago.length>0 && !metodoPago) setMetodoPago(metodosPago[0]); },[metodosPago,metodoPago]);

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center gap-4">
        <button onClick={()=> router.push("/ventas")} className="rounded p-2 hover:bg-zinc-100"><ArrowLeft className="w-4 h-4" /> </button>
        <div><h1 className="text-2xl font-bold">Nueva Orden de Venta</h1><p className="text-sm text-slate-500">Busque productos por código o nombre</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-blue-600"/> Productos</h3>
            <div className="relative mt-3">
              <form onSubmit={(e)=>{e.preventDefault(); if(resultados.length>0) agregarProducto();}}>
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                    <input ref={inputRef} type="text" placeholder="Buscar por código, nombre o marca..." value={busqueda} onChange={(e)=>{setBusqueda(e.target.value); setShowDropdown(true); setSelectedIdx(0);}} onKeyDown={(e)=>{ if(e.key==="ArrowDown"){e.preventDefault(); setSelectedIdx(i=>Math.min(i+1,resultados.length-1));} if(e.key==="ArrowUp"){e.preventDefault(); setSelectedIdx(i=>Math.max(i-1,0));} if(e.key==="Escape") setShowDropdown(false);}} onFocus={()=> busqueda && setShowDropdown(true)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"/>
                  </div>
                  <input type="number" min={1} value={cantidad} onChange={(e)=> setCantidad(Number(e.target.value))} className="w-16 px-2 py-2 border rounded-lg text-sm text-center" title="Cantidad"/>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{moneda==="USD"?"$":"₲"}</span>
                    <input type="text" inputMode="decimal" value={precioPersonalizado>0? formatPrecio(precioPersonalizado):""} placeholder="Precio" onChange={(e)=>{ const raw=e.target.value.replace(/[^\d.,]/g,""); const parseado=moneda==="USD"? raw.replace(",","."): raw.replace(/\./g,"").replace(",","."); setPrecioPersonalizado(parseFloat(parseado)||0);}} className="w-24 pl-6 pr-2 py-2 border rounded-lg text-sm text-right"/>
                  </div>
                  <button type="submit" disabled={resultados.length===0} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40"><Plus className="w-4 h-4 inline mr-1"/> Agregar</button>
                </div>
              </form>
            </div>
            {showDropdown && resultados.length>0 && (
              <div ref={dropdownRef} className="space-y-2 mt-3">
                <p className="text-xs text-slate-400 uppercase px-1">Productos encontrados</p>
                {resultados.map((p,i)=>{
                  const stock=obtenerStock(p);
                  const badge = stock>5?"bg-green-100 text-green-700": stock>0?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700";
                  return (
                    <button key={p.id} onClick={()=>{ agregarProducto(p); setShowDropdown(false);}} onMouseEnter={()=> setSelectedIdx(i)} className={`w-full text-left p-3 rounded-lg border ${i===selectedIdx?"border-blue-300 bg-blue-50 ring-2 ring-blue-200":"border-slate-200 bg-white hover:border-blue-200"}`}>
                      <div className="flex gap-3">
                        <span className="text-2xl">{productoEmoji(p.nombre)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{p.nombre}</p>
                          <p className="text-xs text-slate-400 font-mono">{p.codigo||"—"}</p>
                          <div className="flex justify-between mt-1">
                            <span className="text-sm font-bold text-blue-700">{moneda==="USD" && tipoCambio>0? `$${(p.precio_base/tipoCambio).toFixed(2)}`: `₲${formatGs(p.precio_base)}`}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>Stock: {stock}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {lineas.length>0 ? (
              <table className="w-full text-sm mt-4">
                <thead><tr className="border-b text-xs text-slate-500"><th>#</th><th>Código</th><th>Producto</th><th>Cant.</th><th>Precio Unit.</th><th>Serial</th><th>Subtotal</th><th></th></tr></thead>
                <tbody>
                  {lineas.map((l,idx)=>(
                    <tr key={l.id} className="border-b">
                      <td className="py-2 text-slate-400 text-xs">{idx+1}</td>
                      <td className="font-mono text-xs text-slate-400">{l.codigo||"—"}</td>
                      <td className="font-medium max-w-[200px] truncate">{l.nombre}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={()=> setLineas(prev=> prev.map(li=> li.id===l.id? {...li, cantidad:Math.max(1, li.cantidad-1)}:li))} className="w-6 h-6 rounded bg-slate-100">−</button>
                          <input type="number" min={1} value={l.cantidad} onChange={(e)=> setLineas(prev=> prev.map(li=> li.id===l.id? {...li, cantidad:Math.max(1, Number(e.target.value)||1)}:li))} className="w-12 text-center border rounded text-sm"/>
                          <button onClick={()=> setLineas(prev=> prev.map(li=> li.id===l.id? {...li, cantidad:li.cantidad+1}:li))} className="w-6 h-6 rounded bg-slate-100">+</button>
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="relative inline-flex">
                          <span className="absolute left-2 text-xs text-slate-400 top-1/2 -translate-y-1/2">{moneda==="USD"?"$":"₲"}</span>
                          <input type="text" value={preciosEditando[l.id] ?? formatPrecio(l.precio_unitario)} onChange={(e)=>{ const raw=e.target.value.replace(/[^\d.,]/g,""); setPreciosEditando(prev=>({...prev,[l.id]:raw})); const parseado=moneda==="USD"? raw.replace(",","."): raw.replace(/\./g,"").replace(",","."); const num=moneda==="USD"? (parseFloat(parseado)||0): (parseInt(parseado,10)||0); setLineas(prev=> prev.map(li=> li.id===l.id? {...li, precio_unitario:num}:li));}} onBlur={()=> setPreciosEditando(prev=>{ const n={...prev}; delete n[l.id]; return n;})} className="w-28 pl-6 pr-2 py-1 text-sm border rounded text-right"/>
                        </div>
                      </td>
                      <td><input value={l.serial||""} onChange={(e)=> setLineas(prev=> prev.map(li=> li.id===l.id? {...li, serial:e.target.value}:li))} placeholder="Serial" className="w-28 px-2 py-1 text-xs border rounded font-mono"/></td>
                      <td className="text-right font-semibold">{moneda==="USD"? formatCurrency(l.cantidad*l.precio_unitario): `₲${formatGs(l.cantidad*l.precio_unitario)}`}</td>
                      <td><button onClick={()=> eliminarLinea(l.id)} className="p-1 text-red-500"><Trash2 className="w-4 h-4"/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-slate-400"><Package className="w-10 h-10 mx-auto mb-2"/><p>Busque y agregue productos</p></div>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-blue-600"/> Datos de la Venta</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Cliente</label>
                {clienteData ? (
                  <div className="flex justify-between p-2.5 border border-blue-300 rounded-lg bg-blue-50">
                    <div><p className="text-sm font-medium">{clienteData.nombre} {clienteData.apellido}</p><p className="text-xs text-slate-500">{clienteData.cedula} {clienteData.telefono?` | ${clienteData.telefono}`:""}</p></div>
                    <button onClick={()=>{setClienteId(""); setClienteData(null);}} className="text-xs text-red-500">Cambiar</button>
                  </div>
                ) : (
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                      <input ref={clienteInputRef} placeholder="Buscar por nombre o cédula..." value={clienteBusqueda} onChange={(e)=>{setClienteBusqueda(e.target.value); setClienteSelectedIdx(0);}} onKeyDown={(e)=>{ if(e.key==="ArrowDown"){e.preventDefault(); setClienteSelectedIdx(i=>Math.min(i+1,clienteResults.length-1));} if(e.key==="ArrowUp"){e.preventDefault(); setClienteSelectedIdx(i=>Math.max(i-1,0));} if(e.key==="Escape") setShowClientes(false); if(e.key==="Enter"){e.preventDefault(); if(clienteResults.length>0 && showClientes){ const c=clienteResults[clienteSelectedIdx]||clienteResults[0]; setClienteId(c.id); setClienteData(c); setClienteBusqueda(""); setShowClientes(false);} else buscarCliente(clienteBusqueda);}}} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"/>
                    </div>
                    <button onClick={()=> buscarCliente(clienteBusqueda)} disabled={!clienteBusqueda.trim() || searchingCliente} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40"><Search className="w-4 h-4"/></button>
                    {showClientes && clienteBusqueda.trim() && (
                      <div ref={clienteDropdownRef} className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{top:"100%"}}>
                        {searchingCliente? <div className="px-4 py-2 text-sm text-slate-400">Buscando...</div> : clienteResults.length>0? clienteResults.map((c,i)=>(
                          <button key={c.id} onClick={()=>{setClienteId(c.id); setClienteData(c); setClienteBusqueda(""); setShowClientes(false);}} onMouseEnter={()=> setClienteSelectedIdx(i)} className={`w-full flex justify-between px-4 py-2 text-sm ${i===clienteSelectedIdx?"bg-blue-50 text-blue-700":"hover:bg-slate-50"}`}>
                            <span>{c.nombre} {c.apellido}</span><span className="text-xs text-slate-400">{c.cedula}</span>
                          </button>
                        )): <div className="px-4 py-2 text-sm text-slate-400">Sin resultados</div>}
                        <button onClick={()=> setShowCrearCliente(true)} className="w-full px-4 py-2 text-sm text-blue-600 border-t flex items-center gap-2"><Plus className="w-4 h-4"/> Crear nuevo cliente</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
                <h4 className="font-semibold text-sm">Vendedor y Sucursal</h4>
                <select value={vendedorSucursal.vendedor_codigo} onChange={(e)=>{ const v=vendedores.find(x=> x.vendedor_codigo===e.target.value); setVendedorSucursal(s=>({...s, vendedor_codigo:e.target.value, vendedor_nombre: v? `${v.nombre} ${v.apellido}`.trim(): ""}));}} className="w-full border rounded px-3 py-2 text-sm" required>
                  <option value="">Seleccionar vendedor...</option>
                  {vendedores.map(v=> <option key={v.id} value={v.vendedor_codigo ?? ""}>{v.vendedor_codigo} - {v.nombre} {v.apellido}</option>)}
                </select>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="radio" name="sucursal" value="ESPAÑA" checked={vendedorSucursal.sucursal==="ESPAÑA"} onChange={(e)=> setVendedorSucursal(s=>({...s, sucursal:e.target.value as any}))} required/> ESPAÑA</label>
                  <label className="flex items-center gap-2 text-sm"><input type="radio" name="sucursal" value="PALMA" checked={vendedorSucursal.sucursal==="PALMA"} onChange={(e)=> setVendedorSucursal(s=>({...s, sucursal:e.target.value as any}))}/> PALMA</label>
                </div>
                {vendedorSucursal.vendedor_nombre && vendedorSucursal.sucursal && (<div className="p-2 bg-blue-50 rounded text-sm">{vendedorSucursal.vendedor_nombre} ({vendedorSucursal.vendedor_codigo}) — {vendedorSucursal.sucursal}</div>)}
              </div>
              <select value={tipoVenta} onChange={(e)=> setTipoVenta(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                {TIPOS_VENTA.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taxFree} onChange={(e)=>{setTaxFree(e.target.checked); if(e.target.checked) setIvaIncluido(false);}}/> Tax Free (sin IVA)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ivaIncluido} onChange={(e)=>{setIvaIncluido(e.target.checked); if(e.target.checked) setTaxFree(false);}}/> IVA Incluido</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={delivery} onChange={(e)=>{setDelivery(e.target.checked); if(!e.target.checked) setCostoDelivery(0);}}/> Delivery</label>
              {delivery && (
                <div>
                  <label className="text-xs text-slate-500">Costo Delivery (GS)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₲</span>
                    <input type="text" value={costoDelivery>0? formatGs(costoDelivery).replace("₲","").trim():""} placeholder="0" onChange={(e)=>{ const raw=e.target.value.replace(/[^\d]/g,""); setCostoDelivery(parseInt(raw,10)||0);}} className="w-full pl-6 pr-3 py-2 border border-orange-300 rounded text-sm text-right text-orange-700"/>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500">Moneda</label>
                <div className="flex gap-2 mt-1">
                  <label className={`flex-1 border rounded px-3 py-2 text-sm text-center cursor-pointer ${moneda==="GS"?"border-blue-600 bg-blue-600 text-white":"border-zinc-300"}`}><input type="radio" name="moneda" value="GS" checked={moneda==="GS"} onChange={()=> setMoneda("GS")} className="hidden"/> ₲ GS</label>
                  <label className={`flex-1 border rounded px-3 py-2 text-sm text-center cursor-pointer ${moneda==="USD"?"border-blue-600 bg-blue-600 text-white":"border-zinc-300"}`}><input type="radio" name="moneda" value="USD" checked={moneda==="USD"} onChange={()=> setMoneda("USD")} className="hidden"/> $ USD</label>
                </div>
                {moneda==="USD" && (<input type="number" value={tipoCambio||""} onChange={(e)=> setTipoCambio(Number(e.target.value))} placeholder="7500" className="w-full mt-2 border rounded px-3 py-1.5 text-sm"/>)}
              </div>
              <input placeholder="Observaciones" value={observaciones} onChange={(e)=> setObservaciones(e.target.value)} className="w-full border rounded px-3 py-2 text-sm"/>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Resumen</h3>
            <div className="space-y-2 text-sm mt-3">
              <div className="flex justify-between"><span>Productos</span><span>{lineas.length} ítems ({lineas.reduce((s,l)=>s+l.cantidad,0)} und.)</span></div>
              {ivaIncluido? (<><div className="flex justify-between"><span>Subtotal (sin IVA)</span><span>{moneda==="USD"? formatCurrency(subtotalSinIva): `₲${formatGs(subtotalSinIva)}`}</span></div><div className="flex justify-between"><span>IVA (10%)</span><span>{moneda==="USD"? formatCurrency(iva): `₲${formatGs(iva)}`}</span></div></>):(<div className="flex justify-between"><span>Subtotal</span><span>{moneda==="USD"? formatCurrency(subtotal): `₲${formatGs(subtotal)}`}</span></div>)}
              {!ivaIncluido && !taxFree && tipoVenta!=="mayor" && (<div className="flex justify-between"><span>IVA (10%)</span><span>{moneda==="USD"? formatCurrency(iva): `₲${formatGs(iva)}`}</span></div>)}
              {taxFree && (<div className="flex justify-between text-green-600"><span>Tax Free</span><span>Exento</span></div>)}
              {delivery && costoDelivery>0 && (<div className="flex justify-between text-orange-600"><span>Delivery</span><span>₲{formatGs(costoDelivery)}</span></div>)}
              {!ivaIncluido && porcentajeCostoActual>0 && (<><div className="flex justify-between"><span>Neto</span><span>{moneda==="USD"? formatCurrency(netoPago): `₲${formatGs(netoPago)}`}</span></div><div className="flex justify-between"><span>Costo {metodoPago?.nombre} ({porcentajeCostoActual}%)</span><span className="text-amber-600">{moneda==="USD"? formatCurrency(costoPago): `₲${formatGs(costoPago)}`}</span></div></>)}
              <hr/>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Total Cobrado</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{moneda==="USD"?"$":"₲"}</span>
                  <input type="text" value={formatPrecio(totalCobrado)} onChange={(e)=>{ totalEditadoManual.current=true; const raw=e.target.value.replace(/[^\d.,]/g,""); const parseado=moneda==="USD"? raw.replace(",","."): raw.replace(/\./g,"").replace(",","."); setTotalCobrado(moneda==="USD"? (parseFloat(parseado)||0): (parseInt(parseado,10)||0));}} className="w-full pl-6 pr-3 py-2 border border-blue-300 rounded text-lg font-bold text-blue-700 text-right"/>
                </div>
              </div>
            </div>
          </div>
          {lineas.length>0 && (
            <div className="rounded-2xl border bg-white p-4">
              <h4 className="text-sm font-semibold">Método de Pago</h4>
              <div className="space-y-2 mt-2">
                {metodosPago.map(mp=>{
                  const sel=metodoPago?.id===mp.id;
                  return (<label key={mp.id} className={`flex items-center gap-3 p-2 rounded border cursor-pointer ${sel?"border-blue-500 bg-blue-50":"border-zinc-200"}`}>
                    <input type="checkbox" checked={sel} onChange={()=> setMetodoPago(sel? null: mp)} className="w-4 h-4"/>
                    <span className="flex-1 text-sm">{mp.nombre}</span>{mp.porcentaje_costo>0 && <span className="text-xs text-red-500">{mp.porcentaje_costo}%</span>}
                  </label>);
                })}
              </div>
            </div>
          )}
          <button onClick={crearOrden} disabled={!clienteId || lineas.length===0 || !vendedorSucursal.vendedor_codigo || !vendedorSucursal.sucursal || crearOrder.isPending} className="w-full py-3 bg-zinc-900 text-white rounded-lg font-medium disabled:opacity-40"><ShoppingCart className="w-4 h-4 inline mr-2"/> {crearOrder.isPending?"Guardando...":"Finalizar Venta"}</button>
        </div>
      </div>
      {showCrearCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="font-semibold">Nuevo Cliente</h3>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Nombre *" value={nuevoCliente.nombre} onChange={(e)=> setNuevoCliente(s=>({...s, nombre:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <input placeholder="Apellido *" value={nuevoCliente.apellido} onChange={(e)=> setNuevoCliente(s=>({...s, apellido:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <select value={nuevoCliente.tipo_documento} onChange={(e)=> setNuevoCliente(s=>({...s, tipo_documento:e.target.value}))} className="border rounded px-3 py-2 text-sm"><option>DNI</option><option>CI</option><option>RUC</option><option>Pasaporte</option></select>
              <input placeholder="N° Documento *" value={nuevoCliente.cedula} onChange={(e)=> setNuevoCliente(s=>({...s, cedula:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <input placeholder="Teléfono" value={nuevoCliente.telefono} onChange={(e)=> setNuevoCliente(s=>({...s, telefono:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <input placeholder="Email" value={nuevoCliente.email} onChange={(e)=> setNuevoCliente(s=>({...s, email:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <input placeholder="Dirección" value={nuevoCliente.direccion} onChange={(e)=> setNuevoCliente(s=>({...s, direccion:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <input placeholder="Ciudad" value={nuevoCliente.ciudad} onChange={(e)=> setNuevoCliente(s=>({...s, ciudad:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <input placeholder="RUC" value={nuevoCliente.ruc} onChange={(e)=> setNuevoCliente(s=>({...s, ruc:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
              <input placeholder="País" value={nuevoCliente.pais} onChange={(e)=> setNuevoCliente(s=>({...s, pais:e.target.value}))} className="border rounded px-3 py-2 text-sm"/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=> setShowCrearCliente(false)} className="px-4 py-2 border rounded text-sm">Cancelar</button>
              <button disabled={creandoCliente} onClick={async()=>{
                if(!nuevoCliente.nombre.trim()||!nuevoCliente.apellido.trim()||!nuevoCliente.cedula.trim()){ toast.error("Nombre, apellido y documento obligatorios"); return;}
                setCreandoCliente(true);
                try{ await crearCli.executeAsync({ nombre:nuevoCliente.nombre.trim(), apellido:nuevoCliente.apellido.trim(), cedula:nuevoCliente.cedula.trim(), tipo_documento:nuevoCliente.tipo_documento||"CI", telefono:nuevoCliente.telefono.trim()||"", email:nuevoCliente.email.trim()||"", direccion:nuevoCliente.direccion.trim()||"", ciudad:nuevoCliente.ciudad.trim()||"", ruc:nuevoCliente.ruc.trim()||"", pais:nuevoCliente.pais.trim()||"Paraguay"} as any); }catch(e:any){ toast.error(e.message||"Error"); setCreandoCliente(false); }
              }} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-40">{creandoCliente?"Creando...":"Crear Cliente"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
