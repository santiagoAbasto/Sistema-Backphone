import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Download, Eye, History, PackagePlus, PackageSearch, Play, ScanLine,
  Search, ShieldCheck, ShoppingCart, X, XCircle,
} from 'lucide-react';
import { Badge, EmptyState, Modal, PageHeader, Paginador, Toast, buttonCls, fmtDate, inputCls, useToast } from '@/Components/Admin/ui';
import { ChipsEstado, Stat, bonito, paginar } from '@/Components/Admin/inventario';

// Auditoría física: al iniciar se guarda una foto del inventario disponible y luego se escanea unidad por unidad.

const CATEGORIAS = {
  celulares: 'Celulares',
  computadoras: 'Computadoras',
  productos_apple: 'Equipos de marca',
  productos_generales: 'Productos generales',
};

const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** En qué situación está cada producto de la auditoría. */
function situacion(item, cerrada) {
  if (item.post_start) return 'ingreso';
  if (item.scanned) return 'encontrado';
  if (item.resolution === 'sold_after_audit') return 'vendido';
  return cerrada ? 'faltante' : 'pendiente';
}

const SITUACIONES = {
  encontrado: { label: 'Encontrado', tone: 'emerald', icon: CheckCircle2 },
  pendiente: { label: 'Por escanear', tone: 'slate', icon: ScanLine },
  faltante: { label: 'Faltante', tone: 'rose', icon: AlertTriangle },
  vendido: { label: 'Vendido durante la auditoría', tone: 'amber', icon: ShoppingCart },
  ingreso: { label: 'Ingreso posterior', tone: 'blue', icon: PackagePlus },
};

function SituacionBadge({ valor }) {
  const s = SITUACIONES[valor];
  const Icon = s.icon;
  return <Badge tone={s.tone}><Icon className="h-3 w-3" /> {s.label}</Badge>;
}

const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '');

export default function Index({ audit: auditInicial, history = [] }) {
  const [audit, setAudit] = useState(auditInicial);
  const [toast] = useToast();
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [filtro, setFiltro] = useState(auditInicial?.status === 'closed' ? 'faltante' : 'encontrado');
  const [categoria, setCategoria] = useState('todas');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const inputRef = useRef(null);
  const tablaRef = useRef(null);

  useEffect(() => setAudit(auditInicial), [auditInicial]);
  const abierta = audit?.status === 'open';
  const cerrada = audit?.status === 'closed';

  useEffect(() => {
    if (abierta) inputRef.current?.focus();
  }, [audit?.id, abierta]);

  const filas = useMemo(() => (audit?.items ?? []).map((item) => ({
    ...item,
    situacion: situacion(item, cerrada),
    busqueda: normalizar([item.name, item.primary_code, item.secondary_code, item.tertiary_code, ...(item.details ?? [])].join(' ')),
  })), [audit, cerrada]);

  const conteo = useMemo(() => {
    const n = { todos: 0, encontrado: 0, pendiente: 0, faltante: 0, vendido: 0, ingreso: 0 };
    filas.forEach((f) => {
      if (categoria !== 'todas' && f.category !== categoria) return;
      n[f.situacion] += 1;
      n.todos += 1;
    });
    return n;
  }, [filas, categoria]);

  const q = normalizar(texto.trim());
  const filtrados = useMemo(() => {
    const lista = filas.filter((f) => (filtro === 'todos' || f.situacion === filtro)
      && (categoria === 'todas' || f.category === categoria)
      && (!q || f.busqueda.includes(q)));
    // Lo último escaneado primero; lo demás por categoría y nombre
    return lista.sort((a, b) => (b.scanned_at ?? '').localeCompare(a.scanned_at ?? '')
      || a.category.localeCompare(b.category) || (a.name ?? '').localeCompare(b.name ?? '', 'es', { numeric: true }));
  }, [filas, filtro, categoria, q]);

  useEffect(() => { setPagina(1); }, [filtro, categoria, q, porPagina]);

  const { visibles, meta } = paginar(filtrados, pagina, porPagina);
  const irAPagina = (n) => {
    setPagina(n);
    tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const escanear = async (e) => {
    e.preventDefault();
    const valor = codigo.trim();
    if (!valor || escaneando || !abierta) return;

    setEscaneando(true);
    try {
      const { data } = await axios.post(route('admin.inventory-audits.scan', audit.id), { code: valor });
      setAudit(data.audit);
      setAviso({ tipo: 'exito', mensaje: data.message, item: data.item });
      setFiltro(data.post_start ? 'ingreso' : 'encontrado');
    } catch (error) {
      const data = error.response?.data;
      setAviso({
        tipo: data?.duplicate || data?.ambiguous ? 'alerta' : 'error',
        mensaje: data?.message || 'No se pudo procesar el código. Intenta nuevamente.',
        item: data?.item,
      });
    } finally {
      setCodigo('');
      setEscaneando(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const ejecutar = () => {
    if (procesando) return;
    const url = confirmar === 'cerrar' ? route('admin.inventory-audits.close', audit.id) : route('admin.inventory-audits.store');
    router.post(url, {}, {
      preserveScroll: true,
      onStart: () => setProcesando(true),
      onSuccess: () => {
        setAviso(null);
        setFiltro(confirmar === 'cerrar' ? 'faltante' : 'encontrado');
        setConfirmar(null);
      },
      onFinish: () => setProcesando(false),
    });
  };

  const progreso = audit?.expected > 0 ? Math.round((audit.scanned / audit.expected) * 100) : 100;
  const hayFiltros = Boolean(q) || categoria !== 'todas';

  const FILTROS = [
    { key: 'encontrado', label: 'Encontrados' },
    abierta ? { key: 'pendiente', label: 'Por escanear' } : { key: 'faltante', label: 'Faltantes', alerta: true },
    { key: 'vendido', label: 'Vendidos durante la auditoría', ocultarSinDatos: true },
    { key: 'ingreso', label: 'Ingresos posteriores', ocultarSinDatos: true },
    { key: 'todos', label: 'Todos' },
  ].filter((f) => !f.ocultarSinDatos || conteo[f.key] > 0 || filtro === f.key);

  const acciones = !audit ? null : abierta ? (
    <button type="button" onClick={() => setConfirmar('cerrar')} className={buttonCls('danger', 'h-11 px-4')}>
      <ShieldCheck className="h-4 w-4" /> Finalizar auditoría
    </button>
  ) : (
    <>
      <a href={route('admin.inventory-audits.pdf', audit.id)} target="_blank" rel="noopener noreferrer" className={buttonCls('secondary', 'h-11 px-4')}>
        <Eye className="h-4 w-4" /> Ver informe PDF
      </a>
      <a href={route('admin.inventory-audits.pdf', { inventoryAudit: audit.id, download: 1 })} className={buttonCls('secondary', 'h-11 px-4')}>
        <Download className="h-4 w-4" /> Descargar
      </a>
      <button type="button" onClick={() => setConfirmar('iniciar')} className={buttonCls('primary', 'h-11 px-5')}>
        <Play className="h-4 w-4" /> Nueva auditoría
      </button>
    </>
  );

  return (
    <AdminLayout>
      <Head title="Auditoría de inventario" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Auditoría de inventario"
          subtitle="Conteo físico: al iniciar se guarda una foto de todo lo disponible y luego escaneas cada unidad. No modifica el inventario."
          actions={acciones}
        />

        {!audit ? (
          <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
            <EmptyState icon={ClipboardCheck} title="Todavía no hay auditorías"
              text="Inicia el conteo para guardar la lista de celulares, computadoras, equipos de marca y accesorios disponibles."
              action={<button type="button" onClick={() => setConfirmar('iniciar')} className={buttonCls('primary')}><Play className="h-4 w-4" /> Iniciar auditoría</button>} />
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat icon={ClipboardCheck} label="Esperados" value={audit.expected.toLocaleString('es-BO')}
                hint={`Auditoría #${audit.id} · ${audit.started_by || 'Usuario'}`} />
              <Stat icon={CheckCircle2} label="Encontrados" value={audit.scanned.toLocaleString('es-BO')} tone="emerald"
                hint={`${progreso} % del conteo`} />
              <Stat icon={AlertTriangle} label={cerrada ? 'Faltantes' : 'Por escanear'} value={audit.missing.toLocaleString('es-BO')} tone="lila"
                hint={audit.sold_after_audit > 0 ? `Aparte, ${audit.sold_after_audit} vendidos durante la auditoría` : 'Sin ventas durante la auditoría'} />
              <Stat icon={PackagePlus} label="Ingresos posteriores" value={(audit.received_after_start || 0).toLocaleString('es-BO')} tone="slate"
                hint="No cuentan para el conteo inicial" />
            </div>

            {abierta ? (
              <section className="rounded-2xl bg-carbon-900 p-5 text-white shadow-[0_18px_40px_-24px_rgba(10, 10, 11,0.8)] sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0 lg:max-w-sm">
                    <h2 className="flex items-center gap-2 text-lg font-bold"><ScanLine className="h-5 w-5" /> Escanear producto</h2>
                    <p className="mt-1 text-sm text-white/70">IMEI, número de serie o código. Con el lector, cada lectura se confirma sola.</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                      <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${progreso}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs tabular-nums text-white/60">{audit.scanned.toLocaleString('es-BO')} de {audit.expected.toLocaleString('es-BO')} · {progreso} %</p>
                  </div>
                  <form onSubmit={escanear} className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
                    <label htmlFor="codigo-auditoria" className="sr-only">Código del producto</label>
                    <input ref={inputRef} id="codigo-auditoria" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off"
                      placeholder="Escanea o escribe el código"
                      className="h-12 flex-1 rounded-xl border-0 bg-white px-4 cifra text-base text-gris-900 placeholder:font-sans placeholder:text-gris-400 focus:outline-none focus:ring-4 focus:ring-white/30" />
                    <button type="submit" disabled={!codigo.trim() || escaneando}
                      className="h-12 rounded-xl bg-emerald-500 px-6 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/20">
                      {escaneando ? 'Verificando…' : 'Confirmar'}
                    </button>
                  </form>
                </div>
              </section>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gris-200 bg-white px-5 py-3.5 text-sm text-gris-700">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <p className="flex-1">
                  <span className="font-bold">Auditoría finalizada</span>
                  {audit.closed_at && ` el ${fmtDate(audit.closed_at)}`}{audit.closed_by && ` por ${audit.closed_by}`}.
                  {' '}El resultado quedó guardado; el informe PDF incluye la pérdida estimada de los faltantes.
                </p>
              </div>
            )}

            {aviso && <AvisoEscaneo aviso={aviso} onCerrar={() => setAviso(null)} />}

            {/* Búsqueda y filtros */}
            <section className="rounded-2xl border border-gris-200 bg-white p-4 shadow-sutil">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
                  <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar en la auditoría"
                    placeholder="Buscar por nombre, código, IMEI o serie" className={`${inputCls} h-11 pl-10 pr-10`} />
                  {texto && (
                    <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda"
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" className={`${inputCls} h-11 pr-9 lg:w-56`}>
                  <option value="todas">Todas las categorías</option>
                  {Object.entries(CATEGORIAS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
              <ChipsEstado filtros={FILTROS} activo={filtro} conteo={conteo} onChange={setFiltro} />
            </section>

            {/* Resultado */}
            <section ref={tablaRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-gris-200 bg-white shadow-sutil">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <PackageSearch className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resultado del conteo
                </h2>
                {hayFiltros && (
                  <button type="button" onClick={() => { setTexto(''); setCategoria('todas'); }} className={buttonCls('ghost', 'h-8 px-2.5 text-xs')}>
                    <X className="h-3.5 w-3.5" /> Quitar filtros
                  </button>
                )}
              </div>

              {meta.total === 0 ? (
                <EmptyState icon={filtro === 'encontrado' && !q ? ScanLine : Search}
                  title={filtro === 'encontrado' && !q ? 'Todavía no hay productos confirmados' : 'No hay productos en esta lista'}
                  text={filtro === 'encontrado' && !q && abierta ? 'Escanea el primer producto para empezar el conteo.' : 'Cambia el filtro o la búsqueda.'} />
              ) : (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[900px] text-[13px]">
                      <thead>
                        <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                          <th className="py-3 pl-5 pr-3">Producto</th>
                          <th className="px-3 py-3">Identificador</th>
                          <th className="px-3 py-3">Situación</th>
                          <th className="py-3 pl-3 pr-5">Verificado por</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gris-100">
                        {visibles.map((item) => (
                          <tr key={item.id} className="hover:bg-gris-50/70">
                            <td className="py-3 pl-5 pr-3">
                              <p className="max-w-[340px] truncate font-semibold text-gris-900">{bonito(item.name) || 'Sin nombre'}</p>
                              <p className="mt-0.5 max-w-[340px] truncate text-xs text-gris-500">
                                {[CATEGORIAS[item.category], ...(item.details ?? []).map(bonito)].filter(Boolean).join(' · ')}
                              </p>
                            </td>
                            <td className="px-3 py-3 cifra text-xs">
                              <p className="text-gris-800">{item.primary_code || 'Sin código'}</p>
                              {item.secondary_code && <p className="text-gris-400">{item.secondary_code}</p>}
                              {item.tertiary_code && <p className="text-gris-400">{item.tertiary_code}</p>}
                            </td>
                            <td className="px-3 py-3"><SituacionBadge valor={item.situacion} /></td>
                            <td className="py-3 pl-3 pr-5 text-gris-600">
                              {item.scanned_by || '—'}
                              {item.scanned_at && <span className="block text-xs tabular-nums text-gris-400">{horaCorta(item.scanned_at)}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="divide-y divide-gris-100 lg:hidden">
                    {visibles.map((item) => (
                      <li key={item.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SituacionBadge valor={item.situacion} />
                          <Badge>{CATEGORIAS[item.category]}</Badge>
                        </div>
                        <p className="mt-1.5 truncate text-[15px] font-bold text-gris-900">{bonito(item.name) || 'Sin nombre'}</p>
                        <p className="truncate text-xs text-gris-500">{(item.details ?? []).map(bonito).join(' · ')}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gris-500">
                          <span className="cifra text-gris-700">{item.primary_code || 'Sin código'}</span>
                          {item.scanned_by && <span>{item.scanned_by} · {horaCorta(item.scanned_at)}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <Paginador meta={meta} onPagina={irAPagina} porPagina={porPagina} onPorPagina={setPorPagina} />
            </section>
          </>
        )}

        {history.length > 0 && <Historial history={history} />}
      </div>

      {confirmar && (
        <Modal
          title={confirmar === 'cerrar' ? 'Finalizar auditoría' : 'Iniciar auditoría'}
          onClose={() => !procesando && setConfirmar(null)}
          footer={(
            <>
              <button type="button" onClick={() => setConfirmar(null)} disabled={procesando} className={buttonCls('secondary')}>Cancelar</button>
              <button type="button" onClick={ejecutar} disabled={procesando} className={buttonCls(confirmar === 'cerrar' ? 'danger' : 'primary')}>
                {procesando ? 'Procesando…' : confirmar === 'cerrar' ? 'Sí, finalizar' : 'Iniciar conteo'}
              </button>
            </>
          )}
        >
          {confirmar === 'cerrar' ? (
            <div className="space-y-3 text-sm text-gris-600">
              <p>
                Llevas <span className="font-bold text-gris-900">{audit.scanned.toLocaleString('es-BO')} de {audit.expected.toLocaleString('es-BO')}</span> productos confirmados.
              </p>
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-amber-900">
                Los <span className="font-bold">{audit.missing.toLocaleString('es-BO')}</span> sin escanear quedarán como faltantes, salvo los que se vendieron mientras contabas. Después ya no se puede escanear.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gris-600">
              Se guardará la lista de todos los productos disponibles en este momento. Los que se registren después aparecerán como ingresos posteriores y no alteran el conteo.
            </p>
          )}
        </Modal>
      )}
    </AdminLayout>
  );
}

function AvisoEscaneo({ aviso, onCerrar }) {
  const estilos = {
    exito: { caja: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
    alerta: { caja: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
    error: { caja: 'border-red-200 bg-red-50 text-red-900', icon: XCircle },
  };
  const e = estilos[aviso.tipo];
  const Icon = e.icon;
  return (
    <div role={aviso.tipo === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-5 py-3.5 text-sm ${e.caja}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{aviso.mensaje}</p>
        {aviso.item && (
          <p className="mt-0.5 truncate">{bonito(aviso.item.name)} · <span className="cifra">{aviso.item.primary_code || aviso.item.secondary_code}</span></p>
        )}
      </div>
      <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="grid h-7 w-7 place-items-center rounded-lg opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Historial({ history }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gris-200 bg-white shadow-sutil">
      <div className="border-b border-gris-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
          <History className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Auditorías anteriores
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="bg-gris-50 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
              <th className="py-3 pl-5 pr-3">Auditoría</th>
              <th className="px-3 py-3">Responsable</th>
              <th className="px-3 py-3 text-right">Esperados</th>
              <th className="px-3 py-3 text-right">Encontrados</th>
              <th className="px-3 py-3 text-right">Faltantes</th>
              <th className="px-3 py-3 text-right">Vendidos</th>
              <th className="px-3 py-3 text-right">Ingresos</th>
              <th className="py-3 pl-3 pr-5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gris-100">
            {history.map((a) => (
              <tr key={a.id}>
                <td className="py-3 pl-5 pr-3">
                  <p className="font-semibold text-gris-900">#{a.id}</p>
                  <p className="text-xs text-gris-400">{fmtDate(a.started_at)}</p>
                </td>
                <td className="px-3 py-3 text-gris-600">{a.started_by || '—'}</td>
                <td className="px-3 py-3 text-right tabular-nums">{a.expected.toLocaleString('es-BO')}</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{a.scanned.toLocaleString('es-BO')}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-red-700">{a.missing.toLocaleString('es-BO')}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-700">{(a.sold_after_audit || 0).toLocaleString('es-BO')}</td>
                <td className="px-3 py-3 text-right tabular-nums text-blue-700">{(a.received_after_start || 0).toLocaleString('es-BO')}</td>
                <td className="py-3 pl-3 pr-5">{a.status === 'open' ? <Badge tone="blue">En curso</Badge> : <Badge tone="emerald">Finalizada</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
