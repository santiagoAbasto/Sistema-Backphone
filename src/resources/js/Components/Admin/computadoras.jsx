import { Fingerprint, Laptop, Wallet } from 'lucide-react';
import { Badge, Field, Input, StepCard } from '@/Components/Admin/ui';
import { MENSAJE_CONDICION } from '@/Components/Admin/condicion';
import {
  CajaPrecio, CampoCondicion, CampoEstado, CampoProcedencia, CamposPrecio, EstadoBadge, Linea, Nota, SelectorRapido, Sugerencias,
  bonito, montoInicial, r2, util, validarPrecios,
} from '@/Components/Admin/inventario';

// Piezas de las pantallas de computadoras (listado, registro y edición).

export const CHIPS = ['M1', 'M2', 'M3', 'M4', 'M5'];
export const RAMS = ['8 GB', '16 GB', '18 GB', '24 GB', '32 GB', '36 GB', '48 GB', '64 GB'];
export const ALMACENAMIENTOS = ['256 GB', '512 GB', '1 TB', '2 TB'];

// La salud y los ciclos se guardan juntos en "bateria": sus errores se muestran en el mismo campo
export const ALIAS_ERRORES = { bateria_pct: 'bateria', ciclos: 'bateria' };

// "CHIP M5", "M5 CHIP" y "M5" son lo mismo
const claveChip = (v) => String(v ?? '').toLowerCase().replace(/chip/g, '').replace(/\s+/g, '');
const mismoChip = (a, b) => claveChip(a) !== '' && claveChip(a) === claveChip(b);

// "16", "16 RAM", "16GB" y "16 GB" son lo mismo
const claveMemoria = (v) => {
  const t = String(v ?? '').toLowerCase().replace(/ram/g, '').replace(/\s+/g, '');
  return /^\d+$/.test(t) ? `${t}gb` : t;
};
const mismaMemoria = (a, b) => claveMemoria(a) !== '' && claveMemoria(a) === claveMemoria(b);

export const memoriaTexto = (v) => {
  if (!util(v)) return '';
  const t = String(v).trim().replace(/\s*ram$/i, '');
  return /^\d+$/.test(t) ? `${t} GB` : bonito(t);
};

export const chipTexto = (v) => (util(v) ? bonito(v) : '');
export const nombreEquipo = (c) => bonito(c?.nombre) || 'Computadora';
export const detalleEquipo = (c) => [
  chipTexto(c?.procesador),
  memoriaTexto(c?.ram) && `${memoriaTexto(c.ram)} RAM`,
  memoriaTexto(c?.almacenamiento),
  util(c?.color) ? bonito(c.color) : '',
].filter(Boolean).join(' · ');

/** Título completo del equipo (nombre, chip, almacenamiento y color). */
export const tituloTienda = (d) => bonito([d.nombre, d.procesador, memoriaTexto(d.almacenamiento), d.color].filter(util).join(' '));

/** Batería guardada como texto: "100", "308 CICLOS", "75 - 1748 CICLOS", "100 - CICLOS 5" */
export function leerBateria(valor) {
  const t = String(valor ?? '').toUpperCase();
  const ciclos = (t.match(/(\d+)\s*CICLOS/) || t.match(/CICLOS\s*(\d+)/) || [])[1];
  const resto = t.replace(/(\d+)\s*CICLOS|CICLOS\s*(\d+)/, ' ');
  const n = Number((resto.match(/\d{1,3}/) || [])[0]);
  return { pct: n >= 1 && n <= 100 ? n : null, ciclos: ciclos ? Number(ciclos) : null };
}

/** Se guarda como ya lo hacía el equipo: "100 - 25 CICLOS", "95" o "308 CICLOS". */
export function textoBateria(pct, ciclos) {
  const partes = [pct !== '' ? String(Number(pct)) : '', ciclos !== '' ? `${Number(ciclos)} CICLOS` : ''].filter(Boolean);
  return partes.length ? partes.join(' - ') : null;
}

export const bateriaTexto = (pct, ciclos) => [pct !== '' ? `${pct} %` : '', ciclos !== '' ? `${ciclos} ciclos` : ''].filter(Boolean).join(' · ');

export function BateriaMac({ valor }) {
  const { pct, ciclos } = leerBateria(valor);
  if (pct == null && ciclos == null) return <span className="text-gris-300">—</span>;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {pct != null && <Badge tone={pct >= 90 ? 'emerald' : pct >= 80 ? 'slate' : 'amber'} className="tabular-nums">{pct} %</Badge>}
      {ciclos != null && <span className="text-[11px] tabular-nums text-gris-500">{ciclos.toLocaleString('es-BO')} ciclos</span>}
    </span>
  );
}

// Los números de serie de Apple tienen 10 caracteres (desde 2021) o 12 (antes)
const esApple = (nombre) => /mac|imac|macbook/i.test(String(nombre ?? ''));
export const serieDudosa = (nombre, serie) => {
  const largo = String(serie ?? '').trim().length;
  return esApple(nombre) && largo > 0 && largo !== 10 && largo !== 12;
};

/* ─── Formulario ─── */

export function datosDesde(c) {
  const bateria = leerBateria(c?.bateria);
  return {
    nombre: c?.nombre ?? '',
    condicion: c?.condicion ?? '',
    procesador: c?.procesador ?? '',
    ram: c?.ram ?? '',
    almacenamiento: c?.almacenamiento ?? '',
    color: c?.color ?? '',
    bateria_pct: bateria.pct != null ? String(bateria.pct) : '',
    ciclos: bateria.ciclos != null ? String(bateria.ciclos) : '',
    numero_serie: c?.numero_serie ?? '',
    procedencia: c?.procedencia ?? '',
    precio_costo: montoInicial(c?.precio_costo),
    precio_venta: montoInicial(c?.precio_venta),
    estado: c?.estado ?? 'disponible',
  };
}

export function validarComputadora(d) {
  const e = {};
  if (!d.nombre.trim()) e.nombre = 'Escribe el nombre del equipo.';
  if (!d.condicion) e.condicion = MENSAJE_CONDICION;
  if (!d.ram.trim()) e.ram = 'Elige o escribe la memoria RAM.';
  if (!d.almacenamiento.trim()) e.almacenamiento = 'Elige o escribe el almacenamiento.';
  if (!d.color.trim()) e.color = 'Escribe el color.';
  if (d.bateria_pct !== '') {
    const n = Number(d.bateria_pct);
    if (!Number.isInteger(n) || n < 1 || n > 100) e.bateria = 'La salud de la batería va de 1 a 100 %.';
  }
  if (d.ciclos !== '' && !Number.isInteger(Number(d.ciclos))) e.bateria = 'Escribe los ciclos como un número entero.';
  if (!d.numero_serie.trim()) e.numero_serie = 'Escribe el número de serie.';
  if (!d.procedencia.trim()) e.procedencia = 'Escribe de dónde llegó el equipo.';
  return validarPrecios(d, e);
}

export const payloadDe = (d) => ({
  nombre: d.nombre.trim(),
  condicion: d.condicion || null,
  procesador: d.procesador.trim() || null,
  ram: d.ram.trim(),
  almacenamiento: d.almacenamiento.trim(),
  color: d.color.trim(),
  bateria: textoBateria(d.bateria_pct, d.ciclos),
  numero_serie: d.numero_serie.trim().toUpperCase(),
  procedencia: d.procedencia.trim(),
  precio_costo: r2(d.precio_costo),
  precio_venta: r2(d.precio_venta),
  estado: d.estado,
});

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);

/** Los tres bloques del formulario. `refs` permite enfocar un campo desde la página (por ejemplo, la serie). */
export function CamposComputadora({ form, sugerencias = {}, pasos = false, refs = {}, avisoEstado = null }) {
  const { data, errores, cambiar } = form;

  return (
    <>
      <StepCard step={pasos ? 1 : undefined} icon={Laptop} title="Equipo" subtitle="Modelo, condición, chip, memoria, color y batería.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nombre del equipo" error={errores.nombre} hint="Modelo y tamaño de pantalla. El chip y la memoria van en sus propios campos.">
              <Input ref={refs.nombre} list="computadoras-nombres" value={data.nombre} maxLength={255} autoComplete="off" placeholder="Ej.: MacBook Air 13"
                onChange={(e) => cambiar('nombre', e.target.value)} />
            </Field>
            <Sugerencias id="computadoras-nombres" valores={sugerencias.nombres} />
          </div>

          <div className="md:col-span-2">
            <CampoCondicion valor={data.condicion} error={errores.condicion} onChange={(v) => cambiar('condicion', v)} />
          </div>

          <div className="md:col-span-2">
            <SelectorRapido label="Chip o procesador" opciones={CHIPS} valor={data.procesador} error={errores.procesador} igual={mismoChip}
              placeholder="Otro: M4 Pro, Intel Core i5…" anchoOtra="min-w-[14rem] flex-1" lista="computadoras-procesadores"
              onChange={(v) => cambiar('procesador', v)} />
            <Sugerencias id="computadoras-procesadores" valores={sugerencias.procesadores} />
          </div>

          <div className="md:col-span-2">
            <SelectorRapido label="Memoria RAM" opciones={RAMS} valor={data.ram} error={errores.ram} igual={mismaMemoria}
              onChange={(v) => cambiar('ram', v)} />
          </div>

          <div className="md:col-span-2">
            <SelectorRapido label="Almacenamiento" opciones={ALMACENAMIENTOS} valor={data.almacenamiento} error={errores.almacenamiento} igual={mismaMemoria}
              onChange={(v) => cambiar('almacenamiento', v)} />
          </div>

          <Field label="Color" error={errores.color}>
            <Input list="computadoras-colores" value={data.color} maxLength={100} autoComplete="off" placeholder="Ej.: Plata"
              onChange={(e) => cambiar('color', e.target.value)} />
          </Field>

          <Field label="Batería" error={errores.bateria}
            hint="Salud: Configuración del Sistema › Batería. Ciclos: Información del sistema › Alimentación. Vacío si no se sabe.">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input value={data.bateria_pct} inputMode="numeric" maxLength={3} placeholder="Salud" aria-label="Salud de la batería en %"
                  className="pr-9 tabular-nums" onChange={(e) => cambiar('bateria_pct', soloDigitos(e.target.value, 3))} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gris-400">%</span>
              </div>
              <div className="relative">
                <Input value={data.ciclos} inputMode="numeric" maxLength={4} placeholder="Ciclos" aria-label="Ciclos de carga"
                  className="pr-14 tabular-nums" onChange={(e) => cambiar('ciclos', soloDigitos(e.target.value, 4))} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gris-400">ciclos</span>
              </div>
            </div>
          </Field>
        </div>
        <Sugerencias id="computadoras-colores" valores={sugerencias.colores} />
      </StepCard>

      <StepCard step={pasos ? 2 : undefined} icon={Fingerprint} title="Identificación" subtitle="El número de serie identifica al equipo para garantías y control de stock.">
        <Field label="Número de serie" error={errores.numero_serie}
          hint="Está en Menú Apple › Acerca de esta Mac, o grabado debajo del equipo. No se puede repetir.">
          <Input ref={refs.serie} value={data.numero_serie} maxLength={100} autoComplete="off" placeholder="Ej.: C02XK1ABCD"
            className="font-mono uppercase tracking-wider"
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            onChange={(e) => cambiar('numero_serie', e.target.value.trimStart().toUpperCase())} />
        </Field>
        {serieDudosa(data.nombre, data.numero_serie) && (
          <Nota tono="amber">Los números de serie de Apple tienen 10 o 12 caracteres. Revisa si falta o sobra alguno.</Nota>
        )}
      </StepCard>

      <StepCard step={pasos ? 3 : undefined} icon={Wallet} title="Precio y estado" subtitle="El precio de venta es el que se usa al vender y al cotizar.">
        <CamposPrecio data={data} errores={errores} cambiar={cambiar} />
        <div className="mt-4">
          <CampoProcedencia valor={data.procedencia} error={errores.procedencia} sugerencias={sugerencias.procedencias}
            lista="computadoras-procedencias" onChange={(v) => cambiar('procedencia', v)} />
        </div>
        <div className="mt-4">
          <CampoEstado valor={data.estado} error={errores.estado} onChange={(v) => cambiar('estado', v)} aviso={avisoEstado} />
        </div>
      </StepCard>
    </>
  );
}

/** Resumen en vivo: el equipo, su título completo y el precio con su ganancia. */
export function ResumenComputadora({ data, children }) {
  const titulo = tituloTienda(data);
  return (
    <section className="rounded-2xl border border-gris-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-gris-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
          <Laptop className="h-[18px] w-[18px] text-[#96684F]" /> Resumen
        </h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-gris-50 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#121214] text-white"><Laptop className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-gris-900">{bonito(data.nombre) || 'Nueva computadora'}</p>
            <p className="truncate text-xs text-gris-500">{detalleEquipo(data) || 'Chip, memoria y color'}</p>
          </div>
          <EstadoBadge estado={data.estado} />
        </div>

        <dl className="space-y-1.5 text-sm">
          <Linea label="Condición" valor={data.condicion} />
          <Linea label="Batería" valor={bateriaTexto(data.bateria_pct, data.ciclos)} />
          <Linea label="Número de serie" valor={data.numero_serie} mono />
          <Linea label="Procedencia" valor={data.procedencia.trim()} />
        </dl>

        {titulo && (
          <div className="rounded-xl border border-dashed border-gris-200 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gris-400">Título completo</p>
            <p className="mt-1 text-sm font-semibold text-gris-800">{titulo}</p>
          </div>
        )}

        <CajaPrecio costo={data.precio_costo} venta={data.precio_venta} />

        {children}
      </div>
    </section>
  );
}
