import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useId, useMemo } from 'react';

/**
 * Las piezas con las que se muestran cifras en el panel.
 *
 * Una tarjeta de métrica tiene un trabajo: que la cifra se lea de lejos y que al lado esté lo
 * único que le da sentido (contra qué se compara, de qué está hecha). Todo lo demás estorba.
 *
 * Los colores salen de `tokens.css`; acá no se escribe ningún hexadecimal.
 */

const TONOS = {
    neutro:   { texto: 'text-gris-900',                  marca: 'var(--gris-400)',    fondo: 'bg-gris-100 text-gris-600' },
    acento:   { texto: 'text-gris-900',                  marca: 'var(--acento)',      fondo: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]' },
    positivo: { texto: 'text-[color:var(--ok-texto)]',   marca: 'var(--ok-fuerte)',   fondo: 'bg-[color:var(--ok-fondo)] text-[color:var(--ok-texto)]' },
    negativo: { texto: 'text-[color:var(--peligro-texto)]', marca: 'var(--peligro-fuerte)', fondo: 'bg-[color:var(--peligro-fondo)] text-[color:var(--peligro-texto)]' },
    aviso:    { texto: 'text-[color:var(--aviso-texto)]', marca: 'var(--aviso-fuerte)', fondo: 'bg-[color:var(--aviso-fondo)] text-[color:var(--aviso-texto)]' },
};

/**
 * Gráfico mínimo: la forma de la serie, sin ejes ni números.
 * No es para leer valores, es para ver si sube o baja. Con menos de dos puntos no se dibuja.
 */
export function Sparkline({ puntos = [], tono = 'acento', className = 'h-10 w-full' }) {
    const uid = useId().replace(/:/g, '');
    const color = (TONOS[tono] ?? TONOS.acento).marca;

    const trazado = useMemo(() => {
        const valores = puntos.map((p) => Number(p) || 0);
        if (valores.length < 2) return null;

        const min = Math.min(...valores);
        const max = Math.max(...valores);
        const rango = max - min || 1;
        const ancho = 100;
        const alto = 32;

        const coords = valores.map((v, i) => [
            (i / (valores.length - 1)) * ancho,
            alto - ((v - min) / rango) * (alto - 4) - 2,
        ]);

        const linea = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
        const area = `${linea} L${ancho} ${alto} L0 ${alto} Z`;

        return { linea, area, ultimo: coords[coords.length - 1] };
    }, [puntos]);

    if (!trazado) return null;

    return (
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={className} aria-hidden="true">
            <defs>
                <linearGradient id={`relleno-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={trazado.area} fill={`url(#relleno-${uid})`} />
            <path d={trazado.linea} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={trazado.ultimo[0]} cy={trazado.ultimo[1]} r="2" fill={color} vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

/** Cuánto cambió contra el período anterior. Sin comparación, no se dibuja nada. */
export function Delta({ porcentaje, invertido = false }) {
    if (porcentaje === null || porcentaje === undefined || !Number.isFinite(porcentaje)) return null;

    const sinCambio = Math.abs(porcentaje) < 0.5;
    const subio = porcentaje > 0;
    // En una métrica de gasto, subir es malo: `invertido` da vuelta el color, nunca la flecha.
    const bueno = invertido ? !subio : subio;

    const Icono = sinCambio ? Minus : subio ? ArrowUpRight : ArrowDownRight;
    const color = sinCambio
        ? 'text-gris-500'
        : bueno ? 'text-[color:var(--ok-texto)]' : 'text-[color:var(--peligro-texto)]';

    return (
        <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums ${color}`}>
            <Icono className="h-3.5 w-3.5" />
            {sinCambio ? 'igual' : `${Math.abs(porcentaje).toFixed(0)}%`}
        </span>
    );
}

/**
 * Tarjeta de métrica.
 *
 * `destacada` la sube de jerarquía: fondo oscuro y cifra más grande. Se usa para la cifra que
 * de verdad manda en la pantalla, nunca para más de una.
 */
export function Metrica({
    etiqueta,
    valor,
    hint,
    icono: Icono,
    tono = 'neutro',
    serie,
    delta,
    deltaInvertido = false,
    comparacion,
    destacada = false,
    className = '',
}) {
    const t = TONOS[tono] ?? TONOS.neutro;

    if (destacada) {
        return (
            <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`relative overflow-hidden rounded-[14px] bg-carbon-900 p-5 text-white shadow-alzada ${className}`}
            >
                <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-2xl"
                    style={{ background: 'rgba(196, 154, 124, 0.18)' }} />

                <div className="relative flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{etiqueta}</p>
                    {Icono && <Icono className="h-[18px] w-[18px] shrink-0 text-bronce-400" />}
                </div>

                <p className="relative mt-3 font-marca text-[34px] font-bold leading-none tracking-tight tabular-nums">
                    {valor}
                </p>

                <div className="relative mt-2.5 flex items-center gap-2">
                    {delta !== undefined && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5">
                            <Delta porcentaje={delta} invertido={deltaInvertido} />
                        </span>
                    )}
                    {hint && <p className="text-[12px] text-white/55">{hint}</p>}
                </div>

                {serie?.length > 1 && (
                    <div className="relative mt-4 -mb-1">
                        <Sparkline puntos={serie} tono="acento" className="h-9 w-full" />
                    </div>
                )}
            </motion.div>
        );
    }

    return (
        <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`group relative flex flex-col overflow-hidden rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil transition-shadow hover:shadow-tarjeta ${className}`}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gris-500">{etiqueta}</p>
                {Icono && (
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${t.fondo}`}>
                        <Icono className="h-[17px] w-[17px]" />
                    </span>
                )}
            </div>

            <p className={`mt-3 font-marca text-[26px] font-bold leading-none tracking-tight tabular-nums ${t.texto}`}>
                {valor}
            </p>

            {(hint || delta !== undefined || comparacion) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {delta !== undefined && <Delta porcentaje={delta} invertido={deltaInvertido} />}
                    {comparacion && <span className="text-[12px] text-gris-400">{comparacion}</span>}
                    {hint && <p className="text-[12px] leading-snug text-gris-500">{hint}</p>}
                </div>
            )}

            {serie?.length > 1 && (
                <div className="-mx-5 -mb-5 mt-4">
                    <Sparkline puntos={serie} tono={tono === 'neutro' ? 'acento' : tono} className="h-10 w-full" />
                </div>
            )}
        </motion.div>
    );
}

/**
 * Barra de composición: de qué está hecho un total.
 * Cada parte lleva su color propio; las que no llegan al 2% se agrupan para que la barra no
 * se llene de astillas ilegibles.
 */
export function BarraComposicion({ partes = [], className = '' }) {
    const total = partes.reduce((n, p) => n + (Number(p.valor) || 0), 0);
    if (total <= 0) return null;

    return (
        <div className={className}>
            <div className="flex h-2 overflow-hidden rounded-full bg-gris-100">
                {partes.map((p) => {
                    const pct = ((Number(p.valor) || 0) / total) * 100;
                    if (pct <= 0) return null;
                    return (
                        <span
                            key={p.etiqueta}
                            className="h-full first:rounded-l-full last:rounded-r-full"
                            style={{ width: `${pct}%`, background: p.color }}
                            title={`${p.etiqueta}: ${pct.toFixed(1)}%`}
                        />
                    );
                })}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {partes.map((p) => {
                    const pct = ((Number(p.valor) || 0) / total) * 100;
                    if (pct <= 0) return null;
                    return (
                        <li key={p.etiqueta} className="flex items-center gap-1.5 text-[12px] text-gris-600">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                            {p.etiqueta}
                            <span className="font-semibold tabular-nums text-gris-900">{pct.toFixed(0)}%</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** Encabezado de una sección del panel: una línea fina que ordena la lectura. */
export function TituloSeccion({ children, extra, className = '' }) {
    return (
        <div className={`mb-3 flex items-end justify-between gap-3 ${className}`}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gris-500">{children}</h2>
            {extra}
        </div>
    );
}
