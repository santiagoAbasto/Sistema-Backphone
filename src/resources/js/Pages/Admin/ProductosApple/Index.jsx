import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Apple, FileDown, Plus, Search, ShoppingBag, Tag, TrendingUp, X } from 'lucide-react';
import { notifyRecordsUpdated, useAutoRefresh } from '@/Hooks/useAutoRefresh';
import { Badge, EmptyState, PageHeader, Paginador, Toast, bsFmt, buttonCls, inputCls, useToast } from '@/Components/Admin/ui';
import { CONDICIONES } from '@/Components/Admin/condicion';
import {
  AccionesFila, Aviso, BarraSeleccion, ChipsEstado, CondicionFila, EstadoBadge, ModalEliminar, PrecioConGanancia, Stat, bonito, checkCls, motivoEnListado, paginar, useSeleccion,
} from '@/Components/Admin/inventario';
import { BateriaBadge, ESTADOS_IMEI, detalleEquipo, nombreEquipo } from '@/Components/Admin/productos-apple';

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const digitos = (t) => String(t ?? '').replace(/\D/g, '');

export default function Index({ productos = [], conHistorial = [] }) {
  useAutoRefresh(['productos', 'conHistorial']);
  const [toast] = useToast();
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('todos');
  const [modelo, setModelo] = useState('todos');
  const [condicion, setCondicion] = useState('todas');
  const [orden, setOrden] = useState('inventario');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [aplicando, setAplicando] = useState(false);
  const [borrar, setBorrar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const tablaRef = useRef(null);

  const historial = useMemo(() => new Set(conHistorial), [conHistorial]);

  const filas = useMemo(() => productos.map((c, i) => ({
    ...c,
    pos: i,
    nombre: nombreEquipo(c),
    detalle: detalleEquipo(c),
    costo: Number(c.precio_costo) || 0,
    venta: Number(c.precio_venta) || 0,
    modeloClave: normalizar(c.modelo).replace(/\s+/g, ' ').trim(),
    busqueda: normalizar([c.modelo, c.capacidad, c.color, c.procedencia, c.numero_serie, c.bateria, c.condicion].join(' ')),
    imeis: `${c.imei_1 ?? ''} ${c.imei_2 ?? ''}`,
  })), [productos]);

  const conteo = useMemo(() => {
    const disponibles = filas.filter((c) => c.estado === 'disponible');
    const costo = disponibles.reduce((s, c) => s + c.costo, 0);
    const venta = disponibles.reduce((s, c) => s + c.venta, 0);
    return {
      todos: filas.length,
      disponible: disponibles.length,
      permuta: filas.filter((c) => c.estado === 'permuta').length,
      vendido: filas.filter((c) => c.estado === 'vendido').length,
      bajo_costo: disponibles.filter((c) => c.venta < c.costo).length,
      Nuevo: filas.filter((c) => c.condicion === 'Nuevo').length,
      Seminuevo: filas.filter((c) => c.condicion === 'Seminuevo').length,
      sin: filas.filter((c) => !c.condicion).length,
      disponibles_sin_condicion: disponibles.filter((c) => !c.condicion).length,
      costo,
      venta,
      ganancia: venta - costo,
    };
  }, [filas]);

  const modelos = useMemo(() => {
    const grupos = new Map();
    filas.forEach((c) => {
      if (!c.modeloClave) return;
      const g = grupos.get(c.modeloClave) ?? { clave: c.modeloClave, label: bonito(c.modelo), n: 0 };
      g.n += 1;
      grupos.set(c.modeloClave, g);
    });
    return [...grupos.values()].sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
  }, [filas]);

  const q = normalizar(texto.trim());
  const qDigitos = digitos(texto);
  const filtrados = useMemo(() => {
    const lista = filas.filter((c) =>
      (estado === 'todos'
        || (estado === 'bajo_costo' ? c.estado === 'disponible' && c.venta < c.costo : c.estado === estado))
      && (modelo === 'todos' || c.modeloClave === modelo)
      && (condicion === 'todas' || (condicion === 'sin' ? !c.condicion : c.condicion === condicion))
      && (!q || c.busqueda.includes(q) || (qDigitos.length >= 4 && c.imeis.includes(qDigitos))),
    );
    if (orden === 'recientes') return [...lista].sort((a, b) => b.id - a.id);
    if (orden === 'precio_desc') return [...lista].sort((a, b) => b.venta - a.venta || a.pos - b.pos);
    if (orden === 'precio_asc') return [...lista].sort((a, b) => a.venta - b.venta || a.pos - b.pos);
    return lista;
  }, [filas, estado, modelo, condicion, q, qDigitos, orden]);

  useEffect(() => { setPagina(1); }, [q, estado, modelo, condicion, orden, porPagina]);

  const { visibles, meta } = paginar(filtrados, pagina, porPagina);
  const sel = useSeleccion(visibles, filtrados);
  const irAPagina = (n) => {
    setPagina(n);
    tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hayFiltros = Boolean(q) || estado !== 'todos' || modelo !== 'todos' || condicion !== 'todas';
  const limpiar = () => { setTexto(''); setEstado('todos'); setModelo('todos'); setCondicion('todas'); };

  const habilitar = (c) => {
    router.patch(route('admin.productos-apple.habilitar', c.id), {}, { preserveScroll: true, onSuccess: () => notifyRecordsUpdated() });
  };

  const marcarCondicion = (valor) => {
    if (!sel.seleccion.length || aplicando) return;
    router.patch(route('admin.productos-apple.condicion'), { ids: sel.seleccion, condicion: valor }, {
      preserveScroll: true,
      onStart: () => setAplicando(true),
      onSuccess: () => {
        sel.setSeleccion([]);
        notifyRecordsUpdated();
      },
      onFinish: () => setAplicando(false),
    });
  };

  const confirmarBorrado = () => {
    if (!borrar || procesando) return;
    router.delete(route('admin.productos-apple.destroy', borrar.id), {
      preserveScroll: true,
      onStart: () => setProcesando(true),
      onSuccess: () => {
        sel.setSeleccion((s) => s.filter((id) => id !== borrar.id));
        setBorrar(null);
        notifyRecordsUpdated();
      },
      onFinish: () => setProcesando(false),
    });
  };

  const FILTROS = [
    { key: 'todos', label: 'Todos' },
    { key: 'disponible', label: 'Disponibles' },
    { key: 'permuta', label: 'En permuta', ocultarSinDatos: true },
    { key: 'vendido', label: 'Vendidos' },
    { key: 'bajo_costo', label: 'Bajo el costo', ocultarSinDatos: true, alerta: true },
  ].filter((f) => !f.ocultarSinDatos || conteo[f.key] > 0 || estado === f.key);

  const margen = conteo.venta > 0 ? Math.round((conteo.ganancia / conteo.venta) * 100) : null;
  const sinCondicion = conteo.disponibles_sin_condicion;

  return (
    <AdminLayout>
      <Head title="Equipos de marca" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Equipos de marca"
          subtitle="Tablets, relojes, audífonos y accesorios de marca: los disponibles van primero."
          actions={(
            <>
              <a href={route('admin.exportar.productos-apple')} target="_blank" rel="noopener noreferrer" className={buttonCls('secondary', 'h-11 px-4')}>
                <FileDown className="h-4 w-4" /> Exportar disponibles
              </a>
              <Link href={route('admin.productos-apple.create')} className={buttonCls('primary', 'h-11 px-5')}>
                <Plus className="h-4 w-4" /> Registrar producto
              </Link>
            </>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Apple} label="Disponibles" value={conteo.disponible.toLocaleString('es-BO')}
            hint={`De ${conteo.todos.toLocaleString('es-BO')} registrados`} />
          <Stat icon={Tag} label="Valor de venta" value={bsFmt(conteo.venta)} tone="emerald"
            hint={`Costo de los disponibles: ${bsFmt(conteo.costo)}`} />
          <Stat icon={TrendingUp} label="Ganancia esperada" value={bsFmt(conteo.ganancia)} tone="lila"
            hint={margen != null ? `Margen de ${margen} % sobre la venta` : 'Sin productos disponibles'} />
          <Stat icon={ShoppingBag} label="Vendidos" value={conteo.vendido.toLocaleString('es-BO')} tone="slate"
            hint={conteo.permuta ? `${conteo.permuta} en permuta por habilitar` : 'Productos que ya salieron'} />
        </div>

        {sinCondicion > 0 && !(estado === 'disponible' && condicion === 'sin') && (
          <Aviso onAccion={() => { setEstado('disponible'); setCondicion('sin'); }}>
            <span className="font-bold">{sinCondicion} {sinCondicion === 1 ? 'producto disponible no tiene' : 'productos disponibles no tienen'} condición</span>{' '}
            (nuevo o seminuevo). Selecciónalos y márcalos de una vez.
          </Aviso>
        )}

        {conteo.bajo_costo > 0 && estado !== 'bajo_costo' && (
          <Aviso tono="amber" icon={AlertTriangle} onAccion={() => setEstado('bajo_costo')}>
            <span className="font-bold">{conteo.bajo_costo} {conteo.bajo_costo === 1 ? 'producto disponible tiene' : 'productos disponibles tienen'}</span>{' '}
            el precio de venta por debajo del costo.
          </Aviso>
        )}

        {/* Búsqueda y filtros */}
        <section className="rounded-2xl border border-gris-200 bg-white p-4 shadow-sutil">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar equipos de marca"
                placeholder="Buscar por modelo, serie, IMEI, color o procedencia"
                className={`${inputCls} h-11 pl-10 pr-10`} />
              {texto && (
                <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo" className={`${inputCls} h-11 pr-9 lg:w-56`}>
              <option value="todos">Todos los modelos</option>
              {modelos.map((m) => <option key={m.clave} value={m.clave}>{m.label} ({m.n})</option>)}
            </select>
            <select value={condicion} onChange={(e) => setCondicion(e.target.value)} aria-label="Condición" className={`${inputCls} h-11 pr-9 lg:w-48`}>
              <option value="todas">Toda condición</option>
              {CONDICIONES.map((c) => <option key={c.value} value={c.value}>{c.label} ({conteo[c.value]})</option>)}
              <option value="sin">Sin condición ({conteo.sin})</option>
            </select>
            <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Orden" className={`${inputCls} h-11 pr-9 lg:w-52`}>
              <option value="inventario">Disponibles primero</option>
              <option value="recientes">Registrados recientemente</option>
              <option value="precio_desc">Precio: de mayor a menor</option>
              <option value="precio_asc">Precio: de menor a mayor</option>
            </select>
          </div>
          <ChipsEstado filtros={FILTROS} activo={estado} conteo={conteo} onChange={setEstado} />
        </section>

        {/* Listado */}
        <section ref={tablaRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-gris-200 bg-white shadow-sutil">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
              <Apple className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Listado de equipos de marca
            </h2>
            <div className="flex items-center gap-2">
              {visibles.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gris-600 lg:hidden">
                  <input type="checkbox" checked={sel.paginaMarcada} onChange={sel.alternarPagina} className={checkCls} /> Esta página
                </label>
              )}
              {hayFiltros && (
                <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                  <X className="h-3.5 w-3.5" /> Quitar filtros
                </button>
              )}
            </div>
          </div>

          {productos.length === 0 ? (
            <EmptyState icon={Apple} title="Todavía no hay equipos de marca"
              text="Registra el primer producto para que se pueda vender y cotizar."
              action={<Link href={route('admin.productos-apple.create')} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Registrar producto</Link>} />
          ) : meta.total === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro modelo, serie o IMEI, o quita los filtros."
              action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
          ) : (
            <>
              {/* Escritorio */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1120px] text-[13px]">
                  <thead>
                    <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                      <th className="w-10 py-3 pl-5 pr-2">
                        <input type="checkbox" checked={sel.paginaMarcada} onChange={sel.alternarPagina} aria-label="Seleccionar esta página" className={checkCls} />
                      </th>
                      <th className="px-3 py-3">Equipo</th>
                      <th className="px-3 py-3">Serie / IMEI</th>
                      <th className="px-3 py-3">Batería</th>
                      <th className="px-3 py-3">Procedencia</th>
                      <th className="px-3 py-3 text-right">Costo</th>
                      <th className="px-3 py-3 text-right">Venta</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="py-3 pl-3 pr-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-100">
                    {visibles.map((c) => {
                      const estadoImei = c.tiene_imei && c.estado_imei && c.estado_imei !== 'Libre' ? ESTADOS_IMEI.find((o) => o.value === c.estado_imei) : null;
                      const marcado = sel.seleccion.includes(c.id);
                      return (
                        <tr key={c.id} className={`transition-colors ${marcado ? 'bg-[rgb(var(--acento-rgb)_/_0.06)]' : 'hover:bg-gris-50/70'}`}>
                          <td className="py-3 pl-5 pr-2">
                            <input type="checkbox" checked={marcado} onChange={() => sel.alternar(c.id)} aria-label={`Seleccionar ${c.nombre}`} className={checkCls} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${c.estado === 'vendido' ? 'bg-gris-100 text-gris-400' : 'bg-carbon-900/[0.07] text-carbon-900'}`}>
                                <Apple className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <Link href={route('admin.productos-apple.edit', c.id)} className="block max-w-[260px] truncate font-semibold text-gris-900 hover:text-[color:var(--acento)]">
                                  {c.nombre}
                                </Link>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-xs text-gris-500">{c.detalle || 'Sin color'}</span>
                                  <CondicionFila condicion={c.condicion} estado={c.estado} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="cifra text-xs text-gris-800">{c.numero_serie || '—'}</p>
                            {c.tiene_imei && c.imei_1 && <p className="cifra text-xs text-gris-400">IMEI {c.imei_1}</p>}
                            {estadoImei && <Badge tone="amber" className="mt-1">{estadoImei.corto}</Badge>}
                          </td>
                          <td className="px-3 py-3"><BateriaBadge valor={c.bateria} /></td>
                          <td className="px-3 py-3">
                            <p className="max-w-[170px] truncate text-gris-600" title={c.procedencia}>{c.procedencia || '—'}</p>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-gris-500">{bsFmt(c.costo)}</td>
                          <td className="px-3 py-3"><PrecioConGanancia costo={c.costo} venta={c.venta} /></td>
                          <td className="px-3 py-3"><EstadoBadge estado={c.estado} /></td>
                          <td className="py-3 pl-3 pr-5">
                            <AccionesFila editarUrl={route('admin.productos-apple.edit', c.id)} nombre={c.nombre} estado={c.estado}
                              motivo={motivoEnListado(c.id, historial)} onBorrar={() => setBorrar(c)} onHabilitar={() => habilitar(c)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Móvil y tablet */}
              <ul className="divide-y divide-gris-100 lg:hidden">
                {visibles.map((c) => {
                  const marcado = sel.seleccion.includes(c.id);
                  return (
                    <li key={c.id} className={`px-4 py-4 ${marcado ? 'bg-[rgb(var(--acento-rgb)_/_0.06)]' : ''}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={marcado} onChange={() => sel.alternar(c.id)} aria-label={`Seleccionar ${c.nombre}`} className={`${checkCls} mt-1`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <EstadoBadge estado={c.estado} />
                                <CondicionFila condicion={c.condicion} estado={c.estado} />
                              </div>
                              <Link href={route('admin.productos-apple.edit', c.id)} className="mt-1.5 block truncate text-[15px] font-bold text-gris-900">{c.nombre}</Link>
                              <p className="truncate text-xs text-gris-500">{c.detalle || 'Sin color'}</p>
                            </div>
                            <PrecioConGanancia costo={c.costo} venta={c.venta} />
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gris-500">
                            {c.numero_serie && <span className="cifra text-gris-700">{c.numero_serie}</span>}
                            <BateriaBadge valor={c.bateria} />
                            {c.procedencia && <span className="max-w-[200px] truncate">{c.procedencia}</span>}
                          </div>
                          <div className="mt-3">
                            <AccionesFila editarUrl={route('admin.productos-apple.edit', c.id)} nombre={c.nombre} estado={c.estado}
                              motivo={motivoEnListado(c.id, historial)} onBorrar={() => setBorrar(c)} onHabilitar={() => habilitar(c)} />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <Paginador meta={meta} onPagina={irAPagina} porPagina={porPagina} onPorPagina={setPorPagina} />
        </section>

        <BarraSeleccion
          cantidad={sel.seleccion.length}
          total={meta.total}
          todosMarcados={sel.todosMarcados}
          hayMas={meta.total > visibles.length}
          onSeleccionarTodos={sel.seleccionarTodos}
          onMarcar={marcarCondicion}
          onQuitar={() => sel.setSeleccion([])}
          aplicando={aplicando}
        />
      </div>

      {borrar && (
        <ModalEliminar titulo="Eliminar producto Apple" icon={Apple} nombre={borrar.nombre}
          detalle={[borrar.detalle, borrar.numero_serie && `Serie ${borrar.numero_serie}`].filter(Boolean).join(' · ')}
          procesando={procesando} onConfirmar={confirmarBorrado} onCerrar={() => setBorrar(null)} />
      )}
    </AdminLayout>
  );
}
