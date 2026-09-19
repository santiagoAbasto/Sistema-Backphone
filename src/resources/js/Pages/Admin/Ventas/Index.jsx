import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FileText, Pencil, Plus, Printer, Receipt, Search, ShoppingCart, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';
import { Badge, EmptyState, PageHeader, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';

const TIPOS = {
  celular: { label: 'Celular', tone: 'blue' },
  computadora: { label: 'Computadora', tone: 'violet' },
  producto_apple: { label: 'Equipo de marca', tone: 'amber' },
  producto_general: { label: 'Producto general', tone: 'slate' },
  servicio_tecnico: { label: 'Servicio técnico', tone: 'emerald' },
};

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fecha = (iso) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
const hora = (iso) => new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-[#121214]/[0.07] text-[#121214]',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-600',
    lila: 'bg-[#96684F]/10 text-[#96684F]',
  };
  return (
    <div className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 text-[24px] font-extrabold leading-none tracking-tight text-gris-900">{value}</p>
      {hint && <p className="mt-2 text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

function AccionNota({ href, icon: Icon, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 transition-colors hover:border-gris-300 hover:text-gris-900">
      <Icon className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

export default function Index({ ventas }) {
  useAutoRefresh(['ventas']);

  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [vendedor, setVendedor] = useState('todos');
  const [limite, setLimite] = useState(50);
  const [notas, setNotas] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const buscarNota = async (e) => {
    e?.preventDefault();
    if (!texto.trim()) return;
    setBuscando(true);
    try {
      const response = await axios.get(route('admin.ventas.buscarNota'), {
        params: { codigo_nota: texto.trim() },
      });
      setNotas(response.data);
    } catch (error) {
      console.error('Error al buscar nota:', error);
      setNotas([]);
    } finally {
      setBuscando(false);
    }
  };

  /* ===============================
     DESGLOSE DE ITEMS (misma lógica de siempre)
  =============================== */
  const itemsDesglosados = useMemo(() => ventas.flatMap((venta) => {
    if (venta.tipo_venta === 'servicio_tecnico') {
      const precioVenta = parseFloat(venta.precio_venta || 0);
      const descuento = parseFloat(venta.descuento || 0);
      const capital = parseFloat(venta.precio_invertido || 0);
      const ganancia = precioVenta - descuento - capital;

      return [{
        cliente: venta.nombre_cliente,
        producto: 'Servicio Técnico',
        codigoNota: venta.servicio_tecnico?.codigo_nota ?? venta.codigo_nota,
        id_venta: venta.id,
        tipo: 'servicio_tecnico',
        precioVenta,
        descuento,
        permuta: 0,
        reserva: 0,
        capital,
        precioFinal: precioVenta - descuento,
        ganancia,
        vendedor: venta.vendedor?.name || '—',
        fecha: venta.created_at,
      }];
    }

    return venta.items.map((item, itemIndex) => {
      const precioVenta = parseFloat(item.precio_venta || 0);
      const descuento = parseFloat(item.descuento || 0);
      const capital = parseFloat(item.precio_invertido || 0);
      const permuta = itemIndex === 0 ? parseFloat(venta.valor_permuta || 0) : 0;
      const reserva = itemIndex === 0 ? parseFloat(venta.monto_reserva_aplicado || 0) : 0;
      const ganancia = precioVenta - descuento - permuta - capital;

      const nombre =
        item.tipo === 'celular'
          ? item.celular?.modelo
          : item.tipo === 'computadora'
          ? item.computadora?.nombre
          : item.tipo === 'producto_apple'
          ? item.producto_apple?.modelo
          : item.producto_general?.nombre;

      return {
        cliente: venta.nombre_cliente,
        producto: nombre,
        codigoNota: venta.codigo_nota,
        id_venta: venta.id,
        tipo: item.tipo,
        precioVenta,
        descuento,
        permuta,
        reserva,
        capital,
        precioFinal: precioVenta - descuento - permuta - reserva,
        ganancia,
        vendedor: venta.vendedor?.name || '—',
        fecha: venta.created_at,
      };
    });
  }), [ventas]);

  /* ===============================
     FILTROS (instantáneos)
  =============================== */
  const vendedores = useMemo(
    () => [...new Set(itemsDesglosados.map((i) => i.vendedor).filter((v) => v && v !== '—'))].sort(),
    [itemsDesglosados],
  );
  const conteoTipos = useMemo(() => itemsDesglosados.reduce((acc, i) => ({ ...acc, [i.tipo]: (acc[i.tipo] || 0) + 1 }), {}), [itemsDesglosados]);

  const q = normalizar(texto.trim());
  const filtrados = useMemo(() => itemsDesglosados.filter((i) =>
    (tipo === 'todos' || i.tipo === tipo)
    && (vendedor === 'todos' || i.vendedor === vendedor)
    && (!q || normalizar([i.cliente, i.codigoNota, i.producto, i.vendedor].join(' ')).includes(q)),
  ), [itemsDesglosados, tipo, vendedor, q]);

  useEffect(() => { setLimite(50); }, [texto, tipo, vendedor]);

  const visibles = filtrados.slice(0, limite);
  const totalCobrado = filtrados.reduce((acc, i) => acc + i.precioFinal, 0);
  const gananciaTotal = filtrados.reduce((acc, i) => (i.ganancia > 0 ? acc + i.ganancia : acc), 0);
  const perdidas = filtrados.reduce((acc, i) => (i.ganancia < 0 ? acc + Math.abs(i.ganancia) : acc), 0);
  const ventasUnicas = new Set(filtrados.map((i) => i.id_venta)).size;
  const hayFiltros = q || tipo !== 'todos' || vendedor !== 'todos';

  const limpiar = () => { setTexto(''); setTipo('todos'); setVendedor('todos'); setNotas(null); };

  return (
    <AdminLayout>
      <Head title="Ventas" />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Ventas"
          subtitle="Cada fila es un producto vendido. Desde aquí imprimes la nota o corriges una venta."
          actions={
            <Link href={route('admin.ventas.create')} className={buttonCls('primary', 'h-11 px-5')}>
              <Plus className="h-4 w-4" /> Nueva venta
            </Link>
          }
        />

        {/* Resumen de lo filtrado */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Receipt} label="Ventas" value={ventasUnicas.toLocaleString('es-BO')} hint={`${filtrados.length.toLocaleString('es-BO')} productos vendidos`} />
          <Stat icon={Wallet} label="Total cobrado" value={bsFmt(totalCobrado)} tone="lila" />
          <Stat icon={TrendingUp} label="Ganancia" value={bsFmt(gananciaTotal)} hint="Suma de las ventas con ganancia" tone="emerald" />
          <Stat icon={TrendingDown} label="Invertido de más" value={bsFmt(perdidas)} hint={perdidas > 0 ? 'Ventas por debajo del costo' : 'Ninguna venta bajo el costo'} tone="rose" />
        </div>

        {/* Búsqueda y filtros */}
        <section className="rounded-2xl border border-gris-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <form onSubmit={buscarNota} className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por cliente, código de nota, producto o vendedor"
                className={`${inputCls} h-11 pl-10 pr-10`}
              />
              {texto && (
                <button type="button" onClick={() => { setTexto(''); setNotas(null); }} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={`${inputCls} h-11 pr-9 lg:w-56`} aria-label="Vendedor">
              <option value="todos">Todos los vendedores</option>
              {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button type="submit" disabled={!texto.trim() || buscando} className={buttonCls('secondary', 'h-11')} title="Busca también en servicios técnicos">
              <FileText className="h-4 w-4" /> {buscando ? 'Buscando…' : 'Buscar nota'}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[['todos', 'Todos', itemsDesglosados.length], ...Object.entries(TIPOS).filter(([k]) => conteoTipos[k]).map(([k, t]) => [k, t.label, conteoTipos[k]])].map(([k, label, n]) => (
              <button key={k} type="button" onClick={() => setTipo(k)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${tipo === k ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                {label} <span className={tipo === k ? 'text-white/70' : 'text-gris-400'}>{n}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Notas encontradas (incluye servicios técnicos) */}
        {notas !== null && (
          <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-3.5">
              <p className="text-sm font-bold text-gris-900">
                Notas encontradas <span className="font-semibold text-gris-400">· {notas.length}</span>
              </p>
              <button type="button" onClick={() => setNotas(null)} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Cerrar
              </button>
            </div>
            {notas.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gris-500">No hay notas con «{texto}».</p>
            ) : (
              <ul className="divide-y divide-gris-100">
                {notas.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-sm font-bold text-[#96684F]">{r.codigo_nota}</span>
                      <span className="truncate text-sm font-semibold text-gris-800">{r.nombre_cliente}</span>
                      <Badge tone={r.tipo === 'servicio_tecnico' ? 'emerald' : 'navy'}>{r.tipo === 'servicio_tecnico' ? 'Servicio técnico' : 'Venta'}</Badge>
                    </div>
                    <div className="flex gap-2">
                      {r.tipo === 'venta' && (
                        <Link href={route('admin.ventas.edit', r.id_real)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 hover:border-gris-300 hover:text-gris-900">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Link>
                      )}
                      <AccionNota icon={FileText} label="Nota"
                        href={r.tipo === 'servicio_tecnico' ? route('admin.servicios.boleta', r.id_real) : route('admin.ventas.boleta', r.id_real)} />
                      <AccionNota icon={Printer} label="Térmica"
                        href={r.tipo === 'servicio_tecnico' ? route('admin.servicios.recibo80mm', r.id_real) : route('admin.ventas.boleta80', r.id_real)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Detalle */}
        <section className="overflow-hidden rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
              <ShoppingCart className="h-[18px] w-[18px] text-[#96684F]" /> Detalle de ventas
            </h2>
            {hayFiltros && (
              <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Quitar filtros
              </button>
            )}
          </div>

          {itemsDesglosados.length === 0 ? (
            <EmptyState icon={Receipt} title="Todavía no hay ventas"
              text="Cuando registres la primera venta aparecerá aquí con su nota para imprimir."
              action={<Link href={route('admin.ventas.create')} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Registrar una venta</Link>} />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro nombre, código o quita los filtros."
              action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-[13px]">
                  <thead>
                    <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                      <th className="px-5 py-3">Venta</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Precio</th>
                      <th className="px-4 py-3 text-right">Descuentos</th>
                      <th className="px-4 py-3 text-right">Costo</th>
                      <th className="px-4 py-3 text-right">Cobrado</th>
                      <th className="px-4 py-3 text-right">Ganancia</th>
                      <th className="px-5 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {visibles.map((i, idx) => {
                      const tipoInfo = TIPOS[i.tipo] ?? { label: i.tipo, tone: 'slate' };
                      const rebajas = i.descuento + i.permuta;
                      return (
                        <tr key={`${i.id_venta}-${idx}`} className="align-top transition-colors hover:bg-gris-50/70">
                          <td className="px-5 py-3">
                            <p className="font-mono text-[13px] font-bold text-[#96684F]">{i.codigoNota}</p>
                            <p className="mt-0.5 whitespace-nowrap text-xs text-gris-400">{fecha(i.fecha)} · {hora(i.fecha)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[180px] truncate font-semibold text-gris-900">{i.cliente || 'Sin nombre'}</p>
                            <p className="mt-0.5 text-xs text-gris-400">por {i.vendedor}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[240px] truncate font-medium text-gris-800">{i.producto || '—'}</p>
                            <Badge tone={tipoInfo.tone} className="mt-1">{tipoInfo.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gris-700">{bsFmt(i.precioVenta)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {rebajas > 0 ? (
                              <>
                                <p className="text-rose-600">−{bsFmt(rebajas)}</p>
                                {i.descuento > 0 && i.permuta > 0 && (
                                  <p className="mt-0.5 text-[11px] text-gris-400">Desc. {bsFmt(i.descuento)} · Permuta {bsFmt(i.permuta)}</p>
                                )}
                                {i.permuta > 0 && !(i.descuento > 0) && <p className="mt-0.5 text-[11px] text-gris-400">Permuta</p>}
                              </>
                            ) : <span className="text-gris-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gris-500">{bsFmt(i.capital)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <p className="font-bold text-gris-900">{bsFmt(i.precioFinal)}</p>
                            {i.reserva > 0 && <p className="mt-0.5 text-[11px] text-gris-400">Abono previo {bsFmt(i.reserva)}</p>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {i.ganancia < 0 ? (
                              <span className="inline-flex flex-col items-end">
                                <span className="font-bold text-rose-600">−{bsFmt(Math.abs(i.ganancia))}</span>
                                <span className="text-[11px] text-gris-400">Se invirtió</span>
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-700">+{bsFmt(i.ganancia)}</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1.5">
                              <AccionNota icon={FileText} label="Nota" href={route('admin.ventas.boleta', i.id_venta)} />
                              <AccionNota icon={Printer} label="Térmica" href={route('admin.ventas.boleta80', i.id_venta)} />
                              <Link href={route('admin.ventas.edit', i.id_venta)} title="Editar venta" aria-label={`Editar venta ${i.codigoNota}`}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-gris-200 bg-white text-gris-600 transition-colors hover:border-[#121214] hover:bg-[#121214] hover:text-white">
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gris-200 bg-gris-50/70 text-[13px]">
                      <td className="px-5 py-3 font-bold text-gris-900" colSpan={6}>
                        Total {hayFiltros ? 'filtrado' : 'general'} · {filtrados.length.toLocaleString('es-BO')} productos
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-gris-900">{bsFmt(totalCobrado)}</td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-emerald-700">+{bsFmt(gananciaTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {filtrados.length > limite && (
                <div className="border-t border-gris-100 px-5 py-3 text-center">
                  <button type="button" onClick={() => setLimite((l) => l + 50)} className={buttonCls('secondary')}>
                    Mostrar 50 más <span className="text-gris-400">({(filtrados.length - limite).toLocaleString('es-BO')} restantes)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
