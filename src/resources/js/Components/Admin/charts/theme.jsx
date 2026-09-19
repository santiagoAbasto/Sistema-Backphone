import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/*
 * Tema claro "trading" de los gráficos del resumen: mismas tarjetas blancas que el resto del panel;
 * el azul oscuro queda solo para el menú y la portada.
 * Validado con el validador de paletas (dataviz) sobre blanco:
 *   texto #0F172A 17.9:1 · texto2 #334155 10.4:1 · muted #64748B 4.8:1
 *   sube #089981 3.6:1 · baja #F23645 3.9:1 (par: ΔE daltonismo 11.1 · normal 32.7) · acumulado #96684F 6.0:1
 *   sobre etiquetas verdes o rojas va tinta oscura (5.0:1 y 4.6:1), no blanco.
 */
export const T = {
    surface: '#FFFFFF',
    panel: '#FAFBFD',
    borde: 'rgba(15,23,42,0.08)',
    texto: '#0F172A',
    texto2: '#334155',
    muted: '#64748B',
    grid: '#EEF1F5',
    base: '#CBD5E1',
    sube: '#089981',
    baja: '#F23645',
    subeSuave: 'rgba(8,153,129,0.10)',
    bajaSuave: 'rgba(242,54,69,0.10)',
    subeTexto: '#067A67',
    bajaTexto: '#C81E2C',
    acumulado: '#96684F',
    chip: '#F1F5F9',
    activo: '#121214',
    tag: '#0F172A',
    tinta: '#0F172A',
};

export const bs = (n, dec = 2) =>
    `Bs ${(Number(n) || 0).toLocaleString('es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;

const compacto = new Intl.NumberFormat('es-BO', { notation: 'compact', maximumFractionDigits: 1 });
export const bsCorto = (n) => `Bs ${compacto.format(Number(n) || 0)}`;

export const porcentaje = new Intl.NumberFormat('es-BO', { style: 'percent', maximumFractionDigits: 0 });

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Cifra que "corre" hasta el valor nuevo, como el precio en un exchange. */
export function useCountUp(value) {
    const reduce = useReducedMotion();
    const [shown, setShown] = useState(value);
    const desde = useRef(value);

    useEffect(() => {
        if (reduce) { setShown(value); desde.current = value; return undefined; }
        const ctrl = animate(desde.current, value, { duration: 0.8, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
        desde.current = value;
        return () => ctrl.stop();
    }, [value, reduce]);

    return shown;
}

export function useWidth(ref) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        if (!ref.current) return undefined;
        const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, [ref]);
    return width;
}

/** Tarjeta blanca, igual a las demás del panel; ocupa la misma altura que su vecina en la grilla. */
export function ChartCard({ children, cargando = false }) {
    return (
        <section
            aria-busy={cargando}
            className={`flex h-full flex-col rounded-2xl border border-gris-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-opacity duration-300 sm:p-6 ${cargando ? 'opacity-60' : ''}`}
        >
            {children}
        </section>
    );
}
