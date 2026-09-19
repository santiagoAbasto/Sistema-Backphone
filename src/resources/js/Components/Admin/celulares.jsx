import { useRef } from 'react';
import { AlertTriangle, CheckCircle2, Fingerprint, Smartphone, Wallet } from 'lucide-react';
import { Badge, Field, Input, Segmented, StepCard } from '@/Components/Admin/ui';
import { MENSAJE_CONDICION } from '@/Components/Admin/condicion';
import {
  CajaPrecio, CampoCondicion, CampoEstado, CampoProcedencia, CamposPrecio, EstadoBadge, Linea, Nota, SelectorRapido, Sugerencias,
  bonito, checkCls, montoInicial, r2, useFormularioInventario, util, validarPrecios,
} from '@/Components/Admin/inventario';

// Piezas propias de las pantallas de celulares (lo común a todo el inventario está en inventario.jsx).

export const ESTADOS_IMEI = [
  { value: 'libre', label: 'Libre', corto: 'Libre' },
  { value: 'registrado', label: 'Registrado', corto: 'Registrado' },
  { value: 'imei1_libre_imei2_registrado', label: 'IMEI 1 libre · IMEI 2 registrado', corto: 'IMEI 2 registrado' },
  { value: 'imei1_registrado_imei2_libre', label: 'IMEI 1 registrado · IMEI 2 libre', corto: 'IMEI 1 registrado' },
];

export const CAPACIDADES = ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'];

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

export const nombreEquipo = (c) => bonito(c?.modelo) || 'Celular';
export const detalleEquipo = (c) => [capacidadTexto(c?.capacidad), util(c?.color) ? bonito(c.color) : ''].filter(Boolean).join(' · ');

/** Batería guardada como texto: "86", "100 SELLADO", "100% SELLADO", "-" */
export function leerBateria(valor) {
  const t = String(valor ?? '').trim();
  const sellado = /sellad/i.test(t);
  const n = Number((t.match(/\d{1,3}/) || [])[0]);
  const pct = n >= 1 && n <= 100 ? n : null;
  return { pct: sellado ? (pct ?? 100) : pct, sellado };
}

export function BateriaBadge({ valor }) {
  const { pct, sellado } = leerBateria(valor);
  if (sellado) return <Badge tone="navy">Sellado</Badge>;
  if (pct == null) return <span className="text-gris-300">—</span>;
  return <Badge tone={pct >= 90 ? 'emerald' : pct >= 80 ? 'slate' : 'amber'} className="tabular-nums">{pct} %</Badge>;
}

/** El último dígito del IMEI es de control (algoritmo de Luhn): detecta la mayoría de los errores al escribirlo. */
export function imeiValido(imei) {
  if (!/^\d{15}$/.test(String(imei ?? ''))) return false;
  let suma = 0;
  for (let i = 0; i < 15; i += 1) {
    let d = Number(imei[14 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

/* ─── Formulario ─── */

export function datosDesde(c) {
  const bateria = leerBateria(c?.bateria);
  return {
    modelo: c?.modelo ?? '',
    condicion: c?.condicion ?? '',
    capacidad: c?.capacidad ?? '',
    color: c?.color ?? '',
    bateria_pct: bateria.pct != null ? String(bateria.pct) : '',
    sellado: bateria.sellado,
    imei_1: c?.imei_1 ?? '',
    imei_2: c?.imei_2 ?? '',
    numero_serie: c?.numero_serie ?? '',
    estado_imei: c?.estado_imei ?? 'libre',
    procedencia: c?.procedencia ?? '',
    precio_costo: montoInicial(c?.precio_costo),
    precio_venta: montoInicial(c?.precio_venta),
    estado: c?.estado ?? 'disponible',
  };
}

/** `original`: datos guardados del equipo. Los IMEI repetidos de registros antiguos solo se marcan si se cambian. */
export function validarCelular(d, original = null) {
  const e = {};
  const cambianImeis = !original || d.imei_1 !== original.imei_1 || d.imei_2 !== original.imei_2;
  if (!d.modelo.trim()) e.modelo = 'Escribe el modelo.';
  if (!d.condicion) e.condicion = MENSAJE_CONDICION;
  if (!d.capacidad.trim()) e.capacidad = 'Elige o escribe la capacidad.';
  if (!d.color.trim()) e.color = 'Escribe el color.';
  if (!d.sellado && d.bateria_pct !== '') {
    const n = Number(d.bateria_pct);
    if (!Number.isInteger(n) || n < 1 || n > 100) e.bateria = 'Escribe un porcentaje entre 1 y 100.';
  }
  if (!d.imei_1) e.imei_1 = 'Escribe el IMEI 1.';
  else if (d.imei_1.length !== 15) e.imei_1 = 'El IMEI tiene 15 dígitos.';
  if (d.imei_2 && d.imei_2.length !== 15) e.imei_2 = 'El IMEI tiene 15 dígitos.';
  else if (d.imei_2 && d.imei_2 === d.imei_1 && cambianImeis) e.imei_2 = 'El IMEI 2 no puede ser igual al IMEI 1.';
  if (!d.procedencia.trim()) e.procedencia = 'Escribe de dónde llegó el equipo.';
  return validarPrecios(d, e);
}

export const payloadDe = (d) => ({
  modelo: d.modelo.trim(),
  condicion: d.condicion || null,
  capacidad: d.capacidad.trim(),
  color: d.color.trim(),
  bateria: d.sellado ? '100 SELLADO' : (d.bateria_pct !== '' ? String(Number(d.bateria_pct)) : null),
  imei_1: d.imei_1,
  imei_2: d.imei_2 || null,
  numero_serie: d.numero_serie.trim().toUpperCase() || null,
  estado_imei: d.estado_imei,
  procedencia: d.procedencia.trim(),
  precio_costo: r2(d.precio_costo),
  precio_venta: r2(d.precio_venta),
  estado: d.estado,
});

// El porcentaje y "sellado" se muestran en el mismo error de batería
export const useFormularioCelular = (inicial) => useFormularioInventario(inicial, { bateria_pct: 'bateria', sellado: 'bateria' });

const alPresionarEnter = (ref) => (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    ref?.current?.focus();
  }
};

function CampoImei({ label, valor, error, onChange, inputRef, onEnter }) {
  const completo = valor.length === 15;
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Input ref={inputRef} value={valor} inputMode="numeric" autoComplete="off" maxLength={15} placeholder="15 dígitos"
          className="pr-14 font-mono tracking-wider"
          onKeyDown={onEnter}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 15))} />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-gris-400">{valor.length}/15</span>
      </div>
      {completo && !error && (imeiValido(valor) ? (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> IMEI válido</p>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Revisa este IMEI: parece tener un dígito mal escrito.</p>
      ))}
    </Field>
  );
}

/** Los tres bloques del formulario. `refs` permite enfocar un campo desde la página (por ejemplo, el color). */
export function CamposCelular({ form, sugerencias = {}, pasos = false, refs = {}, avisoEstado = null }) {
  const { data, errores, cambiar } = form;
  const imei2Ref = useRef(null);
  const serieRef = useRef(null);

  return (
    <>
      <StepCard step={pasos ? 1 : undefined} icon={Smartphone} title="Equipo" subtitle="Modelo, condición, capacidad, color y batería.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Modelo" error={errores.modelo}>
              <Input ref={refs.modelo} list="celulares-modelos" value={data.modelo} maxLength={255} autoComplete="off" placeholder="Ej.: iPhone 15 Pro Max"
                onChange={(e) => cambiar('modelo', e.target.value)} />
            </Field>
            <Sugerencias id="celulares-modelos" valores={sugerencias.modelos} />
          </div>

          <div className="md:col-span-2">
            <CampoCondicion valor={data.condicion} error={errores.condicion} onChange={(v) => cambiar('condicion', v)} />
          </div>

          <div className="md:col-span-2">
            <SelectorRapido label="Capacidad" opciones={CAPACIDADES} valor={data.capacidad} error={errores.capacidad} igual={mismaCapacidad}
              onChange={(v) => cambiar('capacidad', v)} />
          </div>

          <Field label="Color" error={errores.color}>
            <Input ref={refs.color} list="celulares-colores" value={data.color} maxLength={100} autoComplete="off" placeholder="Ej.: Negro"
              onChange={(e) => cambiar('color', e.target.value)} />
          </Field>

          <Field label="Salud de la batería" error={errores.bateria}
            hint={data.sellado ? 'Equipo nuevo en su caja sellada.' : 'En iPhone: Ajustes › Batería. Déjalo vacío si no se sabe.'}>
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
        <Sugerencias id="celulares-colores" valores={sugerencias.colores} />
      </StepCard>

      <StepCard step={pasos ? 2 : undefined} icon={Fingerprint} title="Identificación" subtitle="Para garantías y control de stock.">
        <div className="grid gap-4 md:grid-cols-2">
          <CampoImei label="IMEI 1" valor={data.imei_1} error={errores.imei_1} inputRef={refs.imei}
            onEnter={alPresionarEnter(imei2Ref)} onChange={(v) => cambiar('imei_1', v)} />
          <CampoImei label="IMEI 2 (opcional)" valor={data.imei_2} error={errores.imei_2} inputRef={imei2Ref}
            onEnter={alPresionarEnter(serieRef)} onChange={(v) => cambiar('imei_2', v)} />
          <Field label="Número de serie (opcional)" error={errores.numero_serie}
            hint="El número de serie del equipo. No escribas aquí el IMEI.">
            <Input ref={serieRef} value={data.numero_serie} maxLength={100} autoComplete="off" className="font-mono uppercase"
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              onChange={(e) => cambiar('numero_serie', e.target.value.trimStart().toUpperCase())} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Estado del IMEI" error={errores.estado_imei}>
            <Segmented cols="grid-cols-1 sm:grid-cols-2" options={ESTADOS_IMEI} value={data.estado_imei} ariaLabel="Estado del IMEI"
              onChange={(v) => cambiar('estado_imei', v)} />
          </Field>
        </div>
        <Nota>Marca *#06# en el equipo para ver sus IMEI. Con un lector de códigos, al escanear pasa solo al siguiente campo.</Nota>
      </StepCard>

      <StepCard step={pasos ? 3 : undefined} icon={Wallet} title="Precio y estado" subtitle="El precio de venta es el que se usa al vender y al cotizar.">
        <CamposPrecio data={data} errores={errores} cambiar={cambiar} />
        <div className="mt-4">
          <CampoProcedencia valor={data.procedencia} error={errores.procedencia} sugerencias={sugerencias.procedencias}
            lista="celulares-procedencias" onChange={(v) => cambiar('procedencia', v)} />
        </div>
        <div className="mt-4">
          <CampoEstado valor={data.estado} error={errores.estado} onChange={(v) => cambiar('estado', v)} aviso={avisoEstado} />
        </div>
      </StepCard>
    </>
  );
}

/** Resumen en vivo del equipo, con el precio y la ganancia. `children` agrega los botones de la página. */
export function ResumenCelular({ data, titulo = 'Resumen', children }) {
  const bateria = data.sellado ? 'Sellado (sin abrir)' : (data.bateria_pct ? `${data.bateria_pct} %` : '');

  return (
    <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-gris-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
          <Smartphone className="h-[18px] w-[18px] text-[#96684F]" /> {titulo}
        </h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-gris-50 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#121214] text-white"><Smartphone className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-gris-900">{bonito(data.modelo) || 'Nuevo celular'}</p>
            <p className="truncate text-xs text-gris-500">{detalleEquipo(data) || 'Capacidad y color'}</p>
          </div>
          <EstadoBadge estado={data.estado} />
        </div>

        <dl className="space-y-1.5 text-sm">
          <Linea label="Condición" valor={data.condicion} />
          <Linea label="Batería" valor={bateria} />
          <Linea label="IMEI 1" valor={data.imei_1} mono />
          {data.imei_2 && <Linea label="IMEI 2" valor={data.imei_2} mono />}
          {data.numero_serie && <Linea label="Serie" valor={data.numero_serie} mono />}
          <Linea label="Estado del IMEI" valor={ESTADOS_IMEI.find((o) => o.value === data.estado_imei)?.label} />
          <Linea label="Procedencia" valor={data.procedencia.trim()} />
        </dl>

        <CajaPrecio costo={data.precio_costo} venta={data.precio_venta} />

        {children}
      </div>
    </section>
  );
}
