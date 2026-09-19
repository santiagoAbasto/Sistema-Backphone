import { useRef } from 'react';
import { Apple, Fingerprint, Wallet } from 'lucide-react';
import { Badge, Field, Input, Segmented, StepCard, Switch } from '@/Components/Admin/ui';
import { MENSAJE_CONDICION } from '@/Components/Admin/condicion';
import {
  CajaPrecio, CampoCondicion, CampoEstado, CampoProcedencia, CamposPrecio, EstadoBadge, Linea, Nota, SelectorRapido, Sugerencias,
  bonito, checkCls, montoInicial, r2, useFormularioInventario, util, validarPrecios,
} from '@/Components/Admin/inventario';
import { imeiValido, leerBateria } from '@/Components/Admin/celulares';

// Piezas de las pantallas de equipos de marca: tablets, relojes, audífonos y accesorios.
// Lo común a todo el inventario está en inventario.jsx.

// Los valores son los que acepta la columna estado_imei de la base de datos
export const ESTADOS_IMEI = [
  { value: 'Libre', label: 'Libre', corto: 'Libre' },
  { value: 'Registro seguro', label: 'Registrado', corto: 'Registrado' },
  { value: 'IMEI 1 libre y IMEI 2 registrado', label: 'IMEI 1 libre · IMEI 2 registrado', corto: 'IMEI 2 registrado' },
  { value: 'IMEI 2 libre y IMEI 1 registrado', label: 'IMEI 1 registrado · IMEI 2 libre', corto: 'IMEI 1 registrado' },
];

export const CAPACIDADES = ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB'];

// "128", "128GB" y "128 GB" son lo mismo
const clave = (v) => {
  const t = String(v ?? '').toLowerCase().replace(/\s+/g, '');
  return /^\d+$/.test(t) ? `${t}gb` : t;
};
const mismaCapacidad = (a, b) => clave(a) !== '' && clave(a) === clave(b);

export const capacidadTexto = (v) => {
  if (!util(v)) return '';
  const t = String(v).trim();
  return /^\d+$/.test(t) ? `${t} GB` : bonito(t);
};

export const nombreEquipo = (p) => bonito(p?.modelo) || 'Equipo de marca';
export const detalleEquipo = (p) => [capacidadTexto(p?.capacidad), util(p?.color) ? bonito(p.color) : ''].filter(Boolean).join(' · ');

// Los que no tienen batería ni capacidad se guardan con "-", como en los registros anteriores
const guion = (v) => (String(v ?? '').trim() === '' ? '-' : String(v).trim());
const sinGuion = (v) => (util(v) ? String(v) : '');

/* ─── Formulario ─── */

export function datosDesde(p) {
  const bateria = leerBateria(p?.bateria);
  return {
    modelo: p?.modelo ?? '',
    condicion: p?.condicion ?? '',
    capacidad: sinGuion(p?.capacidad),
    color: sinGuion(p?.color),
    bateria_pct: bateria.pct != null && !bateria.sellado ? String(bateria.pct) : '',
    sellado: bateria.sellado,
    numero_serie: p?.numero_serie ?? '',
    tiene_imei: Boolean(p?.tiene_imei),
    imei_1: p?.imei_1 ?? '',
    imei_2: p?.imei_2 ?? '',
    estado_imei: p?.estado_imei ?? 'Libre',
    procedencia: p?.procedencia ?? '',
    precio_costo: montoInicial(p?.precio_costo),
    precio_venta: montoInicial(p?.precio_venta),
    estado: p?.estado ?? 'disponible',
  };
}

export function validarProductoApple(d) {
  const e = {};
  if (!d.modelo.trim()) e.modelo = 'Escribe el modelo.';
  if (!d.condicion) e.condicion = MENSAJE_CONDICION;
  if (!d.color.trim()) e.color = 'Escribe el color.';
  if (!d.sellado && d.bateria_pct !== '') {
    const n = Number(d.bateria_pct);
    if (!Number.isInteger(n) || n < 1 || n > 100) e.bateria = 'Escribe un porcentaje entre 1 y 100.';
  }
  if (d.tiene_imei) {
    if (!d.imei_1) e.imei_1 = 'Escribe el IMEI 1.';
    else if (d.imei_1.length !== 15) e.imei_1 = 'El IMEI tiene 15 dígitos.';
    if (d.imei_2 && d.imei_2.length !== 15) e.imei_2 = 'El IMEI tiene 15 dígitos.';
    else if (d.imei_2 && d.imei_2 === d.imei_1) e.imei_2 = 'El IMEI 2 no puede ser igual al IMEI 1.';
  }
  if (!d.procedencia.trim()) e.procedencia = 'Escribe de dónde llegó el producto.';
  return validarPrecios(d, e);
}

export const payloadDe = (d) => ({
  modelo: d.modelo.trim(),
  condicion: d.condicion || null,
  capacidad: guion(d.capacidad),
  color: d.color.trim(),
  bateria: d.sellado ? '100 SELLADO' : guion(d.bateria_pct !== '' ? String(Number(d.bateria_pct)) : ''),
  numero_serie: d.numero_serie.trim().toUpperCase() || null,
  tiene_imei: d.tiene_imei,
  imei_1: d.tiene_imei ? d.imei_1 : null,
  imei_2: d.tiene_imei ? (d.imei_2 || null) : null,
  estado_imei: d.tiene_imei ? d.estado_imei : null,
  procedencia: d.procedencia.trim(),
  precio_costo: r2(d.precio_costo),
  precio_venta: r2(d.precio_venta),
  estado: d.estado,
});

export const useFormularioProductoApple = (inicial) => useFormularioInventario(inicial, { bateria_pct: 'bateria', sellado: 'bateria' });

export function BateriaBadge({ valor }) {
  const { pct, sellado } = leerBateria(valor);
  if (sellado) return <Badge tone="navy">Sellado</Badge>;
  if (pct == null) return <span className="text-gris-300">—</span>;
  return <Badge tone={pct >= 90 ? 'emerald' : pct >= 80 ? 'slate' : 'amber'} className="tabular-nums">{pct} %</Badge>;
}

function CampoImei({ label, valor, error, onChange, inputRef, onEnter }) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Input ref={inputRef} value={valor} inputMode="numeric" autoComplete="off" maxLength={15} placeholder="15 dígitos"
          className="pr-14 font-mono tracking-wider" onKeyDown={onEnter}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 15))} />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-gris-400">{valor.length}/15</span>
      </div>
      {valor.length === 15 && !error && !imeiValido(valor) && (
        <p className="text-[11px] font-semibold text-amber-700">Revisa este IMEI: parece tener un dígito mal escrito.</p>
      )}
    </Field>
  );
}

/** Los tres bloques del formulario. `refs` permite enfocar un campo desde la página. */
export function CamposProductoApple({ form, sugerencias = {}, pasos = false, refs = {}, avisoEstado = null }) {
  const { data, errores, cambiar } = form;
  const imei2Ref = useRef(null);

  return (
    <>
      <StepCard step={pasos ? 1 : undefined} icon={Apple} title="Producto" subtitle="Modelo, condición, capacidad, color y batería.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Modelo" error={errores.modelo} hint="iPad, AirPods, Apple Watch, Pencil o accesorio.">
              <Input ref={refs.modelo} list="apple-modelos" value={data.modelo} maxLength={255} autoComplete="off" placeholder="Ej.: iPad Air M4"
                onChange={(e) => cambiar('modelo', e.target.value)} />
            </Field>
            <Sugerencias id="apple-modelos" valores={sugerencias.modelos} />
          </div>

          <div className="md:col-span-2">
            <CampoCondicion valor={data.condicion} error={errores.condicion} onChange={(v) => cambiar('condicion', v)} />
          </div>

          <div className="md:col-span-2">
            <SelectorRapido label="Capacidad (opcional)" opciones={CAPACIDADES} valor={data.capacidad} error={errores.capacidad} igual={mismaCapacidad}
              hint="Déjala vacía en AirPods, Pencil y accesorios." onChange={(v) => cambiar('capacidad', v)} />
          </div>

          <Field label="Color" error={errores.color}>
            <Input ref={refs.color} list="apple-colores" value={data.color} maxLength={100} autoComplete="off" placeholder="Ej.: Blanco"
              onChange={(e) => cambiar('color', e.target.value)} />
          </Field>

          <Field label="Salud de la batería (opcional)" error={errores.bateria}
            hint={data.sellado ? 'Producto nuevo en su caja sellada.' : 'Vacío si no aplica o no se sabe.'}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="relative w-28">
                <Input value={data.sellado ? '100' : data.bateria_pct} disabled={data.sellado} inputMode="numeric" maxLength={3} placeholder="—" aria-label="Porcentaje de batería"
                  className="pr-9 tabular-nums disabled:bg-gris-50 disabled:text-gris-400"
                  onChange={(e) => cambiar('bateria_pct', e.target.value.replace(/\D/g, '').slice(0, 3))} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gris-400">%</span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gris-700">
                <input type="checkbox" checked={data.sellado} onChange={(e) => cambiar('sellado', e.target.checked)} className={checkCls} />
                Sellado (sin abrir)
              </label>
            </div>
          </Field>

          {data.sellado && data.condicion === 'Seminuevo' && (
            <div className="md:col-span-2">
              <Nota tono="amber">Marcaste «Sellado (sin abrir)», pero la condición es Seminuevo. Revisa cuál es la correcta.</Nota>
            </div>
          )}
        </div>
        <Sugerencias id="apple-colores" valores={sugerencias.colores} />
      </StepCard>

      <StepCard step={pasos ? 2 : undefined} icon={Fingerprint} title="Identificación" subtitle="El número de serie y el IMEI sirven para garantías y control de stock.">
        <Field label="Número de serie (opcional)" error={errores.numero_serie} hint="Está en la caja o en Ajustes › General › Información. No se puede repetir.">
          <Input ref={refs.serie} value={data.numero_serie} maxLength={100} autoComplete="off" placeholder="Ej.: LQ9FHJ7X42" className="font-mono uppercase tracking-wider"
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            onChange={(e) => cambiar('numero_serie', e.target.value.trimStart().toUpperCase())} />
        </Field>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-gris-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gris-800">Tiene IMEI</p>
            <p className="text-xs text-gris-500">Solo los iPad o Apple Watch con conexión celular.</p>
          </div>
          <Switch checked={data.tiene_imei} label="Tiene IMEI" onChange={(v) => cambiar('tiene_imei', v)} />
        </div>

        {data.tiene_imei && (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <CampoImei label="IMEI 1" valor={data.imei_1} error={errores.imei_1} inputRef={refs.imei}
                onEnter={(e) => { if (e.key === 'Enter') { e.preventDefault(); imei2Ref.current?.focus(); } }}
                onChange={(v) => cambiar('imei_1', v)} />
              <CampoImei label="IMEI 2 (opcional)" valor={data.imei_2} error={errores.imei_2} inputRef={imei2Ref}
                onEnter={(e) => e.key === 'Enter' && e.preventDefault()} onChange={(v) => cambiar('imei_2', v)} />
            </div>
            <div className="mt-4">
              <Field label="Estado del IMEI" error={errores.estado_imei}>
                <Segmented cols="grid-cols-1 sm:grid-cols-2" options={ESTADOS_IMEI} value={data.estado_imei} ariaLabel="Estado del IMEI"
                  onChange={(v) => cambiar('estado_imei', v)} />
              </Field>
            </div>
          </>
        )}
      </StepCard>

      <StepCard step={pasos ? 3 : undefined} icon={Wallet} title="Precio y estado" subtitle="El precio de venta es el que se usa al vender y al cotizar.">
        <CamposPrecio data={data} errores={errores} cambiar={cambiar} />
        <div className="mt-4">
          <CampoProcedencia valor={data.procedencia} error={errores.procedencia} sugerencias={sugerencias.procedencias}
            lista="apple-procedencias" onChange={(v) => cambiar('procedencia', v)} />
        </div>
        <div className="mt-4">
          <CampoEstado valor={data.estado} error={errores.estado} onChange={(v) => cambiar('estado', v)} aviso={avisoEstado} />
        </div>
      </StepCard>
    </>
  );
}

/** Resumen en vivo con el precio y la ganancia. `children` agrega los botones de la página. */
export function ResumenProductoApple({ data, children }) {
  const bateria = data.sellado ? 'Sellado (sin abrir)' : (data.bateria_pct ? `${data.bateria_pct} %` : '');

  return (
    <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-gris-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
          <Apple className="h-[18px] w-[18px] text-[#96684F]" /> Resumen
        </h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-gris-50 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#121214] text-white"><Apple className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-gris-900">{bonito(data.modelo) || 'Nuevo producto'}</p>
            <p className="truncate text-xs text-gris-500">{detalleEquipo(data) || 'Capacidad y color'}</p>
          </div>
          <EstadoBadge estado={data.estado} />
        </div>

        <dl className="space-y-1.5 text-sm">
          <Linea label="Condición" valor={data.condicion} />
          <Linea label="Batería" valor={bateria} />
          <Linea label="Número de serie" valor={data.numero_serie} mono />
          {data.tiene_imei && <Linea label="IMEI 1" valor={data.imei_1} mono />}
          {data.tiene_imei && data.imei_2 && <Linea label="IMEI 2" valor={data.imei_2} mono />}
          {data.tiene_imei && <Linea label="Estado del IMEI" valor={ESTADOS_IMEI.find((o) => o.value === data.estado_imei)?.label} />}
          <Linea label="Procedencia" valor={data.procedencia.trim()} />
        </dl>

        <CajaPrecio costo={data.precio_costo} venta={data.precio_venta} />

        {children}
      </div>
    </section>
  );
}
