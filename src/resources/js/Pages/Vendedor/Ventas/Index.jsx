import VendedorLayout from '@/Layouts/VendedorLayout';
import { Head, Link } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FileDown, FileText, Pencil, Plus, Printer, Receipt, Search, ShoppingCart, Tag, TrendingDown, Wallet, X,
} from 'lucide-react';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';
import { Badge, EmptyState, Modal, PageHeader, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';
import { BarraComposicion, Metrica } from '@/Components/Panel/Metricas';
import { Stat } from '@/Components/Admin/inventario';
import AdminGuide from '@/Components/Admin/AdminGuide';

// Mis ventas: cada fila es un producto vendido por este vendedor. La lista ya llega filtrada
// por `user_id` desde el servidor (VentaController@index), así que acá no se mezcla nada de nadie.

const TIPOS = {
  celular: { label: 'Celular', tone: 'blue' },
  computadora: { label: 'Computadora', tone: 'violet' },
  producto_apple: { label: 'Equipo de marca', tone: 'amber' },
  producto_general: { label: 'Producto general', tone: 'slate' },
  pieza: { label: 'Pieza o repuesto', tone: 'bronce' },
  servicio_tecnico: { label: 'Servicio técnico', tone: 'emerald' },
};

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TZ = 'America/La_Paz';
const fecha = (iso) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const hora = (iso) => new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const hoy = () => new Date().toISOString().slice(0, 10);
const primeroDelMes = () => `${new Date().toISOString().slice(0, 7)}-01`;

function AccionNota({ href, icon: Icon, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-[8px] border border-gris-200 bg-white text-gris-500 transition-colors hover:border-gris-300 hover:bg-gris-50 hover:text-gris-900">
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}

export default function Index({ ventas = [] }) {
  useAutoRefresh(['ventas']);

  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [limite, setLimite] = useState(50);
  const [notas, setNotas] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [exportar, setExportar] = useState(null);

  const buscarNota = async (e) => {
    e?.preventDefault();
    if (!texto.trim()) return;
    setBuscando(true);
    try {
      const { data } = await axios.get(route('vendedor.ventas.buscarNota'), { params: { codigo_nota: texto.trim() } });
      setNotas(data);
    } catch {
      setNotas([]);
    } finally {
      setBuscando(false);
    }
  };

  /* Un renglón por producto vendido. La permuta y la seña se descuentan una sola vez por venta. */
  const itemsDesglosados = useMemo(() => ventas.flatMap((venta) => {
    if (venta.tipo_venta === 'servicio_tecnico') {
      const precioVenta = parseFloat(venta.precio_venta || 0);
      const descuento = parseFloat(venta.descuento || 0);
      return [{
        cliente: venta.nombre_cliente,
        producto: 'Servicio técnico',
        codigoNota: venta.servicio_tecnico?.codigo_nota ?? venta.codigo_nota,
        id_venta: venta.id,
        tipo: 'servicio_tecnico',
        precioVenta, descuento, permuta: 0, reserva: 0,
        precioFinal: precioVenta - descuento,
        fecha: venta.created_at,
      }];
    }

    return (venta.items ?? []).map((item, i) => {
      // El precio y el descuento son por unidad: una pieza puede ir de a varias en la misma línea.
      const unidades = Math.max(1, Number(item.cantidad) || 1);
      const precioVenta = parseFloat(item.precio_venta || 0) * unidades;
      const descuento = parseFloat(item.descuento || 0) * unidades;
      const permuta = i === 0 ? parseFloat(venta.valor_permuta || 0) : 0;
      const reserva = i === 0 ? parseFloat(venta.monto_reserva_aplicado || 0) : 0;
      const nombre = item.tipo === 'celular' ? item.celular?.modelo
        : item.tipo === 'computadora' ? item.computadora?.nombre
          : item.tipo === 'producto_apple' ? item.producto_apple?.modelo
            : item.tipo === 'pieza' ? (item.nombre_producto ?? item.pieza?.nombre)
              : item.producto_general?.nombre;

      return {
        cliente: venta.nombre_cliente,
        producto: unidades > 1 ? `${unidades} × ${nombre ?? 'Producto'}` : nombre,
        codigoNota: venta.codigo_nota,
        id_venta: venta.id,
        tipo: item.tipo,
        precioVenta, descuento, permuta, reserva,
        precioFinal: precioVenta - descuento - permuta - reserva,
        fecha: venta.created_at,
      };
    });
  }), [ventas]);

  const conteoTipos = useMemo(
    () => itemsDesglosados.reduce((acc, i) => ({ ...acc, [i.tipo]: (acc[i.tipo] || 0) + 1 }), {}),
    [itemsDesglosados],
  );

  const q = normalizar(texto.trim());
  const filtrados = useMemo(() => itemsDesglosados.filter((i) =>
    (tipo === 'todos' || i.tipo === tipo)
    && (!q || normalizar([i.cliente, i.codigoNota, i.producto].join(' ')).includes(q)),
  ), [itemsDesglosados, tipo, q]);

  useEffect(() => { setLimite(50); }, [texto, tipo]);

  const visibles = filtrados.slice(0, limite);
  const totalCobrado = filtrados.reduce((a, i) => a + i.precioFinal, 0);
  const totalPrecio = filtrados.reduce((a, i) => a + i.precioVenta, 0);
  const totalDescuentos = filtrados.reduce((a, i) => a + i.descuento + i.permuta, 0);
  const ventasUnicas = new Set(filtrados.map((i) => i.id_venta)).size;
  const hayFiltros = q || tipo !== 'todos';
  const limpiar = () => { setTexto(''); setTipo('todos'); setNotas(null); };

  return (
    <VendedorLayout title="Mis ventas">
      <Head title="Mis ventas" />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Mis ventas"
          subtitle="Cada fila es un producto que vendiste. Desde aquí imprimes la nota o corriges una venta."
          actions={(
            <>
              <button type="button" onClick={() => setExportar({ desde: primeroDelMes(), hasta: hoy() })} className={buttonCls('secondary', 'h-11')}>
                <FileDown className="h-4 w-4" /> Exportar PDF
              </button>
              <Link href={route('vendedor.ventas.create')} className={buttonCls('primary', 'h-11 px-5')}>
                <Plus className="h-4 w-4" /> Nueva venta
              </Link>
            </>
          )}
        />

        <AdminGuide
          id="vendedor-ventas"
          title="¿Cómo se lee esta pantalla?"
          steps={[
            'Cada renglón es un producto. Si en una venta entregaste tres equipos, vas a ver tres renglones con el mismo código de nota.',
'La permuta y la seña se descuentan una sola vez por venta, en el primer renglón.',
            '«Buscar nota» busca también en tus servicios técnicos, que no aparecen en esta tabla si no se facturaron como venta.',
          ]}
          tip="¿Te equivocaste en una venta? Editala desde el lápiz: el stock se acomoda solo."
        >
          Un renglón por producto
        </AdminGuide>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Metrica
            destacada
            etiqueta={hayFiltros ? 'Cobraste en lo filtrado' : 'Cobraste en total'}
            valor={bsFmt(totalCobrado)}
            hint={`${ventasUnicas.toLocaleString('es-BO')} ${ventasUnicas === 1 ? 'venta' : 'ventas'} · ${filtrados.length.toLocaleString('es-BO')} ${filtrados.length === 1 ? 'producto' : 'productos'}`}
            icono={Wallet}
          />

          <div className="flex flex-col justify-between rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gris-500">Precio de lista</p>
              <p className="mt-3 font-marca text-[26px] font-bold leading-none tracking-tight tabular-nums text-gris-900">
                {bsFmt(totalPrecio)}
              </p>
              <p className="mt-2 text-[12px] text-gris-500">
                {totalDescuentos > 0
                  ? `Rebajaste ${bsFmt(totalDescuentos)} entre descuentos y permutas.`
                  : 'No rebajaste nada: todo salió a precio de lista.'}
              </p>
            </div>
            <BarraComposicion
              className="mt-5"
              partes={[
                { etiqueta: 'Cobrado', valor: totalCobrado, color: 'var(--acento)' },
                { etiqueta: 'Rebajas', valor: totalDescuentos, color: 'var(--gris-300)' },
              ]}
            />
          </div>
        </div>

        <section className="rounded-[14px] border border-gris-200 bg-white p-4 shadow-sutil">
          <form onSubmit={buscarNota} className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por cliente, código de nota o producto"
                aria-label="Buscar en mis ventas"
                className={`${inputCls} h-11 pl-10 pr-10`}
              />
              {texto && (
                <button type="button" onClick={() => { setTexto(''); setNotas(null); }} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button type="submit" disabled={!texto.trim() || buscando} className={buttonCls('secondary', 'h-11')} title="Busca también en tus servicios técnicos">
              <FileText className="h-4 w-4" /> {buscando ? 'Buscando…' : 'Buscar nota'}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[['todos', 'Todos', itemsDesglosados.length], ...Object.entries(TIPOS).filter(([k]) => conteoTipos[k]).map(([k, t]) => [k, t.label, conteoTipos[k]])].map(([k, label, n]) => (
              <button key={k} type="button" onClick={() => setTipo(k)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tipo === k ? 'bg-carbon-900 text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                {label} <span className={tipo === k ? 'text-white/70' : 'text-gris-400'}>{n}</span>
              </button>
            ))}
          </div>
        </section>

        {notas !== null && (
          <section className="overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil">
            <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-3.5">
              <p className="text-[15px] font-semibold text-gris-900">Notas encontradas <span className="font-normal text-gris-400">· {notas.length}</span></p>
              <button type="button" onClick={() => setNotas(null)} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Cerrar
              </button>
            </div>
            {notas.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gris-500">No tienes notas con «{texto}».</p>
            ) : (
              <ul className="divide-y divide-gris-100">
                {notas.map((r) => (
                  <li key={`${r.tipo}-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="cifra text-[13px] font-semibold text-[color:var(--acento)]">{r.codigo_nota}</span>
                      <span className="truncate text-sm font-semibold text-gris-800">{r.nombre_cliente}</span>
                      <Badge tone={r.tipo === 'servicio_tecnico' ? 'emerald' : 'navy'}>{r.tipo === 'servicio_tecnico' ? 'Servicio técnico' : 'Venta'}</Badge>
                    </div>
                    <div className="flex gap-2">
                      {r.tipo === 'venta' && (
                        <Link href={route('vendedor.ventas.edit', r.id_real)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 hover:border-gris-300 hover:text-gris-900">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Link>
                      )}
                      <AccionNota icon={FileText} label="Nota"
                        href={r.tipo === 'servicio_tecnico' ? route('vendedor.servicios.boleta', r.id_real) : route('vendedor.ventas.boleta', r.id_real)} />
                      <AccionNota icon={Printer} label="Térmica"
                        href={r.tipo === 'servicio_tecnico' ? route('vendedor.servicios.recibo80mm', r.id_real) : route('vendedor.ventas.boleta80', r.id_real)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-gris-900">
              <ShoppingCart className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Detalle de mis ventas
            </h2>
            {hayFiltros && (
              <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Quitar filtros
              </button>
            )}
          </div>

          {itemsDesglosados.length === 0 ? (
            <EmptyState icon={Receipt} title="Todavía no registraste ninguna venta"
              text="Cuando cargues la primera, va a aparecer acá con su nota lista para imprimir."
              action={<Link href={route('vendedor.ventas.create')} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Registrar una venta</Link>} />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" text="Probá con otro nombre, otro código o quitá los filtros."
              action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-[13px]">
                  <thead>
                    <tr className="border-b border-gris-200 bg-gris-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-500">
                      <th className="px-5 py-3">Venta</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Precio</th>
                      <th className="px-4 py-3 text-right">Descuentos</th>
                      <th className="px-4 py-3 text-right">Cobrado</th>
                      <th className="px-5 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {visibles.map((i, idx) => {
                      const tipoInfo = TIPOS[i.tipo] ?? { label: i.tipo, tone: 'slate' };
                      const rebajas = i.descuento + i.permuta;
                      return (
                        <tr key={`${i.id_venta}-${idx}`} className="group align-top transition-colors hover:bg-gris-50">
                          <td className="px-5 py-3">
                            <p className="cifra text-[12.5px] font-semibold text-[color:var(--acento)]">{i.codigoNota}</p>
                            <p className="mt-0.5 whitespace-nowrap text-xs text-gris-400">{fecha(i.fecha)} · {hora(i.fecha)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[180px] truncate font-semibold text-gris-900">{i.cliente || 'Sin nombre'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[240px] truncate font-medium text-gris-800">{i.producto || '—'}</p>
                            <Badge tone={tipoInfo.tone} className="mt-1">{tipoInfo.label}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gris-700">{bsFmt(i.precioVenta)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                            {rebajas > 0 ? (
                              <>
                                <p className="font-medium text-[color:var(--peligro-texto)]">−{bsFmt(rebajas)}</p>
                                {i.descuento > 0 && i.permuta > 0 && (
                                  <>
                                    <p className="mt-0.5 whitespace-nowrap text-[11px] text-gris-400">Desc. {bsFmt(i.descuento)}</p>
                                    <p className="whitespace-nowrap text-[11px] text-gris-400">Permuta {bsFmt(i.permuta)}</p>
                                  </>
                                )}
                                {i.permuta > 0 && i.descuento === 0 && <p className="mt-0.5 text-[11px] text-gris-400">Permuta</p>}
                              </>
                            ) : <span className="text-gris-300">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                            <p className="whitespace-nowrap font-semibold text-gris-900">{bsFmt(i.precioFinal)}</p>
                            {i.reserva > 0 && <p className="mt-0.5 text-[11px] text-gris-400">Seña previa {bsFmt(i.reserva)}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              <AccionNota icon={FileText} label="Nota" href={route('vendedor.ventas.boleta', i.id_venta)} />
                              <AccionNota icon={Printer} label="Térmica" href={route('vendedor.ventas.boleta80', i.id_venta)} />
                              <Link href={route('vendedor.ventas.edit', i.id_venta)} title="Editar venta" aria-label={`Editar venta ${i.codigoNota}`}
                                className="grid h-8 w-8 place-items-center rounded-[8px] border border-gris-200 bg-white text-gris-500 transition-colors hover:border-carbon-900 hover:bg-carbon-900 hover:text-white">
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
                      <td className="px-5 py-3.5 font-semibold text-gris-900" colSpan={5}>
                        Total {hayFiltros ? 'filtrado' : 'general'} · {filtrados.length.toLocaleString('es-BO')} productos
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-marca text-[15px] font-bold tabular-nums text-gris-900">{bsFmt(totalCobrado)}</td>
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

      {exportar && (
        <Modal
          title="Exportar mis ventas a PDF"
          onClose={() => setExportar(null)}
          footer={(
            <>
              <button type="button" onClick={() => setExportar(null)} className={buttonCls('secondary', 'h-11')}>Cancelar</button>
              <a
                href={route('vendedor.ventas.exportar', { fecha_inicio: exportar.desde, fecha_fin: exportar.hasta })}
                target="_blank" rel="noopener noreferrer"
                onClick={() => setExportar(null)}
                className={buttonCls('primary', 'h-11')}
              >
                <FileDown className="h-4 w-4" /> Abrir el PDF
              </a>
            </>
          )}
        >
          <p className="text-[13px] leading-relaxed text-gris-600">
            Se arma un PDF con tus ventas del período que elijas. Se abre en otra pestaña, listo para imprimir o guardar.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-600">Desde</span>
              <input type="date" value={exportar.desde} max={exportar.hasta}
                onChange={(e) => setExportar((v) => ({ ...v, desde: e.target.value }))} className={`${inputCls} h-11`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-600">Hasta</span>
              <input type="date" value={exportar.hasta} min={exportar.desde}
                onChange={(e) => setExportar((v) => ({ ...v, hasta: e.target.value }))} className={`${inputCls} h-11`} />
            </label>
          </div>
        </Modal>
      )}
    </VendedorLayout>
  );
}
