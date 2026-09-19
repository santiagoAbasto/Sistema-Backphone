import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { ArrowLeft, Info, Landmark, Minus, Plus, User, Users, Wallet, Zap } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Field, Input, Segmented, StepCard, Textarea, bsFmt, buttonCls } from '@/Components/Admin/ui';

const TIPOS = [
  { value: 'servicio_basico', label: 'Servicio básico', icon: Zap, ayuda: 'Luz, agua, internet, alquiler y otros servicios del local.', ejemplo: 'Ej.: Luz del local' },
  { value: 'cuota_bancaria', label: 'Cuota bancaria', icon: Landmark, ayuda: 'Pago de un préstamo o crédito. Anota cuántas cuotas faltan.', ejemplo: 'Ej.: Cuota del préstamo' },
  { value: 'gasto_personal', label: 'Gasto personal', icon: User, ayuda: 'Gastos personales pagados con dinero del negocio.', ejemplo: 'Ej.: Gasto personal de la semana' },
  { value: 'sueldos', label: 'Sueldos', icon: Users, ayuda: 'Pagos al personal.', ejemplo: 'Ej.: Sueldo de septiembre' },
];

const FRECUENCIAS = ['Único', 'Semanal', 'Mensual', 'Trimestral', 'Anual'];
const MAX_CUOTAS = 255;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function Linea({ label, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gris-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-gris-900">{valor || '—'}</dd>
    </div>
  );
}

export default function Create() {
  const [data, setData] = useState({
    concepto: '',
    precio_invertido: '',
    tipo_gasto: 'servicio_basico',
    frecuencia: '',
    cuotas_pendientes: '',
    comentario: '',
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [notice, setNotice] = useState(null);

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });
  const cambiar = (campo, valor) => {
    setData((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => {
      if (!e[campo]) return e;
      const { [campo]: _omitido, ...resto } = e;
      return resto;
    });
  };

  const tipo = TIPOS.find((t) => t.value === data.tipo_gasto) ?? TIPOS[0];
  const TipoIcon = tipo.icon;
  const esCuota = data.tipo_gasto === 'cuota_bancaria';
  const monto = Number(data.precio_invertido) || 0;
  const hoyTexto = new Date().toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });

  const ajustarCuotas = (delta) => {
    const n = Math.min(MAX_CUOTAS, Math.max(0, (parseInt(data.cuotas_pendientes, 10) || 0) + delta));
    cambiar('cuotas_pendientes', String(n));
  };

  const validar = () => {
    const e = {};
    if (!data.concepto.trim()) e.concepto = 'Escribe el concepto del egreso.';
    else if (data.concepto.trim().length > 255) e.concepto = 'El concepto puede tener hasta 255 caracteres.';
    if (!(monto > 0)) e.precio_invertido = 'Escribe el monto del egreso.';
    else if (monto > 99999999.99) e.precio_invertido = 'El monto es demasiado grande.';
    if (data.frecuencia.trim().length > 50) e.frecuencia = 'La frecuencia puede tener hasta 50 caracteres.';
    if (esCuota && data.cuotas_pendientes !== '') {
      const n = Number(data.cuotas_pendientes);
      if (!Number.isInteger(n) || n < 0 || n > MAX_CUOTAS) e.cuotas_pendientes = `Escribe un número de cuotas entre 0 y ${MAX_CUOTAS}.`;
    }
    if (data.comentario.trim().length > 255) e.comentario = 'El comentario puede tener hasta 255 caracteres.';
    return e;
  };

  const registrar = () => {
    if (guardando) return;
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    router.post(route('admin.egresos.store'), {
      concepto: data.concepto.trim(),
      precio_invertido: r2(monto),
      tipo_gasto: data.tipo_gasto,
      frecuencia: data.frecuencia.trim(),
      cuotas_pendientes: esCuota && data.cuotas_pendientes !== '' ? Number(data.cuotas_pendientes) : null,
      comentario: data.comentario.trim(),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(true),
      onSuccess: () => notifyRecordsUpdated(),
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo registrar el egreso', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(false),
    });
  };

  const mensajes = [...new Set(Object.values(errores).flat())];

  return (
    <AdminLayout>
      <Head title="Nuevo egreso" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="ab-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route('admin.egresos.index')} aria-label="Volver a egresos"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-[#121214]" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Nuevo egreso
            </h1>
            <p className="text-sm text-gris-500">Registra un gasto del negocio con la fecha de hoy. Se resta de la utilidad disponible del resumen.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Paso 1 */}
            <StepCard step={1} title="Tipo de gasto" subtitle="Elige a qué corresponde: así el resumen separa bien los gastos.">
              <Segmented options={TIPOS} value={data.tipo_gasto} ariaLabel="Tipo de gasto" onChange={(v) => cambiar('tipo_gasto', v)} />
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-gris-50 px-3 py-2.5 text-[13px] text-gris-600">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#96684F]" /> {tipo.ayuda}
              </p>
            </StepCard>

            {/* Paso 2 */}
            <StepCard step={2} title="Detalle del egreso" subtitle="Qué se pagó, cuánto y cada cuánto se repite.">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                <Field label="Concepto" error={errores.concepto}>
                  <Input value={data.concepto} placeholder={tipo.ejemplo} maxLength={255}
                    onChange={(e) => cambiar('concepto', e.target.value)} />
                </Field>
                <Field label="Monto" error={errores.precio_invertido}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gris-400">Bs</span>
                    <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" className="pl-11 text-base font-bold tabular-nums"
                      value={data.precio_invertido} onChange={(e) => cambiar('precio_invertido', e.target.value)} />
                  </div>
                </Field>
              </div>

              <div className={`mt-4 grid gap-4 ${esCuota ? 'md:grid-cols-[minmax(0,1fr)_240px]' : ''}`}>
                <div>
                  <Field label="Frecuencia (opcional)" error={errores.frecuencia}>
                    <Input value={data.frecuencia} placeholder="Ej.: Mensual" maxLength={50}
                      onChange={(e) => cambiar('frecuencia', e.target.value)} />
                  </Field>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FRECUENCIAS.map((f) => (
                      <button key={f} type="button" onClick={() => cambiar('frecuencia', data.frecuencia === f ? '' : f)} aria-pressed={data.frecuencia === f}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${data.frecuencia === f ? 'bg-[#121214] text-white' : 'bg-gris-100 text-gris-600 hover:bg-gris-200'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {esCuota && (
                  <Field label="Cuotas pendientes" error={errores.cuotas_pendientes} hint="Cuántas cuotas faltan después de esta.">
                    <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-gris-200 bg-white transition focus-within:border-[#96684F] focus-within:ring-4 focus-within:ring-[#96684F]/15">
                      <button type="button" onClick={() => ajustarCuotas(-1)} aria-label="Una cuota menos"
                        className="grid w-11 shrink-0 place-items-center text-gris-500 transition-colors hover:bg-gris-50 hover:text-gris-900">
                        <Minus className="h-4 w-4" />
                      </button>
                      <input type="number" min="0" max={MAX_CUOTAS} step="1" inputMode="numeric" placeholder="0" aria-label="Cuotas pendientes"
                        value={data.cuotas_pendientes} onChange={(e) => cambiar('cuotas_pendientes', e.target.value)}
                        className="w-full min-w-0 border-x border-y-0 border-gris-200 bg-transparent px-2 text-center text-sm font-semibold tabular-nums text-gris-900 focus:outline-none focus:ring-0" />
                      <button type="button" onClick={() => ajustarCuotas(1)} aria-label="Una cuota más"
                        className="grid w-11 shrink-0 place-items-center text-gris-500 transition-colors hover:bg-gris-50 hover:text-gris-900">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </Field>
                )}
              </div>

              <div className="mt-4">
                <Field label="Comentario (opcional)" value={data.comentario} max={255} error={errores.comentario}>
                  <Textarea rows={3} value={data.comentario} placeholder="Ej.: Vence el 15 de cada mes."
                    onChange={(e) => cambiar('comentario', e.target.value)} />
                </Field>
              </div>
            </StepCard>
          </div>

          {/* Resumen */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <Wallet className="h-[18px] w-[18px] text-[#96684F]" /> Resumen del egreso
                </h2>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3 rounded-xl bg-gris-50 px-4 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#96684F]/10 text-[#96684F]">
                    <TipoIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gris-500">Tipo de gasto</p>
                    <p className="truncate font-bold text-gris-900">{tipo.label}</p>
                  </div>
                </div>

                <dl className="space-y-1.5 text-sm">
                  <Linea label="Concepto" valor={data.concepto.trim()} />
                  <Linea label="Frecuencia" valor={data.frecuencia.trim()} />
                  {esCuota && <Linea label="Cuotas pendientes" valor={data.cuotas_pendientes} />}
                  <Linea label="Fecha" valor={`Hoy, ${hoyTexto}`} />
                </dl>

                <div className="rounded-xl bg-[#121214] px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Monto del egreso</p>
                  <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{bsFmt(monto)}</p>
                  <p className="mt-1.5 text-xs text-white/60">Se resta de la utilidad disponible de hoy en el resumen.</p>
                </div>

                {mensajes.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <p className="mb-1 font-semibold">Revisa estos datos:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {mensajes.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                )}

                <button type="button" onClick={registrar} disabled={guardando} className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  {guardando ? 'Guardando…' : 'Registrar egreso'}
                </button>
                <p className="text-center text-xs text-gris-400">Al guardar vuelves al listado de egresos.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
