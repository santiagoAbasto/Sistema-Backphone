import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  AlertTriangle, CalendarRange, Download, FileSpreadsheet, FileText, Hammer, Pencil, Plus, Printer, Search, TrendingUp, Users, Wallet,
  Wrench, X,
} from 'lucide-react';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';
import { Badge, EmptyState, Field, Input, Modal, PageHeader, Toast, bsFmt, buttonCls, inputCls, useToast } from '@/Components/Admin/ui';

const TZ = 'America/La_Paz';
const SIN_FILTROS = { desde: '', hasta: '', vendedor: '', tecnico: '', pendientes: false };

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fechaCorta = (iso) => (iso
  ? new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
  : '—');
// «2026-09-01» → «1 sept 2026», sin desfase por zona horaria
const fechaTexto = (ymd, conAnio = true) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', ...(conAnio && { year: 'numeric' }) });
};
const conSigno = (n) => (n < 0 ? `−${bsFmt(Math.abs(n))}` : `+${bsFmt(n)}`);

// Los trabajos se guardan como JSON; los registros antiguos pueden traer texto libre
const trabajosDe = (s) => {
  try {
    const items = JSON.parse(s.detalle_servicio || '[]');
    if (Array.isArray(items)) return items.filter((i) => String(i?.descripcion ?? '').trim());
  } catch { /* texto libre */ }
  return s.detalle_servicio ? [{ descripcion: String(s.detalle_servicio) }] : [];
};

// Parámetros que entiende el servidor (solo los que tienen valor)
const paramsDe = (f) => Object.fromEntries(Object.entries({
  fecha_inicio: f.desde, fecha_fin: f.hasta, vendedor_id: f.vendedor, tecnico: f.tecnico, pendientes: f.pendientes ? 1 : '',
}).filter(([, v]) => v));

// Todos los renglones del detalle tal como están guardados: el costo se carga en el mismo orden
const trabajosGuardados = (s) => {
  try {
    const items = JSON.parse(s.detalle_servicio || '[]');
    if (Array.isArray(items)) return items.map((i) => (i && typeof i === 'object' ? i : { descripcion: String(i ?? '') }));
  } catch { /* texto libre */ }
  return null;
};

const problemaDe = (f) => {
  if (f.desde && !f.hasta) return 'Elige también la fecha final.';
  if (!f.desde && f.hasta) return 'Elige también la fecha inicial.';
  if (f.desde && f.hasta && f.desde > f.hasta) return 'La fecha inicial no puede ser posterior a la final.';
  return null;
};

// Mientras se escribe el año, el campo pasa por fechas como 0002-09-01: solo cuentan las completas
const fechaCompleta = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000);

const fechaCls = 'h-9 w-full min-w-0 border-0 bg-transparent p-0 text-sm text-gris-800 shadow-none focus:outline-none focus:ring-0 sm:w-[128px]';

function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-[#121214]/[0.07] text-[#121214]',
    lila: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 text-[24px] font-extrabold leading-none tracking-tight text-gris-900">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

function Doc({ href, icon: Icon, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 transition-colors hover:border-gris-300 hover:text-gris-900">
      <Icon className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

function Acciones({ s, prefijo }) {
  return (
    <div className="flex justify-end gap-1.5">
      <Doc href={route(`${prefijo}.servicios.boleta`, s.id)} icon={FileText} label="Nota" />
      <Doc href={route(`${prefijo}.servicios.recibo80mm`, s.id)} icon={Printer} label="Térmica" />
    </div>
  );
}

function Tecnico({ nombre }) {
  return <Badge tone="lila"><Wrench className="h-3 w-3" /> {nombre || '—'}</Badge>;
}

/** El administrador completa el costo de cada trabajo. La nota del cliente no cambia: solo se suma lo que costó. */
function ModalCosto({ servicio, onCerrar }) {
  const guardados = trabajosGuardados(servicio);
  const { data, setData, patch, processing, errors } = useForm({
    costos: (guardados ?? []).map((t) => (t.costo === undefined || t.costo === null ? '' : String(t.costo))),
    costo_total: servicio.costo_pendiente ? '' : String(servicio.precio_costo ?? ''),
  });

  const cobrado = Number(servicio.precio_venta || 0);
  const costo = guardados
    ? data.costos.reduce((a, c) => a + (Number(c) || 0), 0)
    : Number(data.costo_total) || 0;
  const completo = guardados ? data.costos.every((c) => c !== '' && Number(c) >= 0) : data.costo_total !== '' && Number(data.costo_total) >= 0;
  const utilidad = cobrado - costo;
  const errorGeneral = errors.costos || errors.costo_total || Object.entries(errors).find(([k]) => k.startsWith('costos.'))?.[1];

  const guardar = () => {
    if (processing || !completo) return;
    patch(route('admin.servicios.costo', servicio.id), { preserveScroll: true, onSuccess: onCerrar });
  };

  return (
    <Modal
      title={`Costo de ${servicio.codigo_nota || 'servicio'}`}
      onClose={onCerrar}
      footer={(
        <>
          <button type="button" onClick={onCerrar} className={buttonCls('secondary', 'h-11')}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={processing || !completo} className={buttonCls('primary', 'h-11')}>
            {processing ? 'Guardando…' : 'Guardar costo'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-gris-50 px-4 py-3 text-[13px] leading-relaxed text-gris-600">
          <span className="font-semibold text-gris-900">{servicio.equipo}</span> de {servicio.cliente}
          {servicio.vendedor?.name ? `, registrado por ${servicio.vendedor.name}` : ''}. Escribe lo que costó cada trabajo:
          la nota del cliente no cambia.
        </p>

        {guardados ? (
          <ul className="space-y-2">
            {guardados.map((t, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-3 rounded-xl border border-gris-200 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gris-900">{t.descripcion || 'Trabajo sin descripción'}</p>
                  <p className="text-xs text-gris-500">El cliente paga {bsFmt(Number(t.precio) || 0)}</p>
                </div>
                <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Costo" autoFocus={i === 0}
                  aria-label={`Costo de ${t.descripcion || `el trabajo ${i + 1}`}`} className="tabular-nums" value={data.costos[i]}
                  onChange={(e) => setData('costos', data.costos.map((c, j) => (j === i ? e.target.value : c)))} />
              </li>
            ))}
          </ul>
        ) : (
          <Field label="Costo del servicio (Bs)" hint="Este servicio es de antes: tiene un solo costo total.">
            <Input type="number" min="0" step="0.01" inputMode="decimal" autoFocus value={data.costo_total}
              onChange={(e) => setData('costo_total', e.target.value)} />
          </Field>
        )}

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-gris-50 p-3 text-center">
          <div><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Cobrado</dt><dd className="text-sm font-bold tabular-nums text-gris-900">{bsFmt(cobrado)}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Costo</dt><dd className="text-sm font-semibold tabular-nums text-gris-600">{completo ? bsFmt(costo) : '—'}</dd></div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Utilidad</dt>
            <dd className={`text-sm font-bold tabular-nums ${!completo ? 'text-gris-400' : utilidad < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {completo ? conSigno(utilidad) : '—'}
            </dd>
          </div>
        </dl>

        {completo && utilidad < 0 && (
          <p className="text-xs font-semibold text-amber-700">Se cobró {bsFmt(Math.abs(utilidad))} menos de lo que costó.</p>
        )}
        {servicio.quien_cargo_el_costo?.name && servicio.costo_cargado_en && (
          <p className="text-xs text-gris-400">
            Último costo cargado por {servicio.quien_cargo_el_costo.name} el {fechaCorta(servicio.costo_cargado_en)}.
          </p>
        )}
        {errorGeneral && <p className="text-xs font-semibold text-rose-600">{errorGeneral}</p>}
      </div>
    </Modal>
  );
}

export default function ServiciosIndex({ servicios = [], filtros = {}, vendedores = [], tecnicos = [], pendientesDeCosto = 0, Layout, prefijo = 'admin', titulo, subtitulo, guia = null }) {
  useAutoRefresh(['servicios']);
  const [toast] = useToast();
  const { errors = {} } = usePage().props;

  const hoy = dayjs().format('YYYY-MM-DD');
  const periodos = [
    { key: 'todo', label: 'Todo', desde: '', hasta: '' },
    { key: 'hoy', label: 'Hoy', desde: hoy, hasta: hoy },
    { key: '7d', label: '7 días', desde: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), hasta: hoy },
    { key: 'mes', label: 'Este mes', desde: dayjs().startOf('month').format('YYYY-MM-DD'), hasta: hoy },
    { key: 'anio', label: 'Este año', desde: dayjs().startOf('year').format('YYYY-MM-DD'), hasta: hoy },
  ];

  const [filtro, setFiltro] = useState({
    desde: filtros.fecha_inicio || '',
    hasta: filtros.fecha_fin || '',
    vendedor: filtros.vendedor_id ? String(filtros.vendedor_id) : '',
    tecnico: filtros.tecnico || '',
    pendientes: ['1', 1, true, 'true'].includes(filtros.pendientes),
  });
  const [cargandoCosto, setCargandoCosto] = useState(null);
  const [texto, setTexto] = useState('');
  const [limite, setLimite] = useState(50);
  const [cargando, setCargando] = useState(false);
  const espera = useRef(null);
  useEffect(() => () => clearTimeout(espera.current), []);

  const aplicar = (f) => {
    clearTimeout(espera.current);
    router.get(route(`${prefijo}.servicios.index`), paramsDe(f), {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onStart: () => setCargando(true),
      onFinish: () => setCargando(false),
    });
  };

  // Cada cambio se aplica solo; en las fechas se espera un momento por si sigue escribiendo
  const cambiar = (cambios, esperar = false) => {
    const f = { ...filtro, ...cambios };
    setFiltro(f);
    setLimite(50);
    clearTimeout(espera.current);
    if (!fechaCompleta(f.desde) || !fechaCompleta(f.hasta) || problemaDe(f)) return;
    if (esperar) espera.current = setTimeout(() => aplicar(f), 450);
    else aplicar(f);
  };

  const problema = problemaDe(filtro) || errors.fecha_fin || errors.fecha_inicio || errors.tecnico || errors.vendedor_id || null;
  const periodoActivo = periodos.find((p) => p.desde === filtro.desde && p.hasta === filtro.hasta)?.key ?? null;

  // Lo que muestra la lista ahora (filtros ya aplicados por el servidor)
  const ini = filtros.fecha_inicio;
  const fin = filtros.fecha_fin;
  const periodoTexto = ini && fin
    ? (ini === fin ? fechaTexto(ini) : `${fechaTexto(ini, ini.slice(0, 4) !== fin.slice(0, 4))} – ${fechaTexto(fin)}`)
    : 'Todas las fechas';
  const soloPendientes = ['1', 1, true, 'true'].includes(filtros.pendientes);
  const hayFiltrosServidor = Boolean((ini && fin) || filtros.vendedor_id || filtros.tecnico || soloPendientes);

  // El costo y la ganancia son del administrador: al vendedor no le llegan desde el servidor
  const conCostos = prefijo === 'admin';

  const filas = useMemo(() => servicios.map((s) => {
    const pendiente = conCostos && Boolean(s.costo_pendiente);
    const costo = Number(s.precio_costo || 0);
    const cobrado = Number(s.precio_venta || 0);
    // Sin costo cargado no hay utilidad que mostrar: no se toma el cobro entero como ganancia
    return { ...s, pendiente, costo, cobrado, ganancia: pendiente ? null : cobrado - costo, trabajos: trabajosDe(s) };
  }), [servicios, conCostos]);

  const q = normalizar(texto.trim());
  const filtrados = useMemo(() => (q
    ? filas.filter((s) => normalizar([
      s.cliente, s.telefono, s.codigo_nota, s.equipo, s.tecnico, s.vendedor?.name, s.notas_adicionales,
      ...s.trabajos.map((t) => t.descripcion),
    ].join(' ')).includes(q))
    : filas), [filas, q]);

  useEffect(() => { setLimite(50); }, [q]);

  const visibles = filtrados.slice(0, limite);
  const conCosto = filtrados.filter((s) => !s.pendiente);
  const sinCostoVisibles = filtrados.length - conCosto.length;
  const totalCosto = conCosto.reduce((a, s) => a + s.costo, 0);
  const totalCobrado = filtrados.reduce((a, s) => a + s.cobrado, 0);
  const cobradoConCosto = conCosto.reduce((a, s) => a + s.cobrado, 0);
  const totalGanancia = cobradoConCosto - totalCosto;
  const margen = cobradoConCosto > 0 ? Math.round((totalGanancia / cobradoConCosto) * 100) : null;
  const clientes = new Set(filtrados.map((s) => normalizar(s.cliente))).size;
  const hayFiltros = Boolean(q) || hayFiltrosServidor;

  const verTodo = () => { setFiltro(SIN_FILTROS); aplicar(SIN_FILTROS); };
  const limpiar = () => {
    setTexto('');
    if (hayFiltrosServidor) verTodo();
    else setFiltro(SIN_FILTROS);
  };

  return (
    <Layout title="Servicios técnicos">
      <Head title="Servicios técnicos" />
      <Toast toast={toast} />
      {cargandoCosto && <ModalCosto servicio={cargandoCosto} onCerrar={() => setCargandoCosto(null)} />}

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title={titulo ?? 'Servicios técnicos'}
          subtitle={subtitulo ?? 'Reparaciones registradas. Filtra por período o técnico y exporta el reporte en PDF.'}
          actions={(
            <>
              {/* Resumen en una hoja del mismo período que está filtrado arriba */}
              <a href={route(`${prefijo}.servicios.exportarResumen`, { fecha_inicio: filtro.desde || undefined, fecha_fin: filtro.hasta || undefined })}
                target="_blank" rel="noopener noreferrer" className={buttonCls('secondary', 'h-11')}
                title="Una hoja con el resumen del período filtrado">
                <FileSpreadsheet className="h-4 w-4" /> Resumen
              </a>
              <Link href={route(`${prefijo}.servicios.create`)} className={buttonCls('primary', 'h-11 px-5')}>
                <Plus className="h-4 w-4" /> Nuevo servicio
              </Link>
            </>
          )}
        />

        {guia}

        {/* Lo que registran los vendedores llega sin costo: hasta cargarlo no se sabe la utilidad */}
        {conCostos && (pendientesDeCosto > 0 || soloPendientes) && (
          <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5 text-sm ${pendientesDeCosto > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`} role="status">
            <AlertTriangle className={`h-5 w-5 shrink-0 ${pendientesDeCosto > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
            <p className="min-w-0 flex-1">
              {pendientesDeCosto > 0 ? (
                <>
                  <span className="font-bold">
                    {pendientesDeCosto === 1 ? 'Falta el costo de 1 servicio técnico.' : `Falta el costo de ${pendientesDeCosto} servicios técnicos.`}
                  </span>{' '}
                  Cárgalo para calcular la utilidad: mientras falte, ese servicio no suma ganancia en los reportes.
                </>
              ) : (
                <span className="font-bold">Todos los servicios tienen su costo cargado.</span>
              )}
            </p>
            <button type="button" onClick={() => cambiar({ pendientes: !soloPendientes })}
              className={buttonCls('secondary', `h-9 px-3 ${pendientesDeCosto > 0 ? 'border-amber-300 text-amber-900 hover:bg-amber-100' : ''}`)}>
              {soloPendientes ? 'Ver todos' : 'Ver cuáles'}
            </button>
          </div>
        )}

        {/* Resumen de lo que se ve */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Hammer} label="Servicios" value={filtrados.length.toLocaleString('es-BO')}
            hint={`${clientes.toLocaleString('es-BO')} ${clientes === 1 ? 'cliente' : 'clientes'} · ${periodoTexto}`} />
          <Stat icon={Wallet} label="Cobrado a clientes" value={bsFmt(totalCobrado)} tone="lila" />
          {conCostos ? (
            <>
              <Stat icon={Wrench} label="Costo de los trabajos" value={bsFmt(totalCosto)} tone="amber" />
              <Stat icon={TrendingUp} label="Ganancia" value={totalGanancia < 0 ? conSigno(totalGanancia) : bsFmt(totalGanancia)} tone="emerald"
                hint={sinCostoVisibles > 0
                  ? `Sin contar ${sinCostoVisibles} ${sinCostoVisibles === 1 ? 'servicio sin costo' : 'servicios sin costo'}`
                  : margen !== null ? `Margen de ${margen} %` : 'Sin cobros en este período'} />
            </>
          ) : (
            <>
              <Stat icon={Wrench} label="Trabajos hechos" value={filtrados.reduce((a, s2) => a + s2.trabajos.length, 0).toLocaleString('es-BO')}
                tone="amber" hint="Sumando todos los servicios del período" />
              <Stat icon={Users} label="Equipos distintos" value={new Set(filtrados.map((s2) => normalizar(s2.equipo))).size.toLocaleString('es-BO')}
                tone="emerald" hint="Modelos que pasaron por el taller" />
            </>
          )}
        </div>

        {/* Búsqueda, filtros, período y exportación */}
        <section className="rounded-2xl border border-gris-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por cliente, código, equipo, trabajo o teléfono"
                aria-label="Buscar servicios"
                className={`${inputCls} h-11 pl-10 pr-10`}
              />
              {texto && (
                <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {tecnicos.length > 0 && (
              <select value={filtro.tecnico} onChange={(e) => cambiar({ tecnico: e.target.value })} aria-label="Técnico"
                className={`${inputCls} h-11 pr-9 lg:w-52`}>
                <option value="">Todos los técnicos</option>
                {tecnicos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {vendedores.length > 0 && (
              <select value={filtro.vendedor} onChange={(e) => cambiar({ vendedor: e.target.value })} aria-label="Registrado por"
                className={`${inputCls} h-11 pr-9 lg:w-56`}>
                <option value="">Registrado por: todos</option>
                {vendedores.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
              </select>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-gris-100 pt-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-gris-400">
                <CalendarRange className="h-4 w-4 text-[color:var(--acento)]" /> Período
              </span>
              {periodos.map((p) => (
                <button key={p.key} type="button" onClick={() => cambiar({ desde: p.desde, hasta: p.hasta })} aria-pressed={periodoActivo === p.key}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${periodoActivo === p.key ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Las fechas y el botón de exportar van juntos: el PDF sale con este mismo período */}
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-gris-200 bg-white transition focus-within:border-[color:var(--acento)] focus-within:ring-4 focus-within:ring-[rgb(var(--acento-rgb)_/_0.15)] sm:flex sm:h-11 sm:items-stretch sm:self-start xl:self-auto">
              <label className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 sm:py-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400">Desde</span>
                <input type="date" value={filtro.desde} max={filtro.hasta || undefined} className={fechaCls}
                  onChange={(e) => {
                    const d = e.target.value;
                    // Al elegir solo el inicio, el período llega hasta hoy
                    cambiar({ desde: d, hasta: filtro.hasta || (d ? (d > hoy ? d : hoy) : '') }, true);
                  }} />
              </label>
              <label className="flex min-w-0 flex-col justify-center gap-0.5 border-l border-gris-200 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 sm:py-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400">Hasta</span>
                <input type="date" value={filtro.hasta} min={filtro.desde || undefined} className={fechaCls}
                  onChange={(e) => cambiar({ hasta: e.target.value }, true)} />
              </label>
              {problema ? (
                <span aria-disabled="true" title={problema}
                  className="col-span-2 flex cursor-not-allowed items-center justify-center gap-2 border-t border-gris-200 bg-gris-100 px-4 py-2.5 text-sm font-semibold text-gris-400 sm:border-l sm:border-t-0 sm:py-0">
                  <Download className="h-4 w-4" /> Exportar PDF
                </span>
              ) : (
                <a href={route(`${prefijo}.servicios.exportarFiltrado`, paramsDe(filtro))} title="Descarga el reporte del período, técnico y registro elegidos"
                  className="col-span-2 flex items-center justify-center gap-2 border-t border-gris-200 bg-[#121214] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D1D21] sm:border-l sm:border-t-0 sm:py-0">
                  <Download className="h-4 w-4" /> Exportar PDF
                  <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{servicios.length}</span>
                </a>
              )}
            </div>
          </div>
          {problema && <p className="mt-2 text-xs font-semibold text-amber-700 xl:text-right" role="status">{problema}</p>}
        </section>

        {/* Listado */}
        <section className="overflow-hidden rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                <Hammer className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Detalle de servicios
              </h2>
              <span className="text-xs font-semibold text-gris-400">
                {periodoTexto}{filtros.tecnico ? ` · ${filtros.tecnico}` : ''}
              </span>
              {cargando && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--acento)]">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgb(var(--acento-rgb)_/_0.25)] border-t-[color:var(--acento)]" /> Actualizando…
                </span>
              )}
            </div>
            {hayFiltros && (
              <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Quitar filtros
              </button>
            )}
          </div>

          <div className={`transition-opacity ${cargando ? 'opacity-60' : ''}`} aria-busy={cargando}>
            {servicios.length === 0 && !hayFiltrosServidor ? (
              <EmptyState icon={Hammer} title="Todavía no hay servicios"
                text="Cuando registres la primera reparación aparecerá aquí con su nota para imprimir."
                action={<Link href={route(`${prefijo}.servicios.create`)} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Registrar un servicio</Link>} />
            ) : servicios.length === 0 ? (
              <EmptyState icon={CalendarRange} title="No hay servicios con estos filtros"
                text="Prueba con otro período o técnico, o mira todos los servicios."
                action={<button type="button" onClick={verTodo} className={buttonCls('secondary')}>Ver todos</button>} />
            ) : filtrados.length === 0 ? (
              <EmptyState icon={Search} title="Sin resultados"
                text={hayFiltrosServidor ? `Nada coincide con «${texto.trim()}» en ${periodoTexto.toLowerCase()}.` : `Nada coincide con «${texto.trim()}».`}
                action={hayFiltrosServidor
                  ? <button type="button" onClick={verTodo} className={buttonCls('secondary')}>Buscar en todas las fechas</button>
                  : <button type="button" onClick={() => setTexto('')} className={buttonCls('secondary')}>Borrar búsqueda</button>} />
            ) : (
              <>
                {/* Escritorio */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1080px] text-[13px]">
                    <thead>
                      <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                        <th className="px-5 py-3">Nota</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Equipo y trabajo</th>
                        <th className="px-4 py-3">Técnico</th>
                        {conCostos && <th className="px-4 py-3 text-right">Costo</th>}
                        <th className="px-4 py-3 text-right">Cobrado</th>
                        {conCostos && <th className="px-4 py-3 text-right">Ganancia</th>}
                        <th className="px-5 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gris-100">
                      {visibles.map((s) => (
                        <tr key={s.id} className="align-top transition-colors hover:bg-gris-50/70">
                          <td className="px-5 py-3">
                            <p className="font-mono text-[13px] font-bold text-[color:var(--acento)]">{s.codigo_nota || '—'}</p>
                            <p className="mt-0.5 whitespace-nowrap text-xs text-gris-400">{fechaCorta(s.fecha)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[190px] truncate font-semibold text-gris-900">{s.cliente}</p>
                            <p className="mt-0.5 text-xs text-gris-400">{s.telefono || 'Sin teléfono'} · por {s.vendedor?.name || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[260px] truncate font-medium text-gris-800">{s.equipo}</p>
                            <p className="mt-0.5 max-w-[260px] truncate text-xs text-gris-500" title={s.trabajos.map((t) => t.descripcion).join(' · ')}>
                              {s.trabajos[0]?.descripcion ?? '—'}
                              {s.trabajos.length > 1 && <span className="text-gris-400"> y {s.trabajos.length - 1} más</span>}
                            </p>
                          </td>
                          <td className="px-4 py-3"><Tecnico nombre={s.tecnico} /></td>
                          {conCostos && (
                            <td className="px-4 py-3 text-right tabular-nums text-gris-500">
                              {s.pendiente ? (
                                <button type="button" onClick={() => setCargandoCosto(s)}
                                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-200">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Cargar costo
                                </button>
                              ) : (
                                <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                                  {bsFmt(s.costo)}
                                  <button type="button" onClick={() => setCargandoCosto(s)} aria-label={`Corregir el costo de ${s.codigo_nota || 'este servicio'}`}
                                    title="Corregir el costo" className="grid h-6 w-6 place-items-center rounded-md text-gris-300 transition-colors hover:bg-gris-100 hover:text-gris-600">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-gris-900">{bsFmt(s.cobrado)}</td>
                          {conCostos && (
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                              {s.pendiente ? (
                                <span className="text-xs font-semibold text-gris-400">Pendiente</span>
                              ) : s.ganancia < 0 ? (
                                <span className="inline-flex flex-col items-end">
                                  <span className="font-bold text-rose-600">{conSigno(s.ganancia)}</span>
                                  <span className="text-[11px] text-gris-400">Bajo el costo</span>
                                </span>
                              ) : (
                                <span className="font-bold text-emerald-700">{conSigno(s.ganancia)}</span>
                              )}
                            </td>
                          )}
                          <td className="px-5 py-3"><Acciones s={s} prefijo={prefijo} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gris-200 bg-gris-50/70 text-[13px]">
                        <td className="px-5 py-3 font-bold text-gris-900" colSpan={4}>
                          Total {hayFiltros ? 'filtrado' : 'general'} · {filtrados.length.toLocaleString('es-BO')} {filtrados.length === 1 ? 'servicio' : 'servicios'}
                        </td>
                        {conCostos && <td className="px-4 py-3 text-right font-semibold tabular-nums text-gris-600">{bsFmt(totalCosto)}</td>}
                        <td className="px-4 py-3 text-right font-extrabold tabular-nums text-gris-900">{bsFmt(totalCobrado)}</td>
                        {conCostos && <td className={`px-4 py-3 text-right font-extrabold tabular-nums ${totalGanancia < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{conSigno(totalGanancia)}</td>}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Celular */}
                <ul className="divide-y divide-gris-100 md:hidden">
                  {visibles.map((s) => (
                    <li key={s.id} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gris-900">{s.cliente}</p>
                          <p className="font-mono text-xs font-bold text-[color:var(--acento)]">
                            {s.codigo_nota || '—'} <span className="font-sans font-normal text-gris-400">· {fechaCorta(s.fecha)}</span>
                          </p>
                        </div>
                        <Tecnico nombre={s.tecnico} />
                      </div>
                      <p className="text-sm text-gris-600">
                        <span className="font-semibold text-gris-900">{s.equipo}</span>
                        {s.trabajos[0] && ` · ${s.trabajos[0].descripcion}`}
                        {s.trabajos.length > 1 && <span className="text-gris-400"> y {s.trabajos.length - 1} más</span>}
                      </p>
                      <div className={`grid gap-2 rounded-xl bg-gris-50 p-3 text-center ${conCostos ? 'grid-cols-3' : 'grid-cols-1'}`}>
                        {conCostos && <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Costo</p><p className="text-sm font-semibold tabular-nums text-gris-600">{s.pendiente ? '—' : bsFmt(s.costo)}</p></div>}
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Cobrado</p><p className="text-sm font-bold tabular-nums text-gris-900">{bsFmt(s.cobrado)}</p></div>
                        {conCostos && <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gris-400">Ganancia</p><p className={`text-sm font-bold tabular-nums ${s.pendiente ? 'text-gris-400' : s.ganancia < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{s.pendiente ? 'Pendiente' : conSigno(s.ganancia)}</p></div>}
                      </div>
                      {conCostos && s.pendiente && (
                        <button type="button" onClick={() => setCargandoCosto(s)} className={buttonCls('secondary', 'h-10 w-full border-amber-300 text-amber-900 hover:bg-amber-50')}>
                          <AlertTriangle className="h-4 w-4" /> Cargar el costo
                        </button>
                      )}
                      <Acciones s={s} prefijo={prefijo} />
                    </li>
                  ))}
                </ul>

                {filtrados.length > limite && (
                  <div className="border-t border-gris-100 px-5 py-3 text-center">
                    <button type="button" onClick={() => setLimite((l) => l + 50)} className={buttonCls('secondary')}>
                      Mostrar 50 más <span className="text-gris-400">({(filtrados.length - limite).toLocaleString('es-BO')} restantes)</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
