import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { AlertTriangle, Banknote, CheckCircle2, HelpCircle, KeyRound, Lock } from 'lucide-react';
import { notifyRecordsUpdated, useAutoRefresh } from '@/Hooks/useAutoRefresh';
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea, Toast, bsFmt, useToast,
} from '@/Components/Admin/ui';

// La caja de cada sucursal, día por día: se abre con el efectivo con el que arranca el cajón y se
// cierra contándolo. El sistema dice cuánto debería haber y si sobra o falta.
//
// El vendedor cuenta a ciegas (el servidor no le manda «debería haber» hasta que cierra): así anota
// lo que contó y no el número que esperaba ver.

const fechaLarga = (iso) => new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00`));
const fechaCorta = (iso) => new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`));
const hora = (iso) => (iso ? new Intl.DateTimeFormat('es-BO', { timeStyle: 'short' }).format(new Date(iso)) : '');

function estadoDe(caja, hoy) {
  if (!caja) return 'sin-abrir';
  if (caja.abierta) return caja.fecha < hoy ? 'olvidada' : 'abierta';
  return 'cerrada';
}

function Diferencia({ valor }) {
  if (Math.abs(valor) < 0.005) return <span className="font-bold text-emerald-700">Cuadra</span>;
  return valor > 0
    ? <span className="font-bold text-amber-700">Sobran {bsFmt(valor)}</span>
    : <span className="font-bold text-rose-600">Faltan {bsFmt(Math.abs(valor))}</span>;
}

// El «¿qué hago ahora?» de cada caja: el próximo paso según cómo está
function QueHagoAhora({ estado, caja, aCiegas }) {
  const texto = {
    'sin-abrir': 'Cuenta el efectivo con el que arranca el cajón y anótalo para abrir la caja. Desde ahí, lo que se cobra en efectivo se suma solo.',
    olvidada: `La caja del ${caja ? fechaLarga(caja.fecha) : ''} quedó abierta. Cuenta el efectivo del cajón y ciérrala: recién después se puede abrir la de hoy.`,
    abierta: aCiegas
      ? 'Durante el día no hay nada que hacer: las ventas, servicios y abonos en efectivo se suman solos y los egresos se restan. Al terminar, cuenta el efectivo y anota cuánto hay: al cerrar ves si cuadra.'
      : 'Durante el día no hay nada que hacer: las ventas, servicios y abonos en efectivo se suman solos y los egresos se restan. Al terminar, cuenta el efectivo y cierra la caja.',
    cerrada: 'Listo por hoy. Mañana, quien abra anota con cuánto arranca la caja.',
  }[estado];

  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-gris-50 px-3.5 py-3 text-[13px] leading-relaxed text-gris-700">
      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--acento)]" aria-hidden="true" />
      <p><span className="font-semibold text-gris-900">¿Qué hago ahora? </span>{texto}</p>
    </div>
  );
}

function Desglose({ caja }) {
  const m = caja.movimientos;
  const filas = [
    ['Arrancó con', caja.monto_apertura, ''],
    ['Ventas en efectivo', m.ventas, '+'],
    ['Servicios en efectivo', m.servicios, '+'],
    ['Abonos de reserva en efectivo', m.reservas, '+'],
    ['Egresos', m.egresos, '−'],
  ];
  return (
    <dl className="space-y-1.5 text-sm">
      {filas.map(([label, valor, signo]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-gris-500">{label}</dt>
          <dd className="tabular-nums text-gris-800">{signo} {bsFmt(valor)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-3 border-t border-gris-100 pt-2 font-semibold">
        <dt className="text-gris-900">Debería haber</dt>
        <dd className="tabular-nums text-gris-900">{bsFmt(caja.esperado)}</dd>
      </div>
    </dl>
  );
}

function CajaDeSucursal({ sucursal, caja, hoy, aCiegas, prefijo, avisar }) {
  const estado = estadoDe(caja, hoy);
  const [monto, setMonto] = useState('');
  const [notas, setNotas] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  const opciones = (mensaje) => ({
    preserveScroll: true,
    onStart: () => setEnviando(true),
    onSuccess: () => { setMonto(''); setNotas(''); setErrores({}); notifyRecordsUpdated(); avisar(mensaje); },
    onError: (e) => setErrores(e),
    onFinish: () => setEnviando(false),
  });

  const abrir = () => router.post(route(`${prefijo}.caja.abrir`), { sucursal_id: sucursal.id, monto_apertura: monto }, opciones('Caja abierta.'));
  const cerrar = () => router.post(route(`${prefijo}.caja.cerrar`, caja.id), { monto_contado: monto, notas }, opciones('Caja cerrada.'));

  const etiqueta = {
    'sin-abrir': <Badge tone="slate">Sin abrir</Badge>,
    olvidada: <Badge tone="rose">Sin cerrar desde el {caja ? fechaCorta(caja.fecha) : ''}</Badge>,
    abierta: <Badge tone="emerald"><KeyRound className="h-3 w-3" /> Abierta</Badge>,
    cerrada: <Badge tone="navy"><Lock className="h-3 w-3" /> Cerrada</Badge>,
  }[estado];

  const montoValido = monto !== '' && Number(monto) >= 0;

  return (
    <Card title={sucursal.nombre} subtitle={caja && estado === 'olvidada' ? fechaLarga(caja.fecha) : `Hoy, ${fechaLarga(hoy)}`} actions={etiqueta}>
      <div className="space-y-4">
        <QueHagoAhora estado={estado} caja={caja} aCiegas={aCiegas} />

        {caja && (
          <p className="text-[13px] text-gris-500">
            Abrió <span className="font-semibold text-gris-800">{caja.abierta_por}</span> a las {hora(caja.abierta_en)} con{' '}
            <span className="font-semibold tabular-nums text-gris-800">{bsFmt(caja.monto_apertura)}</span>.
          </p>
        )}

        {caja && caja.movimientos && <Desglose caja={caja} />}

        {estado === 'sin-abrir' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="¿Con cuánto arranca la caja? (Bs)" error={errores.monto_apertura} className="flex-1">
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={monto} placeholder="0,00"
                onChange={(e) => setMonto(e.target.value)} />
            </Field>
            <Button variant="primary" className="h-11 px-5" disabled={!montoValido || enviando} onClick={abrir}>
              <KeyRound className="h-4 w-4" /> {enviando ? 'Abriendo…' : 'Abrir caja'}
            </Button>
          </div>
        )}

        {(estado === 'abierta' || estado === 'olvidada') && (
          <div className="space-y-3 border-t border-gris-100 pt-4">
            <Field label="¿Cuánto efectivo contaste en el cajón? (Bs)" error={errores.monto_contado}>
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={monto} placeholder="0,00"
                onChange={(e) => setMonto(e.target.value)} />
            </Field>
            <Field label="Notas (opcional)" hint="Si sobra o falta, anota por qué: un vuelto mal dado, un retiro, un gasto sin cargar.">
              <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </Field>
            <Button variant="primary" className="h-11 w-full" disabled={!montoValido || enviando} onClick={cerrar}>
              <Lock className="h-4 w-4" /> {enviando ? 'Cerrando…' : montoValido ? `Cerrar la caja con ${bsFmt(monto)}` : 'Cerrar la caja'}
            </Button>
          </div>
        )}

        {estado === 'cerrada' && (
          <div className="space-y-2 border-t border-gris-100 pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gris-500">Se contó</span>
              <span className="font-semibold tabular-nums text-gris-900">{bsFmt(caja.monto_contado)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gris-500">Resultado</span>
              <Diferencia valor={caja.diferencia} />
            </div>
            <p className="text-[13px] text-gris-500">Cerró {caja.cerrada_por} a las {hora(caja.cerrada_en)}.</p>
            {caja.notas && <p className="rounded-lg bg-gris-50 px-3 py-2 text-[13px] text-gris-700">{caja.notas}</p>}
            {Math.abs(caja.despues_del_cierre) >= 0.005 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Después del cierre {caja.despues_del_cierre > 0 ? 'entraron' : 'salieron'} {bsFmt(Math.abs(caja.despues_del_cierre))} en efectivo que no quedaron en este conteo.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Historial({ historial }) {
  return (
    <Card title="Cierres anteriores" subtitle="Los últimos 30 días cerrados. Lo que se ve es lo que quedó firmado al cerrar.">
      {historial.length === 0 ? (
        <EmptyState icon={Banknote} title="Todavía no se cerró ninguna caja" text="Cuando se cierre la primera, aparece acá con lo que se contó." />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gris-100 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-400">
                <th className="px-5 py-2">Día</th>
                <th className="px-3 py-2">Sucursal</th>
                <th className="px-3 py-2 text-right">Arrancó</th>
                <th className="px-3 py-2 text-right">Debería haber</th>
                <th className="px-3 py-2 text-right">Se contó</th>
                <th className="px-3 py-2 text-right">Resultado</th>
                <th className="px-5 py-2">Quién</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gris-100">
              {historial.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-2.5 text-gris-800">{fechaCorta(c.fecha)}</td>
                  <td className="px-3 py-2.5 text-gris-600">{c.sucursal}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gris-600">{bsFmt(c.monto_apertura)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gris-600">{bsFmt(c.esperado)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gris-900">{bsFmt(c.monto_contado)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right"><Diferencia valor={c.diferencia} /></td>
                  <td className="px-5 py-2.5 text-xs text-gris-500" title={c.notas || undefined}>
                    Abrió {c.abierta_por} · cerró {c.cerrada_por}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function CajaDiaria({ hoy, cajas = [], historial = [], aCiegas = false, Layout, prefijo = 'admin' }) {
  // «Debería haber» se mueve con cada venta: se refresca solo mientras la pantalla está abierta
  useAutoRefresh(['cajas', 'historial']);
  const [toast, mostrar] = useToast();

  return (
    <Layout title="Caja">
      <Head title="Caja" />
      <Toast toast={toast} />

      <PageHeader
        title="Caja"
        subtitle={aCiegas
          ? 'Cada día se abre con el efectivo con el que arranca el cajón y se cierra contándolo. Al cerrar ves si cuadró.'
          : 'Cada día, por sucursal: se abre con el efectivo con el que arranca el cajón y se cierra contándolo. Acá ves cuánto debería haber y si sobró o faltó.'}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {cajas.map(({ sucursal, caja }) => (
          <CajaDeSucursal key={sucursal.id} sucursal={sucursal} caja={caja} hoy={hoy} aCiegas={aCiegas} prefijo={prefijo} avisar={mostrar} />
        ))}
      </div>

      {cajas.length === 0 && (
        <EmptyState icon={CheckCircle2} title="No hay sucursales encendidas" text="La caja es de cada sucursal: enciende una en Sucursales." />
      )}

      <div className="mt-6">
        <Historial historial={historial} />
      </div>
    </Layout>
  );
}
