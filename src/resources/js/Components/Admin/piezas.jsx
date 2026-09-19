import { router } from '@inertiajs/react';
import { useState } from 'react';
import { route } from 'ziggy-js';
import { AlertTriangle, PackageMinus, PackagePlus } from 'lucide-react';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Badge, Field, Input, Modal, StepCard, Switch, Textarea, bsFmt, buttonCls } from '@/Components/Admin/ui';
import {
  CajaPrecio, CamposPrecio, Linea, Nota, Sugerencias, fmtFecha, montoInicial, r2, useFormularioInventario, validarPrecios,
} from '@/Components/Admin/inventario';

// Piezas y repuestos: pantallas, baterías, pines de carga, tornillos.
// A diferencia del resto del inventario no se lleva una fila por unidad sino un saldo, así que lo
// que manda en todas estas pantallas es «cuántas quedan». Lo común vive en inventario.jsx.

/** Marca de la pieza: una plaqueta con su muesca y sus dos tornillos. Hereda el color del texto. */
export function IconoPieza({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.5 4.5h11l4 4v11h-15z" />
      <path d="M15.5 4.5v4h4" />
      <circle cx="8.5" cy="9" r="1.4" />
      <circle cx="8.5" cy="15" r="1.4" />
      <path d="M12.5 15h4" />
    </svg>
  );
}

/* ─── Estado del saldo ─── */

/** Cómo está una pieza según su saldo y su mínimo. */
export function estadoDe(p) {
  if (p?.activa === false) return 'archivada';
  if ((Number(p?.cantidad) || 0) <= 0) return 'agotada';
  if (Number(p?.minimo) > 0 && Number(p.cantidad) <= Number(p.minimo)) return 'por_agotarse';
  return 'disponible';
}

const ESTADOS = {
  disponible:   { label: 'En stock', tone: 'emerald' },
  por_agotarse: { label: 'Queda poco', tone: 'amber' },
  agotada:      { label: 'Agotada', tone: 'rose' },
  archivada:    { label: 'Archivada', tone: 'slate' },
};

export function EstadoPieza({ pieza }) {
  const e = ESTADOS[estadoDe(pieza)] ?? ESTADOS.disponible;
  return <Badge tone={e.tone}>{e.label}</Badge>;
}

/** El saldo, grande y con su unidad. */
export function Saldo({ cantidad, minimo = 0, className = '' }) {
  const n = Number(cantidad) || 0;
  const bajo = Number(minimo) > 0 && n > 0 && n <= Number(minimo);
  const color = n <= 0 ? 'text-rose-600' : bajo ? 'text-amber-700' : 'text-gris-900';
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      <span className={`text-[15px] font-bold tabular-nums ${color}`}>{n.toLocaleString('es-BO')}</span>
      <span className="text-[11px] text-gris-400">{n === 1 ? 'unidad' : 'unidades'}</span>
    </span>
  );
}

/* ─── Formulario ─── */

export function datosDesde(p) {
  return {
    nombre: p?.nombre ?? '',
    categoria: p?.categoria ?? '',
    compatibilidad: p?.compatibilidad ?? '',
    cantidad: p ? String(p.cantidad ?? 0) : '',
    minimo: p?.minimo ? String(p.minimo) : '',
    origen: p?.origen ?? '',
    codigo: p?.codigo ?? '',
    notas: p?.notas ?? '',
    precio_costo: montoInicial(p?.precio_costo),
    precio_venta: montoInicial(p?.precio_venta),
    activa: p ? Boolean(p.activa) : true,
  };
}

export function validarPieza(d, { conCantidad = true } = {}) {
  const e = {};
  if (!d.nombre.trim()) e.nombre = 'Escribe el nombre de la pieza.';
  if (conCantidad) {
    if (d.cantidad === '') e.cantidad = 'Escribe cuántas unidades hay.';
    else if (!Number.isInteger(Number(d.cantidad)) || Number(d.cantidad) < 0) e.cantidad = 'La cantidad tiene que ser un número entero.';
  }
  if (d.minimo !== '' && (!Number.isInteger(Number(d.minimo)) || Number(d.minimo) < 0)) {
    e.minimo = 'El mínimo tiene que ser un número entero.';
  }
  return validarPrecios(d, e);
}

export const payloadDe = (d) => ({
  nombre: d.nombre.trim(),
  categoria: d.categoria.trim(),
  compatibilidad: d.compatibilidad.trim(),
  cantidad: Number(d.cantidad || 0),
  minimo: Number(d.minimo || 0),
  origen: d.origen.trim(),
  codigo: d.codigo.trim().toUpperCase(),
  notas: d.notas.trim(),
  precio_costo: r2(d.precio_costo),
  precio_venta: r2(d.precio_venta),
  activa: d.activa,
});

export const useFormularioPieza = (inicial) => useFormularioInventario(inicial);

/**
 * Los campos de una pieza.
 *
 * En la edición no aparece la cantidad: el saldo entra por «Ingresar» o se corrige por «Ajustar»,
 * y así cada unidad que entra o sale deja su renglón en el historial. Si el formulario pudiera
 * reescribirlo, el historial pasaría a ser un cuento.
 */
export function CamposPieza({ form, categorias = [], sugerencias = [], edicion = false, saldo = 0, onMoverStock }) {
  const { data, errores, cambiar } = form;
  const lista = [...new Set([...(categorias || []), ...(sugerencias || [])])];

  return (
    <>
      <StepCard step={1} title="Qué pieza es" subtitle="El nombre es lo que se busca al vender o al reparar: escríbelo como lo dirías en voz alta.">
        <div className="grid gap-4">
          <Field label="Nombre de la pieza" error={errores.nombre} hint="Ej.: Pantalla incell, Batería original, Pin de carga.">
            <Input value={data.nombre} maxLength={160} autoComplete="off" placeholder="Ej.: Pantalla incell"
              onChange={(e) => cambiar('nombre', e.target.value)} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Categoría" error={errores.categoria} hint="Para agrupar el cajón: pantallas, baterías, flex…">
              <Input list="piezas-categorias" value={data.categoria} maxLength={60} autoComplete="off"
                placeholder="Ej.: Pantalla" onChange={(e) => cambiar('categoria', e.target.value)} />
            </Field>
            <Field label="Compatible con" error={errores.compatibilidad} hint="Qué equipos acepta esta pieza.">
              <Input value={data.compatibilidad} maxLength={160} autoComplete="off"
                placeholder="Ej.: iPhone 11 / 11 Pro" onChange={(e) => cambiar('compatibilidad', e.target.value)} />
            </Field>
          </div>
        </div>
        <Sugerencias id="piezas-categorias" valores={lista} />
      </StepCard>

      <StepCard step={2} title="Cuántas hay" subtitle="El saldo de esta pieza. Es lo que se descuenta al venderla o al usarla en una reparación.">
        {edicion ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gris-200 bg-gris-50 px-4 py-3.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-500">Saldo actual</p>
              <Saldo cantidad={saldo} minimo={data.minimo} className="mt-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onMoverStock?.('ingreso')}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-carbon-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-carbon-800">
                <PackagePlus className="h-4 w-4" /> Ingresar
              </button>
              <button type="button" onClick={() => onMoverStock?.('ajuste')}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-gris-200 bg-white px-4 text-sm font-semibold text-gris-700 transition-colors hover:bg-gris-50">
                <PackageMinus className="h-4 w-4" /> Ajustar
              </button>
            </div>
          </div>
        ) : (
          <Field label="Cantidad" error={errores.cantidad} hint="Cuántas unidades entran hoy al inventario.">
            <Input type="number" min="0" step="1" inputMode="numeric" className="text-base font-bold tabular-nums"
              placeholder="0" value={data.cantidad} onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => cambiar('cantidad', e.target.value)} />
          </Field>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Avisar cuando queden" error={errores.minimo} hint="Déjalo en blanco si no quieres el aviso.">
            <Input type="number" min="0" step="1" inputMode="numeric" className="tabular-nums" placeholder="Ej.: 2"
              value={data.minimo} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => cambiar('minimo', e.target.value)} />
          </Field>
          <Field label="De dónde salió" error={errores.origen} hint="El despiece o el proveedor. Es un dato interno.">
            <Input value={data.origen} maxLength={160} autoComplete="off" placeholder="Ej.: Despiece iPhone 11 IMEI 3521…"
              onChange={(e) => cambiar('origen', e.target.value)} />
          </Field>
        </div>

        {edicion && (
          <Nota>Editar la ficha no mueve el saldo. Las unidades entran por «Ingresar» y se corrigen por «Ajustar»: así queda anotado quién, cuándo y por qué.</Nota>
        )}
      </StepCard>

      <StepCard step={3} title="Precios" subtitle="A cuánto entra la pieza y a cuánto sale. El vendedor solo ve el precio de venta.">
        <CamposPrecio data={data} errores={errores} cambiar={cambiar} />
      </StepCard>

      <StepCard step={4} title="Lo opcional" subtitle="Nada de esto hace falta para vender: sirve para encontrar la pieza entre cientos.">
        <div className="grid gap-4">
          <Field label="Código" error={errores.codigo} hint="Si le pones etiqueta al cajón, escríbela acá y se podrá buscar por ella.">
            <Input value={data.codigo} maxLength={60} autoComplete="off" placeholder="Ej.: PANT-11"
              className="uppercase" onChange={(e) => cambiar('codigo', e.target.value)} />
          </Field>
          <Field label="Notas" error={errores.notas}>
            <Textarea rows={2} value={data.notas} placeholder="Ej.: son las que vienen sin sensor de proximidad"
              onChange={(e) => cambiar('notas', e.target.value)} />
          </Field>
          <div className="flex items-start justify-between gap-4 rounded-xl border border-gris-200 px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-gris-900">Disponible para vender y reparar</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gris-500">
                Al apagarlo la pieza queda archivada: no aparece al vender ni al cargar un servicio, pero conserva su historial.
              </p>
            </div>
            <Switch checked={data.activa} onChange={(v) => cambiar('activa', v)} label="Disponible" />
          </div>
        </div>
      </StepCard>
    </>
  );
}

/** El costado del formulario: qué se está por guardar y cuánto vale. */
export function ResumenPieza({ data, saldo = null, children }) {
  const cantidad = saldo ?? Number(data.cantidad || 0);
  const valor = cantidad * (Number(data.precio_venta) || 0);
  const invertido = cantidad * (Number(data.precio_costo) || 0);

  return (
    <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
      <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
          <IconoPieza className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen de la pieza
        </h2>
        <Saldo cantidad={cantidad} minimo={data.minimo} />
      </div>

      <div className="space-y-4 p-5">
        <dl className="space-y-1.5 text-sm">
          <Linea label="Pieza" valor={data.nombre.trim()} />
          <Linea label="Categoría" valor={data.categoria.trim()} />
          <Linea label="Compatible" valor={data.compatibilidad.trim()} />
          {data.codigo.trim() && <Linea label="Código" valor={data.codigo.trim().toUpperCase()} mono />}
        </dl>

        <CajaPrecio costo={data.precio_costo} venta={data.precio_venta} />

        {cantidad > 0 && Number(data.precio_venta) > 0 && (
          <dl className="space-y-1.5 border-t border-gris-100 pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gris-500">Valor de este stock</dt>
              <dd className="font-semibold tabular-nums text-gris-900">{bsFmt(valor)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gris-500">Invertido</dt>
              <dd className="font-semibold tabular-nums text-gris-500">{bsFmt(invertido)}</dd>
            </div>
          </dl>
        )}

        {!data.activa && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>Archivada: no va a aparecer al vender ni al cargar un servicio.</span>
          </p>
        )}

        {children}
      </div>
    </section>
  );
}

/* ─── Movimientos de stock ─── */

const TEXTOS_MOVIMIENTO = {
  ingreso: {
    titulo: 'Ingresar unidades',
    ayuda: 'Llegó un pedido o se despiezó un equipo. Se suman al saldo que ya hay.',
    campo: 'Cuántas entran',
    motivo: 'Ej.: llegó el pedido del 12/09',
    boton: 'Ingresar al stock',
  },
  ajuste: {
    titulo: 'Ajustar el saldo',
    ayuda: 'Contaste el cajón y no coincide. Escribe lo que contaste: el sistema anota la diferencia.',
    campo: 'Cuántas contaste',
    motivo: 'Ej.: conteo físico de fin de mes',
    boton: 'Guardar el conteo',
  },
};

/**
 * Entrada de mercadería o corrección de saldo.
 *
 * Son dos verbos distintos a propósito. «Ingresar» suma, y es lo de todos los días. «Ajustar» fija
 * el saldo en lo que se contó, y es lo que se usa cuando algo se rompió o se traspapeló: el sistema
 * calcula la diferencia y la deja anotada, que es justamente lo que después hay que poder explicar.
 */
export function ModalStock({ pieza, accion = 'ingreso', onCerrar, onHecho }) {
  const t = TEXTOS_MOVIMIENTO[accion] ?? TEXTOS_MOVIMIENTO.ingreso;
  const [cantidad, setCantidad] = useState(accion === 'ajuste' ? String(pieza?.cantidad ?? 0) : '');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const saldoActual = Number(pieza?.cantidad) || 0;
  const n = cantidad === '' ? null : Number(cantidad);
  const saldoFinal = n === null ? saldoActual : (accion === 'ingreso' ? saldoActual + n : n);
  const diferencia = saldoFinal - saldoActual;

  const guardar = () => {
    if (guardando) return;
    if (n === null || !Number.isInteger(n) || n < 0) {
      setError('Escribe un número entero de unidades.');
      return;
    }
    if (accion === 'ingreso' && n === 0) {
      setError('Para que entre algo, la cantidad tiene que ser mayor a cero.');
      return;
    }

    router.post(route('admin.piezas.stock', pieza.id), { accion, cantidad: n, motivo: motivo.trim() }, {
      preserveScroll: true,
      onStart: () => setGuardando(true),
      onSuccess: () => { notifyRecordsUpdated(); onHecho?.(); onCerrar(); },
      onError: (errs) => setError(Object.values(errs)[0] ?? 'No se pudo guardar el movimiento.'),
      onFinish: () => setGuardando(false),
    });
  };

  return (
    <Modal
      title={t.titulo}
      onClose={onCerrar}
      footer={(
        <>
          <button type="button" onClick={onCerrar} className={buttonCls('secondary')}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className={buttonCls('primary')}>
            {guardando ? 'Guardando…' : t.boton}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gris-50 px-4 py-3">
          <p className="truncate text-[15px] font-bold text-gris-900">{pieza?.nombre}</p>
          <p className="mt-0.5 text-xs text-gris-500">
            {[pieza?.compatibilidad, pieza?.codigo].filter(Boolean).join(' · ') || 'Sin más datos'}
          </p>
          <p className="mt-2 text-[13px] text-gris-600">Hoy hay <Saldo cantidad={saldoActual} minimo={pieza?.minimo} />.</p>
        </div>

        <p className="text-[13px] leading-relaxed text-gris-600">{t.ayuda}</p>

        <Field label={t.campo} error={error}>
          <Input type="number" min="0" step="1" inputMode="numeric" autoFocus className="text-base font-bold tabular-nums"
            value={cantidad} onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => { setCantidad(e.target.value); setError(null); }} />
        </Field>

        <Field label="Motivo (opcional)" hint="Queda en el historial de la pieza.">
          <Input value={motivo} maxLength={200} placeholder={t.motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>

        {n !== null && Number.isInteger(n) && n >= 0 && (
          <p className={`rounded-xl px-4 py-3 text-[13px] font-semibold ${
            diferencia === 0 ? 'bg-gris-100 text-gris-600'
              : diferencia > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
            {diferencia === 0
              ? 'El saldo queda igual: no se anota ningún movimiento.'
              : `${diferencia > 0 ? 'Entran' : 'Salen'} ${Math.abs(diferencia)} ${Math.abs(diferencia) === 1 ? 'unidad' : 'unidades'} y quedan ${saldoFinal}.`}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** El historial de una pieza: qué se movió, cuándo y por qué. */
export function HistorialPieza({ movimientos = [] }) {
  if (movimientos.length === 0) {
    return (
      <p className="rounded-xl bg-gris-50 px-4 py-3 text-[13px] leading-relaxed text-gris-500">
        Todavía no hay movimientos. Van a aparecer acá en cuanto la pieza se venda, se use en una reparación o entre mercadería.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gris-100">
      {movimientos.map((m) => (
        <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gris-900">{m.etiqueta}</p>
            <p className="mt-0.5 truncate text-xs text-gris-500">
              {[m.motivo, m.quien, fmtFecha(m.fecha)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-[13px] font-bold tabular-nums ${m.cantidad >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {m.cantidad >= 0 ? '+' : '−'}{Math.abs(m.cantidad)}
            </p>
            <p className="text-[11px] text-gris-400">quedan {m.saldo}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
