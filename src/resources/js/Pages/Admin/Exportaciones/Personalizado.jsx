import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { route } from 'ziggy-js';
import {
  Apple, ArrowLeft, Boxes, FileDown, Laptop, Search, Smartphone,
} from 'lucide-react';
import AdminGuide from '@/Components/Admin/AdminGuide';
import { Consejos, Field, Input, PageHeader, Segmented, StepCard, Switch, Toast, buttonCls, useToast } from '@/Components/Admin/ui';
import { Aviso, Nota, Stat } from '@/Components/Admin/inventario';

// Exportar datos → Exportador: se escribe lo que se busca y, antes de generar el PDF, el panel dice cuántos
// productos van a salir y muestra los primeros. Así nadie abre un PDF vacío.

const ICONOS = {
  celulares: Smartphone,
  computadoras: Laptop,
  productos_generales: Boxes,
  productos_apple: Apple,
};

const EJEMPLOS = {
  productos_generales: ['fundas magsafe de 14 pro max', 'vidrio templado', 'cargador 20w'],
  celulares: ['iphone 14 pro max', 'iphone 13', 'se 2020'],
  computadoras: ['macbook air', 'macbook pro 14', 'ideapad'],
  productos_apple: ['ipad', 'apple watch', 'airpods'],
};

const CONSEJOS_BUSQUEDA = [
  {
    titulo: 'Escribe como lo tienes cargado',
    texto: 'La búsqueda no distingue mayúsculas, tildes ni el plural: «fundas» encuentra «funda». Cada palabra que escribas tiene que estar en el nombre.',
    bien: 'funda magsafe 14 pro max',
    mal: 'fundas de silicona con imán para el iPhone catorce',
  },
  {
    titulo: 'Menos palabras, más resultados',
    texto: 'Cuantas más palabras pongas, menos productos entran. Empieza corto y ve agregando hasta que la cuenta se acerque a lo que buscas.',
    bien: 'vidrio → vidrio templado → vidrio templado 15',
    mal: 'vidrio templado 9h premium antishock para iphone 15 pro',
  },
  {
    titulo: 'Fíjate en la cuenta antes de exportar',
    texto: 'Arriba del botón dice cuántos productos van a salir y muestra los primeros. Si dice 0, cambia las palabras en vez de abrir el PDF.',
    bien: '«Van a salir 23 productos» → exportar',
    mal: 'Exportar sin mirar y abrir un PDF vacío',
  },
];

export default function ExportadorPersonalizado({ defaults = {}, inventarios = [] }) {
  const [toast] = useToast();
  const [inventario, setInventario] = useState(defaults.inventario ?? 'productos_generales');
  const [nombre, setNombre] = useState(defaults.nombre ?? '');
  const [soloDisponibles, setSoloDisponibles] = useState(defaults.solo_disponibles ?? true);
  const [cuenta, setCuenta] = useState({ total: null, muestra: [], cargando: false });

  const elegido = useMemo(
    () => inventarios.find((i) => i.value === inventario) ?? inventarios[0] ?? {},
    [inventario, inventarios],
  );

  // La cuenta se pide mientras se escribe, medio segundo después de la última tecla
  useEffect(() => {
    const texto = nombre.trim();
    if (texto === '') { setCuenta({ total: null, muestra: [], cargando: false }); return undefined; }

    setCuenta((c) => ({ ...c, cargando: true }));
    const t = setTimeout(() => {
      axios.get(route('admin.exportar.contar'), {
        params: { inventario, nombre: texto, solo_disponibles: soloDisponibles ? 1 : 0 },
      })
        .then(({ data }) => setCuenta({ total: data.total, muestra: data.muestra ?? [], cargando: false }))
        .catch(() => setCuenta({ total: null, muestra: [], cargando: false }));
    }, 500);

    return () => clearTimeout(t);
  }, [inventario, nombre, soloDisponibles]);

  const urlPdf = nombre.trim()
    ? route('admin.exportar.por-nombre', {
      inventario,
      nombre: nombre.trim(),
      solo_disponibles: soloDisponibles ? 1 : 0,
    })
    : null;

  const hayResultados = cuenta.total !== null && cuenta.total > 0;

  return (
    <AdminLayout>
      <Head title="Exportador" />
      <Toast toast={toast} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <Link href={route('admin.exportaciones.index')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gris-500 hover:text-gris-800">
          <ArrowLeft className="h-4 w-4" /> Exportaciones
        </Link>

        <PageHeader
          title="Exportador"
          subtitle="Busca por nombre o modelo dentro de un inventario y arma un PDF solo con lo que encontraste."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={ICONOS[inventario] ?? Boxes} label="Inventario" value={elegido.label ?? '—'} tone="navy"
            hint={`se busca por ${elegido.busca_por ?? 'nombre'}`} />
          <Stat icon={Boxes} label="Dónde busca" value={(soloDisponibles ? elegido.disponibles ?? 0 : elegido.total ?? 0).toLocaleString('es-BO')}
            tone="slate" hint={soloDisponibles ? 'productos disponibles' : 'productos, incluidos los vendidos'} />
          <Stat icon={Search} label="Coinciden"
            value={cuenta.cargando ? '…' : cuenta.total === null ? '—' : cuenta.total.toLocaleString('es-BO')}
            tone={hayResultados ? 'emerald' : 'slate'}
            hint={cuenta.total === null ? 'escribe qué buscas' : hayResultados ? 'van a salir en el PDF' : 'probá con menos palabras'} />
          <Stat icon={FileDown} label="El PDF" value={hayResultados ? 'Listo' : 'Falta'} tone={hayResultados ? 'emerald' : 'slate'}
            hint={hayResultados ? 'se abre en otra pestaña' : 'no hay nada que exportar'} />
        </div>

        <AdminGuide id="exportador" title="¿Cómo busco lo que necesito?" steps={[
          'Elige en qué inventario buscar: celulares, computadoras, equipos de marca o accesorios.',
          'Escribe las palabras del nombre, como las tienes cargadas. No importan las mayúsculas, las tildes ni el plural.',
          'Mira la cuenta y los primeros resultados. Si es lo que buscabas, toca «Abrir el PDF».',
        ]} tip="La búsqueda pide que estén todas las palabras que escribas: «funda 15» encuentra «Funda MagSafe de iPhone 15», pero «funda azul 15» no la encuentra si el nombre no dice «azul»." />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <StepCard step="1" title="¿Dónde busco?" subtitle="Cada inventario se busca por su propio campo.">
              <Segmented
                ariaLabel="Inventario"
                value={inventario}
                onChange={setInventario}
                options={inventarios.map((i) => ({ value: i.value, label: i.label }))}
              />

              <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-gris-50 px-3.5 py-3">
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-gris-900">Solo lo disponible</span>
                  <span className="block text-xs leading-relaxed text-gris-500">
                    Apagado, el PDF también trae los que ya se vendieron. Sirve para ver qué se movió.
                  </span>
                </span>
                <Switch checked={soloDisponibles} onChange={setSoloDisponibles} label="Solo lo disponible" />
              </label>
            </StepCard>

            <StepCard step="2" title="¿Qué busco?" subtitle="Las palabras del nombre o del modelo, como las tienes cargadas.">
              <Field label={`Buscar por ${elegido.busca_por ?? 'nombre'}`}
                hint="Tienen que estar todas las palabras que escribas. Empieza corto.">
                <Input value={nombre} maxLength={120} autoFocus
                  placeholder={(EJEMPLOS[inventario] ?? [])[0] ?? 'Escribe qué buscas'}
                  onChange={(e) => setNombre(e.target.value)} />
              </Field>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gris-500">Ejemplos:</span>
                {(EJEMPLOS[inventario] ?? []).map((ej) => (
                  <button key={ej} type="button" onClick={() => setNombre(ej)}
                    className="rounded-lg border border-dashed border-gris-300 px-2.5 py-1 text-xs font-semibold text-gris-600 hover:border-[color:var(--acento)] hover:text-[color:var(--acento)]">
                    {ej}
                  </button>
                ))}
              </div>

              {nombre.trim() !== '' && cuenta.total === 0 && !cuenta.cargando && (
                <Nota tono="amber">
                  Ningún producto tiene todas esas palabras en su {elegido.busca_por ?? 'nombre'}.
                  Prueba con menos palabras{soloDisponibles ? ', o apaga «Solo lo disponible»' : ''}.
                </Nota>
              )}
            </StepCard>

            <section className="rounded-2xl border border-gris-200 bg-white p-5 shadow-sutil">
              <h2 className="text-base font-bold text-gris-900">Cómo buscar bien</h2>
              <p className="mt-0.5 text-[13px] text-gris-500">La búsqueda es simple a propósito: encuentra por palabras sueltas.</p>
              <Consejos consejos={CONSEJOS_BUSQUEDA} />
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200 bg-white p-5 shadow-sutil">
              <h2 className="text-base font-bold text-gris-900">Lo que va a salir</h2>
              <p className="mt-0.5 text-[13px] text-gris-500">
                {cuenta.total === null
                  ? 'Escribe qué buscas y acá se ve la cuenta.'
                  : cuenta.cargando ? 'Contando…' : `${cuenta.total.toLocaleString('es-BO')} ${cuenta.total === 1 ? 'producto' : 'productos'}.`}
              </p>

              {cuenta.muestra.length > 0 && (
                <ul className="mt-4 divide-y divide-gris-100 rounded-xl border border-gris-100">
                  {cuenta.muestra.map((p, i) => (
                    <li key={`${p.nombre}-${i}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="min-w-0 truncate text-[13px] text-gris-700">{p.nombre}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.estado === 'disponible' ? 'bg-emerald-50 text-emerald-700' : 'bg-gris-100 text-gris-500'}`}>
                        {p.estado === 'disponible' ? 'Disponible' : 'Vendido'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {cuenta.total > cuenta.muestra.length && cuenta.muestra.length > 0 && (
                <p className="mt-2 text-xs text-gris-500">
                  Y {(cuenta.total - cuenta.muestra.length).toLocaleString('es-BO')} más en el PDF.
                </p>
              )}

              <a
                href={hayResultados ? urlPdf : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!hayResultados}
                onClick={(e) => { if (!hayResultados) e.preventDefault(); }}
                className={buttonCls('primary', `mt-4 h-11 w-full ${hayResultados ? '' : 'pointer-events-none opacity-50'}`)}
              >
                <FileDown className="h-4 w-4" /> Abrir el PDF
              </a>

              <p className="mt-2 text-center text-[11px] text-gris-400">Se abre en otra pestaña.</p>
            </section>

            <Aviso tono="lila" icon={FileDown}>
              El PDF trae el costo y la ganancia: es para adentro, no para mandárselo a un cliente.
            </Aviso>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
