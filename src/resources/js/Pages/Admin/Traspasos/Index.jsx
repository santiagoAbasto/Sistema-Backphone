import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { route } from 'ziggy-js';
import {
  ArrowRight, Check, PackageCheck, Search, Send, Truck, X,
} from 'lucide-react';
import { notifyRecordsUpdated, useAutoRefresh } from '@/Hooks/useAutoRefresh';
import {
  Badge, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, Toast,
  bsFmt, buttonCls, inputCls, useToast,
} from '@/Components/Admin/ui';
import { checkCls } from '@/Components/Admin/inventario';

// Traspasos de inventario entre sucursales. Lo que sale queda «en tránsito» —fuera de la venta en
// las dos— hasta que la sucursal destino confirma que llegó.

const clave = (tipo, id) => `${tipo}:${id}`;
const fechaHora = (iso) => (iso ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '');

const ESTADOS = {
  en_transito: { label: 'En tránsito', tone: 'amber' },
  recibido: { label: 'Recibido', tone: 'emerald' },
  cancelado: { label: 'Cancelado', tone: 'slate' },
};

export default function Index({
  sucursales = [], tipos = [], productos = [], traspasos = [], filtros = {},
  puedeEnviar = false, miSucursal = null,
}) {
  useAutoRefresh(['productos', 'traspasos', 'tipos']);
  const [toast] = useToast();

  const [destino, setDestino] = useState(() => sucursales.find((s) => s.id !== filtros.origen)?.id ?? '');
  const [q, setQ] = useState(filtros.q ?? '');
  const [nota, setNota] = useState('');
  // El remito vive en la pantalla y no en la dirección: cambiar de pestaña o de sucursal no
  // puede borrar lo que ya se eligió de los otros inventarios.
  const [remito, setRemito] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState({});

  const elegidos = useMemo(() => Object.values(remito), [remito]);
  const unidades = elegidos.reduce((a, i) => a + i.cantidad, 0);
  const valor = elegidos.reduce((a, i) => a + i.precio * i.cantidad, 0);

  const ir = (extra = {}) => router.get(route('admin.traspasos.index'), { ...filtros, q, ...extra }, {
    preserveState: true, preserveScroll: true, replace: true,
  });

  const alternar = (p) => setRemito((r) => {
    const k = clave(p.tipo, p.id);
    if (r[k]) {
      const { [k]: _fuera, ...resto } = r;
      return resto;
    }
    return { ...r, [k]: { ...p, cantidad: 1 } };
  });

  const cambiarCantidad = (p, cantidad) => setRemito((r) => ({
    ...r,
    [clave(p.tipo, p.id)]: { ...r[clave(p.tipo, p.id)], cantidad: Math.max(1, Math.min(p.cantidad, Number(cantidad) || 1)) },
  }));

  const marcarTodos = () => setRemito((r) => {
    const faltan = productos.filter((p) => !r[clave(p.tipo, p.id)]);
    if (faltan.length === 0) {
      // Ya estaban todos: el mismo botón los saca
      const copia = { ...r };
      productos.forEach((p) => delete copia[clave(p.tipo, p.id)]);
      return copia;
    }
    return { ...r, ...Object.fromEntries(faltan.map((p) => [clave(p.tipo, p.id), { ...p, cantidad: 1 }])) };
  });

  const enviar = () => {
    if (enviando) return;
    router.post(route('admin.traspasos.store'), {
      origen_sucursal_id: filtros.origen,
      destino_sucursal_id: destino,
      nota,
      items: elegidos.map((i) => ({ tipo: i.tipo, producto_id: i.id, cantidad: i.cantidad })),
    }, {
      preserveScroll: true,
      onStart: () => setEnviando(true),
      onSuccess: () => { setRemito({}); setNota(''); setErrores({}); notifyRecordsUpdated(); },
      onError: setErrores,
      onFinish: () => setEnviando(false),
    });
  };

  const nombreSucursal = (id) => sucursales.find((s) => s.id === id)?.nombre ?? '';
  const todosMarcados = productos.length > 0 && productos.every((p) => remito[clave(p.tipo, p.id)]);
  const mensajes = [...new Set(Object.values(errores).flat())];

  return (
    <AdminLayout title="Traspasos">
      <Head title="Traspasos" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Traspasos entre sucursales"
          subtitle="Lo que sale queda en tránsito —no se puede vender en ninguna de las dos— hasta que la sucursal que recibe confirma que llegó."
        />

        {puedeEnviar && (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-5">
              {/* De dónde a dónde */}
              <Card title="¿Qué se mueve y hacia dónde?">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
                  <Field label="Desde">
                    <Select value={filtros.origen ?? ''} onChange={(e) => { setRemito({}); ir({ origen: e.target.value }); }}>
                      {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </Select>
                  </Field>
                  <span className="hidden h-11 place-items-center px-1 text-gris-300 sm:grid">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                  <Field label="Hacia" error={errores.destino_sucursal_id}>
                    <Select value={destino} onChange={(e) => setDestino(Number(e.target.value))}>
                      <option value="">Elige la sucursal</option>
                      {sucursales.filter((s) => s.id !== filtros.origen).map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </Card>

              {/* Qué se elige */}
              <section className="overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil">
                <div className="border-b border-gris-100 p-4">
                  <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Inventario">
                    {tipos.map((t) => {
                      const activa = t.value === filtros.tipo;
                      return (
                        <button key={t.value} type="button" role="tab" aria-selected={activa}
                          onClick={() => !activa && ir({ tipo: t.value })}
                          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                            activa ? 'bg-carbon-900 text-white' : 'border border-gris-200 bg-white text-gris-600 hover:border-gris-300 hover:text-gris-900'}`}>
                          {t.label}
                          <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${activa ? 'bg-white/20' : 'bg-gris-100 text-gris-500'}`}>
                            {t.total}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); ir(); }} className="mt-3 flex flex-wrap gap-2">
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
                      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el inventario de origen"
                        placeholder="Modelo, IMEI, serie, código o nombre" className={`${inputCls} h-10 pl-9`} />
                    </div>
                    <button type="submit" className={buttonCls('secondary', 'h-10')}>Buscar</button>
                    {productos.length > 0 && (
                      <button type="button" onClick={marcarTodos} className={buttonCls('secondary', 'h-10')}>
                        {todosMarcados ? 'Quitar los que se ven' : 'Marcar los que se ven'}
                      </button>
                    )}
                  </form>
                </div>

                {productos.length === 0 ? (
                  <EmptyState icon={PackageCheck} title="No hay nada para enviar acá"
                    text={filtros.q
                      ? 'Nada coincide con esa búsqueda en la sucursal de origen.'
                      : 'Esta sucursal no tiene productos disponibles de este tipo.'} />
                ) : (
                  <ul className="divide-y divide-gris-100">
                    {productos.map((p) => {
                      const elegido = remito[clave(p.tipo, p.id)];
                      return (
                        <li key={clave(p.tipo, p.id)} className={`flex items-center gap-3 px-4 py-3 ${elegido ? 'bg-[rgb(var(--acento-rgb)_/_0.06)]' : ''}`}>
                          <input type="checkbox" checked={Boolean(elegido)} onChange={() => alternar(p)}
                            aria-label={`Enviar ${p.nombre}`} className={checkCls} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gris-900">{p.nombre}</p>
                            {p.detalle && <p className="truncate text-xs text-gris-500">{p.detalle}</p>}
                          </div>
                          {p.cantidad > 1 && (
                            <span className="shrink-0 text-xs text-gris-400">quedan {p.cantidad}</span>
                          )}
                          {elegido && p.cantidad > 1 && (
                            <input type="number" min={1} max={p.cantidad} value={elegido.cantidad}
                              onChange={(e) => cambiarCantidad(p, e.target.value)}
                              aria-label={`Cuántas unidades de ${p.nombre}`}
                              className={`${inputCls} h-9 w-20 text-center font-semibold tabular-nums`} />
                          )}
                          <span className="shrink-0 text-sm font-bold tabular-nums text-gris-900">{bsFmt(p.precio)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            {/* El remito */}
            <aside className="xl:sticky xl:top-24">
              <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
                <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                    <Truck className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Lo que se envía
                  </h2>
                  <Badge tone="navy">{unidades} {unidades === 1 ? 'unidad' : 'unidades'}</Badge>
                </div>

                <div className="space-y-4 p-5">
                  {elegidos.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gris-200 bg-gris-50/60 px-4 py-6 text-center text-sm text-gris-500">
                      Marca lo que quieras mandar. Podés mezclar celulares, accesorios y piezas en el mismo envío.
                    </p>
                  ) : (
                    <>
                      <p className="text-[13px] text-gris-600">
                        De <span className="font-semibold text-gris-900">{nombreSucursal(filtros.origen)}</span>
                        {' '}a <span className="font-semibold text-gris-900">{destino ? nombreSucursal(destino) : '…'}</span>
                      </p>
                      <ul className="max-h-64 space-y-2 overflow-y-auto">
                        {elegidos.map((i) => (
                          <li key={clave(i.tipo, i.id)} className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-gris-600">
                              {i.cantidad > 1 ? `${i.cantidad} × ` : ''}{i.nombre}
                            </span>
                            <button type="button" onClick={() => alternar(i)} aria-label={`Quitar ${i.nombre}`}
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-gris-400 hover:bg-rose-50 hover:text-rose-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="rounded-xl bg-carbon-900 px-4 py-3.5 text-white">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Valor de venta que viaja</p>
                        <p className="mt-1 cifra text-[26px] font-bold leading-none tracking-tight">{bsFmt(valor)}</p>
                      </div>
                    </>
                  )}

                  <Field label="Nota del envío (opcional)" hint="Queda en el remito que ven las dos sucursales.">
                    <Textarea rows={2} value={nota} maxLength={500} placeholder="Ej.: va con el transporte del viernes"
                      onChange={(e) => setNota(e.target.value)} />
                  </Field>

                  {mensajes.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                      <ul className="list-disc space-y-1 pl-5">{mensajes.map((m) => <li key={m}>{m}</li>)}</ul>
                    </div>
                  )}

                  <button type="button" onClick={enviar} disabled={enviando || elegidos.length === 0 || !destino}
                    className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                    <Send className="h-4 w-4" /> {enviando ? 'Enviando…' : 'Enviar el traspaso'}
                  </button>
                  <p className="text-center text-xs leading-relaxed text-gris-400">
                    Sale del inventario de {nombreSucursal(filtros.origen)} y queda en tránsito. Recién se puede
                    vender cuando la otra sucursal confirme que llegó.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        )}

        {/* Historial */}
        <Card title="Envíos" subtitle="Los que salieron de tu sucursal y los que estás esperando.">
          {traspasos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gris-500">Todavía no se movió nada entre sucursales.</p>
          ) : (
            <ul className="divide-y divide-gris-100">
              {traspasos.map((t) => (
                <Envio key={t.id} t={t} miSucursal={miSucursal} puedeEnviar={puedeEnviar} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

function Envio({ t, miSucursal, puedeEnviar }) {
  const [abierto, setAbierto] = useState(false);
  const estado = ESTADOS[t.estado] ?? ESTADOS.cancelado;
  // Quien recibe confirma; quien envió puede cancelar mientras no haya llegado.
  const puedeRecibir = t.estado === 'en_transito' && (puedeEnviar || miSucursal === t.destinoId);
  const puedeCancelar = t.estado === 'en_transito' && (puedeEnviar || miSucursal === t.origenId);

  const accion = (nombre) => router.post(route(`admin.traspasos.${nombre}`, t.id), {}, {
    preserveScroll: true, onSuccess: () => notifyRecordsUpdated(),
  });

  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="cifra text-[13px] font-bold text-[color:var(--acento)]">{t.codigo}</span>
            <Badge tone={estado.tone}>{estado.label}</Badge>
          </p>
          <p className="mt-1 text-sm text-gris-700">
            {t.origen} <ArrowRight className="inline h-3.5 w-3.5 text-gris-400" /> {t.destino}
            <span className="text-gris-400"> · {t.unidades} {t.unidades === 1 ? 'unidad' : 'unidades'}</span>
          </p>
          <p className="mt-0.5 text-xs text-gris-500">
            Enviado{t.enviadoPor ? ` por ${t.enviadoPor}` : ''} · {fechaHora(t.enviadoEn)}
            {t.recibidoEn && ` · Recibido${t.recibidoPor ? ` por ${t.recibidoPor}` : ''} · ${fechaHora(t.recibidoEn)}`}
          </p>
          {t.nota && <p className="mt-1 text-xs italic text-gris-500">«{t.nota}»</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setAbierto(!abierto)} className={buttonCls('ghost', 'h-9 text-xs')}>
            {abierto ? 'Ocultar' : 'Ver el remito'}
          </button>
          {puedeCancelar && (
            <button type="button" onClick={() => accion('cancelar')} className={buttonCls('danger', 'h-9 text-xs')}>
              Cancelar
            </button>
          )}
          {puedeRecibir && (
            <button type="button" onClick={() => accion('recibir')} className={buttonCls('primary', 'h-9 text-xs')}>
              <Check className="h-3.5 w-3.5" /> Confirmar que llegó
            </button>
          )}
        </div>
      </div>

      {abierto && (
        <ul className="mt-3 divide-y divide-gris-100 rounded-xl border border-gris-200">
          {t.items.map((i, n) => (
            <li key={n} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[13px]">
              <span className="min-w-0">
                <span className="font-semibold text-gris-900">{i.cantidad > 1 ? `${i.cantidad} × ` : ''}{i.nombre}</span>
                {i.detalle && <span className="ml-2 text-gris-500">{i.detalle}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
