import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { route } from 'ziggy-js';
import {
  AlertTriangle, Archive, ArchiveRestore, Boxes, PackagePlus, Pencil, Plus, Search, Tag, TrendingUp, X,
} from 'lucide-react';
import { notifyRecordsUpdated, useAutoRefresh } from '@/Hooks/useAutoRefresh';
import { Badge, EmptyState, PageHeader, Paginador, Toast, bsFmt, buttonCls, inputCls, useToast } from '@/Components/Admin/ui';
import { Aviso, Stat } from '@/Components/Admin/inventario';
import { EstadoPieza, IconoPieza, ModalStock, Saldo, estadoDe } from '@/Components/Admin/piezas';

// El listado se arma en el servidor: un taller que despieza equipos junta miles de repuestos, y
// mandar todo al navegador para filtrarlo ahí deja de funcionar bastante antes de eso.

const FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'disponibles', label: 'En stock' },
  { key: 'por_agotarse', label: 'Queda poco', alerta: true },
  { key: 'agotadas', label: 'Agotadas' },
  { key: 'archivadas', label: 'Archivadas' },
];

export default function Index({ piezas, filtros = {}, resumen = {}, categorias = [], sugerencias = [] }) {
  useAutoRefresh(['piezas', 'resumen', 'categorias']);
  const [toast] = useToast();
  const [q, setQ] = useState(filtros.q ?? '');
  const [cargando, setCargando] = useState(false);
  const [movimiento, setMovimiento] = useState(null);
  const tablaRef = useRef(null);
  const primeraVez = useRef(true);

  useEffect(() => { setQ(filtros.q ?? ''); }, [filtros.q]);

  const ir = (extra = {}, { subir = false } = {}) => {
    setCargando(true);
    router.get(route('admin.piezas.index'), {
      q, categoria: filtros.categoria, estado: filtros.estado, orden: filtros.orden, por: filtros.por, ...extra,
    }, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onFinish: () => {
        setCargando(false);
        if (subir) tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
  };

  // La búsqueda sale sola al dejar de escribir: con miles de piezas, esperar el Enter es un trámite.
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    if (q === (filtros.q ?? '')) return;
    const t = setTimeout(() => ir({ q, page: 1 }), 350);
    return () => clearTimeout(t);
  }, [q]);

  const items = piezas?.data ?? [];
  const hayFiltros = Boolean(filtros.q) || (filtros.categoria ?? '') !== '' || (filtros.estado ?? 'todas') !== 'todas';
  const limpiar = () => { setQ(''); ir({ q: '', categoria: '', estado: 'todas', page: 1 }); };

  const archivar = (pieza, activa) => {
    router.patch(route('admin.piezas.archivar', pieza.id), { activa }, {
      preserveScroll: true, onSuccess: () => notifyRecordsUpdated(),
    });
  };

  const margen = resumen.venta > 0 ? Math.round(((resumen.venta - resumen.costo) / resumen.venta) * 100) : null;

  return (
    <AdminLayout title="Piezas y repuestos">
      <Head title="Piezas y repuestos" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Piezas y repuestos"
          subtitle="El cajón del taller: pantallas, baterías, pines y todo lo que sale de un despiece. Se lleva por cantidad, no por unidad."
          actions={(
            <Link href={route('admin.piezas.create')} className={buttonCls('primary', 'h-11 px-5')}>
              <Plus className="h-4 w-4" /> Registrar pieza
            </Link>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Boxes} label="Unidades en stock" value={(resumen.unidades ?? 0).toLocaleString('es-BO')}
            hint={`En ${(resumen.referencias ?? 0).toLocaleString('es-BO')} ${resumen.referencias === 1 ? 'pieza distinta' : 'piezas distintas'}`} />
          <Stat icon={Tag} label="Valor de venta" value={bsFmt(resumen.venta)} tone="emerald"
            hint={`Invertido: ${bsFmt(resumen.costo)}`} />
          <Stat icon={TrendingUp} label="Ganancia esperada" value={bsFmt((resumen.venta ?? 0) - (resumen.costo ?? 0))} tone="lila"
            hint={margen != null ? `Margen de ${margen} % sobre la venta` : 'Sin piezas con precio'} />
          <Stat icon={AlertTriangle} label="Por reponer" value={((resumen.por_agotarse ?? 0) + (resumen.agotadas ?? 0)).toLocaleString('es-BO')} tone="slate"
            hint={`${resumen.agotadas ?? 0} agotadas · ${resumen.por_agotarse ?? 0} por agotarse`} />
        </div>

        {(resumen.por_agotarse ?? 0) > 0 && filtros.estado !== 'por_agotarse' && (
          <Aviso tono="amber" icon={AlertTriangle} onAccion={() => ir({ estado: 'por_agotarse', page: 1 })}>
            <span className="font-bold">{resumen.por_agotarse} {resumen.por_agotarse === 1 ? 'pieza llegó' : 'piezas llegaron'} a su mínimo</span>{' '}
            y conviene reponerlas antes de quedarte sin ellas.
          </Aviso>
        )}

        {/* Búsqueda y filtros */}
        <section className="rounded-2xl border border-gris-200 bg-white p-4 shadow-sutil">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar piezas"
                placeholder="Buscar por nombre, categoría, compatibilidad, código u origen"
                className={`${inputCls} h-11 pl-10 pr-10`} />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select value={filtros.categoria ?? ''} onChange={(e) => ir({ categoria: e.target.value, page: 1 })}
              aria-label="Categoría" className={`${inputCls} h-11 pr-9 lg:w-56`}>
              <option value="">Todas las categorías</option>
              {[...new Set([...categorias, ...sugerencias])].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtros.orden ?? 'nombre'} onChange={(e) => ir({ orden: e.target.value, page: 1 })}
              aria-label="Orden" className={`${inputCls} h-11 pr-9 lg:w-56`}>
              <option value="nombre">Por nombre</option>
              <option value="recientes">Registradas recientemente</option>
              <option value="stock_asc">Las que menos quedan</option>
              <option value="valor_desc">Las que más valen</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {FILTROS.map((f) => {
              const activo = (filtros.estado ?? 'todas') === f.key;
              return (
                <button key={f.key} type="button" onClick={() => ir({ estado: f.key, page: 1 })} aria-pressed={activo}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    activo ? 'bg-carbon-900 text-white'
                      : f.alerta ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Listado */}
        <section ref={tablaRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-gris-200 bg-white shadow-sutil">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
              <IconoPieza className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Listado de piezas
            </h2>
            {hayFiltros && (
              <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Quitar filtros
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState icon={IconoPieza}
              title={hayFiltros ? 'Sin resultados' : 'Todavía no hay piezas cargadas'}
              text={hayFiltros
                ? 'Probá con parte del nombre o del equipo compatible, o quitá los filtros.'
                : 'Cargá la primera: nombre, cuántas hay y a cuánto entra y sale. Después se vende o se usa en una reparación con dos clics.'}
              action={hayFiltros
                ? <button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>
                : <Link href={route('admin.piezas.create')} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Registrar pieza</Link>} />
          ) : (
            <>
              {/* Escritorio */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[920px] text-[13px]">
                  <thead>
                    <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                      <th className="px-5 py-3">Pieza</th>
                      <th className="px-3 py-3">Compatible con</th>
                      <th className="px-3 py-3 text-center">Quedan</th>
                      <th className="hidden px-3 py-3 text-right 2xl:table-cell">Costo</th>
                      <th className="px-3 py-3 text-right">Venta</th>
                      <th className="px-3 py-3 text-right">Valor</th>
                      <th className="py-3 pl-3 pr-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {items.map((p) => (
                      <tr key={p.id} className="group transition-colors hover:bg-gris-50/70">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                              estadoDe(p) === 'agotada' || !p.activa ? 'bg-gris-100 text-gris-400' : 'bg-carbon-900/[0.07] text-carbon-900'}`}>
                              <IconoPieza className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <Link href={route('admin.piezas.edit', p.id)} className="block max-w-[260px] truncate font-semibold text-gris-900 hover:text-[color:var(--acento)]">
                                {p.nombre}
                              </Link>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {p.categoria && <span className="truncate text-xs text-gris-500">{p.categoria}</span>}
                                {p.codigo && <Badge tone="slate"><span className="cifra">{p.codigo}</span></Badge>}
                                <EstadoPieza pieza={p} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="max-w-[190px] truncate text-gris-600" title={p.compatibilidad}>{p.compatibilidad || '—'}</p>
                        </td>
                        <td className="px-3 py-3 text-center"><Saldo cantidad={p.cantidad} minimo={p.minimo} /></td>
                        <td className="hidden px-3 py-3 text-right tabular-nums text-gris-500 2xl:table-cell">{bsFmt(p.precio_costo)}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-gris-900">{bsFmt(p.precio_venta)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-gris-600">{bsFmt((Number(p.cantidad) || 0) * (Number(p.precio_venta) || 0))}</td>
                        <td className="py-3 pl-3 pr-5">
                          <Acciones pieza={p} onIngresar={() => setMovimiento({ pieza: p, accion: 'ingreso' })} onArchivar={archivar} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Móvil y tablet */}
              <ul className="divide-y divide-gris-100 lg:hidden">
                {items.map((p) => (
                  <li key={p.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5"><EstadoPieza pieza={p} /></div>
                        <Link href={route('admin.piezas.edit', p.id)} className="mt-1.5 block truncate text-[15px] font-bold text-gris-900">{p.nombre}</Link>
                        <p className="truncate text-xs text-gris-500">{[p.categoria, p.compatibilidad].filter(Boolean).join(' · ') || 'Sin más datos'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold tabular-nums text-gris-900">{bsFmt(p.precio_venta)}</p>
                        <Saldo cantidad={p.cantidad} minimo={p.minimo} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Acciones pieza={p} onIngresar={() => setMovimiento({ pieza: p, accion: 'ingreso' })} onArchivar={archivar} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Paginador meta={piezas} cargando={cargando}
            onPagina={(n) => ir({ page: n }, { subir: true })}
            porPagina={filtros.por ?? 25} onPorPagina={(n) => ir({ por: n, page: 1 })} />
        </section>
      </div>

      {movimiento && (
        <ModalStock pieza={movimiento.pieza} accion={movimiento.accion} onCerrar={() => setMovimiento(null)} />
      )}
    </AdminLayout>
  );
}

function Acciones({ pieza, onIngresar, onArchivar }) {
  const boton = 'grid h-9 w-9 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-gris-100 hover:text-gris-900';
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={onIngresar} className={boton} title="Ingresar unidades" aria-label={`Ingresar unidades de ${pieza.nombre}`}>
        <PackagePlus className="h-4 w-4" />
      </button>
      <Link href={route('admin.piezas.edit', pieza.id)} className={boton} title="Editar" aria-label={`Editar ${pieza.nombre}`}>
        <Pencil className="h-4 w-4" />
      </Link>
      <button type="button" onClick={() => onArchivar(pieza, !pieza.activa)} className={boton}
        title={pieza.activa ? 'Archivar' : 'Volver a activar'}
        aria-label={`${pieza.activa ? 'Archivar' : 'Volver a activar'} ${pieza.nombre}`}>
        {pieza.activa ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
      </button>
    </div>
  );
}
