import { Link } from '@inertiajs/react';
import { useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, ChevronRight, ExternalLink, History, Info, Lock, PackageCheck,
  Pencil, Repeat, ShoppingBag, ShoppingCart, Store, Trash2, TrendingUp,
} from 'lucide-react';
import { Badge, Button, Field, Input, Modal, Segmented, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';
import { CONDICIONES, CondicionBadge } from '@/Components/Admin/condicion';

// Piezas comunes de las pantallas de inventario (celulares, computadoras…): la misma línea en todas.

/* ─── Estados y formatos ─── */

export const ESTADOS = {
  disponible: { label: 'Disponible', tone: 'emerald', icon: PackageCheck, ayuda: 'Se puede vender y cotizar.' },
  vendido: { label: 'Vendido', tone: 'slate', icon: ShoppingBag, ayuda: 'Ya no se puede vender ni cotizar.' },
  permuta: { label: 'Permuta', tone: 'blue', icon: Repeat, ayuda: 'Recibido como parte de pago. Márcalo como disponible cuando esté listo para la venta.' },
};

export const OPCIONES_ESTADO = Object.entries(ESTADOS).map(([value, e]) => ({ value, label: e.label, icon: e.icon }));

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado];
  return e ? <Badge tone={e.tone}>{e.label}</Badge> : <Badge>{estado || '—'}</Badge>;
}

export const checkCls = 'h-4 w-4 cursor-pointer rounded border-gris-300 text-[#121214] focus:ring-2 focus:ring-[rgb(var(--acento-rgb)_/_0.3)] focus:ring-offset-0';

// Palabras con escritura propia
const PALABRAS = {
  iphone: 'iPhone', ipad: 'iPad', imac: 'iMac', macbook: 'MacBook', mac: 'Mac', airpods: 'AirPods',
  pro: 'Pro', max: 'Max', mini: 'mini', plus: 'Plus', air: 'Air', se: 'SE', neo: 'Neo', ultra: 'Ultra', studio: 'Studio',
  xs: 'XS', xr: 'XR', xl: 'XL', gb: 'GB', tb: 'TB', ram: 'RAM', ssd: 'SSD', icore: 'Intel Core', chip: 'chip',
  m1: 'M1', m2: 'M2', m3: 'M3', m4: 'M4', m5: 'M5', i3: 'i3', i5: 'i5', i7: 'i7', i9: 'i9',
  inch: 'inch', pulgadas: 'pulgadas', de: 'de', del: 'del', y: 'y', con: 'con',
};

/** "MACBOOK AIR 13 M4 256GB" → "MacBook Air 13 M4 256 GB" */
export function bonito(texto) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim().replace(/(\d+)\s*(gb|tb)\b/gi, '$1 $2');
  if (!t) return '';
  return t.split(' ').map((w) => {
    const lower = w.toLowerCase();
    if (PALABRAS[lower]) return PALABRAS[lower];
    if (/^\d/.test(w)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

// "permuta" es el texto provisional que dejan los equipos registrados desde una venta con permuta
export const util = (v) => {
  const t = String(v ?? '').trim();
  return t !== '' && t !== '-' && t !== '0' && t.toLowerCase() !== 'permuta';
};

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const MAX_MONTO = 99999999.99;
export const montoInicial = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));

export function rentabilidad(costo, venta) {
  const v = Number(venta) || 0;
  const ganancia = r2(v - (Number(costo) || 0));
  return { ganancia, margen: v > 0 ? Math.round((ganancia / v) * 100) : null };
}

/** Revisa el costo y el precio de venta; agrega los errores a `e`. */
export function validarPrecios(d, e) {
  [['precio_costo', 'Escribe el precio de costo.'], ['precio_venta', 'Escribe el precio de venta.']].forEach(([campo, falta]) => {
    const n = Number(d[campo]);
    if (d[campo] === '') e[campo] = falta;
    else if (!Number.isFinite(n) || n < 0) e[campo] = 'Escribe un monto válido.';
    else if (n > MAX_MONTO) e[campo] = 'El monto es demasiado grande.';
  });
  return e;
}

const TZ = 'America/La_Paz';

export const fmtFecha = (v, largo = false) => {
  if (!v) return '—';
  const opciones = largo ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-BO', opciones);
  }
  return new Date(v).toLocaleDateString('es-BO', { ...opciones, timeZone: TZ });
};

/* ─── Formulario ─── */

/** Estado de un formulario de inventario. `alias` junta varios campos en un mismo error (por ejemplo, la batería). */
export function useFormularioInventario(inicial, alias = {}) {
  const [data, setData] = useState(inicial);
  const [errores, setErrores] = useState({});

  const cambiar = (campo, valor) => {
    setData((d) => ({ ...d, [campo]: valor }));
    const claveError = alias[campo] ?? campo;
    setErrores((e) => {
      if (!e[claveError]) return e;
      const { [claveError]: _omitido, ...resto } = e;
      return resto;
    });
  };

  return { data, setData, errores, setErrores, cambiar };
}

export function Sugerencias({ id, valores = [] }) {
  return <datalist id={id}>{valores.map((v) => <option key={v} value={v} />)}</datalist>;
}

export function Nota({ children, tono = 'slate' }) {
  const tonos = {
    slate: 'bg-gris-50 text-gris-600',
    amber: 'border border-amber-200 bg-amber-50 text-amber-900',
  };
  const Icon = tono === 'amber' ? AlertTriangle : Info;
  return (
    <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] ${tonos[tono]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tono === 'amber' ? 'text-amber-600' : 'text-[color:var(--acento)]'}`} /> <span>{children}</span>
    </p>
  );
}

/** Botones con los valores más comunes y un campo para escribir otro. */
export function SelectorRapido({
  label, opciones, valor, error, hint, onChange, igual = (a, b) => a === b, placeholder = 'Otra', anchoOtra = 'w-28', lista,
}) {
  const elegido = opciones.some((o) => igual(o, valor));
  return (
    <Field label={label} error={error} hint={hint}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
        {opciones.map((o) => {
          const sel = igual(o, valor);
          return (
            <button key={o} type="button" aria-pressed={sel} onClick={() => onChange(o)}
              className={`h-10 rounded-xl border px-3.5 text-sm font-semibold tabular-nums transition-colors ${
                sel ? 'border-[#121214] bg-[#121214] text-white shadow-[0_8px_18px_-10px_rgba(10, 10, 11,0.6)]' : 'border-gris-200 bg-white text-gris-600 hover:border-gris-300 hover:text-gris-900'
              }`}>
              {o}
            </button>
          );
        })}
        <input value={elegido ? '' : valor} maxLength={100} placeholder={placeholder} aria-label={`${label}: otra`} autoComplete="off" list={lista}
          onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-10 ${anchoOtra}`} />
      </div>
    </Field>
  );
}

export function CampoCondicion({ valor, error, onChange }) {
  const condicion = CONDICIONES.find((c) => c.value === valor);
  return (
    <Field label="Condición" error={error}
      hint={condicion?.ayuda ?? 'Se elige al cargar el producto; nunca se deduce sola.'}>
      <Segmented options={CONDICIONES} value={valor} ariaLabel="Condición" onChange={onChange} />
    </Field>
  );
}

export function CampoMonto({ label, valor, error, onChange }) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gris-400">Bs</span>
        <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" className="pl-11 text-base font-bold tabular-nums"
          value={valor} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

/** Costo, venta y la ganancia (o pérdida) que dejan. */
export function CamposPrecio({ data, errores, cambiar }) {
  const hayPrecios = data.precio_costo !== '' && data.precio_venta !== '';
  const rent = rentabilidad(data.precio_costo, data.precio_venta);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <CampoMonto label="Precio de costo" valor={data.precio_costo} error={errores.precio_costo} onChange={(v) => cambiar('precio_costo', v)} />
        <CampoMonto label="Precio de venta" valor={data.precio_venta} error={errores.precio_venta} onChange={(v) => cambiar('precio_venta', v)} />
      </div>
      {hayPrecios && (rent.ganancia >= 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold text-emerald-800">
          <TrendingUp className="h-4 w-4 shrink-0" /> Ganancia de {bsFmt(rent.ganancia)}{rent.margen != null ? ` · ${rent.margen} % del precio de venta` : ''}
        </p>
      ) : (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> El precio de venta es menor al costo: se pierden {bsFmt(-rent.ganancia)}.
        </p>
      ))}
    </>
  );
}

export function CampoProcedencia({ valor, error, onChange, sugerencias = [], lista = 'inventario-procedencias' }) {
  return (
    <>
      <Field label="Procedencia" error={error} hint="Proveedor o de dónde llegó. Es un dato interno.">
        <Input list={lista} value={valor} maxLength={100} autoComplete="off" placeholder="Ej.: EEUU" onChange={(e) => onChange(e.target.value)} />
      </Field>
      <Sugerencias id={lista} valores={sugerencias} />
    </>
  );
}

export function CampoEstado({ valor, error, onChange, aviso = null }) {
  const estado = ESTADOS[valor] ?? ESTADOS.disponible;
  return (
    <>
      <Field label="Estado" error={error}>
        <Segmented options={OPCIONES_ESTADO} value={valor} ariaLabel="Estado" onChange={onChange} />
      </Field>
      <Nota>{estado.ayuda}</Nota>
      {aviso}
    </>
  );
}

export function Linea({ label, valor, mono = false }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gris-500">{label}</dt>
      <dd className={`min-w-0 truncate text-right font-semibold text-gris-900 ${mono ? 'font-mono text-[13px]' : ''}`}>{valor || '—'}</dd>
    </div>
  );
}

/** Caja azul del resumen: precio de venta, costo y ganancia. */
export function CajaPrecio({ costo, venta }) {
  const rent = rentabilidad(costo, venta);
  const hayPrecios = costo !== '' && venta !== '';
  return (
    <div className="rounded-xl bg-[#121214] px-4 py-3.5 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Precio de venta</p>
      <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{bsFmt(venta)}</p>
      <p className="mt-1.5 text-xs text-white/70">
        {hayPrecios
          ? `Costo ${bsFmt(costo)} · ${rent.ganancia >= 0 ? `Ganancia ${bsFmt(rent.ganancia)}` : 'Bajo el costo'}`
          : 'Escribe el costo y el precio de venta.'}
      </p>
    </div>
  );
}

export function ErroresResumen({ errores }) {
  const mensajes = [...new Set(Object.values(errores).flat())];
  if (mensajes.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      <p className="mb-1 font-semibold">Revisa estos datos:</p>
      <ul className="list-disc space-y-1 pl-5">
        {mensajes.map((m) => <li key={m}>{m}</li>)}
      </ul>
    </div>
  );
}

export function EncabezadoFormulario({ volverUrl, volverLabel, titulo, subtitulo }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={volverUrl} aria-label={volverLabel}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-[32px] font-extrabold leading-tight tracking-tight text-[#121214]" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
          {titulo}
        </h1>
        {subtitulo && <p className="truncate text-sm text-gris-500">{subtitulo}</p>}
      </div>
    </div>
  );
}

/* ─── Listado ─── */

export function Stat({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'bg-[#121214]/[0.07] text-[#121214]',
    emerald: 'bg-emerald-50 text-emerald-700',
    lila: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    slate: 'bg-gris-100 text-gris-600',
  };
  return (
    <div className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[13px] font-semibold text-gris-500">{label}</p>
      </div>
      <p className="mt-4 text-[24px] font-extrabold leading-none tracking-tight tabular-nums text-gris-900">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-gris-400">{hint}</p>}
    </div>
  );
}

export function PrecioConGanancia({ costo, venta }) {
  const { ganancia } = rentabilidad(costo, venta);
  return (
    <div className="text-right">
      <p className="font-bold tabular-nums text-gris-900">{bsFmt(venta)}</p>
      <p className={`text-xs font-semibold tabular-nums ${ganancia < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
        {ganancia < 0 ? `Bajo el costo (−${bsFmt(-ganancia)})` : `+${bsFmt(ganancia)}`}
      </p>
    </div>
  );
}

// En los vendidos no se avisa nada; en los demás se marca si falta la condición
export function CondicionFila({ condicion, estado }) {
  return <CondicionBadge condicion={condicion} vacio={estado !== 'vendido' ? <Badge tone="amber">Sin condición</Badge> : null} />;
}

/** Por qué un equipo del listado no se puede eliminar (null si se puede). */
export function motivoEnListado(id, conHistorial) {
  if (conHistorial.has(id)) return 'Figura en ventas o reservas: se conserva para no perder el historial.';
  return null;
}

export function AccionesFila({ editarUrl, nombre, estado, motivo, onBorrar, onHabilitar }) {
  return (
    <div className="flex justify-end gap-1.5">
      {estado === 'permuta' && (
        <button type="button" onClick={onHabilitar} title="Marcar como disponible para vender"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Habilitar
        </button>
      )}
      <Link href={editarUrl}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gris-200 bg-white px-2.5 text-xs font-semibold text-gris-600 transition-colors hover:border-[#121214] hover:bg-[#121214] hover:text-white">
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Link>
      {motivo ? (
        <span title={motivo} aria-label={`No se puede eliminar: ${motivo}`}
          className="grid h-8 w-8 cursor-not-allowed place-items-center rounded-lg border border-gris-100 bg-gris-50 text-gris-300">
          <Lock className="h-3.5 w-3.5" />
        </span>
      ) : (
        <button type="button" onClick={onBorrar} title="Eliminar" aria-label={`Eliminar ${nombre}`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-gris-200 bg-white text-gris-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Aviso sobre el listado con una acción ("Ver cuáles"). */
export function Aviso({ tono = 'lila', icon: Icon = Store, children, accion = 'Ver cuáles', onAccion }) {
  const tonos = {
    lila: { caja: 'border-[rgb(var(--acento-rgb)_/_0.25)] bg-[rgb(var(--acento-rgb)_/_0.06)] text-gris-800', icono: 'text-[color:var(--acento)]', boton: buttonCls('secondary', 'h-9 px-3') },
    amber: { caja: 'border-amber-200 bg-amber-50 text-amber-900', icono: 'text-amber-600', boton: buttonCls('secondary', 'h-9 border-amber-300 px-3 text-amber-900 hover:bg-amber-100') },
  };
  const t = tonos[tono] ?? tonos.lila;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5 text-sm ${t.caja}`}>
      <Icon className={`h-5 w-5 shrink-0 ${t.icono}`} />
      <p className="flex-1">{children}</p>
      {onAccion && <button type="button" onClick={onAccion} className={t.boton}>{accion}</button>}
    </div>
  );
}

export function ChipsEstado({ filtros, activo, conteo, onChange, etiqueta = 'Filtrar por estado' }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={etiqueta}>
      {filtros.map((f) => {
        const sel = activo === f.key;
        const color = sel
          ? (f.alerta ? 'bg-amber-500 text-white' : 'bg-[#121214] text-white')
          : (f.alerta ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-gris-100 text-gris-600 hover:bg-gris-200');
        return (
          <button key={f.key} type="button" onClick={() => onChange(f.key)} aria-pressed={sel}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${color}`}>
            {f.label} <span className={sel ? 'text-white/70' : 'opacity-60'}>{(conteo[f.key] ?? 0).toLocaleString('es-BO')}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Página actual de una lista ya filtrada, con los datos que usa el Paginador. */
export function paginar(lista, pagina, porPagina) {
  const total = lista.length;
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, ultima);
  return {
    visibles: lista.slice((actual - 1) * porPagina, actual * porPagina),
    meta: {
      current_page: actual,
      last_page: ultima,
      total,
      from: total ? (actual - 1) * porPagina + 1 : 0,
      to: Math.min(actual * porPagina, total),
    },
  };
}

/** Selección de filas del listado (por página o toda la lista filtrada). */
export function useSeleccion(visibles, filtrados) {
  const [seleccion, setSeleccion] = useState([]);
  const paginaMarcada = visibles.length > 0 && visibles.every((c) => seleccion.includes(c.id));

  return {
    seleccion,
    setSeleccion,
    paginaMarcada,
    todosMarcados: filtrados.length > 0 && filtrados.every((c) => seleccion.includes(c.id)),
    alternar: (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    alternarPagina: () => setSeleccion((s) => (paginaMarcada
      ? s.filter((id) => !visibles.some((c) => c.id === id))
      : [...new Set([...s, ...visibles.map((c) => c.id)])])),
    seleccionarTodos: () => setSeleccion((s) => [...new Set([...s, ...filtrados.map((c) => c.id)])]),
  };
}

/** Barra fija con lo seleccionado: marcar la condición de todos a la vez. */
export function BarraSeleccion({ cantidad, total, todosMarcados, hayMas, onSeleccionarTodos, onMarcar, onQuitar, aplicando }) {
  if (!cantidad) return null;
  return (
    <div className="sticky bottom-4 z-30">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[#121214] px-5 py-3 text-white shadow-[0_18px_40px_-18px_rgba(10, 10, 11,0.8)]">
        <p className="text-sm font-bold">{cantidad} {cantidad === 1 ? 'seleccionado' : 'seleccionados'}</p>
        {!todosMarcados && hayMas && (
          <button type="button" onClick={onSeleccionarTodos}
            className="text-sm font-semibold text-white/80 underline-offset-2 hover:text-white hover:underline">
            Seleccionar los {total.toLocaleString('es-BO')} de la lista
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-white/70">Marcar como</span>
          {CONDICIONES.map((c) => {
            const Icon = c.icon;
            return (
              <button key={c.value} type="button" disabled={aplicando} onClick={() => onMarcar(c.value)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50">
                <Icon className="h-4 w-4" /> {c.label}
              </button>
            );
          })}
          <button type="button" onClick={onQuitar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white">
            Quitar selección
          </button>
        </div>
      </div>
    </div>
  );
}

/** `advertencia` explica qué pasa al borrar. */
export function ModalEliminar({
  titulo, icon: Icon, nombre, detalle, procesando, onConfirmar, onCerrar,
  advertencia = 'Se borra del inventario y no se puede deshacer.',
}) {
  return (
    <Modal
      title={titulo}
      onClose={() => !procesando && onCerrar()}
      footer={(
        <>
          <Button onClick={onCerrar} disabled={procesando}>Cancelar</Button>
          <button type="button" onClick={onConfirmar} disabled={procesando}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> {procesando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </>
      )}
    >
      <div className="flex items-center gap-3 rounded-xl bg-gris-50 px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-gris-500"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="truncate font-bold text-gris-900">{nombre}</p>
          {detalle && <p className="truncate text-xs text-gris-500">{detalle}</p>}
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-gris-600">{advertencia}</p>
    </Modal>
  );
}

/* ─── Edición ─── */

const MOVIMIENTOS = {
  venta: { icon: ShoppingCart, tone: 'bg-[#121214]/[0.07] text-[#121214]' },
  permuta: { icon: Repeat, tone: 'bg-blue-50 text-blue-700' },
  reserva: { icon: CalendarCheck, tone: 'bg-amber-50 text-amber-700' },
};

function Movimiento({ m }) {
  const tipo = MOVIMIENTOS[m.tipo] ?? MOVIMIENTOS.venta;
  const Icon = tipo.icon;
  const contenido = (
    <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tipo.tone}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gris-900">
          {m.titulo} {m.codigo && <span className="font-mono text-[color:var(--acento)]">{m.codigo}</span>}
        </span>
        <span className="block truncate text-xs text-gris-500">{fmtFecha(m.fecha)}{m.detalle ? ` · ${m.detalle}` : ''}</span>
      </span>
      <span className="shrink-0 text-sm font-bold tabular-nums text-gris-900">{bsFmt(m.monto)}</span>
      {m.externo
        ? <ExternalLink className="h-4 w-4 shrink-0 text-gris-300 transition-colors group-hover:text-gris-600" />
        : <ChevronRight className="h-4 w-4 shrink-0 text-gris-300 transition-colors group-hover:text-gris-600" />}
    </>
  );
  const cls = 'group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gris-50';
  return m.externo
    ? <a href={m.url} target="_blank" rel="noopener noreferrer" className={cls} title="Abrir el documento">{contenido}</a>
    : <Link href={m.url} className={cls} title="Ver la venta">{contenido}</Link>;
}

export function HistorialEquipo({ historial = [] }) {
  return (
    <section className="rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]"><History className="h-5 w-5" /></span>
        <div>
          <h2 className="text-base font-bold text-gris-900">Historial del equipo</h2>
          <p className="mt-0.5 text-[13px] text-gris-500">Ventas, permutas y reservas en las que figura.</p>
        </div>
      </div>
      {historial.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gris-200 bg-gris-50/60 px-4 py-8 text-center text-sm text-gris-500">
          Todavía no figura en ventas ni reservas.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-gris-100">
          {historial.map((m, i) => <li key={`${m.tipo}-${m.codigo}-${i}`}><Movimiento m={m} /></li>)}
        </ul>
      )}
    </section>
  );
}

/** Eliminar el equipo del inventario, con el motivo cuando no se puede. */
export function ZonaPeligro({ bloqueo, onEliminar, sustantivo = 'equipo' }) {
  return (
    <section className="rounded-[14px] border border-gris-200 bg-white shadow-sutil">
      <div className="flex flex-wrap items-center gap-4 p-5 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[color:var(--peligro-fondo)] text-peligro">
          <Trash2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gris-900">Eliminar {sustantivo}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gris-500">
            {bloqueo ?? 'Se borra del inventario y no se puede deshacer.'}
          </p>
        </div>
        {bloqueo ? (
          <span className={buttonCls('secondary', 'h-10 cursor-not-allowed opacity-60')}>
            <Lock className="h-4 w-4" /> No se puede eliminar
          </span>
        ) : (
          <button type="button" onClick={onEliminar} className={buttonCls('danger', 'h-10')}>
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        )}
      </div>
    </section>
  );
}
