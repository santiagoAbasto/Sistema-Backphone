import { useEffect, useState } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import { Barcode, Boxes, CheckCircle2, Loader2, Package, PackageMinus, PackagePlus, Wallet, XCircle } from 'lucide-react';
import { Field, Input, Segmented, StepCard, bsFmt } from '@/Components/Admin/ui';
import { MENSAJE_CONDICION } from '@/Components/Admin/condicion';
import {
  CajaPrecio, CampoCondicion, CampoProcedencia, CamposPrecio, EstadoBadge, Linea, Nota, Sugerencias,
  bonito, montoInicial, r2, r2Opcional, useFormularioInventario, validarPrecios,
} from '@/Components/Admin/inventario';
import { Saldo } from '@/Components/Admin/piezas';

// Piezas de las pantallas de productos generales: fundas, vidrios, cargadores y accesorios.
// Van por cantidad, como las piezas: un registro es un producto («Vidrio templado 9D · iPhone 13 ·
// Premium») con cuántos quedan. Lo común a todo el inventario está en inventario.jsx.

export const TIPOS = [
  { value: 'funda', label: 'Funda' },
  { value: 'vidrio_templado', label: 'Vidrio templado' },
  { value: 'vidrio_camara', label: 'Vidrio de cámara' },
  { value: 'cargador_20w', label: 'Cargador 20W' },
  { value: 'cargador_5w', label: 'Cargador 5W' },
  { value: 'accesorio', label: 'Accesorio' },
  { value: 'otro', label: 'Otro' },
];

export const tipoTexto = (v) => TIPOS.find((t) => t.value === v)?.label ?? bonito(String(v ?? '').replace(/_/g, ' '));
export const nombreProducto = (p) => bonito(p?.nombre) || 'Producto';
/** Lo que distingue a un producto de otro con el mismo nombre: para qué equipo es y su calidad. */
export const detalleProducto = (p) => [p?.modelo, p?.calidad].map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ');

/** Siguiente código de la serie: FUNDACHAV_1 → FUNDACHAV_2, FUNDA-009 → FUNDA-010. Sin número al final, agrega _2. */
export function siguienteCodigo(codigo) {
  const t = String(codigo ?? '').trim();
  if (!t) return '';
  const m = t.match(/^(.*?)(\d+)$/);
  if (!m) return `${t}_2`;
  const n = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  return `${m[1]}${n}`;
}

/* ─── Formulario ─── */

export function datosDesde(p) {
  return {
    codigo: p?.codigo ?? '',
    tipo: p?.tipo ?? '',
    nombre: p?.nombre ?? '',
    modelo: p?.modelo ?? '',
    calidad: p?.calidad ?? '',
    cantidad: p ? String(p.cantidad ?? 0) : '',
    condicion: p?.condicion ?? 'Nuevo',
    procedencia: p?.procedencia ?? '',
    precio_costo: montoInicial(p?.precio_costo),
    precio_venta: montoInicial(p?.precio_venta),
    precio_tienda: montoInicial(p?.precio_tienda),
  };
}

/** Al cargar, la cantidad es obligatoria y el código no (lo pone el sistema). Al editar, al revés. */
export function validarProductoGeneral(d, { edicion = false } = {}) {
  const e = {};
  if (edicion && !d.codigo.trim()) e.codigo = 'Escribe el código.';
  if (!d.tipo) e.tipo = 'Elige el tipo de producto.';
  if (!d.nombre.trim()) e.nombre = 'Escribe el nombre.';
  if (!d.condicion) e.condicion = MENSAJE_CONDICION;
  if (!d.procedencia.trim()) e.procedencia = 'Escribe de dónde llegó el producto.';
  if (!edicion) {
    const n = Number(d.cantidad);
    if (d.cantidad === '') e.cantidad = 'Escribe cuántas unidades llegaron.';
    else if (!Number.isInteger(n) || n < 1) e.cantidad = 'Tiene que entrar al menos una unidad (número entero).';
  }
  return validarPrecios(d, e);
}

export const payloadDe = (d, { edicion = false } = {}) => ({
  codigo: d.codigo.trim().toUpperCase(),
  tipo: d.tipo,
  nombre: d.nombre.trim(),
  modelo: d.modelo.trim(),
  calidad: d.calidad.trim(),
  ...(edicion ? {} : { cantidad: Number(d.cantidad || 0) }),
  condicion: d.condicion || null,
  procedencia: d.procedencia.trim(),
  precio_costo: r2(d.precio_costo),
  precio_venta: r2(d.precio_venta),
  precio_tienda: r2Opcional(d.precio_tienda),
});

export const useFormularioProductoGeneral = (inicial) => useFormularioInventario(inicial);

/** Revisa en vivo si el código ya existe (sin contar el producto que se edita). */
export function useCodigoDisponible(codigo, original = '') {
  const [estado, setEstado] = useState('vacio');

  useEffect(() => {
    const c = codigo.trim().toUpperCase();
    if (!c) return setEstado('vacio');
    if (original && c === original.toUpperCase()) return setEstado('propio');

    setEstado('revisando');
    const control = new AbortController();
    const espera = setTimeout(() => {
      axios.get(route('admin.productos-generales.verificar-codigo'), { params: { codigo: c }, signal: control.signal })
        .then(({ data }) => setEstado(data.existe ? 'ocupado' : 'libre'))
        .catch((err) => { if (err.name !== 'CanceledError') setEstado('vacio'); });
    }, 300);

    return () => { clearTimeout(espera); control.abort(); };
  }, [codigo, original]);

  return estado;
}

function EstadoCodigo({ estado }) {
  if (estado === 'revisando') return <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gris-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Revisando el código…</p>;
  if (estado === 'libre') return <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Código disponible</p>;
  if (estado === 'ocupado') return <p className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700"><XCircle className="h-3.5 w-3.5" /> Ya hay un producto con este código.</p>;
  return null;
}

/**
 * Los bloques del formulario. `refs` permite enfocar un campo desde la página.
 *
 * En la edición no aparece la cantidad: el saldo entra por «Ingresar» y se corrige por «Ajustar» o
 * por el conteo, y así cada unidad que entra o sale deja su renglón en el historial.
 */
export function CamposProductoGeneral({ form, sugerencias = {}, pasos = false, refs = {}, estadoCodigo = 'vacio', edicion = false, saldo = 0, onMoverStock }) {
  const { data, errores, cambiar } = form;

  return (
    <>
      <StepCard step={pasos ? 1 : undefined} icon={Package} title="Producto" subtitle="Qué es, para qué equipo y de qué calidad.">
        <div className="grid gap-4">
          <Field label="Tipo" error={errores.tipo}>
            <Segmented cols="grid-cols-2 sm:grid-cols-4" options={TIPOS} value={data.tipo} ariaLabel="Tipo de producto"
              onChange={(v) => cambiar('tipo', v)} />
          </Field>

          <div>
            <Field label="Nombre" error={errores.nombre} hint="Como se reconoce en ventas y cotizaciones. Ej.: Vidrio templado 9D.">
              <Input ref={refs.nombre} list="generales-nombres" value={data.nombre} maxLength={255} autoComplete="off" placeholder="Ej.: Vidrio templado 9D"
                onChange={(e) => cambiar('nombre', e.target.value)} />
            </Field>
            <Sugerencias id="generales-nombres" valores={sugerencias.nombres} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Field label="Modelo" error={errores.modelo} hint="El equipo para el que es. Déjalo vacío si sirve para todos.">
                <Input ref={refs.modelo} list="generales-modelos" value={data.modelo} maxLength={120} autoComplete="off" placeholder="Ej.: iPhone 13 Pro Max"
                  onChange={(e) => cambiar('modelo', e.target.value)} />
              </Field>
              <Sugerencias id="generales-modelos" valores={sugerencias.modelos} />
            </div>
            <div>
              <Field label="Calidad" error={errores.calidad} hint="Para distinguir dos del mismo modelo.">
                <Input list="generales-calidades" value={data.calidad} maxLength={60} autoComplete="off" placeholder="Ej.: Premium, Original, 9D"
                  onChange={(e) => cambiar('calidad', e.target.value)} />
              </Field>
              <Sugerencias id="generales-calidades" valores={sugerencias.calidades} />
            </div>
          </div>

          <CampoCondicion valor={data.condicion} error={errores.condicion} onChange={(v) => cambiar('condicion', v)} />
        </div>
      </StepCard>

      <StepCard step={pasos ? 2 : undefined} icon={Boxes} title="Cuántos hay"
        subtitle="El saldo de este producto. Se descuenta solo al vender, al usarlo en una reparación o al mandarlo a otra sucursal.">
        {edicion ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gris-200 bg-gris-50 px-4 py-3.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-500">Saldo actual</p>
                <Saldo cantidad={saldo} className="mt-1" />
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
            <Nota>Editar la ficha no mueve el saldo. Las unidades entran por «Ingresar» y se corrigen por «Ajustar» o por el conteo: así queda anotado quién, cuándo y por qué.</Nota>
          </>
        ) : (
          <Field label="Cantidad" error={errores.cantidad} hint="Cuántas unidades entran hoy. No hace falta etiquetarlas: se cuentan por saldo.">
            <Input ref={refs.cantidad} type="number" min="1" step="1" inputMode="numeric" className="text-base font-bold tabular-nums"
              placeholder="Ej.: 500" value={data.cantidad} onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => cambiar('cantidad', e.target.value)} />
          </Field>
        )}
      </StepCard>

      <StepCard step={pasos ? 3 : undefined} icon={Barcode} title="Código"
        subtitle={edicion ? 'El código del producto en el sistema; no se puede repetir.' : 'Opcional: si lo dejas vacío, el sistema le pone uno.'}>
        <Field label={edicion ? 'Código' : 'Código (opcional)'} error={errores.codigo}
          hint={edicion ? 'Se guarda en mayúsculas.' : 'Déjalo vacío y queda, por ejemplo, VT-00042. Si la caja trae código de barras, escanéalo acá.'}>
          <Input ref={refs.codigo} value={data.codigo} maxLength={255} autoComplete="off" placeholder={edicion ? '' : 'Lo pone el sistema'}
            className="cifra uppercase tracking-wider"
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            onChange={(e) => cambiar('codigo', e.target.value.trimStart().toUpperCase())} />
        </Field>
        {!errores.codigo && <div className="mt-2"><EstadoCodigo estado={estadoCodigo} /></div>}
      </StepCard>

      <StepCard step={pasos ? 4 : undefined} icon={Wallet} title="Precio y procedencia" subtitle="Precio por unidad. El de cliente final es el que se usa al vender y al cotizar.">
        <CamposPrecio data={data} errores={errores} cambiar={cambiar} />
        <div className="mt-4">
          <CampoProcedencia valor={data.procedencia} error={errores.procedencia} sugerencias={sugerencias.procedencias}
            lista="generales-procedencias" onChange={(v) => cambiar('procedencia', v)} />
        </div>
      </StepCard>
    </>
  );
}

/** Resumen en vivo: qué entra, cuántas unidades y cuánto vale ese stock. `children` agrega los botones. */
export function ResumenProductoGeneral({ data, estado = 'disponible', saldo = null, children }) {
  const cantidad = saldo ?? (Number(data.cantidad) || 0);
  const detalle = detalleProducto(data);

  return (
    <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
      <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
          <Package className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen
        </h2>
        <Saldo cantidad={cantidad} />
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-gris-50 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-carbon-900 text-white"><Package className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-gris-900">{bonito(data.nombre) || 'Nuevo producto'}</p>
            <p className="truncate text-xs text-gris-500">{[data.tipo ? tipoTexto(data.tipo) : 'Tipo de producto', detalle].filter(Boolean).join(' · ')}</p>
          </div>
          {estado !== 'disponible' && <EstadoBadge estado={estado} />}
        </div>

        <dl className="space-y-1.5 text-sm">
          <Linea label="Código" valor={data.codigo.trim().toUpperCase() || 'Lo pone el sistema'} mono={Boolean(data.codigo.trim())} />
          <Linea label="Condición" valor={data.condicion} />
          <Linea label="Procedencia" valor={data.procedencia.trim()} />
        </dl>

        <CajaPrecio costo={data.precio_costo} venta={data.precio_venta} />

        {cantidad > 0 && Number(data.precio_venta) > 0 && (
          <dl className="space-y-1.5 border-t border-gris-100 pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gris-500">Valor de este stock</dt>
              <dd className="font-semibold tabular-nums text-gris-900">{bsFmt(cantidad * Number(data.precio_venta))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gris-500">Invertido</dt>
              <dd className="font-semibold tabular-nums text-gris-500">{bsFmt(cantidad * (Number(data.precio_costo) || 0))}</dd>
            </div>
          </dl>
        )}

        {children}
      </div>
    </section>
  );
}
