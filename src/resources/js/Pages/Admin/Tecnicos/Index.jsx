import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import {
  AlertTriangle, Archive, CalendarRange, Check, ChevronLeft, ChevronRight, Pencil, Plus, Wrench,
} from 'lucide-react';
import { notifyRecordsUpdated, useAutoRefresh } from '@/Hooks/useAutoRefresh';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Segmented, Textarea, Toast,
  bsFmt, buttonCls, useToast,
} from '@/Components/Admin/ui';

// Técnicos y comisiones. El taller no paga sueldo: reparte la ganancia de cada reparación.
// Esta pantalla lleva la ficha de cada técnico y dice, semana por semana, cuánto le toca.

const TONO_ESPECIALIDAD = { apple: 'navy', android: 'emerald', ambas: 'bronce' };

const fechaCorta = (iso) => new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00`));
const fechaHora = (iso) => (iso ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '');

const vacio = { nombre: '', especialidad: 'ambas', comision: 60, telefono: '', notas: '', activo: true };

export default function Index({ tecnicos = [], comisiones = [], semana = {}, sinTecnico = 0, especialidades = [] }) {
  useAutoRefresh(['tecnicos', 'comisiones', 'sinTecnico']);
  const [toast] = useToast();
  const [ficha, setFicha] = useState(null);
  const [abierto, setAbierto] = useState(null);

  const irASemana = (fecha) => router.get(route('admin.tecnicos.index'), { semana: fecha }, {
    preserveState: true, preserveScroll: true, replace: true,
  });

  const liquidar = (t) => router.post(route('admin.tecnicos.liquidar', t.tecnico_id), { semana: semana.inicio }, {
    preserveScroll: true, onSuccess: () => notifyRecordsUpdated(),
  });

  const totalSemana = comisiones.reduce((a, c) => a + c.comision, 0);

  return (
    <AdminLayout title="Técnicos y comisiones">
      <Head title="Técnicos y comisiones" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Técnicos y comisiones"
          subtitle="El taller no paga sueldo: cada técnico se lleva un porcentaje de la ganancia de lo que repara. Acá sale cuánto le toca a cada uno por la semana."
          actions={(
            <Button variant="primary" className="h-11 px-5" onClick={() => setFicha(vacio)}>
              <Plus className="h-4 w-4" /> Nuevo técnico
            </Button>
          )}
        />

        {/* ── La semana ── */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gris-200 bg-white p-4 shadow-sutil">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => irASemana(semana.anterior)} aria-label="Semana anterior"
              className="grid h-10 w-10 place-items-center rounded-xl border border-gris-200 text-gris-500 transition-colors hover:text-gris-900">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-1">
              <p className="flex items-center gap-2 text-[15px] font-bold text-gris-900">
                <CalendarRange className="h-4 w-4 text-[color:var(--acento)]" />
                Del {fechaCorta(semana.inicio)} al {fechaCorta(semana.fin)}
              </p>
              <p className="mt-0.5 text-xs text-gris-500">
                {semana.esActual ? 'Esta semana, hasta hoy' : 'Semana cerrada'}
              </p>
            </div>
            <button type="button" onClick={() => irASemana(semana.siguiente)} aria-label="Semana siguiente"
              className="grid h-10 w-10 place-items-center rounded-xl border border-gris-200 text-gris-500 transition-colors hover:text-gris-900">
              <ChevronRight className="h-4 w-4" />
            </button>
            {!semana.esActual && (
              <button type="button" onClick={() => irASemana('')} className={buttonCls('ghost', 'h-9')}>
                Volver a esta semana
              </button>
            )}
          </div>

          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gris-400">A repartir en la semana</p>
            <p className="cifra text-[22px] font-bold leading-none text-gris-900">{bsFmt(totalSemana)}</p>
          </div>
        </section>

        {sinTecnico > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <span className="font-bold">{sinTecnico} {sinTecnico === 1 ? 'servicio' : 'servicios'} de esta semana sin técnico asignado.</span>{' '}
                No se reparten ni se pierden: quedan afuera del cálculo hasta que alguien los complete.
              </span>
            </p>
            <Link href={route('admin.servicios.index')} className={buttonCls('secondary', 'h-9')}>Ver servicios</Link>
          </div>
        )}

        {/* ── Lo que le toca a cada uno ── */}
        {comisiones.length === 0 ? (
          <Card>
            <EmptyState icon={Wrench} title="Todavía no hay técnicos"
              text="Registra a quienes reparan y con qué porcentaje cobran. A partir de ahí el sistema calcula solo lo de cada semana."
              action={<Button variant="primary" onClick={() => setFicha(vacio)}><Plus className="h-4 w-4" /> Nuevo técnico</Button>} />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {comisiones.map((c) => (
              <TarjetaComision key={c.tecnico_id} c={c}
                abierto={abierto === c.tecnico_id}
                onAbrir={() => setAbierto(abierto === c.tecnico_id ? null : c.tecnico_id)}
                onLiquidar={() => liquidar(c)} />
            ))}
          </div>
        )}

        {/* ── Las fichas ── */}
        <Card title="Fichas de los técnicos"
          subtitle="La especialidad decide qué equipos puede recibir cada uno. El porcentaje es lo que se lleva de la ganancia.">
          {tecnicos.length === 0 ? (
            <p className="py-4 text-center text-sm text-gris-500">Todavía no hay ninguno.</p>
          ) : (
            <ul className="divide-y divide-gris-100">
              {tecnicos.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-gris-900">
                      {t.nombre}
                      {!t.activo && <Badge tone="slate">Archivado</Badge>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gris-500">
                      <Badge tone={TONO_ESPECIALIDAD[t.especialidad] ?? 'slate'}>{t.especialidadTexto}</Badge>
                      <span>Se lleva el {t.comision} %</span>
                      <span>· {t.servicios} {t.servicios === 1 ? 'servicio' : 'servicios'}</span>
                      {t.telefono && <span>· {t.telefono}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setFicha({ ...t })} title="Editar" aria-label={`Editar ${t.nombre}`}
                      className="grid h-9 w-9 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-gris-100 hover:text-gris-900">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {t.activo && (
                      <button type="button" title="Archivar" aria-label={`Archivar ${t.nombre}`}
                        onClick={() => router.delete(route('admin.tecnicos.destroy', t.id), { preserveScroll: true })}
                        className="grid h-9 w-9 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-gris-100 hover:text-gris-900">
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {ficha && <ModalFicha ficha={ficha} especialidades={especialidades} onCerrar={() => setFicha(null)} />}
    </AdminLayout>
  );
}

/** Lo que le toca a un técnico por la semana. El número es una sugerencia hasta que se paga. */
function TarjetaComision({ c, abierto, onAbrir, onLiquidar }) {
  const sinNada = c.servicios === 0 && c.pendientes === 0;

  return (
    <section className={`rounded-2xl border bg-white shadow-sutil ${c.pagada ? 'border-emerald-200' : 'border-gris-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gris-100 px-5 py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-bold text-gris-900">
            <Wrench className="h-4 w-4 text-[color:var(--acento)]" /> {c.nombre}
          </p>
          <p className="mt-1 text-xs text-gris-500">
            Se lleva el {c.porcentaje} % de la ganancia
            {!c.activo && <span className="text-amber-700"> · archivado</span>}
          </p>
        </div>
        <Badge tone={TONO_ESPECIALIDAD[c.especialidad] ?? 'slate'}>
          {c.especialidad === 'apple' ? 'Apple' : c.especialidad === 'android' ? 'Android' : 'Cualquier equipo'}
        </Badge>
      </div>

      <div className="space-y-4 p-5">
        {sinNada ? (
          <p className="py-2 text-center text-[13px] text-gris-500">No reparó nada esta semana.</p>
        ) : (
          <>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gris-500">{c.servicios} {c.servicios === 1 ? 'servicio cobrado' : 'servicios cobrados'}</dt>
                <dd className="font-semibold tabular-nums text-gris-900">{bsFmt(c.cobrado)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gris-500">Repuestos que puso la tienda</dt>
                <dd className="font-semibold tabular-nums text-rose-600">−{bsFmt(c.repuestos)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-gris-100 pt-1.5">
                <dt className="font-semibold text-gris-700">Ganancia a repartir</dt>
                <dd className="font-bold tabular-nums text-gris-900">{bsFmt(c.ganancia)}</dd>
              </div>
            </dl>

            <div className="rounded-xl bg-carbon-900 px-4 py-3.5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Le toca a {c.nombre}</p>
              <p className="mt-1 cifra text-[28px] font-bold leading-none tracking-tight">{bsFmt(c.comision)}</p>
              <p className="mt-1.5 text-xs text-white/60">Quedan {bsFmt(c.tienda)} en la tienda</p>
            </div>

            {c.pendientes > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  {c.pendientes} {c.pendientes === 1 ? 'servicio suyo espera' : 'servicios suyos esperan'} que cargues el costo.
                  Hasta entonces no {c.pendientes === 1 ? 'entra' : 'entran'} en el cálculo.
                </span>
              </p>
            )}

            {c.pagada ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
                <Check className="h-4 w-4 shrink-0" />
                Pagada {bsFmt(c.pagada.monto)}{c.pagada.quien ? ` por ${c.pagada.quien}` : ''} · {fechaHora(c.pagada.fecha)}
              </p>
            ) : (
              <button type="button" onClick={onLiquidar} disabled={c.pendientes > 0 || c.servicios === 0}
                className={buttonCls('primary', 'h-11 w-full')}>
                Marcar la semana como pagada
              </button>
            )}

            {c.notas.length > 0 && (
              <div>
                <button type="button" onClick={onAbrir} className="text-xs font-bold text-gris-500 underline-offset-2 hover:text-gris-900 hover:underline">
                  {abierto ? 'Ocultar el detalle' : (c.notas.length === 1 ? 'Ver el servicio' : `Ver los ${c.notas.length} servicios`)}
                </button>
                {abierto && (
                  <ul className="mt-2 divide-y divide-gris-100 border-t border-gris-100">
                    {c.notas.map((n) => (
                      <li key={n.codigo} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                        <span className="min-w-0">
                          <span className="cifra text-xs font-bold text-[color:var(--acento)]">{n.codigo}</span>
                          <span className="ml-2 text-gris-600">{n.equipo}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block tabular-nums text-gris-500">{bsFmt(n.cobrado)}</span>
                          <span className="block text-xs font-semibold tabular-nums text-emerald-700">+{bsFmt(n.comision)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ModalFicha({ ficha, especialidades, onCerrar }) {
  const nuevo = !ficha.id;
  const { data, setData, post, patch, processing, errors } = useForm({
    nombre: ficha.nombre ?? '',
    especialidad: ficha.especialidad ?? 'ambas',
    comision: String(ficha.comision ?? 60),
    telefono: ficha.telefono ?? '',
    notas: ficha.notas ?? '',
    activo: ficha.activo ?? true,
  });

  const guardar = () => {
    const opciones = { preserveScroll: true, onSuccess: () => { notifyRecordsUpdated(); onCerrar(); } };
    if (nuevo) post(route('admin.tecnicos.store'), opciones);
    else patch(route('admin.tecnicos.update', ficha.id), opciones);
  };

  const porcentaje = Math.min(100, Math.max(0, Number(data.comision) || 0));

  return (
    <Modal
      title={nuevo ? 'Nuevo técnico' : ficha.nombre}
      onClose={onCerrar}
      footer={(
        <>
          <Button onClick={onCerrar} disabled={processing}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={processing}>
            {processing ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="Nombre" error={errors.nombre}>
          <Input value={data.nombre} maxLength={120} autoFocus placeholder="Ej.: Axel"
            onChange={(e) => setData('nombre', e.target.value)} />
        </Field>

        <Field label="¿Qué equipos atiende?" error={errors.especialidad}
          hint="Es la regla que impide que un Android termine en manos del técnico de Apple.">
          <Segmented options={especialidades.map((e) => ({ value: e.value, label: e.label }))}
            value={data.especialidad} cols="grid-cols-1 sm:grid-cols-3" ariaLabel="Especialidad"
            onChange={(v) => setData('especialidad', v)} />
        </Field>

        <Field label="Comisión del técnico" error={errors.comision}
          hint={`De cada Bs 100 de ganancia, se lleva Bs ${porcentaje} y quedan Bs ${100 - porcentaje} en la tienda.`}>
          <div className="relative">
            <Input type="number" min="0" max="100" step="1" inputMode="numeric"
              className="pr-10 text-base font-bold tabular-nums" value={data.comision}
              onChange={(e) => setData('comision', e.target.value)} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gris-400">%</span>
          </div>
        </Field>

        <Field label="Teléfono (opcional)" error={errors.telefono}>
          <Input value={data.telefono} maxLength={40} placeholder="Ej.: 70000000"
            onChange={(e) => setData('telefono', e.target.value)} />
        </Field>

        <Field label="Notas (opcional)" error={errors.notas}>
          <Textarea rows={2} value={data.notas} placeholder="Ej.: trabaja martes y jueves"
            onChange={(e) => setData('notas', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
