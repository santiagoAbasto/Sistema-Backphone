import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { route } from 'ziggy-js';
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileDown, History, Search, X } from 'lucide-react';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Card, EmptyState, Input, Switch, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';
import { EncabezadoFormulario, fmtFecha } from '@/Components/Admin/inventario';
import { TIPOS, detalleProducto, nombreProducto, tipoTexto } from '@/Components/Admin/productos-generales';

// El conteo físico de los productos generales.
//
// Cada renglón guarda, junto a lo contado, cuánto decía el sistema en ese momento: si mientras se
// cuenta se vende algo, el servidor no ajusta ese producto con un número viejo y avisa. Lo escrito
// se guarda también en este navegador, para no perder una hora de conteo si se recarga la página.

const BORRADOR = 'conteo-productos-generales';
const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function leerBorrador() {
  try { return JSON.parse(window.localStorage.getItem(BORRADOR) || '{}') || {}; } catch { return {}; }
}

function guardarBorrador(valores) {
  try {
    if (Object.keys(valores).length === 0) window.localStorage.removeItem(BORRADOR);
    else window.localStorage.setItem(BORRADOR, JSON.stringify(valores));
  } catch { /* sin almacenamiento: el conteo sigue, solo que no sobrevive a una recarga */ }
}

function Diferencia({ n }) {
  if (n === null) return <span className="text-gris-300">—</span>;
  if (n === 0) return <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Coincide</span>;
  return (
    <span className={`text-[13px] font-bold tabular-nums ${n < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
      {n < 0 ? `Faltan ${Math.abs(n)}` : `Sobran ${n}`}
    </span>
  );
}

export default function Conteo({ productos = [], ultimos = [] }) {
  const { flash } = usePage().props;
  // { [id]: { contado: '12', esperado: 15 } }: lo escrito y cuánto decía el sistema al escribirlo
  const [valores, setValores] = useState(() => {
    const borrador = leerBorrador();
    const actuales = new Map(productos.map((p) => [String(p.id), Number(p.cantidad) || 0]));
    // Lo que se movió desde que se contó no se recupera: hay que volver a contarlo
    return Object.fromEntries(Object.entries(borrador).filter(([id, v]) => actuales.get(id) === v?.esperado));
  });
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [conAgotados, setConAgotados] = useState(false);
  const [soloDiferencias, setSoloDiferencias] = useState(false);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const entradas = useRef([]);

  useEffect(() => { guardarBorrador(valores); }, [valores]);

  const hayConteo = Object.keys(valores).length > 0;

  // Salir con un conteo a medio guardar se pregunta: dentro del panel y al cerrar la pestaña
  useEffect(() => {
    if (!hayConteo) return undefined;
    const alCerrar = (e) => { e.preventDefault(); e.returnValue = ''; };
    const quitar = router.on('before', (e) => {
      if (guardandoRef.current || e.detail.visit.method !== 'get') return;
      if (!window.confirm('Tienes un conteo sin guardar. Queda guardado en este navegador, pero ¿quieres salir igual?')) e.preventDefault();
    });
    window.addEventListener('beforeunload', alCerrar);
    return () => { window.removeEventListener('beforeunload', alCerrar); quitar(); };
  }, [hayConteo]);

  const filas = useMemo(() => productos.map((p) => {
    const sistema = Number(p.cantidad) || 0;
    const v = valores[p.id];
    const contado = v && v.contado !== '' ? Number(v.contado) : null;
    return {
      ...p,
      nombre: nombreProducto(p),
      detalle: [tipoTexto(p.tipo), detalleProducto(p)].filter(Boolean).join(' · '),
      sistema,
      contado,
      diferencia: contado === null ? null : contado - sistema,
      busqueda: normalizar([p.codigo, p.nombre, p.modelo, p.calidad, tipoTexto(p.tipo)].join(' ')),
    };
  }), [productos, valores]);

  const tipos = useMemo(() => TIPOS.filter((t) => productos.some((p) => p.tipo === t.value)), [productos]);
  const q = normalizar(texto.trim());

  const visibles = filas.filter((f) => (conAgotados || f.sistema > 0 || f.contado !== null)
    && (tipo === 'todos' || f.tipo === tipo)
    && (!soloDiferencias || (f.diferencia !== null && f.diferencia !== 0))
    && (!q || f.busqueda.includes(q)));

  const resumen = useMemo(() => {
    const contados = filas.filter((f) => f.contado !== null);
    const faltantes = contados.filter((f) => f.diferencia < 0);
    return {
      total: filas.filter((f) => f.sistema > 0).length,
      contados: contados.length,
      coinciden: contados.filter((f) => f.diferencia === 0).length,
      faltan: faltantes.reduce((s, f) => s - f.diferencia, 0),
      sobran: contados.filter((f) => f.diferencia > 0).reduce((s, f) => s + f.diferencia, 0),
      // Lo que falta, a lo que costó: es la plata que no aparece
      perdida: faltantes.reduce((s, f) => s - f.diferencia * (Number(f.precio_costo) || 0), 0),
    };
  }, [filas]);

  const cambiar = (p, valor) => {
    const limpio = valor.replace(/[^\d]/g, '');
    setValores((v) => {
      const siguiente = { ...v };
      if (limpio === '') delete siguiente[p.id];
      else siguiente[p.id] = { contado: limpio, esperado: p.sistema };
      return siguiente;
    });
  };

  // Enter pasa al siguiente: se cuenta con una mano en el teclado
  const siguiente = (indice) => (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    entradas.current[indice + 1]?.focus();
  };

  const guardar = () => {
    if (guardando || !hayConteo) return;
    const conteos = Object.entries(valores).map(([id, v]) => ({ id: Number(id), contado: Number(v.contado), esperado: v.esperado }));
    router.post(route('admin.productos-generales.conteo.guardar'), { conteos, nota: nota.trim() }, {
      preserveScroll: true,
      onStart: () => { guardandoRef.current = true; setGuardando(true); },
      onSuccess: () => { setValores({}); setNota(''); notifyRecordsUpdated(); },
      onFinish: () => { guardandoRef.current = false; setGuardando(false); },
    });
  };

  const limpiar = () => { setTexto(''); setTipo('todos'); setSoloDiferencias(false); };
  const hayFiltros = Boolean(q) || tipo !== 'todos' || soloDiferencias;

  return (
    <AdminLayout>
      <Head title="Contar productos generales" />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
            <EncabezadoFormulario volverUrl={route('admin.productos-generales.index')} volverLabel="Volver a productos generales"
              titulo="Contar inventario" subtitulo="Escribe cuántas unidades contaste de cada producto. Lo que dejes vacío no se toca." />
          </div>
          <a href={route('admin.exportar.productos-generales')} target="_blank" rel="noopener noreferrer" className={buttonCls('secondary', 'h-11 px-4')}>
            <FileDown className="h-4 w-4" /> Planilla para imprimir
          </a>
        </div>

        {flash?.success && (
          <p className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> <span>{flash.success}</span>
          </p>
        )}
        {flash?.error && (
          <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> <span>{flash.error}</span>
          </p>
        )}

        <section className="rounded-2xl border border-gris-200 bg-white p-4 shadow-sutil">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar en el conteo"
                placeholder="Buscar por código, nombre, modelo o calidad" className={`${inputCls} h-11 pl-10 pr-10`} />
              {texto && (
                <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" className={`${inputCls} h-11 pr-9 lg:w-56`}>
              <option value="todos">Todos los tipos</option>
              {tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-gris-600">
            <label className="flex items-center gap-2">
              <Switch checked={soloDiferencias} onChange={setSoloDiferencias} label="Solo con diferencia" /> Solo con diferencia
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={conAgotados} onChange={setConAgotados} label="Mostrar agotados" /> Mostrar los agotados (por si aparece alguno)
            </label>
            {hayFiltros && (
              <button type="button" onClick={limpiar} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                <X className="h-3.5 w-3.5" /> Quitar filtros
              </button>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gris-200 bg-white shadow-sutil">
          {productos.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No hay productos para contar" text="Cuando cargues productos generales van a aparecer acá." />
          ) : visibles.length === 0 ? (
            <EmptyState icon={Search} title="Sin resultados" text="Prueba con otro nombre, o quita los filtros."
              action={<button type="button" onClick={limpiar} className={buttonCls('secondary')}>Quitar filtros</button>} />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                  <th className="px-4 py-3 sm:px-5">Producto</th>
                  <th className="hidden px-3 py-3 md:table-cell">Código</th>
                  <th className="px-3 py-3 text-right">Sistema</th>
                  <th className="w-24 px-3 py-3 text-right sm:w-32">Contaste</th>
                  <th className="hidden py-3 pl-3 pr-5 text-right sm:table-cell">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gris-100">
                {visibles.map((f, i) => (
                  <tr key={f.id} className={f.diferencia ? (f.diferencia < 0 ? 'bg-rose-50/50' : 'bg-amber-50/50') : ''}>
                    <td className="px-4 py-2.5 sm:px-5">
                      <p className="font-semibold text-gris-900">{f.nombre}</p>
                      <p className="text-xs text-gris-500">{f.detalle}</p>
                      <div className="sm:hidden"><Diferencia n={f.diferencia} /></div>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell"><span className="cifra text-xs text-gris-700">{f.codigo}</span></td>
                    <td className="px-3 py-2.5 text-right text-[15px] font-bold tabular-nums text-gris-900">{f.sistema.toLocaleString('es-BO')}</td>
                    <td className="px-3 py-2.5">
                      <Input ref={(el) => { entradas.current[i] = el; }} type="text" inputMode="numeric" autoComplete="off"
                        aria-label={`Unidades contadas de ${f.nombre} ${f.detalle}`} placeholder="—"
                        className="h-10 text-right text-base font-bold tabular-nums"
                        value={valores[f.id]?.contado ?? ''} onChange={(e) => cambiar(f, e.target.value)} onKeyDown={siguiente(i)} />
                    </td>
                    <td className="hidden py-2.5 pl-3 pr-5 text-right sm:table-cell"><Diferencia n={f.diferencia} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Lo que se va a guardar, siempre a la vista */}
        <div className="sticky bottom-4 z-30">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-gris-200 bg-white/95 px-5 py-3 shadow-[0_18px_40px_-18px_rgba(10,10,11,0.45)] backdrop-blur">
            <p className="text-[13px] text-gris-600">
              <span className="font-bold text-gris-900">{resumen.contados}</span> de {resumen.total} contados
              {resumen.contados > 0 && (
                <>
                  {' · '}<span className="font-semibold text-emerald-700">{resumen.coinciden} {resumen.coinciden === 1 ? 'coincide' : 'coinciden'}</span>
                  {resumen.faltan > 0 && <>{' · '}<span className="font-semibold text-rose-600">faltan {resumen.faltan} ({bsFmt(resumen.perdida)} al costo)</span></>}
                  {resumen.sobran > 0 && <>{' · '}<span className="font-semibold text-amber-700">sobran {resumen.sobran}</span></>}
                </>
              )}
            </p>
            <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
              <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} aria-label="Nota del conteo"
                placeholder="Nota (opcional): conteo de fin de mes" className={`${inputCls} h-11 w-full sm:w-72`} />
              {hayConteo && (
                <button type="button" onClick={() => setValores({})} className={buttonCls('ghost', 'h-11 px-3')}>Borrar lo escrito</button>
              )}
              <button type="button" onClick={guardar} disabled={guardando || !hayConteo} className={buttonCls('primary', 'h-11 px-5')}>
                <ClipboardCheck className="h-4 w-4" /> {guardando ? 'Guardando…' : 'Guardar conteo'}
              </button>
            </div>
          </div>
        </div>

        <Card title="Últimos ajustes" subtitle="Lo que se corrigió por conteo o ajuste, con quién lo hizo. El detalle completo está en el historial de cada producto."
          actions={<History className="h-[18px] w-[18px] text-gris-400" />}>
          {ultimos.length === 0 ? (
            <p className="rounded-xl bg-gris-50 px-4 py-3 text-[13px] text-gris-500">Todavía no hubo ajustes de inventario.</p>
          ) : (
            <ul className="divide-y divide-gris-100">
              {ultimos.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-gris-900">{m.producto}</p>
                    <p className="mt-0.5 truncate text-xs text-gris-500">{[m.codigo, m.motivo, m.quien, fmtFecha(m.fecha)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[13px] font-bold tabular-nums ${m.cantidad >= 0 ? 'text-amber-700' : 'text-rose-600'}`}>
                      {m.cantidad >= 0 ? `Sobraron ${m.cantidad}` : `Faltaron ${Math.abs(m.cantidad)}`}
                    </p>
                    <p className="text-[11px] text-gris-400">quedaron {m.saldo}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

    </AdminLayout>
  );
}
