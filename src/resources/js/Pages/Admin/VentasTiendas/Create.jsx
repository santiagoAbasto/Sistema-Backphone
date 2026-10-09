import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import {
  ArrowLeft, ArrowLeftRight, Banknote, Building2, CreditCard, Laptop, Package, QrCode, Search, ShoppingCart, Smartphone, Tablet, Trash2,
} from 'lucide-react';
import CardPaymentFields from '@/Components/CardPaymentFields';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { IconoPieza } from '@/Components/Admin/piezas';
import { Badge, Field, Input, Segmented, StepCard, Toast, bsFmt, buttonCls, useToast } from '@/Components/Admin/ui';

// Nueva venta a una tienda, a precio mayorista. El precio de cada producto sale del inventario
// («precio para tiendas») y se puede ajustar acá: la venta queda con el precio al que se vendió.
// Lo que no tiene precio para tiendas ni se ofrece (el servidor lo rechaza igual).

const TIPOS = {
  celular: { label: 'Celular', icon: Smartphone },
  computadora: { label: 'Computadora', icon: Laptop },
  producto_apple: { label: 'Equipo de marca', icon: Tablet },
  producto_general: { label: 'Producto general', icon: Package },
  pieza: { label: 'Pieza', icon: IconoPieza },
};

// Sin valor por defecto: quien cobra elige cómo le pagaron
const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'qr', label: 'QR', icon: QrCode },
  { value: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
];

// Solo las piezas se llevan por cantidad (saldo); lo demás es un equipo concreto, de a uno.
const esPorCantidad = (tipo) => tipo === 'pieza';

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const precioDe = (item) => Number(item.precio) || 0;
const subtotalDe = (item) => precioDe(item) * item.cantidad;

export default function Create({ tiendas = [] }) {
  const [toast, showToast] = useToast();

  const [tienda, setTienda] = useState({ nombre: '', responsable: '', telefono: '' });
  const [verTiendas, setVerTiendas] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [tarjeta, setTarjeta] = useState({ inicio: '', fin: '' });
  const [items, setItems] = useState([]);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  // Búsqueda de productos: sale sola al dejar de escribir, y una respuesta tardía no pisa a una más nueva.
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [verResultados, setVerResultados] = useState(false);
  const ultimoPedido = useRef(0);

  useEffect(() => {
    const texto = q.trim();
    const pedido = ++ultimoPedido.current;
    if (!texto) { setResultados([]); setBuscando(false); return undefined; }

    setBuscando(true);
    const espera = setTimeout(async () => {
      try {
        const { data } = await axios.get(route('admin.ventas-tiendas.productos'), { params: { q: texto } });
        if (pedido === ultimoPedido.current) setResultados(data);
      } catch {
        if (pedido === ultimoPedido.current) setResultados([]);
      } finally {
        if (pedido === ultimoPedido.current) setBuscando(false);
      }
    }, 250);

    return () => clearTimeout(espera);
  }, [q]);

  const sugeridas = useMemo(() => {
    const n = normalizar(tienda.nombre.trim());
    return tiendas.filter((t) => !n || normalizar(t.nombre).includes(n)).slice(0, 6);
  }, [tienda.nombre, tiendas]);

  const error = (campo) => errores[campo]?.[0];
  const quitarError = (campo) => setErrores((e) => (campo in e
    ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== campo))
    : e));
  const cambiarTienda = (campo, valor) => {
    setTienda((t) => ({ ...t, [campo]: valor }));
    quitarError(`tienda.${campo}`);
  };

  const elegirTienda = (t) => {
    setTienda({ nombre: t.nombre, responsable: t.responsable ?? '', telefono: t.telefono ?? '' });
    setVerTiendas(false);
    setErrores((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('tienda.'))));
  };

  const agregar = (p) => {
    const existente = items.find((i) => i.tipo === p.tipo && i.producto_id === p.id);
    const porCantidad = esPorCantidad(p.tipo);

    if (existente && !porCantidad) return showToast('Ese producto ya está en la venta.', 'error');
    // El servidor vuelve a revisar el saldo al guardar; acá se avisa antes de armar toda la nota
    if (existente && existente.cantidad >= existente.stock) {
      return showToast(`De «${p.nombre}» solo ${p.cantidad === 1 ? 'queda 1' : `quedan ${p.cantidad}`}.`, 'error');
    }

    setErrores({});
    setItems(existente
      ? items.map((i) => (i === existente ? { ...i, cantidad: i.cantidad + 1 } : i))
      : [...items, {
        tipo: p.tipo,
        producto_id: p.id,
        nombre: p.nombre,
        detalle: [p.detalle, p.codigo].filter(Boolean).join(' · '),
        precio: String(p.precio_tienda),
        precio_tienda: p.precio_tienda,
        precio_venta: p.precio_venta,
        cantidad: 1,
        stock: p.cantidad,
      }]);
    setQ('');
    setVerResultados(false);
  };

  const cambiarItem = (index, cambios) => {
    setErrores({});
    setItems(items.map((item, i) => (i === index ? { ...item, ...cambios } : item)));
  };

  const quitarItem = (index) => {
    setErrores({});
    setItems(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((suma, item) => suma + subtotalDe(item), 0);
  const unidades = items.reduce((suma, item) => suma + item.cantidad, 0);

  // Los errores de cada línea van junto a ella; el resto (stock, lista vacía…) en el resumen.
  const errorDeLinea = (index) => Object.entries(errores)
    .filter(([clave]) => clave.startsWith(`items.${index}.`))
    .flatMap(([, mensajes]) => mensajes);
  const propios = (clave) => clave.startsWith('tienda.') || clave.startsWith('items.') || ['metodo_pago', 'inicio_tarjeta', 'fin_tarjeta'].includes(clave);
  const otrosErrores = Object.entries(errores).filter(([clave]) => !propios(clave)).flatMap(([, mensajes]) => mensajes);

  const registrar = async () => {
    if (enviando) return;

    // Lo mismo que revisa el servidor, para avisar antes de salir
    const locales = {};
    if (!tienda.nombre.trim()) locales['tienda.nombre'] = ['Escribe el nombre de la tienda.'];
    if (!metodoPago) locales.metodo_pago = ['Elige cómo pagó la tienda.'];
    if (items.length === 0) locales.items = ['Agrega al menos un producto.'];
    items.forEach((item, i) => {
      if (precioDe(item) <= 0) locales[`items.${i}.precio`] = ['El precio tiene que ser mayor a cero.'];
    });
    if (Object.keys(locales).length > 0) {
      setErrores(locales);
      return showToast('Revisa los datos marcados.', 'error');
    }

    setEnviando(true);
    try {
      const { data } = await axios.post(route('admin.ventas-tiendas.store'), {
        tienda,
        metodo_pago: metodoPago,
        ...(metodoPago === 'tarjeta' ? { inicio_tarjeta: tarjeta.inicio, fin_tarjeta: tarjeta.fin } : {}),
        items: items.map((i) => ({ tipo: i.tipo, producto_id: i.producto_id, cantidad: i.cantidad, precio: precioDe(i) })),
      });
      notifyRecordsUpdated();
      if (data.venta_id) window.open(route('admin.ventas-tiendas.boleta', data.venta_id), '_blank');
      router.visit(route('admin.ventas-tiendas.index'));
    } catch (e) {
      if (e.response?.status === 422) {
        setErrores(e.response.data.errors || {});
        showToast('Revisa los datos marcados.', 'error');
      } else {
        showToast('No se pudo registrar la venta. Inténtalo de nuevo en unos segundos.', 'error');
      }
      setEnviando(false);
    }
  };

  return (
    <AdminLayout title="Nueva venta a tienda">
      <Head title="Nueva venta a tienda" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route('admin.ventas-tiendas.index')} aria-label="Volver a ventas a tiendas"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-marca text-[28px] font-bold leading-tight tracking-tight text-gris-900">Nueva venta a tienda</h1>
            <p className="text-sm text-gris-500">Precio mayorista. Al registrar se descuenta del inventario y se abre la nota.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Paso 1 */}
            <StepCard step={1} title="Tienda" subtitle="Escribe el nombre: si ya te compró antes, aparece para elegirla y se completan sus datos.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative md:col-span-2">
                  <Field label="Nombre de la tienda" error={error('tienda.nombre')}>
                    <Input
                      value={tienda.nombre}
                      placeholder="Ej.: Importadora Pérez"
                      autoComplete="off"
                      maxLength={120}
                      onChange={(e) => { cambiarTienda('nombre', e.target.value); setVerTiendas(true); }}
                      onFocus={() => setVerTiendas(true)}
                      onBlur={() => setTimeout(() => setVerTiendas(false), 150)}
                    />
                  </Field>
                  {verTiendas && sugeridas.length > 0 && (
                    <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gris-200 bg-white text-sm shadow-xl">
                      {sugeridas.map((t) => (
                        <li key={t.id}>
                          <button type="button" className="block w-full px-4 py-2.5 text-left hover:bg-gris-50"
                            onMouseDown={(e) => e.preventDefault()} onClick={() => elegirTienda(t)}>
                            <span className="block font-semibold text-gris-900">{t.nombre}</span>
                            <span className="text-xs text-gris-500">{[t.responsable, t.telefono].filter(Boolean).join(' · ') || 'Sin responsable ni teléfono'}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Field label="Responsable (opcional)" error={error('tienda.responsable')}>
                  <Input value={tienda.responsable} placeholder="Ej.: Juan Pérez" maxLength={120}
                    onChange={(e) => cambiarTienda('responsable', e.target.value)} />
                </Field>

                <Field label="Teléfono (opcional)" error={error('tienda.telefono')}>
                  <Input value={tienda.telefono} placeholder="Ej.: 70000000" inputMode="tel" maxLength={40}
                    onChange={(e) => cambiarTienda('telefono', e.target.value)} />
                </Field>
              </div>
            </StepCard>

            {/* Paso 2 */}
            <StepCard step={2} title="Productos" subtitle="Busca por nombre, modelo, código, IMEI o serie. Solo salen los productos que tienen precio para tiendas.">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
                <Input
                  className="pl-10"
                  aria-label="Buscar un producto"
                  placeholder="Ej.: iPhone 15, pantalla, cargador, un IMEI…"
                  autoComplete="off"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setVerResultados(true); }}
                  onFocus={() => setVerResultados(true)}
                  onBlur={() => setTimeout(() => setVerResultados(false), 150)}
                />

                {verResultados && q.trim() !== '' && (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-gris-200 bg-white shadow-xl">
                    {resultados.length === 0 && (
                      <li className="px-4 py-3 text-[13px] text-gris-500">
                        {buscando ? 'Buscando…' : 'No hay productos con precio para tiendas que coincidan. Si falta alguno, ponle su precio para tiendas en el inventario.'}
                      </li>
                    )}
                    {resultados.map((p) => {
                      const Icono = TIPOS[p.tipo]?.icon ?? Package;
                      const yaEsta = !esPorCantidad(p.tipo) && items.some((i) => i.tipo === p.tipo && i.producto_id === p.id);
                      return (
                        <li key={`${p.tipo}-${p.id}`}>
                          <button type="button" disabled={yaEsta} onMouseDown={(e) => e.preventDefault()} onClick={() => agregar(p)}
                            className="flex w-full items-center gap-3 border-b border-gris-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gris-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gris-100 text-gris-500"><Icono className="h-4 w-4" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-gris-900">{p.nombre}</span>
                              <span className="block truncate text-xs text-gris-500">
                                {[TIPOS[p.tipo]?.label, p.detalle, p.codigo, esPorCantidad(p.tipo) ? `quedan ${p.cantidad}` : null].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              {yaEsta ? <span className="text-xs font-semibold text-gris-500">Ya está</span> : (
                                <>
                                  <span className="block text-sm font-bold tabular-nums text-gris-900">{bsFmt(p.precio_tienda)}</span>
                                  <span className="block text-[11px] tabular-nums text-gris-400">Cliente final {bsFmt(p.precio_venta)}</span>
                                </>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Productos agregados */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-gris-400">En esta venta · {items.length}</p>
                {items.length === 0 ? (
                  <div className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm ${error('items') ? 'border-red-300 bg-red-50 text-red-700' : 'border-gris-200 bg-gris-50/60 text-gris-500'}`}>
                    {error('items') ?? 'Todavía no agregaste productos.'}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item, i) => {
                      const Icono = TIPOS[item.tipo]?.icon ?? Package;
                      const mensajes = errorDeLinea(i);
                      return (
                        <li key={`${item.tipo}-${item.producto_id}`} className={`rounded-xl border bg-white px-4 py-3 ${mensajes.length ? 'border-red-300' : 'border-gris-200'}`}>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gris-100 text-gris-500"><Icono className="h-4 w-4" /></span>
                            <div className="min-w-[160px] flex-1">
                              <p className="truncate text-sm font-semibold text-gris-900">{item.nombre}</p>
                              <p className="truncate text-xs text-gris-500">
                                {[TIPOS[item.tipo]?.label, item.detalle].filter(Boolean).join(' · ')}
                              </p>
                              <p className="text-[11px] tabular-nums text-gris-400">
                                Cliente final {bsFmt(item.precio_venta)}
                                {precioDe(item) !== item.precio_tienda && <> · precio para tiendas {bsFmt(item.precio_tienda)}</>}
                              </p>
                            </div>

                            {esPorCantidad(item.tipo) && (
                              <label className="w-20 shrink-0">
                                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-gris-500">Cantidad</span>
                                <Input type="number" min={1} max={item.stock} step={1} inputMode="numeric" className="h-10 font-semibold tabular-nums"
                                  value={item.cantidad}
                                  onChange={(e) => cambiarItem(i, { cantidad: Math.min(item.stock, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })} />
                              </label>
                            )}

                            <label className="w-32 shrink-0">
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-gris-500">
                                {esPorCantidad(item.tipo) ? 'Precio c/u (Bs)' : 'Precio (Bs)'}
                              </span>
                              <Input type="number" min={0} step="0.01" inputMode="decimal" className="h-10 font-semibold tabular-nums"
                                value={item.precio} onChange={(e) => cambiarItem(i, { precio: e.target.value })} />
                            </label>

                            <p className="w-28 shrink-0 text-right text-sm font-bold tabular-nums text-gris-900">{bsFmt(subtotalDe(item))}</p>
                            <button type="button" onClick={() => quitarItem(i)} aria-label={`Quitar ${item.nombre}`}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {mensajes.map((mensaje) => <p key={mensaje} className="mt-2 text-xs font-medium text-peligro">{mensaje}</p>)}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </StepCard>

            {/* Paso 3 */}
            <StepCard step={3} title="Pago" subtitle="Elige cómo pagó la tienda.">
              <Field label="Forma de pago" error={error('metodo_pago')}>
                <Segmented options={METODOS_PAGO} value={metodoPago} ariaLabel="Forma de pago"
                  onChange={(v) => { setMetodoPago(v); quitarError('metodo_pago'); }} />
              </Field>

              {metodoPago === 'tarjeta' && (
                <div className="mt-4">
                  <CardPaymentFields
                    titular={tienda.nombre}
                    inicio={tarjeta.inicio}
                    fin={tarjeta.fin}
                    errors={{ inicio_tarjeta: error('inicio_tarjeta'), fin_tarjeta: error('fin_tarjeta') }}
                    onChangeInicio={(valor) => setTarjeta((t) => ({ ...t, inicio: valor }))}
                    onChangeFin={(valor) => setTarjeta((t) => ({ ...t, fin: valor }))}
                  />
                </div>
              )}
            </StepCard>
          </div>

          {/* Resumen tipo carrito */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
              <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <ShoppingCart className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen
                </h2>
                <Badge tone="navy">{unidades} {unidades === 1 ? 'unidad' : 'unidades'}</Badge>
              </div>

              <div className="space-y-4 p-5">
                <p className="flex items-center gap-2 text-sm text-gris-600">
                  <Building2 className="h-4 w-4 shrink-0 text-gris-400" />
                  <span className="truncate">{tienda.nombre.trim() || 'Sin tienda todavía'}</span>
                </p>

                {items.length > 0 && (
                  <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-gris-100 pt-4">
                    {items.map((item) => (
                      <li key={`r-${item.tipo}-${item.producto_id}`} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-gris-600">{item.cantidad > 1 ? `${item.cantidad} × ` : ''}{item.nombre}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-gris-900">{bsFmt(subtotalDe(item))}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="rounded-xl bg-carbon-900 px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Total a cobrar</p>
                  <p className="mt-1 text-[28px] font-bold leading-none tracking-tight">{bsFmt(total)}</p>
                  <p className="mt-1.5 text-xs text-white/60">{METODOS_PAGO.find((m) => m.value === metodoPago)?.label ?? 'Falta elegir la forma de pago'}</p>
                </div>

                {otrosErrores.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <ul className="list-disc space-y-1 pl-5">
                      {otrosErrores.map((mensaje) => <li key={mensaje}>{mensaje}</li>)}
                    </ul>
                  </div>
                )}

                <button type="button" onClick={registrar} disabled={enviando}
                  className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  {enviando ? 'Registrando…' : 'Registrar venta a tienda'}
                </button>
                <p className="text-center text-xs text-gris-400">Se descuenta del inventario y se abre la nota.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
