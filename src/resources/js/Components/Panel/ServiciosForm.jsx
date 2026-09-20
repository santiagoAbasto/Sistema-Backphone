import { Head, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { route } from 'ziggy-js';
import { ArrowLeft, Hammer, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import PremiumNotice from '@/Components/PremiumNotice';
import { notifyRecordsUpdated } from '@/Hooks/useAutoRefresh';
import { Badge, Field, Input, Segmented, StepCard, Textarea, bsFmt, buttonCls, inputCls } from '@/Components/Admin/ui';
import { IconoPieza } from '@/Components/Admin/piezas';
import RecepcionEquipo, { payloadRecepcion, recepcionInicial, textoDesbloqueo, validarRecepcion } from '@/Components/Panel/RecepcionEquipo';

let ultimoId = 0;
const nuevoTrabajo = () => ({ id: ++ultimoId, origen: 'manual', descripcion: '', costo: '', precio: '', pieza: null, cantidad: 1 });
const trabajoDePieza = (pieza) => ({
  id: ++ultimoId,
  origen: 'pieza',
  pieza,
  cantidad: 1,
  descripcion: [pieza.nombre, pieza.compatibilidad].filter(Boolean).join(' · '),
  // El costo lo pone el servidor desde el inventario; acá solo se muestra cuando el panel lo recibe.
  costo: pieza.precio_costo != null ? String(Number(pieza.precio_costo)) : '',
  precio: String(Number(pieza.precio_venta) || 0),
});
const monto = (v) => Math.round((Number(v) || 0) * 100) / 100;
const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Buscador de piezas del inventario.
 *
 * Es un buscador y no un desplegable porque un taller que despieza equipos junta cientos de
 * repuestos: en una lista larga no se encuentra nada, y con el nombre a medio escribir sí.
 */
function BuscadorPiezas({ piezas, onElegir, onCerrar }) {
  const [texto, setTexto] = useState('');
  const q = normalizar(texto.trim());
  const resultados = (q
    ? piezas.filter((p) => normalizar([p.nombre, p.categoria, p.compatibilidad, p.codigo].join(' ')).includes(q))
    : piezas
  ).slice(0, 40);

  return (
    <div className="rounded-xl border border-[rgb(var(--acento-rgb)_/_0.3)] bg-[rgb(var(--acento-rgb)_/_0.04)] p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar una pieza del inventario"
            placeholder="Pantalla, batería, pin de carga, iPhone 11…" className={`${inputCls} h-10 pl-9`} />
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar el buscador de piezas"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-white hover:text-gris-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {resultados.length === 0 ? (
        <p className="px-1 py-3 text-[13px] text-gris-500">
          {piezas.length === 0
            ? 'Todavía no hay piezas cargadas en el inventario. Podés escribir el trabajo a mano igual.'
            : 'Ninguna pieza coincide. Probá con parte del nombre o con el equipo compatible.'}
        </p>
      ) : (
        <ul className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gris-200 bg-white">
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onElegir(p)}
                className="flex w-full items-center justify-between gap-3 border-b border-gris-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-gris-50">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-gris-900">{p.nombre}</span>
                  <span className="block truncate text-xs text-gris-500">
                    {[p.compatibilidad || p.categoria, `quedan ${p.cantidad}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-gris-900">{bsFmt(p.precio_venta)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Linea({ label, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gris-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-gris-900">{valor || '—'}</dd>
    </div>
  );
}

export default function ServiciosForm({ tecnicos = [], piezas = [], revision = [], marcas = [], Layout, prefijo = 'admin' }) {
  // El vendedor registra solo lo que paga el cliente: con eso sale la nota. El costo de cada trabajo lo carga
  // el administrador desde la lista (le llega el aviso), y recién ahí se calcula la utilidad.
  const conMargen = prefijo === 'admin';
  const [data, setData] = useState({
    cliente: '',
    telefono: '',
    equipo: '',
    marca: '',
    tecnico_id: '',
    fecha: dayjs().format('YYYY-MM-DD'), // fecha local (no UTC)
    notas_adicionales: '',
  });
  const [trabajos, setTrabajos] = useState(() => [nuevoTrabajo()]);
  const [recepcion, setRecepcion] = useState(() => recepcionInicial(revision));
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [errores, setErrores] = useState({});
  const [buscandoPieza, setBuscandoPieza] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [notice, setNotice] = useState(null);
  const ultimaBusqueda = useRef('');

  const avisar = (title, message = '', type = 'error') => setNotice({ id: Date.now(), title, message, type });
  const quitarError = (clave) => setErrores((e) => {
    if (!e[clave]) return e;
    const { [clave]: _omitido, ...resto } = e;
    return resto;
  });
  const cambiar = (campo, valor) => {
    setData((d) => ({ ...d, [campo]: valor }));
    quitarError(campo);
  };

  /* Cliente: sugerencias mientras escribe */
  const buscarCliente = async (valor) => {
    cambiar('cliente', valor);
    ultimaBusqueda.current = valor;
    if (valor.trim().length < 2) {
      setMostrarSugerencias(false);
      return;
    }
    try {
      const res = await axios.get(route(`${prefijo}.clientes.sugerencias`, { term: valor.trim() }));
      if (ultimaBusqueda.current !== valor) return; // respuesta vieja: ya escribió otra cosa
      setSugerencias(Array.isArray(res.data) ? res.data : []);
      setMostrarSugerencias(true);
    } catch {
      setMostrarSugerencias(false);
    }
  };

  const elegirCliente = (c) => {
    setData((d) => ({ ...d, cliente: c.nombre, telefono: c.telefono || d.telefono }));
    quitarError('cliente');
    setMostrarSugerencias(false);
  };

  /* Trabajos */
  const cambiarTrabajo = (id, campo, valor) => {
    setTrabajos((ts) => ts.map((t) => {
      if (t.id !== id) return t;
      const siguiente = { ...t, [campo]: valor };
      // Al cambiar las unidades de una pieza, el cobro y el costo se recalculan desde su precio
      // unitario: si no, cambiar 1 por 3 dejaría el precio de una sola.
      if (campo === 'cantidad' && t.origen === 'pieza' && t.pieza) {
        const n = Math.max(1, Number(valor) || 1);
        siguiente.cantidad = n;
        siguiente.precio = String(monto((Number(t.pieza.precio_venta) || 0) * n));
        siguiente.costo = t.pieza.precio_costo != null ? String(monto((Number(t.pieza.precio_costo) || 0) * n)) : '';
      }
      return siguiente;
    }));
    quitarError(`trabajo.${id}`);
    quitarError('trabajos');
  };
  const quitarTrabajo = (id) => setTrabajos((ts) => (ts.length === 1 ? [nuevoTrabajo()] : ts.filter((t) => t.id !== id)));
  const agregarTrabajo = () => setTrabajos((ts) => [...ts, nuevoTrabajo()]);

  // La primera fila está vacía hasta que se escribe algo: la pieza ocupa ese lugar en vez de
  // dejar un renglón en blanco arriba de todo.
  const agregarPieza = (pieza) => {
    setTrabajos((ts) => {
      const fila = trabajoDePieza(pieza);
      const soloUnaVacia = ts.length === 1 && ts[0].origen === 'manual' && !ts[0].descripcion.trim() && ts[0].precio === '';
      return soloUnaVacia ? [fila] : [...ts, fila];
    });
    setBuscandoPieza(false);
    quitarError('trabajos');
  };

  // La regla del taller: un equipo Android no se le asigna al técnico de Apple. Acá se ve —
  // al elegir la marca, los que no la atienden desaparecen de la lista— y el servidor la
  // vuelve a comprobar al guardar.
  const disponibles = data.marca
    ? tecnicos.filter((t) => data.marca === 'otro' || t.especialidad === 'ambas' || t.especialidad === data.marca)
    : tecnicos;
  const tecnicoElegido = tecnicos.find((t) => String(t.id) === String(data.tecnico_id)) ?? null;
  const fueraDeLista = data.marca ? tecnicos.filter((t) => !disponibles.includes(t)) : [];
  const marcaTexto = marcas.find((m) => m.value === data.marca)?.label ?? data.marca;

  const elegirMarca = (marca) => {
    setData((d) => {
      const sirve = tecnicos.find((t) => String(t.id) === String(d.tecnico_id)
        && (marca === 'otro' || t.especialidad === 'ambas' || t.especialidad === marca));
      // Si el que estaba elegido no atiende esta marca, se suelta: es más honesto que dejarlo
      // puesto y que el servidor lo rechace recién al guardar.
      return { ...d, marca, tecnico_id: sirve ? d.tecnico_id : '' };
    });
    quitarError('marca');
    quitarError('tecnico_id');
  };

  const puntosMarcados = recepcion.revision.filter((p) => p.estado).length;
  const descritos = trabajos.filter((t) => t.descripcion.trim());
  const totalCosto = monto(trabajos.reduce((a, t) => a + monto(t.costo), 0));
  const totalCobro = monto(trabajos.reduce((a, t) => a + monto(t.precio), 0));
  const ganancia = monto(totalCobro - totalCosto);

  // Lo que sale del inventario ya trae su costo: solo queda pendiente lo escrito a mano sin costo.
  const sinCosto = conMargen ? descritos.filter((t) => t.origen !== 'pieza' && t.costo === '').length : 0;

  // Cuántas unidades de cada pieza está pidiendo el servicio (dos renglones de lo mismo suman).
  const pedidoPorPieza = trabajos.reduce((acc, t) => {
    if (t.origen === 'pieza' && t.pieza) acc[t.pieza.id] = (acc[t.pieza.id] ?? 0) + Math.max(1, Number(t.cantidad) || 1);
    return acc;
  }, {});

  const validar = () => {
    const e = {};
    if (!data.cliente.trim()) e.cliente = 'Escribe el nombre del cliente.';
    if (!data.equipo.trim()) e.equipo = 'Indica qué equipo deja el cliente.';
    if (!data.marca) e.marca = 'Indica de qué es el equipo.';
    if (!data.tecnico_id) e.tecnico_id = 'Elige quién va a reparar el equipo.';
    if (!data.fecha) e.fecha = 'Elige la fecha.';
    trabajos.forEach((t) => {
      if (!t.descripcion.trim() && (t.costo !== '' || t.precio !== '')) e[`trabajo.${t.id}`] = 'Describe este trabajo.';
      else if (t.descripcion.trim() && t.precio === '') e[`trabajo.${t.id}`] = 'Escribe cuánto paga el cliente por este trabajo.';
      else if (Number(t.costo) < 0 || Number(t.precio) < 0) e[`trabajo.${t.id}`] = 'Los montos no pueden ser negativos.';
      else if (t.origen === 'pieza' && t.pieza && pedidoPorPieza[t.pieza.id] > Number(t.pieza.cantidad || 0)) {
        e[`trabajo.${t.id}`] = `De «${t.pieza.nombre}» quedan ${t.pieza.cantidad} y el servicio está usando ${pedidoPorPieza[t.pieza.id]}.`;
      }
    });
    if (descritos.length === 0) e.trabajos = 'Agrega al menos un trabajo.';
    return { ...e, ...validarRecepcion(recepcion) };
  };

  const registrar = () => {
    if (guardando) return;
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) {
      avisar('Revisa los datos', 'Hay campos por completar.');
      return;
    }

    // Un costo vacío no es cero: el servicio queda con el costo pendiente (del vendedor nunca viaja
    // el costo). Lo que sale del inventario viaja con su pieza y sus unidades, y el costo real lo
    // resuelve el servidor: así nadie puede inflarlo desde el navegador.
    const detalle = descritos.map((t) => (t.origen === 'pieza' && t.pieza
      ? {
        descripcion: t.descripcion.trim(),
        precio: monto(t.precio),
        pieza_id: t.pieza.id,
        cantidad: Math.max(1, Number(t.cantidad) || 1),
      }
      : {
        descripcion: t.descripcion.trim(),
        ...(conMargen && t.costo !== '' ? { costo: monto(t.costo) } : {}),
        precio: monto(t.precio),
      }));

    router.post(route(`${prefijo}.servicios.store`), {
      cliente: data.cliente.trim(),
      telefono: data.telefono.trim(),
      equipo: data.equipo.trim(),
      marca: data.marca,
      tecnico_id: data.tecnico_id,
      fecha: data.fecha,
      notas_adicionales: data.notas_adicionales.trim(),
      recepcion: payloadRecepcion(recepcion),
      detalle_servicio: JSON.stringify(detalle),
      ...(conMargen && sinCosto === 0 ? { precio_costo: totalCosto } : {}),
      precio_venta: monto(detalle.reduce((a, t) => a + t.precio, 0)),
    }, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setGuardando(true),
      onSuccess: () => notifyRecordsUpdated(),
      onError: (errs) => {
        setErrores(errs);
        avisar('No se pudo registrar el servicio', 'Revisa los datos marcados.');
      },
      onFinish: () => setGuardando(false),
    });
  };

  const mensajes = [...new Set(Object.values(errores).flat())];

  return (
    <Layout title="Nuevo servicio técnico">
      <Head title="Nuevo servicio técnico" />
      <PremiumNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link href={route(`${prefijo}.servicios.index`)} aria-label="Volver a servicios"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gris-200 bg-white text-gris-500 transition-colors hover:text-gris-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-carbon-900" style={{ fontFamily: "'Chakra Petch', 'Inter', sans-serif" }}>
              Nuevo servicio técnico
            </h1>
            <p className="text-sm text-gris-500">Registra la reparación: cliente, equipo, técnico y lo que se cobra.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Paso 1 */}
            <StepCard step={1} title="Cliente" subtitle="Escribe el nombre: si ya vino antes, aparece para elegirlo.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Field label="Nombre del cliente" error={errores.cliente}>
                    <Input
                      value={data.cliente}
                      placeholder="Ej.: María Rojas"
                      autoComplete="off"
                      onChange={(e) => buscarCliente(e.target.value)}
                      onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
                    />
                  </Field>
                  {mostrarSugerencias && sugerencias.length > 0 && (
                    <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gris-200 bg-white text-sm shadow-xl">
                      {sugerencias.map((c) => (
                        <li key={c.id ?? `${c.nombre}-${c.telefono}`}>
                          <button type="button" className="block w-full px-4 py-2.5 text-left hover:bg-gris-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => elegirCliente(c)}>
                            <span className="block font-semibold text-gris-900">{c.nombre}</span>
                            {c.telefono && <span className="text-xs text-gris-500">{c.telefono}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Field label="Teléfono" error={errores.telefono} hint="Para avisarle cuando el equipo esté listo.">
                  <Input value={data.telefono} placeholder="Ej.: 70000000" inputMode="tel"
                    onChange={(e) => cambiar('telefono', e.target.value)} />
                </Field>
              </div>
            </StepCard>

            {/* Paso 2 */}
            <StepCard step={2} title="Equipo y técnico" subtitle="Qué equipo deja el cliente y quién hará el trabajo.">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                <Field label="Equipo" error={errores.equipo}>
                  <Input value={data.equipo} placeholder="Ej.: iPhone 13 Pro Max"
                    onChange={(e) => cambiar('equipo', e.target.value)} />
                </Field>
                <Field label="Fecha" error={errores.fecha}>
                  <Input type="date" value={data.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="¿De qué es el equipo?" error={errores.marca}
                  hint="De acá sale quién lo puede reparar.">
                  <Segmented options={marcas} value={data.marca} ariaLabel="Marca del equipo"
                    cols="grid-cols-3" onChange={elegirMarca} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Técnico" error={errores.tecnico_id}
                  hint={data.marca
                    ? 'Solo aparecen los que atienden esta marca.'
                    : 'Elige primero de qué es el equipo.'}>
                  {disponibles.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                      Ningún técnico atiende esta marca todavía. El administrador la configura en
                      «Técnicos y comisiones».
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Técnico">
                      {disponibles.map((t) => {
                        const elegido = String(data.tecnico_id) === String(t.id);
                        return (
                          <button key={t.id} type="button" role="radio" aria-checked={elegido}
                            onClick={() => { cambiar('tecnico_id', t.id); quitarError('tecnico_id'); }}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all ${
                              elegido
                                ? 'border-carbon-900 bg-carbon-900 text-white shadow-[0_8px_18px_-10px_rgba(10,10,11,0.6)]'
                                : 'border-gris-200 bg-white text-gris-700 hover:border-gris-300 hover:text-gris-900'}`}>
                            <Wrench className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>

                {/* Que se vea por qué alguien dejó de estar en la lista, y no que simplemente
                    desapareció: nombrarlo evita que parezca un error de la pantalla */}
                {data.marca && fueraDeLista.length > 0 && (
                  <p className="mt-2 text-[11.5px] leading-snug text-gris-500">
                    {fueraDeLista.length <= 2
                      ? `${fueraDeLista.map((t) => t.nombre).join(' y ')} no ${fueraDeLista.length === 1 ? 'aparece' : 'aparecen'}: no ${fueraDeLista.length === 1 ? 'atiende' : 'atienden'} ${marcaTexto}.`
                      : `${fueraDeLista.length} técnicos no aparecen porque no atienden ${marcaTexto}.`}
                  </p>
                )}
              </div>
            </StepCard>

            {/* Paso 3 */}
            <StepCard step={3} title="Trabajos y repuestos"
              subtitle={conMargen
                ? 'Cada trabajo con su costo y lo que paga el cliente. Las piezas del inventario traen su costo sola y salen del stock al guardar; lo que no esté cargado se escribe a mano.'
                : 'Cada trabajo con lo que paga el cliente. Si usas una pieza del inventario, elígela: sale del stock al guardar.'}
              actions={<Badge tone="navy">{descritos.length} {descritos.length === 1 ? 'renglón' : 'renglones'}</Badge>}>

              <div className={`mb-2 hidden gap-2.5 px-[13px] text-[11px] font-bold uppercase tracking-[0.08em] text-gris-400 md:grid ${conMargen ? 'grid-cols-[32px_minmax(0,1fr)_132px_152px_40px]' : 'grid-cols-[32px_minmax(0,1fr)_152px_40px]'}`}>
                <span>#</span><span>Trabajo o repuesto</span>{conMargen && <span>Costo (Bs)</span>}<span>Cobro al cliente</span><span />
              </div>

              <ul className="space-y-2">
                {trabajos.map((t, i) => {
                  const dePieza = t.origen === 'pieza' && t.pieza;
                  const costo = monto(t.costo);
                  const precio = monto(t.precio);
                  const error = errores[`trabajo.${t.id}`];
                  const bajoCosto = conMargen && t.costo !== '' && t.precio !== '' && precio < costo;
                  const aviso = error || (bajoCosto ? `Se cobra ${bsFmt(costo - precio)} menos de lo que cuesta.` : null);
                  return (
                    <li key={t.id} className={`rounded-xl border p-3 transition-colors ${error ? 'border-rose-300 bg-rose-50/40' : dePieza ? 'border-[rgb(var(--acento-rgb)_/_0.3)] bg-[rgb(var(--acento-rgb)_/_0.03)]' : 'border-gris-200 bg-white'}`}>
                      {dePieza && (
                        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-gris-200/70 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--acento)]">
                            <IconoPieza className="h-3.5 w-3.5" /> Del inventario
                          </span>
                          <div className="flex items-center gap-2">
                            <label htmlFor={`unidades-${t.id}`} className="text-[11px] font-semibold text-gris-500">Unidades</label>
                            <input id={`unidades-${t.id}`} type="number" min={1} step={1} inputMode="numeric" value={t.cantidad}
                              onChange={(e) => cambiarTrabajo(t.id, 'cantidad', e.target.value)}
                              className={`${inputCls} h-9 w-20 text-center font-semibold tabular-nums`} />
                            <span className="text-[11px] text-gris-400">de {t.pieza.cantidad} en stock</span>
                          </div>
                        </div>
                      )}

                      <div className={`grid items-center gap-2.5 ${conMargen
                        ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] md:grid-cols-[32px_minmax(0,1fr)_132px_152px_40px]'
                        : 'grid-cols-[minmax(0,1fr)_40px] md:grid-cols-[32px_minmax(0,1fr)_152px_40px]'}`}>
                        <span className="hidden h-8 w-8 place-items-center rounded-lg bg-gris-100 text-xs font-bold text-gris-500 md:grid">{i + 1}</span>
                        <Input className={conMargen ? 'col-span-3 md:col-span-1' : 'col-span-2 md:col-span-1'} value={t.descripcion} aria-label={`Trabajo ${i + 1}`}
                          placeholder={i === 0 ? 'Ej.: Cambio de batería' : 'Describe el trabajo'}
                          onChange={(e) => cambiarTrabajo(t.id, 'descripcion', e.target.value)} />
                        {conMargen && (dePieza ? (
                          // El costo de una pieza sale del inventario: se muestra, no se escribe.
                          <p className="flex h-11 items-center rounded-[10px] border border-dashed border-gris-300 px-3 text-sm font-semibold tabular-nums text-gris-500"
                            title="Sale del inventario de piezas">
                            {t.costo === '' ? 'Del stock' : bsFmt(costo)}
                          </p>
                        ) : (
                          <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Costo" aria-label={`Costo del trabajo ${i + 1}`}
                            className="tabular-nums" value={t.costo} onChange={(e) => cambiarTrabajo(t.id, 'costo', e.target.value)} />
                        ))}
                        <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Cobro al cliente" aria-label={`Cobro al cliente del trabajo ${i + 1}`}
                          className="font-semibold tabular-nums" value={t.precio} onChange={(e) => cambiarTrabajo(t.id, 'precio', e.target.value)} />
                        <button type="button" onClick={() => quitarTrabajo(t.id)} aria-label={`Quitar ${dePieza ? t.pieza.nombre : `trabajo ${i + 1}`}`} title="Quitar"
                          className="grid h-10 w-10 place-items-center rounded-lg text-gris-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {aviso && (
                        <p className={`mt-2 text-xs md:pl-[42px] ${error ? 'font-semibold text-rose-600' : 'text-amber-700'}`}>{aviso}</p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {buscandoPieza ? (
                <div className="mt-3">
                  <BuscadorPiezas piezas={piezas} onElegir={agregarPieza} onCerrar={() => setBuscandoPieza(false)} />
                </div>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={agregarTrabajo}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-gris-300 text-sm font-semibold text-gris-600 transition-colors hover:border-[color:var(--acento)] hover:bg-[rgb(var(--acento-rgb)_/_0.04)] hover:text-carbon-900">
                    <Plus className="h-4 w-4" /> Escribir un trabajo
                  </button>
                  <button type="button" onClick={() => setBuscandoPieza(true)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[rgb(var(--acento-rgb)_/_0.4)] bg-[rgb(var(--acento-rgb)_/_0.06)] text-sm font-semibold text-[color:var(--acento)] transition-colors hover:bg-[rgb(var(--acento-rgb)_/_0.12)]">
                    <IconoPieza className="h-4 w-4" /> Usar una pieza del inventario
                  </button>
                </div>
              )}
              {errores.trabajos && <p className="mt-2 text-xs font-semibold text-rose-600">{errores.trabajos}</p>}
            </StepCard>

            {/* Paso 4 */}
            <StepCard step={4} title="Cómo llega el equipo"
              subtitle="Se imprime en la nota que firman el cliente y la tienda. Es lo que responde cuando alguien vuelve diciendo que su equipo no estaba así."
              actions={<Badge tone="navy">{puntosMarcados} {puntosMarcados === 1 ? 'punto' : 'puntos'}</Badge>}>
              <RecepcionEquipo recepcion={recepcion} onCambiar={(r) => { setRecepcion(r); quitarError('desbloqueo'); }}
                error={errores.desbloqueo} />

              <div className="mt-5 border-t border-gris-100 pt-5">
                <Field label="Notas" hint="Lo que no entra en la revisión: acuerdos con el cliente, recomendaciones.">
                  <Textarea rows={3} value={data.notas_adicionales} placeholder="Ej.: el cliente autoriza abrir el equipo; pasa a buscarlo el viernes."
                    onChange={(e) => cambiar('notas_adicionales', e.target.value)} />
                </Field>
              </div>
            </StepCard>
          </div>

          {/* Resumen */}
          <aside className="xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
              <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                  <Hammer className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Resumen del servicio
                </h2>
                <Badge tone="navy">{descritos.length} {descritos.length === 1 ? 'trabajo' : 'trabajos'}</Badge>
              </div>

              <div className="space-y-4 p-5">
                <dl className="space-y-1.5 text-sm">
                  <Linea label="Cliente" valor={data.cliente.trim()} />
                  <Linea label="Equipo" valor={data.equipo.trim()} />
                  <Linea label="Técnico" valor={tecnicoElegido?.nombre} />
                  <Linea label="Desbloqueo" valor={textoDesbloqueo(recepcion.desbloqueo)} />
                  <Linea label="Revisión" valor={puntosMarcados > 0 ? `${puntosMarcados} puntos anotados` : ''} />
                </dl>

                {descritos.length > 0 && (
                  <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-gris-100 pt-4">
                    {descritos.map((t) => (
                      <li key={`r-${t.id}`} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-gris-600">{t.descripcion}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-gris-900">{bsFmt(t.precio)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {conMargen && (
                  <dl className="space-y-1.5 border-t border-gris-100 pt-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gris-500">Costo de los trabajos</dt>
                      <dd className="font-semibold tabular-nums text-gris-900">{sinCosto > 0 ? 'Pendiente' : bsFmt(totalCosto)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gris-500">Ganancia</dt>
                      {sinCosto > 0 ? (
                        <dd className="font-semibold text-gris-400">Al cargar el costo</dd>
                      ) : (
                        <dd className={`font-semibold tabular-nums ${ganancia < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {ganancia < 0 ? '−' : '+'}{bsFmt(Math.abs(ganancia))}
                        </dd>
                      )}
                    </div>
                  </dl>
                )}

                <div className="rounded-xl bg-carbon-900 px-4 py-3.5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">El cliente paga</p>
                  <p className="mt-1 text-[28px] font-bold leading-none tracking-tight">{bsFmt(totalCobro)}</p>
                  <p className="mt-1.5 text-xs text-white/60">Es el total que aparece en la nota.</p>
                </div>

                {!conMargen && (
                  <p className="rounded-xl bg-gris-50 px-4 py-3 text-xs leading-relaxed text-gris-600">
                    Al registrarlo sale la nota para el cliente. El costo del trabajo lo carga el administrador para calcular la utilidad.
                  </p>
                )}

                {mensajes.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    <p className="mb-1 font-semibold">Revisa estos datos:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {mensajes.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                )}

                <button type="button" onClick={registrar} disabled={guardando}
                  className={buttonCls('primary', 'h-12 w-full text-[15px]')}>
                  {guardando ? 'Guardando…' : 'Registrar servicio'}
                </button>
                <p className="text-center text-xs text-gris-400">Al guardar vuelves al listado, donde imprimes la nota.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
