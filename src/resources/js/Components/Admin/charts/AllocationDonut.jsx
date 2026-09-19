import { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, Info, PieChart } from 'lucide-react';
import { ChartCard, T, bs, porcentaje, useCountUp } from './theme';

/*
 * Ganancia por categoría como el "portafolio" de una billetera, en tarjeta blanca.
 * Paleta categórica documentada (pasos claros) validada sobre blanco en ESTE orden, incluido el cierre
 * del anillo (magenta ↔ azul). Tres tonos quedan bajo 3:1 sobre blanco: por eso cada porción lleva su
 * porcentaje escrito y la lista muestra todos los montos (regla de alivio del validador).
 * El color sigue a la categoría y el anillo conserva siempre el orden.
 */
// La paleta vive en tokens.css: ahí se cambia una vez y la siguen el anillo, los reportes
// y cualquier gráfico que venga después.
export const CATEGORIAS = [
    { label: 'Celulares', color: 'var(--grafico-1)' },
    { label: 'Computadoras', color: 'var(--grafico-2)' },
    { label: 'Productos Generales', color: 'var(--grafico-3)' },
    { label: 'Equipos de marca', color: 'var(--grafico-4)' },
    { label: 'Servicios Técnicos', color: 'var(--grafico-5)' },
];
const OTRO = 'var(--grafico-otros)';

// Lienzo del anillo (con espacio para las etiquetas de porcentaje a los costados)
const VW = 380;
const VH = 280;
const CX = VW / 2;
const CY = VH / 2;
const R = 84;          // radio al centro del trazo
const TRAZO = 22;
const HUECO = 3;       // px de superficie entre porciones
const BISEL = R + TRAZO / 2 + 12;

const polar = (r, a) => [CX + r * Math.sin(a), CY - r * Math.cos(a)];

function arco(a0, a1, r = R) {
    const [x0, y0] = polar(r, a0);
    const [x1, y1] = polar(r, a1);
    return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

// Mezcla hacia blanco para el brillo de cada porción
function aclarar(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
    return `rgb(${c.join(',')})`;
}

function Sparkline({ valores, color }) {
    const W = 84;
    const H = 26;
    const P = 3;
    const hay = valores.length > 1 && valores.some((v) => v !== 0);
    if (!hay) {
        return (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
                <line x1={P} x2={W - P} y1={H / 2} y2={H / 2} stroke={T.base} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        );
    }
    const min = Math.min(0, ...valores);
    const max = Math.max(0, ...valores);
    const x = (i) => P + (i * (W - 2 * P)) / (valores.length - 1);
    const y = (v) => P + (1 - (v - min) / ((max - min) || 1)) * (H - 2 * P);
    const pts = valores.map((v, i) => [x(i), y(v)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <path d={`${d} L${pts.at(-1)[0]},${y(min)} L${pts[0][0]},${y(min)} Z`} fill={color} fillOpacity="0.14" />
            <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="2.4" fill={color} />
        </svg>
    );
}

export default function AllocationDonut({ distribucion = [], total = 0, serie, cargando = false }) {
    const reduce = useReducedMotion();
    const uid = useId().replace(/:/g, '');
    const [foco, setFoco] = useState(null);

    const filas = useMemo(
        () => distribucion
            .map((d) => ({ label: String(d?.label ?? ''), valor: Number(d?.valor) || 0 }))
            .filter((d) => d.label),
        [distribucion],
    );
    const colorDe = (label) => CATEGORIAS.find((c) => c.label === label)?.color ?? OTRO;
    const ordenDe = (label) => { const i = CATEGORIAS.findIndex((c) => c.label === label); return i === -1 ? 99 : i; };

    const positivas = filas.filter((f) => f.valor > 0).sort((a, b) => ordenDe(a.label) - ordenDe(b.label));
    const perdidas = filas.filter((f) => f.valor < 0);
    const suma = positivas.reduce((s, f) => s + f.valor, 0);

    // Porciones del anillo + etiquetas de porcentaje con línea guía (sin encimarse)
    const segmentos = useMemo(() => {
        let a = 0;
        const hueco = positivas.length > 1 ? HUECO / R : 0;
        const segs = positivas.map((f) => {
            const frac = f.valor / suma;
            const a0 = a;
            const a1 = a + frac * 2 * Math.PI;
            a = a1;
            const s0 = a0 + hueco / 2;
            const s1 = positivas.length === 1 ? a1 - 0.0001 : Math.max(s0 + 0.002, a1 - hueco / 2);
            const color = colorDe(f.label);
            const [gx0, gy0] = polar(R, s0);
            const [gx1, gy1] = polar(R, s1);
            return { ...f, frac, color, d: arco(s0, s1), g: [gx0, gy0, gx1, gy1], medio: (a0 + a1) / 2 };
        });

        // Etiquetas: solo porciones de 6 % o más; a cada lado se separan al menos 30px
        const etiquetas = segs.filter((s) => s.frac >= 0.06).map((s) => {
            const derecha = Math.sin(s.medio) >= 0;
            const [x1, y1] = polar(R + TRAZO / 2 + 3, s.medio);
            const [x2, y2] = polar(BISEL + 8, s.medio);
            return { label: s.label, frac: s.frac, derecha, x1, y1, x2, y: y2 };
        });
        for (const lado of [true, false]) {
            const grupo = etiquetas.filter((e) => e.derecha === lado).sort((p, q) => p.y - q.y);
            for (let i = 1; i < grupo.length; i++) grupo[i].y = Math.max(grupo[i].y, grupo[i - 1].y + 30);
            for (const e of grupo) e.y = Math.min(Math.max(e.y, 18), VH - 18);
        }
        return { segs, etiquetas };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filas]);

    const lista = [...segmentos.segs].sort((a, b) => b.valor - a.valor);
    const sel = segmentos.segs.find((s) => s.label === foco);
    const totalAnim = useCountUp(Number(total) || 0);
    const tendencia = (label) => (serie?.puntos ?? []).map((p) => Number(p.categorias?.[label]) || 0);

    return (
        <ChartCard cargando={cargando}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]">
                        <PieChart className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-base font-bold text-gris-900">Ganancia por categoría</p>
                        <p className="text-[13px] text-gris-500">Cómo se reparte · antes de egresos</p>
                    </div>
                </div>
                <span className="rounded-lg bg-gris-100 px-2 py-1 text-xs font-bold text-gris-600">
                    {positivas.length} {positivas.length === 1 ? 'categoría' : 'categorías'}
                </span>
            </div>

            {segmentos.segs.length === 0 ? (
                <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gris-200 bg-gris-50/60 px-6 py-16 text-center">
                    <PieChart className="h-6 w-6 text-gris-400" />
                    <p className="mt-3 text-sm font-bold text-gris-800">Todavía no hay ganancia en este período</p>
                    <p className="mt-1 text-[13px] text-gris-500">Aparecerá apenas registres ventas o servicios.</p>
                </div>
            ) : (
                <>
                    {/* Anillo */}
                    <div className="relative mx-auto mt-4 w-full max-w-[380px]">
                        <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full" role="img"
                            aria-label={`Ganancia por categoría: ${lista.map((s) => `${s.label} ${porcentaje.format(s.frac)}`).join(', ')}`}>
                            <defs>
                                {segmentos.segs.map((s, i) => (
                                    <linearGradient key={s.label} id={`${uid}-g${i}`} gradientUnits="userSpaceOnUse" x1={s.g[0]} y1={s.g[1]} x2={s.g[2]} y2={s.g[3]}>
                                        <stop offset="0%" stopColor={aclarar(s.color, 0.22)} />
                                        <stop offset="100%" stopColor={s.color} />
                                    </linearGradient>
                                ))}
                                <radialGradient id={`${uid}-centro`} cx="50%" cy="40%" r="65%">
                                    <stop offset="0%" stopColor="#FFFFFF" />
                                    <stop offset="100%" stopColor="#F4F6FB" />
                                </radialGradient>
                            </defs>

                            {/* Bisel con marcas, como el de un reloj */}
                            <motion.g initial={reduce ? false : { rotate: -30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
                                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} style={{ originX: `${CX}px`, originY: `${CY}px` }}>
                                <circle cx={CX} cy={CY} r={BISEL} fill="none" stroke={T.grid} strokeWidth="1" />
                                {Array.from({ length: 72 }, (_, i) => {
                                    const a = (i / 72) * 2 * Math.PI;
                                    const largo = i % 6 === 0 ? 6 : 3;
                                    const [x1, y1] = polar(BISEL + 2, a);
                                    const [x2, y2] = polar(BISEL + 2 + largo, a);
                                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 6 === 0 ? T.base : '#E2E8F0'} strokeWidth="1" />;
                                })}
                            </motion.g>

                            {/* Pista y centro */}
                            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={TRAZO} />
                            <circle cx={CX} cy={CY} r={R - TRAZO / 2 - 6} fill={`url(#${uid}-centro)`} stroke="rgba(15,23,42,0.05)" />

                            {/* Porciones */}
                            {segmentos.segs.map((s, i) => {
                                const activo = foco === s.label;
                                return (
                                    <motion.path
                                        key={s.label}
                                        d={s.d}
                                        fill="none"
                                        stroke={`url(#${uid}-g${i})`}
                                        strokeLinecap="butt"
                                        pointerEvents="stroke"
                                        style={{ cursor: 'pointer', filter: activo ? `drop-shadow(0 4px 12px ${s.color}66)` : 'drop-shadow(0 2px 5px rgba(15,23,42,0.10))' }}
                                        onPointerEnter={() => setFoco(s.label)}
                                        onPointerLeave={() => setFoco(null)}
                                        initial={reduce ? false : { pathLength: 0, strokeWidth: TRAZO }}
                                        animate={{ pathLength: 1, strokeWidth: activo ? TRAZO + 8 : TRAZO, opacity: foco && !activo ? 0.3 : 1 }}
                                        transition={{
                                            pathLength: { duration: 0.6, delay: reduce ? 0 : 0.2 + i * 0.13, ease: [0.22, 1, 0.36, 1] },
                                            strokeWidth: { type: 'spring', stiffness: 380, damping: 26 },
                                            opacity: { duration: 0.2 },
                                        }}
                                    />
                                );
                            })}

                            {/* Etiquetas de porcentaje con línea guía */}
                            {segmentos.etiquetas.map((e, i) => {
                                const x3 = e.derecha ? e.x2 + 14 : e.x2 - 14;
                                const tenue = foco && foco !== e.label;
                                return (
                                    <motion.g key={e.label} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: tenue ? 0.3 : 1 }}
                                        transition={{ duration: 0.4, delay: reduce ? 0 : 0.7 + i * 0.08 }}>
                                        <polyline points={`${e.x1},${e.y1} ${e.x2},${e.y} ${x3},${e.y}`} fill="none" stroke={T.base} strokeWidth="1" />
                                        <circle cx={e.x1} cy={e.y1} r="1.8" fill="#94A3B8" />
                                        <text x={e.derecha ? x3 + 5 : x3 - 5} y={e.y - 2} textAnchor={e.derecha ? 'start' : 'end'} fontSize="13" fontWeight="800" fill={T.texto}>
                                            {porcentaje.format(e.frac)}
                                        </text>
                                        <text x={e.derecha ? x3 + 5 : x3 - 5} y={e.y + 11} textAnchor={e.derecha ? 'start' : 'end'} fontSize="10" fill={T.muted}>
                                            {e.label.length > 15 ? `${e.label.slice(0, 14)}…` : e.label}
                                        </text>
                                    </motion.g>
                                );
                            })}
                        </svg>

                        {/* Centro: total o la categoría señalada */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="w-[34%] text-center">
                                {sel ? (
                                    <motion.div key={sel.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                                        <p className="truncate text-[11px] font-semibold text-gris-500">{sel.label}</p>
                                        <p className="mt-0.5 text-[20px] font-bold leading-tight text-gris-900">{bs(sel.valor, 0)}</p>
                                        <p className="text-xs font-bold text-gris-600">{porcentaje.format(sel.frac)}</p>
                                    </motion.div>
                                ) : (
                                    <div>
                                        <p className="text-[11px] font-semibold text-gris-500">Ganancia neta</p>
                                        <p className="mt-0.5 text-[21px] font-bold leading-tight text-gris-900">
                                            {totalAnim < 0 ? `−${bs(Math.abs(totalAnim), 0)}` : bs(totalAnim, 0)}
                                        </p>
                                        <p className="text-[11px] text-gris-500">del período</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Lista tipo portafolio, enlazada con el anillo */}
                    <div className="mt-3 flex-1">
                        <div className="grid grid-cols-[minmax(0,1fr)_44px_92px] items-center gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gris-400 sm:grid-cols-[minmax(0,1fr)_84px_44px_92px]">
                            <span>Categoría</span>
                            <span className="hidden sm:block">Tendencia</span>
                            <span className="text-right">Parte</span>
                            <span className="text-right">Ganancia</span>
                        </div>
                        <ul className="space-y-1" aria-label="Detalle por categoría">
                            {lista.map((s, i) => {
                                const activo = foco === s.label;
                                return (
                                    <motion.li key={s.label} tabIndex={0}
                                        initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.4, delay: reduce ? 0 : 0.35 + i * 0.06 }}
                                        onMouseEnter={() => setFoco(s.label)} onMouseLeave={() => setFoco(null)}
                                        onFocus={() => setFoco(s.label)} onBlur={() => setFoco(null)}
                                        aria-label={`${s.label}: ${bs(s.valor, 0)}, ${porcentaje.format(s.frac)} de la ganancia`}
                                        className={`grid grid-cols-[minmax(0,1fr)_44px_92px] items-center gap-3 rounded-xl px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[rgb(var(--acento-rgb)_/_0.3)] sm:grid-cols-[minmax(0,1fr)_84px_44px_92px] ${activo ? 'bg-gris-50' : ''}`}>
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: s.color }} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-gris-900">{s.label}</p>
                                                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gris-100">
                                                    <motion.div className="h-full rounded-full" style={{ background: s.color }}
                                                        initial={reduce ? false : { width: 0 }} animate={{ width: `${s.frac * 100}%` }}
                                                        transition={{ duration: 0.8, delay: reduce ? 0 : 0.5 + i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
                                                </div>
                                            </div>
                                        </div>
                                        <span className="hidden sm:block"><Sparkline valores={tendencia(s.label)} color={s.color} /></span>
                                        <span className="text-right text-xs font-bold tabular-nums text-gris-600">{porcentaje.format(s.frac)}</span>
                                        <span className="text-right text-sm font-bold tabular-nums text-gris-900">{bs(s.valor, 0)}</span>
                                    </motion.li>
                                );
                            })}
                            {perdidas.map((f) => (
                                <li key={f.label} className="grid grid-cols-[minmax(0,1fr)_auto_92px] items-center gap-3 rounded-xl px-3 py-2">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: T.baja }} />
                                        <p className="truncate text-sm font-semibold text-gris-900">{f.label}</p>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ background: T.bajaSuave, color: T.bajaTexto }}>
                                        <ArrowDownRight className="h-3 w-3" /> pérdida
                                    </span>
                                    <span className="text-right text-sm font-bold tabular-nums text-gris-900">−{bs(Math.abs(f.valor), 0)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-gris-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {perdidas.length > 0 ? 'Las categorías con pérdida no entran en el anillo. ' : ''}
                La utilidad disponible resta además los egresos (alquiler, sueldos, etc.).
            </p>
        </ChartCard>
    );
}
