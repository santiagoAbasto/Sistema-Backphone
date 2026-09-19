import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  CalendarRange, Download, Landmark, PieChart, Plus, Receipt, Search, TrendingUp, User, Users, Wallet, X, Zap,
} from 'lucide-react';
import { useAutoRefresh } from '@/Hooks/useAutoRefresh';
import { Badge, EmptyState, PageHeader, Toast, bsFmt, buttonCls, inputCls, useToast } from '@/Components/Admin/ui';

const TZ = 'America/La_Paz';

const TIPOS = {
  servicio_basico: { label: 'Servicio básico', tone: 'blue', icon: Zap },
  cuota_bancaria: { label: 'Cuota bancaria', tone: 'violet', icon: Landmark },
  gasto_personal: { label: 'Gasto personal', tone: 'amber', icon: User },
  sueldos: { label: 'Sueldos', tone: 'emerald', icon: Users },
};

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fechaCorta = (iso) => (iso
  ? new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
  : '—');
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '');
// «2026-09-01» → «1 sept 2026», sin desfase por zona horaria
const fechaTexto = (ymd, conAnio = true) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', ...(conAnio && { year: 'numeric' }) });
};
const mayuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Mientras se escribe el año, el campo pasa por fechas como 0002-09-01: solo cuentan las completas
const fechaCompleta = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number(v.slice(0, 4)) >= 2000;
const problemaDe = (r) => {
  if (!r.desde || !r.hasta) return 'Elige las dos fechas del período.';
  if (r.desde > r.hasta) return 'La fecha inicial no puede ser posterior a la final.';
  return null;
};

const fechaCls = 'h-9 w-full min-w-0 border-0 bg-transparent p-0 text-sm text-gris-800 shadow-none focus:outline-none focus:ring-0 sm:w-[128px]';

function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-carbon-900/[0.07] text-carbon-900',
    lila: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="rounded-2xl border border-gris-200 bg-white p-5 shadow-sutil">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 truncate text-[24px] font-bold leading-none tracking-tight text-gris-900">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

function TipoBadge({ tipo }) {
  const t = TIPOS[tipo] ?? { label: mayuscula(String(tipo ?? '').replace(/_/g, ' ')), tone: 'slate', icon: Receipt };
  const Icon = t.icon;
  return <Badge tone={t.tone}><Icon className="h-3 w-3" /> {t.label}</Badge>;
}

function Cuotas({ e }) {
  if (e.tipo_gasto !== 'cuota_bancaria') return <span className="text-gris-300">—</span>;
  const n = e.cuotas_pendientes;
  if (n === null || n === undefined || n === '') return <span className="text-gris-400">Sin dato</span>;
  return <span className="font-semibold text-gris-700">{n} {Number(n) === 1 ? 'pendiente' : 'pendientes'}</span>;
}

export default function Index({ egresos = [], filtros = {} }) {
  useAutoRefresh(['egresos', 'resumen']);
  const [toast] = useToast();
  const { errors = {} } = usePage().props;

  const hoy = dayjs().format('YYYY-MM-DD');
  const pasado = dayjs().subtract(1, 'month');
  const periodos = [
    { key: 'hoy', label: 'Hoy', desde: hoy, hasta: hoy },
    { key: '7d', label: '7 días', desde: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), hasta: hoy },
    { key: 'mes', label: 'Este mes', desde: dayjs().startOf('month').format('YYYY-MM-DD'), hasta: hoy },
    { key: 'pasado', label: 'Mes pasado', desde: pasado.startOf('month').format('YYYY-MM-DD'), hasta: pasado.endOf('month').format('YYYY-MM-DD') },
    { key: 'anio', label: 'Este año', desde: dayjs().startOf('year').format('YYYY-MM-DD'), hasta: hoy },
  ];

  const [rango, setRango] = useState({ desde: filtros.fecha_inicio || '', hasta: filtros.fecha_fin || '' });
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [limite, setLimite] = useState(50);
  const [cargando, setCargando] = useState(false);
  const espera = useRef(null);
  useEffect(() => () => clearTimeout(espera.current), []);

  const aplicar = (r) => {
    clearTimeout(espera.current);
    router.get(route('admin.egresos.index'), { fecha_inicio: r.desde, fecha_fin: r.hasta }, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onStart: () => setCargando(true),
      onFinish: () => setCargando(false),
    });
  };

  // Cada cambio se aplica solo; en las fechas se espera un momento por si sigue escribiendo
  const cambiarRango = (cambios, esperar = false) => {
    const r = { ...rango, ...cambios };
    setRango(r);
    setLimite(50);
    clearTimeout(espera.current);
    if (!fechaCompleta(r.desde) || !fechaCompleta(r.hasta) || problemaDe(r)) return;
    if (esperar) espera.current = setTimeout(() => aplicar(r), 450);
    else aplicar(r);
  };

  const problema = problemaDe(rango) || errors.fecha_fin || errors.fecha_inicio || null;
  const exportable = !problema && fechaCompleta(rango.desde) && fechaCompleta(rango.hasta);
  const periodoActivo = periodos.find((p) => p.desde === rango.desde && p.hasta === rango.hasta)?.key ?? null;

  // Lo que muestra la lista ahora (período ya aplicado por el servidor)
  const ini = filtros.fecha_inicio;
  const fin = filtros.fecha_fin;
  const periodoTexto = ini && fin
    ? (ini === fin ? fechaTexto(ini) : `${fechaTexto(ini, ini.slice(0, 4) !== fin.slice(0, 4))} – ${fechaTexto(fin)}`)
    : 'Este mes';

  const filas = useMemo(() => egresos.map((e) => ({ ...e, monto: Number(e.precio_invertido || 0) })), [egresos]);
  const conteo = useMemo(() => filas.reduce((acc, e) => ({ ...acc, [e.tipo_gasto]: (acc[e.tipo_gasto] || 0) + 1 }), {}), [filas]);

  const q = normalizar(texto.trim());
  const filtrados = useMemo(() => filas.filter((e) =>
    (tipo === 'todos' || e.tipo_gasto === tipo)
    && (!q || normalizar([e.concepto, e.comentario, e.frecuencia, e.user?.name, TIPOS[e.tipo_gasto]?.label].join(' ')).includes(q)),
  ), [filas, tipo, q]);

  useEffect(() => { setLimite(50); }, [q, tipo]);

  const visibles = filtrados.slice(0, limite);
  const total = filtrados.reduce((a, e) => a + e.monto, 0);
  const promedio = filtrados.length ? total / filtrados.length : 0;
  const mayor = filtrados.reduce((m, e) => (!m || e.monto > m.monto ? e : m), null);
  const porTipo = filtrados.reduce((acc, e) => ({ ...acc, [e.tipo_gasto]: (acc[e.tipo_gasto] || 0) + e.monto }), {});
  const principal = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0] ?? null;
  const hayFiltros = Boolean(q) || tipo !== 'todos';
  const limpiar = () => { setTexto(''); setTipo('todos'); };

  const exportarHref = exportable
    ? route('admin.egresos.exportar-pdf', {
      fecha_inicio: rango.desde,
      fecha_fin: rango.hasta,
      ...(tipo !== 'todos' ? { tipo_gasto: tipo } : {}),
    })
    : null;

  return (
    <AdminLayout>
      <Head title="Egresos" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Egresos"
          subtitle="Gastos del negocio: servicios básicos, cuotas bancarias, sueldos y gastos personales. Se restan de la utilidad disponible del resumen."
          actions={
            <Link href={route('admin.egresos.create')} className={buttonCls('primary', 'h-11 px-5')}>
              <Plus className="h-4 w-4" /> Nuevo egreso
            </Link>
          }
        />

        {/* Resumen de lo que se ve */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Wallet} label="Total gastado" value={bsFmt(total)} tone="rose"
            hint={`${filtrados.length.toLocaleString('es-BO')} ${filtrados.length === 1 ? 'egreso' : 'egresos'} · ${periodoTexto}`} />
          <Stat icon={Receipt} label="Promedio por egreso" value={bsFmt(promedio)} tone="lila" />
          <Stat icon={TrendingUp} label="Mayor gasto" value={bsFmt(mayor ? mayor.monto : 0)} tone="amber"
            hint={mayor ? mayor.concepto : 'Sin egresos en este período'} />
          <Stat icon={PieChart} label="Donde más se gasta" value={principal ? (TIPOS[principal[0]]?.label ?? principal[0]) : '—'}
            hint={principal && total > 0 ? `${bsFmt(principal[1])} · ${Math.round((principal[1] / total) * 100)} % del total` : 'Sin egresos en este período'} />
        </div>

        {/* Búsqueda, tipo, período y exportación */}
        <section className="rounded-2xl border border-gris-200 bg-white p-4 shadow-sutil">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar egresos"
              placeholder="Buscar por concepto, comentario, frecuencia o quién lo registró"
              className={`${inputCls} h-11 pl-10 pr-10`} />
            {texto && (
              <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Tipo de gasto">
            {[['todos', 'Todos', filas.length], ...Object.entries(TIPOS).map(([k, t]) => [k, t.label, conteo[k] || 0])].map(([k, label, n]) => (
              <button key={k} type="button" onClick={() => setTipo(k)} aria-pressed={tipo === k}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${tipo === k ? 'bg-carbon-900 text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                {label} <span className={tipo === k ? 'text-white/70' : 'text-gris-400'}>{n}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-gris-100 pt-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-gris-400">
                <CalendarRange className="h-4 w-4 text-[color:var(--acento)]" /> Período
              </span>
              {periodos.map((p) => (
                <button key={p.key} type="button" onClick={() => cambiarRango({ desde: p.desde, hasta: p.hasta })} aria-pressed={periodoActivo === p.key}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${periodoActivo === p.key ? 'bg-carbon-900 text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Las fechas y el botón de exportar van juntos: el PDF sale con este mismo período */}
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-gris-200 bg-white transition focus-within:border-[color:var(--acento)] focus-within:ring-4 focus-within:ring-[#96684F]/15 sm:flex sm:h-11 sm:items-stretch sm:self-start xl:self-auto">
              <label className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 sm:py-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400">Desde</span>
                <input type="date" value={rango.desde} max={rango.hasta || undefined} className={fechaCls}
                  onChange={(e) => cambiarRango({ desde: e.target.value }, true)} />
              </label>
              <label className="flex min-w-0 flex-col justify-center gap-0.5 border-l border-gris-200 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 sm:py-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400">Hasta</span>
                <input type="date" value={rango.hasta} min={rango.desde || undefined} className={fechaCls}
                  onChange={(e) => cambiarRango({ hasta: e.target.value }, true)} />
              </label>
              {exportarHref ? (
                <a href={exportarHref} target="_blank" rel="noopener noreferrer"
                  title={tipo !== 'todos' ? `Reporte del período, solo ${TIPOS[tipo].label.toLowerCase()}` : 'Reporte de todos los egresos del período'}
                  className="col-span-2 flex items-center justify-center gap-2 border-t border-gris-200 bg-carbon-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-carbon-800 sm:border-l sm:border-t-0 sm:py-0">
                  <Download className="h-4 w-4" /> Exportar PDF
                  {tipo !== 'todos' && <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-bold">{TIPOS[tipo].label}</span>}
                </a>
              ) : (
                <span aria-disabled="true" title={problema || 'Completa las fechas'}
                  className="col-span-2 flex cursor-not-allowed items-center justify-center gap-2 border-t border-gris-200 bg-gris-100 px-4 py-2.5 text-sm font-semibold text-gris-400 sm:border-l sm:border-t-0 sm:py-0">
                  <Download className="h-4 w-4" /> Exportar PDF
                </span>
              )}
            </div>
          </div>
          {problema && <p className="mt-2 text-xs font-semibold text-amber-700 xl:text-right" role="status">{problema}</p>}
        </section>

        {/* Listado */}
        <section className="overflow-hidden rounded-2xl border border-gris-200 bg-white shadow-sutil">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                <Wallet className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Detalle de egresos
              </h2>
              <span className="text-xs font-semibold text-gris-400">{periodoTexto}</span>
              {cargando && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--acento)]">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--acento)]/25 border-t-[#96684F]" /> Actualizando…
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
            {egresos.length === 0 ? (
              <EmptyState icon={Wallet} title="No hay egresos en este período"
                text={`Nada registrado del ${periodoTexto.toLowerCase()}. Registra un gasto o elige otro período.`}
                action={<Link href={route('admin.egresos.create')} className={buttonCls('primary')}><Plus className="h-4 w-4" /> Registrar un egreso</Link>} />
            ) : filtrados.length === 0 ? (
              <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro concepto o quita los filtros."
                action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
            ) : (
              <>
                {/* Escritorio */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[980px] text-[13px]">
                    <thead>
                      <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                        <th className="px-5 py-3">Fecha</th>
                        <th className="px-4 py-3">Concepto</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Frecuencia</th>
                        <th className="px-4 py-3">Cuotas</th>
                        <th className="px-4 py-3">Registrado por</th>
                        <th className="px-5 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gris-100">
                      {visibles.map((e) => (
                        <tr key={e.id} className="align-top transition-colors hover:bg-gris-50/70">
                          <td className="px-5 py-3">
                            <p className="whitespace-nowrap font-semibold text-gris-800">{fechaCorta(e.created_at)}</p>
                            <p className="mt-0.5 text-xs text-gris-400">{hora(e.created_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[280px] truncate font-semibold text-gris-900">{e.concepto}</p>
                            {e.comentario && <p className="mt-0.5 max-w-[280px] truncate text-xs text-gris-500" title={e.comentario}>{e.comentario}</p>}
                          </td>
                          <td className="px-4 py-3"><TipoBadge tipo={e.tipo_gasto} /></td>
                          <td className="px-4 py-3 text-gris-600">{mayuscula(e.frecuencia) || <span className="text-gris-300">—</span>}</td>
                          <td className="px-4 py-3"><Cuotas e={e} /></td>
                          <td className="px-4 py-3 text-gris-600">{e.user?.name || '—'}</td>
                          <td className="px-5 py-3 text-right font-bold tabular-nums text-gris-900">{bsFmt(e.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gris-200 bg-gris-50/70 text-[13px]">
                        <td className="px-5 py-3 font-bold text-gris-900" colSpan={6}>
                          Total {hayFiltros ? 'filtrado' : 'del período'} · {filtrados.length.toLocaleString('es-BO')} {filtrados.length === 1 ? 'egreso' : 'egresos'}
                        </td>
                        <td className="px-5 py-3 text-right font-bold tabular-nums text-rose-600">{bsFmt(total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Celular */}
                <ul className="divide-y divide-gris-100 md:hidden">
                  {visibles.map((e) => (
                    <li key={e.id} className="space-y-2.5 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gris-900">{e.concepto}</p>
                          <p className="text-xs text-gris-400">{fechaCorta(e.created_at)} · {hora(e.created_at)} · {e.user?.name || '—'}</p>
                        </div>
                        <p className="shrink-0 text-base font-bold tabular-nums text-gris-900">{bsFmt(e.monto)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gris-500">
                        <TipoBadge tipo={e.tipo_gasto} />
                        {e.frecuencia && <span>{mayuscula(e.frecuencia)}</span>}
                        {e.tipo_gasto === 'cuota_bancaria' && <span>· <Cuotas e={e} /></span>}
                      </div>
                      {e.comentario && <p className="text-xs text-gris-500">{e.comentario}</p>}
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
    </AdminLayout>
  );
}
