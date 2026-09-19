import { useEffect, useState } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import { Barcode, CheckCircle2, Loader2, Package, Wallet, XCircle } from 'lucide-react';
import { Field, Input, Segmented, StepCard } from '@/Components/Admin/ui';
import { MENSAJE_CONDICION } from '@/Components/Admin/condicion';
import {
  CajaPrecio, CampoCondicion, CampoEstado, CampoProcedencia, CamposPrecio, EstadoBadge, Linea, Sugerencias,
  bonito, montoInicial, r2, useFormularioInventario, validarPrecios,
} from '@/Components/Admin/inventario';

// Piezas de las pantallas de productos generales: fundas, vidrios, cargadores y accesorios.
// Cada unidad tiene su propio código. Lo común a todo el inventario está en inventario.jsx.

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
    condicion: p?.condicion ?? 'Nuevo',
    procedencia: p?.procedencia ?? '',
    precio_costo: montoInicial(p?.precio_costo),
    precio_venta: montoInicial(p?.precio_venta),
    estado: p?.estado ?? 'disponible',
  };
}

export function validarProductoGeneral(d) {
  const e = {};
  if (!d.codigo.trim()) e.codigo = 'Escribe el código.';
  if (!d.tipo) e.tipo = 'Elige el tipo de producto.';
  if (!d.nombre.trim()) e.nombre = 'Escribe el nombre.';
  if (!d.condicion) e.condicion = MENSAJE_CONDICION;
  if (!d.procedencia.trim()) e.procedencia = 'Escribe de dónde llegó el producto.';
  return validarPrecios(d, e);
}

export const payloadDe = (d) => ({
  codigo: d.codigo.trim().toUpperCase(),
  tipo: d.tipo,
  nombre: d.nombre.trim(),
  condicion: d.condicion || null,
  procedencia: d.procedencia.trim(),
  precio_costo: r2(d.precio_costo),
  precio_venta: r2(d.precio_venta),
  estado: d.estado,
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

/** Los tres bloques del formulario. `refs` permite enfocar el código desde la página. */
export function CamposProductoGeneral({ form, sugerencias = {}, pasos = false, refs = {}, estadoCodigo = 'vacio', avisoEstado = null }) {
  const { data, errores, cambiar } = form;

  return (
    <>
      <StepCard step={pasos ? 1 : undefined} icon={Package} title="Producto" subtitle="Tipo, nombre y condición.">
        <div className="grid gap-4">
          <Field label="Tipo" error={errores.tipo}>
            <Segmented cols="grid-cols-2 sm:grid-cols-4" options={TIPOS} value={data.tipo} ariaLabel="Tipo de producto"
              onChange={(v) => cambiar('tipo', v)} />
          </Field>

          <div>
            <Field label="Nombre" error={errores.nombre} hint="Como se reconoce en ventas y cotizaciones. Ej.: Funda de silicona iPhone 15 Pro.">
              <Input ref={refs.nombre} list="generales-nombres" value={data.nombre} maxLength={255} autoComplete="off" placeholder="Ej.: Cubo 20 W original"
                onChange={(e) => cambiar('nombre', e.target.value)} />
            </Field>
            <Sugerencias id="generales-nombres" valores={sugerencias.nombres} />
          </div>

          <CampoCondicion valor={data.condicion} error={errores.condicion} onChange={(v) => cambiar('condicion', v)} />
        </div>
      </StepCard>

      <StepCard step={pasos ? 2 : undefined} icon={Barcode} title="Código" subtitle="Cada unidad lleva su propio código; no se puede repetir.">
        <Field label="Código" error={errores.codigo} hint="Se guarda en mayúsculas. Con un lector de códigos puedes escanearlo directo.">
          <Input ref={refs.codigo} value={data.codigo} maxLength={255} autoComplete="off" placeholder="Ej.: FUNDACHAV_1"
            className="cifra uppercase tracking-wider"
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            onChange={(e) => cambiar('codigo', e.target.value.trimStart().toUpperCase())} />
        </Field>
        {!errores.codigo && <div className="mt-2"><EstadoCodigo estado={estadoCodigo} /></div>}
      </StepCard>

      <StepCard step={pasos ? 3 : undefined} icon={Wallet} title="Precio y estado" subtitle="El precio de venta es el que se usa al vender y al cotizar.">
        <CamposPrecio data={data} errores={errores} cambiar={cambiar} />
        <div className="mt-4">
          <CampoProcedencia valor={data.procedencia} error={errores.procedencia} sugerencias={sugerencias.procedencias}
            lista="generales-procedencias" onChange={(v) => cambiar('procedencia', v)} />
        </div>
        <div className="mt-4">
          <CampoEstado valor={data.estado} error={errores.estado} onChange={(v) => cambiar('estado', v)} aviso={avisoEstado} />
        </div>
      </StepCard>
    </>
  );
}

/** Resumen en vivo con el precio y la ganancia. `children` agrega los botones de la página. */
export function ResumenProductoGeneral({ data, children }) {
  return (
    <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
      <div className="border-b border-gris-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
          <Package className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen
        </h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-gris-50 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-carbon-900 text-white"><Package className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-gris-900">{bonito(data.nombre) || 'Nuevo producto'}</p>
            <p className="truncate text-xs text-gris-500">{data.tipo ? tipoTexto(data.tipo) : 'Tipo de producto'}</p>
          </div>
          <EstadoBadge estado={data.estado} />
        </div>

        <dl className="space-y-1.5 text-sm">
          <Linea label="Código" valor={data.codigo.trim().toUpperCase()} mono />
          <Linea label="Condición" valor={data.condicion} />
          <Linea label="Procedencia" valor={data.procedencia.trim()} />
        </dl>

        <CajaPrecio costo={data.precio_costo} venta={data.precio_venta} />

        {children}
      </div>
    </section>
  );
}
