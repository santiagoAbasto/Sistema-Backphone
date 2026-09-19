import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { ArrowDownRight, ArrowUpRight, ChartLine, Minus, Table2 } from 'lucide-react';
import { ChartCard, T, bs, bsCorto, clamp, useCountUp, useWidth } from './theme';

/*
 * Resumen económico — gráfico tipo trading (tema claro) con datos reales.
 *  · Línea: cada venta/servicio es un "tick" con su valor; el tramo va en verde si sube y en rojo si baja.
 *    Debajo, en su propio panel, el acumulado del período.
 *  · Velas: cada día (o mes) es una vela con apertura, máximo, mínimo y cierre de sus movimientos.
 *    Debajo, en su propio panel, el total del día.
 * Cada panel tiene una sola escala: nunca dos ejes sobre el mismo gráfico.
 */
const UP = T.sube;
const DOWN = T.baja;

const METRICAS = [
    { key: 'ingresos', label: 'Ingresos', precio: 'Ticket', desc: 'Cada punto es una venta o servicio con su valor.' },
    { key: 'inversion', label: 'Inversión', precio: 'Costo', desc: 'Cada punto es el costo de un movimiento (incluye permutas).' },
    { key: 'utilidad', label: 'Utilidad', precio: 'Ganancia', desc: 'Cada punto es la ganancia de un movimiento; los egresos restan.' },
];

const RANGOS = [
    { key: '7d', label: '7D', title: 'Últimos 7 días' },
    { key: 'mes', label: '1M', title: 'Este mes' },
    { key: 'anio', label: '1A', title: 'Este año' },
];

const PAD_T = 12;
const MAIN = 208;
const SEP = 30;
const SUB = 58;
const AXIS = 30;
const H = PAD_T + MAIN + SEP + SUB + AXIS;

function IconoLinea(props) {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M1.5 11.5 5 7.2l3 2.6 3.4-5.3 3.1 2.8" />
        </svg>
    );
}

function IconoVelas(props) {
    return (
        <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
            <rect x="3.1" y="1.8" width="1" height="12.4" rx="0.5" />
            <rect x="1.8" y="4.6" width="3.6" height="6.4" rx="1" />
            <rect x="11.1" y="1.2" width="1" height="10.4" rx="0.5" />
            <rect x="9.8" y="3.2" width="3.6" height="5" rx="1" />
        </svg>
    );
}

// Marcas redondas del eje
function escala(min, max, cuantos = 4) {
    if (min === max) max = min + 1;
    const span = max - min;
    const mag = 10 ** Math.floor(Math.log10(span / cuantos));
    const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= cuantos) ?? 10 * mag;
    const lo = Math.floor(min / paso) * paso;
    const hi = Math.ceil(max / paso) * paso;
    const ticks = [];
    for (let v = lo; v <= hi + paso / 2; v += paso) ticks.push(Math.round(v * 100) / 100);
    return { lo, hi, ticks };
}

// Escala de "precio": se ajusta a los datos (como un exchange); incluye el cero si hay pérdidas
function escalaPrecio(valores, conCero) {
    let min = Math.min(...valores, conCero ? 0 : Infinity);
    let max = Math.max(...valores, conCero ? 0 : -Infinity);
    if (min === max) { const d = Math.abs(min) * 0.15 || 1; min -= d; max += d; }
    const pad = (max - min) * 0.08;
    return escala(min - pad, max + pad);
}

function Segmentado({ opciones, valor, onChange, label, layoutId }) {
    return (
        <div role="tablist" aria-label={label} className="inline-flex rounded-xl p-1" style={{ background: T.chip }}>
            {opciones.map((o) => {
                const sel = valor === o.key;
                const Icon = o.icon;
                return (
                    <button key={o.key} type="button" role="tab" aria-selected={sel} title={o.title ?? o.label} onClick={() => onChange(o.key)}
                        className={`relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors ${sel ? '' : 'hover:text-gris-900'}`}
                        style={{ color: sel ? '#FFFFFF' : '#475569' }}>
                        {sel && (
                            <motion.span layoutId={layoutId} className="absolute inset-0 rounded-lg shadow-sm" style={{ background: T.activo }}
                                transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                        )}
                        {Icon && <Icon className="relative h-3.5 w-3.5" />}
                        <span className={`relative ${Icon ? 'sr-only sm:not-sr-only' : ''}`}>{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

const TIPOS = [
    { key: 'linea', label: 'Línea', icon: IconoLinea },
    { key: 'velas', label: 'Velas', icon: IconoVelas },
];

function Chip({ sube }) {
    return (
        <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold"
            style={{ background: sube ? T.subeSuave : T.bajaSuave, color: sube ? T.subeTexto : T.bajaTexto }}>
            {sube ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {sube ? 'Sube' : 'Baja'}
        </span>
    );
}

export default function TrendChart({ serie, totales = {}, rango, cargando = false, onPreset, presetActivo }) {
    const reduce = useReducedMotion();
    const uid = useId().replace(/:/g, '');
    const wrapRef = useRef(null);
    const svgRef = useRef(null);
    const width = useWidth(wrapRef);

    const [metrica, setMetrica] = useState('ingresos');
    const [tipo, setTipo] = useState('linea');
    const [vista, setVista] = useState('grafico');
    const [activo, setActivo] = useState(null);

    const puntos = serie?.puntos ?? [];
    const movimientos = serie?.movimientos ?? [];
    const recortado = (serie?.movimientos_total ?? movimientos.length) > movimientos.length;
    const porMes = serie?.granularidad === 'mes';
    const unidad = porMes ? 'mes' : 'día';
    const meta = METRICAS.find((m) => m.key === metrica);
    const esVelas = tipo === 'velas';

    const dia = (f) => dayjs(f).locale('es');
    const bucket = (f) => dayjs(porMes ? `${f}-01` : f).locale('es');
    const cortaBucket = (f) => (porMes ? bucket(f).format('MMM YY') : bucket(f).format('D MMM'));
    const largaBucket = (f) => (porMes ? bucket(f).format('MMMM YYYY') : bucket(f).format('ddd D MMM YYYY'));

    // ── Línea: cada movimiento ──
    const ticks = useMemo(
        () => movimientos.filter((m) => metrica === 'utilidad' || m.tipo !== 'egreso'),
        [movimientos, metrica],
    );
    const valores = useMemo(() => ticks.map((m) => Number(m[metrica]) || 0), [ticks, metrica]);
    const acum = useMemo(() => { let s = 0; return valores.map((v) => (s += v)); }, [valores]);

    // ── Velas: cada día (o mes) ──
    const velas = useMemo(() => puntos.map((p) => p.velas?.[metrica] ?? null), [puntos, metrica]);
    const volumen = useMemo(() => puntos.map((p) => Number(p[metrica]) || 0), [puntos, metrica]);
    const ultimaVela = velas.findLastIndex(Boolean);

    const n = esVelas ? puntos.length : ticks.length;
    const hayDatos = esVelas ? ultimaVela !== -1 : ticks.length > 0;
    const ultimo = esVelas ? ultimaVela : n - 1;

    // ── Cifras de cabecera ──
    const total = Number(totales?.[metrica]) || 0;
    const heroValor = useCountUp(total);
    const cantidad = movimientos.filter((m) => m.tipo !== 'egreso').length;
    const promedio = valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
    const mayor = valores.length ? Math.max(...valores) : 0;

    const hoy = dayjs().format('YYYY-MM-DD');
    const hoySuma = ticks.filter((m) => m.fecha === hoy).reduce((s, m) => s + (Number(m[metrica]) || 0), 0);
    const dir = hoySuma > 0 ? 'sube' : hoySuma < 0 ? 'baja' : 'igual';
    const DeltaIcon = dir === 'sube' ? ArrowUpRight : dir === 'baja' ? ArrowDownRight : Minus;
    const deltaTono = dir === 'igual' || metrica === 'inversion'
        ? { bg: T.chip, fg: T.texto2 }
        : dir === 'sube' ? { bg: T.subeSuave, fg: T.subeTexto } : { bg: T.bajaSuave, fg: T.bajaTexto };

    useEffect(() => { setActivo(null); }, [serie, metrica, tipo]);

    // ── Geometría ──
    const geo = useMemo(() => {
        if (!width || !hayDatos) return null;

        const datosPrecio = esVelas ? velas.filter(Boolean).flatMap((v) => [v.h, v.l]) : valores;
        const conCero = metrica === 'utilidad' && datosPrecio.some((v) => v < 0);
        const { lo, hi, ticks: marcas } = escalaPrecio(datosPrecio, conCero);

        const right = Math.max(62, Math.max(...marcas.map((t) => bsCorto(t).length)) * 6.4 + 26);
        const left = 4;
        const plotW = Math.max(10, width - left - right);
        const step = plotW / n;
        const x = (i) => left + step * (i + 0.5);
        const y = (v) => PAD_T + (1 - (v - lo) / (hi - lo || 1)) * MAIN;
        const bottom = PAD_T + MAIN;
        const subTop = bottom + SEP;

        let main;
        let sub;
        if (esVelas) {
            const bw = clamp(step * 0.6, 3, 16);
            main = {
                velas: velas.map((v, i) => v && ({
                    i, cx: x(i), bw, up: v.c >= v.o,
                    top: Math.min(y(v.o), y(v.c)), alto: Math.max(1.5, Math.abs(y(v.o) - y(v.c))),
                    yh: y(v.h), yl: y(v.l),
                })).filter(Boolean),
            };
            const vmax = Math.max(...volumen.map((v) => Math.abs(v)), 0) || 1;
            sub = {
                barras: volumen.map((v, i) => {
                    const h = v === 0 ? 0 : Math.max(2, (Math.abs(v) / vmax) * SUB);
                    const up = velas[i] ? velas[i].c >= velas[i].o : v >= 0;
                    return { x: x(i) - bw / 2, y: subTop + SUB - h, w: bw, h, up: v < 0 ? false : up };
                }),
            };
        } else {
            const pts = valores.map((v, i) => [x(i), y(v)]);
            let up = '';
            let down = '';
            for (let i = 1; i < pts.length; i++) {
                const s = `M${pts[i - 1][0]},${pts[i - 1][1]} L${pts[i][0]},${pts[i][1]} `;
                if (valores[i] >= valores[i - 1]) up += s; else down += s;
            }
            const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
            main = { pts, up, down, area: pts.length > 1 ? `${linea} L${pts.at(-1)[0]},${bottom} L${pts[0][0]},${bottom} Z` : '' };

            const amin = Math.min(0, ...acum);
            const amax = Math.max(0, ...acum);
            const ay = (v) => subTop + (1 - (v - amin) / ((amax - amin) || 1)) * SUB;
            const apts = acum.map((v, i) => [x(i), ay(v)]);
            const alinea = apts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
            sub = {
                linea: alinea,
                area: apts.length > 1 ? `${alinea} L${apts.at(-1)[0]},${ay(amin)} L${apts[0][0]},${ay(amin)} Z` : '',
                fin: apts.at(-1),
            };
        }

        // Etiquetas del eje X sin encimarse (en la línea, solo cuando cambia el día)
        const etiquetas = [];
        let ultimaX = -Infinity;
        let ultimaFecha = null;
        for (let i = 0; i < n; i++) {
            const f = esVelas ? puntos[i].fecha : ticks[i].fecha;
            if (!esVelas && f === ultimaFecha) continue;
            ultimaFecha = f;
            const xi = x(i);
            if (xi - ultimaX < 72) continue;
            etiquetas.push({ i, x: xi, txt: esVelas ? cortaBucket(f) : dia(f).format('D MMM') });
            ultimaX = xi;
        }

        return { marcas, right, left, plotW, step, x, y, bottom, subTop, main, sub, etiquetas, conCero };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, hayDatos, esVelas, velas, valores, acum, volumen, n, metrica]);

    const valorEn = (i) => (esVelas ? velas[i]?.c : valores[i]);
    const subeEn = (i) => (esVelas ? (velas[i] ? velas[i].c >= velas[i].o : true) : (i === 0 ? true : valores[i] >= valores[i - 1]));
    const lectura = activo ?? ultimo;

    const indiceDesde = (clientX) => {
        const r = svgRef.current.getBoundingClientRect();
        return clamp(Math.floor((clientX - r.left - geo.left) / geo.step), 0, n - 1);
    };

    const mover = (delta) => setActivo((a) => {
        let i = clamp((a ?? ultimo) + delta, 0, n - 1);
        if (esVelas) { // salta días sin movimientos
            while (i > 0 && i < n - 1 && !velas[i]) i += delta;
        }
        return i;
    });

    const onKey = (e) => {
        if (!geo) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
        if (e.key === 'Home') { e.preventDefault(); setActivo(0); }
        if (e.key === 'End') { e.preventDefault(); setActivo(ultimo); }
        if (e.key === 'Escape') setActivo(null);
    };

    const claveAnim = `${metrica}-${tipo}-${n}-${puntos[0]?.fecha}-${puntos.at(-1)?.fecha}`;

    const lecturaVela = esVelas && lectura >= 0 ? velas[lectura] : null;
    const lecturaTick = !esVelas && lectura >= 0 ? ticks[lectura] : null;
    const lecturaSube = lectura >= 0 ? subeEn(lectura) : true;

    return (
        <ChartCard cargando={cargando}>
            {/* Encabezado */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#96684F]/10 text-[#96684F]">
                        <ChartLine className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="flex items-center gap-2 text-base font-bold text-gris-900">
                            Resumen económico
                            <span className="rounded-md bg-gris-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-gris-500">BOB</span>
                        </p>
                        <p className="text-[13px] text-gris-500">{rango}{recortado && !esVelas ? ' · últimos 400 movimientos' : ''}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {onPreset && <Segmentado opciones={RANGOS} valor={presetActivo} onChange={onPreset} label="Período" layoutId={`${uid}-r`} />}
                    <Segmentado opciones={TIPOS} valor={tipo} onChange={setTipo} label="Tipo de gráfico" layoutId={`${uid}-t`} />
                    {hayDatos && (
                        <button type="button" onClick={() => setVista((v) => (v === 'grafico' ? 'tabla' : 'grafico'))}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-gris-200 text-gris-500 transition-colors hover:bg-gris-50 hover:text-gris-800"
                            title={vista === 'grafico' ? 'Ver como tabla' : 'Ver como gráfico'} aria-label={vista === 'grafico' ? 'Ver como tabla' : 'Ver como gráfico'}>
                            {vista === 'grafico' ? <Table2 className="h-4 w-4" /> : <ChartLine className="h-4 w-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Ingresos · Inversión · Utilidad */}
            <div role="tablist" aria-label="Qué mostrar" className="mt-5 grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: T.chip }}>
                {METRICAS.map((m) => {
                    const sel = metrica === m.key;
                    return (
                        <button key={m.key} type="button" role="tab" aria-selected={sel} onClick={() => setMetrica(m.key)}
                            className={`relative rounded-lg py-2 text-sm font-bold transition-colors ${sel ? '' : 'hover:text-gris-900'}`}
                            style={{ color: sel ? '#FFFFFF' : '#475569' }}>
                            {sel && (
                                <motion.span layoutId={`${uid}-m`} className="absolute inset-0 rounded-lg shadow-[0_6px_16px_-8px_rgba(10, 10, 11,0.55)]"
                                    style={{ background: T.activo }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                            )}
                            <span className="relative">{m.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Cifra del período */}
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-[34px] font-extrabold leading-none tracking-tight text-gris-900 sm:text-[38px]">
                    {heroValor < 0 ? `−${bs(Math.abs(heroValor))}` : bs(heroValor)}
                </p>
                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold" style={{ background: deltaTono.bg, color: deltaTono.fg }}>
                    <DeltaIcon className="h-3.5 w-3.5" />
                    Hoy {dir === 'igual' ? 'sin movimiento' : `${hoySuma > 0 ? '+' : '−'}${bs(Math.abs(hoySuma))}`}
                </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-gris-500">
                <span>Movimientos <strong className="font-bold text-gris-900">{cantidad.toLocaleString('es-BO')}</strong></span>
                {valores.length > 0 && <span>{meta.precio} promedio <strong className="font-bold text-gris-900">{bs(promedio)}</strong></span>}
                {valores.length > 0 && <span>Mayor <strong className="font-bold text-gris-900">{bs(mayor)}</strong></span>}
            </div>

            {/* Área del gráfico */}
            <div className="mt-5 flex flex-1 flex-col rounded-xl border p-3 sm:p-4" style={{ borderColor: T.borde, background: T.panel }}>
                {!hayDatos ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                        <ChartLine className="h-6 w-6 text-gris-400" />
                        <p className="mt-3 text-sm font-bold text-gris-800">No hubo movimientos en este período</p>
                        <p className="mt-1 text-[13px] text-gris-500">Cuando registres ventas, servicios o egresos, aparecerán aquí.</p>
                    </div>
                ) : vista === 'tabla' ? (
                    <div className="max-h-[380px] overflow-auto rounded-lg border border-gris-200 bg-white">
                        <table className="min-w-full text-[13px]">
                            <caption className="sr-only">{esVelas ? `Velas por ${unidad}` : 'Movimientos del período'}</caption>
                            <thead className="sticky top-0 bg-gris-50 text-[11px] font-bold uppercase tracking-[0.08em] text-gris-500">
                                {esVelas ? (
                                    <tr>
                                        <th scope="col" className="px-3 py-2.5 text-left">{porMes ? 'Mes' : 'Día'}</th>
                                        {['Apertura', 'Máximo', 'Mínimo', 'Cierre', 'Total'].map((h) => <th key={h} scope="col" className="px-3 py-2.5 text-right">{h}</th>)}
                                    </tr>
                                ) : (
                                    <tr>
                                        <th scope="col" className="px-3 py-2.5 text-left">Fecha</th>
                                        <th scope="col" className="px-3 py-2.5 text-left">Detalle</th>
                                        {METRICAS.map((m) => <th key={m.key} scope="col" className="px-3 py-2.5 text-right">{m.label}</th>)}
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gris-100">
                                {esVelas
                                    ? puntos.map((p, i) => velas[i] && (
                                        <tr key={p.fecha} className="hover:bg-gris-50/70">
                                            <th scope="row" className="px-3 py-2 text-left font-medium capitalize text-gris-700">{cortaBucket(p.fecha)}</th>
                                            {['o', 'h', 'l', 'c'].map((k) => <td key={k} className="px-3 py-2 text-right tabular-nums text-gris-700">{bs(velas[i][k])}</td>)}
                                            <td className="px-3 py-2 text-right font-bold tabular-nums text-gris-900">{bs(volumen[i])}</td>
                                        </tr>
                                    ))
                                    : [...ticks].reverse().map((m) => (
                                        <tr key={`${m.fecha}-${m.orden}`} className="hover:bg-gris-50/70">
                                            <td className="whitespace-nowrap px-3 py-2 text-gris-500">{dia(m.fecha).format('D MMM')}</td>
                                            <td className="max-w-[180px] truncate px-3 py-2 font-medium text-gris-900">{m.etiqueta}</td>
                                            {METRICAS.map((mm) => (
                                                <td key={mm.key} className={`px-3 py-2 text-right tabular-nums ${mm.key === 'utilidad' && m.utilidad < 0 ? 'font-semibold' : ''}`}
                                                    style={{ color: mm.key === 'utilidad' && m.utilidad < 0 ? T.bajaTexto : T.texto2 }}>{bs(m[mm.key])}</td>
                                            ))}
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <>
                        {/* Barra de lectura: se actualiza al pasar el mouse */}
                        <div className="mb-2 flex min-h-[28px] flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12px] text-gris-500" aria-hidden="true">
                            {lecturaVela ? (
                                <>
                                    <span className="font-bold capitalize text-gris-900">{largaBucket(puntos[lectura].fecha)}</span>
                                    {[['A', lecturaVela.o], ['Máx', lecturaVela.h], ['Mín', lecturaVela.l], ['C', lecturaVela.c]].map(([k, v]) => (
                                        <span key={k}>{k} <strong className="font-bold tabular-nums text-gris-900">{bs(v)}</strong></span>
                                    ))}
                                    <span>Total <strong className="font-bold tabular-nums text-gris-900">{bs(volumen[lectura])}</strong></span>
                                    <Chip sube={lecturaSube} />
                                </>
                            ) : lecturaTick ? (
                                <>
                                    <span className="font-bold text-gris-900">{dia(lecturaTick.fecha).format('D MMM YYYY')}</span>
                                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-gris-600 ring-1 ring-gris-200">
                                        {lecturaTick.tipo === 'egreso' ? 'Egreso' : lecturaTick.tipo === 'servicio' ? 'Servicio' : 'Venta'}
                                    </span>
                                    <span className="max-w-[220px] truncate text-gris-700">{lecturaTick.etiqueta}</span>
                                    <span>{meta.precio} <strong className="font-bold tabular-nums text-gris-900">{bs(valores[lectura])}</strong></span>
                                    <span>Acumulado <strong className="font-bold tabular-nums text-gris-900">{bs(acum[lectura])}</strong></span>
                                    {lectura > 0 && <Chip sube={lecturaSube} />}
                                </>
                            ) : esVelas && lectura >= 0 && puntos[lectura] ? (
                                <span><span className="font-bold capitalize text-gris-900">{largaBucket(puntos[lectura].fecha)}</span> · sin movimientos</span>
                            ) : null}
                        </div>

                        <div
                            ref={wrapRef}
                            tabIndex={0}
                            role="group"
                            aria-label={`Gráfico de ${meta.label.toLowerCase()} ${esVelas ? `en velas por ${unidad}` : 'por movimiento'}. Usa las flechas para recorrerlo.`}
                            onKeyDown={onKey}
                            onFocus={() => setActivo((a) => a ?? ultimo)}
                            onBlur={() => setActivo(null)}
                            className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#96684F]/40"
                            style={{ height: H }}
                        >
                            {geo && (
                                <svg ref={svgRef} width={width} height={H} className="block" aria-hidden="true">
                                    <defs>
                                        <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={UP} stopOpacity="0.16" />
                                            <stop offset="100%" stopColor={UP} stopOpacity="0" />
                                        </linearGradient>
                                        <linearGradient id={`${uid}-acum`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={T.acumulado} stopOpacity="0.18" />
                                            <stop offset="100%" stopColor={T.acumulado} stopOpacity="0" />
                                        </linearGradient>
                                        <clipPath id={`${uid}-ver`}>
                                            <motion.rect key={claveAnim} x="0" y="0" height={H}
                                                initial={reduce ? false : { width: 0 }} animate={{ width }}
                                                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
                                        </clipPath>
                                    </defs>

                                    {/* Cuadrícula y precios a la derecha */}
                                    {geo.marcas.map((t) => (
                                        <g key={t}>
                                            <line x1={geo.left} x2={geo.left + geo.plotW} y1={geo.y(t)} y2={geo.y(t)}
                                                stroke={t === 0 && geo.conCero ? T.base : T.grid} strokeWidth="1" shapeRendering="crispEdges" />
                                            <text x={geo.left + geo.plotW + 10} y={geo.y(t)} dy="0.32em" fontSize="11" fill={T.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                {bsCorto(t)}
                                            </text>
                                        </g>
                                    ))}
                                    {geo.etiquetas.map((e) => (
                                        <line key={`v-${e.i}`} x1={e.x} x2={e.x} y1={PAD_T} y2={geo.bottom} stroke={T.grid} strokeWidth="1" shapeRendering="crispEdges" />
                                    ))}

                                    <g clipPath={`url(#${uid}-ver)`}>
                                        {esVelas ? (
                                            geo.main.velas.map((v) => {
                                                const color = v.up ? UP : DOWN;
                                                const dim = activo !== null && activo !== v.i;
                                                return (
                                                    <g key={v.i} opacity={dim ? 0.4 : 1}>
                                                        <line x1={v.cx} x2={v.cx} y1={v.yh} y2={v.yl} stroke={color} strokeWidth="1.3" />
                                                        <rect x={v.cx - v.bw / 2} y={v.top} width={v.bw} height={v.alto} rx="1.5" fill={color} />
                                                    </g>
                                                );
                                            })
                                        ) : (
                                            <>
                                                {geo.main.area && <path d={geo.main.area} fill={`url(#${uid}-area)`} />}
                                                {geo.main.up && <path d={geo.main.up} stroke={UP} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                                                {geo.main.down && <path d={geo.main.down} stroke={DOWN} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                                                {n <= 90 && geo.main.pts.map((p, i) => (
                                                    <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={subeEn(i) ? UP : DOWN} stroke={T.panel} strokeWidth="1.5" />
                                                ))}
                                            </>
                                        )}

                                        {/* Panel inferior */}
                                        {esVelas ? (
                                            geo.sub.barras.map((b, i) => b.h > 0 && (
                                                <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="1.5"
                                                    fill={b.up ? UP : DOWN} fillOpacity={activo === null ? 0.4 : activo === i ? 0.9 : 0.18} />
                                            ))
                                        ) : (
                                            <>
                                                {geo.sub.area && <path d={geo.sub.area} fill={`url(#${uid}-acum)`} />}
                                                <path d={geo.sub.linea} stroke={T.acumulado} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                                            </>
                                        )}
                                    </g>

                                    {/* Base y nombre del panel inferior */}
                                    <line x1={geo.left} x2={geo.left + geo.plotW} y1={geo.subTop + SUB} y2={geo.subTop + SUB} stroke={T.base} strokeWidth="1" shapeRendering="crispEdges" />
                                    <text x={geo.left + 2} y={geo.subTop - 9} fontSize="10" fontWeight="700" letterSpacing="0.1em" fill={T.muted}>
                                        {esVelas ? `TOTAL POR ${unidad.toUpperCase()}` : 'ACUMULADO DEL PERÍODO'}
                                    </text>
                                    {!esVelas && (
                                        <text x={geo.left + geo.plotW + 10} y={geo.sub.fin[1]} dy="0.32em" fontSize="11" fontWeight="700" fill={T.acumulado} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {bsCorto(acum.at(-1))}
                                        </text>
                                    )}

                                    {/* Eje X */}
                                    {geo.etiquetas.map((e) => (
                                        <text key={e.i} x={clamp(e.x, geo.left + 18, geo.left + geo.plotW - 18)} y={H - 9} fontSize="11" fill={T.muted} textAnchor="middle">{e.txt}</text>
                                    ))}

                                    {/* Último precio: línea + etiqueta en el eje + punto que late */}
                                    {ultimo >= 0 && (() => {
                                        const vy = geo.y(valorEn(ultimo));
                                        const color = subeEn(ultimo) ? UP : DOWN;
                                        return (
                                            <g>
                                                <line x1={geo.x(ultimo)} x2={geo.left + geo.plotW} y1={vy} y2={vy} stroke={color} strokeOpacity="0.5" strokeWidth="1" shapeRendering="crispEdges" />
                                                {activo === null && !esVelas && !reduce && (
                                                    <motion.circle cx={geo.x(ultimo)} cy={vy} fill={color}
                                                        initial={{ r: 3, opacity: 0.45 }} animate={{ r: 13, opacity: 0 }}
                                                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
                                                )}
                                                {!esVelas && <circle cx={geo.x(ultimo)} cy={vy} r="4.5" fill={color} stroke="#FFFFFF" strokeWidth="2" />}
                                                <g transform={`translate(${geo.left + geo.plotW + 4}, ${clamp(vy - 10, 0, geo.bottom - 20)})`}>
                                                    <rect width={geo.right - 6} height="20" rx="6" fill={color} />
                                                    <text x="7" y="10" dy="0.34em" fontSize="11" fontWeight="800" fill={T.tinta} style={{ fontVariantNumeric: 'tabular-nums' }}>{bsCorto(valorEn(ultimo))}</text>
                                                </g>
                                            </g>
                                        );
                                    })()}

                                    {/* Cruz con etiquetas en los ejes */}
                                    {activo !== null && valorEn(activo) !== undefined && (() => {
                                        const cx = geo.x(activo);
                                        const cy = geo.y(valorEn(activo));
                                        const fechaTag = esVelas ? cortaBucket(puntos[activo].fecha) : dia(ticks[activo].fecha).format('D MMM');
                                        return (
                                            <g pointerEvents="none">
                                                <line x1={cx} x2={cx} y1={PAD_T} y2={geo.subTop + SUB} stroke="rgba(15,23,42,0.28)" strokeWidth="1" shapeRendering="crispEdges" />
                                                <line x1={geo.left} x2={geo.left + geo.plotW} y1={cy} y2={cy} stroke="rgba(15,23,42,0.16)" strokeWidth="1" shapeRendering="crispEdges" />
                                                {!esVelas && <circle cx={cx} cy={cy} r="5.5" fill={subeEn(activo) ? UP : DOWN} stroke="#FFFFFF" strokeWidth="2" />}
                                                <g transform={`translate(${geo.left + geo.plotW + 4}, ${clamp(cy - 10, 0, geo.bottom - 20)})`}>
                                                    <rect width={geo.right - 6} height="20" rx="6" fill={T.tag} />
                                                    <text x="7" y="10" dy="0.34em" fontSize="11" fontWeight="800" fill="#FFFFFF" style={{ fontVariantNumeric: 'tabular-nums' }}>{bsCorto(valorEn(activo))}</text>
                                                </g>
                                                <g transform={`translate(${clamp(cx - 34, geo.left, geo.left + geo.plotW - 68)}, ${H - AXIS + 6})`}>
                                                    <rect width="68" height="20" rx="6" fill={T.tag} />
                                                    <text x="34" y="10" dy="0.34em" fontSize="11" fontWeight="700" fill="#FFFFFF" textAnchor="middle">{fechaTag}</text>
                                                </g>
                                            </g>
                                        );
                                    })()}

                                    {/* Zona para el mouse o el dedo (ambos paneles) */}
                                    <rect x={geo.left} y={PAD_T} width={geo.plotW} height={geo.subTop + SUB - PAD_T} fill="transparent"
                                        style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
                                        onPointerMove={(e) => setActivo(indiceDesde(e.clientX))}
                                        onPointerDown={(e) => setActivo(indiceDesde(e.clientX))}
                                        onPointerLeave={() => setActivo(null)} />
                                </svg>
                            )}

                            <p className="sr-only" aria-live="polite">
                                {activo !== null && lecturaTick ? `${dia(lecturaTick.fecha).format('D [de] MMMM')}, ${lecturaTick.etiqueta}: ${meta.precio} ${bs(valores[activo])}, acumulado ${bs(acum[activo])}` : ''}
                                {activo !== null && lecturaVela ? `${largaBucket(puntos[activo].fecha)}: apertura ${bs(lecturaVela.o)}, máximo ${bs(lecturaVela.h)}, mínimo ${bs(lecturaVela.l)}, cierre ${bs(lecturaVela.c)}` : ''}
                            </p>
                        </div>
                    </>
                )}
            </div>

            <p className="mt-3 text-xs text-gris-500">{esVelas ? `Cada vela resume los movimientos del ${unidad}: apertura, máximo, mínimo y cierre.` : meta.desc}</p>
        </ChartCard>
    );
}
