import { Link, usePage } from '@inertiajs/react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { route } from 'ziggy-js';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

// Piezas compartidas por todas las pantallas del panel.

export const inputCls = 'w-full rounded-[10px] border border-gris-200 bg-white px-3 py-2 text-sm text-gris-900 transition-colors placeholder:text-gris-400 hover:border-gris-300 focus:border-[color:var(--acento)] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--acento-rgb)_/_0.16)] disabled:cursor-not-allowed disabled:bg-gris-100 disabled:text-gris-400';

export function PageHeader({ title, subtitle, actions }) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 className="font-marca text-[28px] font-bold leading-tight tracking-tight text-gris-900">{title}</h1>
                {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gris-500">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
    );
}

export function Card({ title, subtitle, actions, children, className = '' }) {
    return (
        <section className={`rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil ${className}`}>
            {(title || actions) && (
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        {title && <h2 className="text-[15px] font-semibold text-gris-900">{title}</h2>}
                        {subtitle && <p className="mt-1 text-xs leading-relaxed text-gris-500">{subtitle}</p>}
                    </div>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

export function Field({ label, hint, value, max, error, children }) {
    const len = typeof value === 'string' ? value.length : null;
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gris-600">{label}</label>
                {max && len !== null && (
                    <span className={`text-[11px] tabular-nums ${len > max ? 'font-semibold text-aviso' : 'text-gris-400'}`}>{len}/{max}</span>
                )}
            </div>
            {children}
            {hint && <p className="text-[11.5px] leading-snug text-gris-500">{hint}</p>}
            {error && <p className="text-xs font-medium text-peligro">{error}</p>}
        </div>
    );
}

export function Switch({ checked, onChange, disabled, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={!!checked}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className="relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgb(var(--acento-rgb)_/_0.28)] disabled:opacity-50"
            style={{ width: 44, height: 24, border: 0, padding: 0, background: checked ? 'var(--acento)' : 'var(--gris-300)' }}
        >
            <span className="inline-block rounded-full bg-white shadow transition-transform"
                style={{ width: 20, height: 20, transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} />
        </button>
    );
}

const ESTILOS_BOTON = {
    // El negro de la marca para la acción principal; el bronce queda para acentos y estados.
    primary:   'bg-carbon-900 text-white shadow-[0_8px_18px_-10px_rgba(10,10,11,0.65)] hover:bg-carbon-800 active:bg-carbon-950',
    secondary: 'border border-gris-200 bg-white text-gris-700 hover:border-gris-300 hover:bg-gris-50',
    acento:    'bg-[color:var(--acento)] text-white hover:brightness-110 active:brightness-95',
    danger:    'border border-peligro/30 bg-white text-peligro hover:bg-peligro/[0.06]',
    success:   'bg-ok text-white hover:brightness-110',
    ghost:     'text-gris-600 hover:bg-gris-100 hover:text-gris-900',
};

/** Clases de botón para usar también en <Link> o <a>. */
export const buttonCls = (variant = 'secondary', className = '') =>
    `inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS_BOTON[variant] ?? ESTILOS_BOTON.secondary} ${className}`;

export function Button({ variant = 'secondary', className = '', ...props }) {
    return <button type="button" className={buttonCls(variant, className)} {...props} />;
}

/** Toast local + mensajes flash que llegan del servidor. */
export function useToast() {
    const { flash } = usePage().props;
    const [toast, setToast] = useState(null);
    const timer = useRef(null);

    const show = useCallback((msg, type = 'success') => {
        clearTimeout(timer.current);
        setToast({ msg, type });
        timer.current = setTimeout(() => setToast(null), 3500);
    }, []);

    useEffect(() => {
        if (flash?.success) show(flash.success);
        if (flash?.error) show(flash.error, 'error');
    }, [flash, show]);

    return [toast, show];
}

export function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div
            role="status"
            className={`fixed bottom-6 right-6 z-[1100] max-w-sm animate-subir rounded-[12px] px-4 py-3 text-sm font-medium shadow-flotante ${
                toast.type === 'error' ? 'bg-peligro text-white' : 'bg-carbon-900 text-white'
            }`}
        >
            {toast.msg}
        </div>
    );
}

/**
 * Tarjetas numeradas con un ejemplo de lo que conviene escribir y otro de lo que no.
 * Se usa en las pantallas donde el administrador redacta texto que después ve otra persona.
 */
export function Consejos({ consejos, cierre }) {
    return (
        <>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
                {consejos.map((c, i) => (
                    <li key={c.titulo} className="rounded-xl border border-[color:var(--borde-sutil)] px-3.5 py-3">
                        <p className="flex items-start gap-2 text-[13px] font-bold leading-snug text-[color:var(--texto-fuerte)]">
                            <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--acento)] text-[11px] font-bold text-white">{i + 1}</span>
                            {c.titulo}
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--texto-suave)]">{c.texto}</p>
                        <div className="mt-2.5 space-y-1 border-t border-[color:var(--borde-sutil)] pt-2.5 text-xs">
                            <p className="flex items-start gap-1.5 text-[color:var(--ok-texto)]">
                                <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-label="Bien" /> <span>«{c.bien}»</span>
                            </p>
                            <p className="flex items-start gap-1.5 text-[color:var(--texto-tenue)]">
                                <X className="mt-px h-3.5 w-3.5 shrink-0" aria-label="Evita" /> <span className="line-through decoration-[color:var(--borde-medio)]">«{c.mal}»</span>
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
            {cierre && <p className="mt-3 rounded-xl bg-[color:var(--superficie-tenue)] px-3.5 py-3 text-xs leading-relaxed text-[color:var(--texto-suave)]">{cierre}</p>}
        </>
    );
}

export function Modal({ title, onClose, children, footer, wide = false }) {
    useEffect(() => {
        const fn = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center px-4 py-6" style={{ background: 'var(--armazon-velo)' }} role="dialog" aria-modal="true">
            <div className={`flex max-h-full w-full animate-subir flex-col rounded-[16px] bg-white shadow-flotante ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
                <div className="flex items-center justify-between border-b border-gris-100 px-6 py-4">
                    <h2 className="font-marca text-[17px] font-bold text-gris-900">{title}</h2>
                    <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-gris-500 hover:bg-gris-100" aria-label="Cerrar">✕</button>
                </div>
                <div className="overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex justify-end gap-3 border-t border-gris-100 px-6 py-4">{footer}</div>}
            </div>
        </div>
    );
}

export const fmtDate = (iso) => iso
    ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
    : '—';

/* ─── Piezas de formularios y listados del panel (misma línea visual en todas las pantallas) ─── */

export const bsFmt = (n) =>
    `Bs ${(Number(n) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${inputCls} h-11 ${className}`} {...props} />;
});

export function Select({ className = '', children, ...props }) {
    return <select className={`${inputCls} h-11 pr-9 ${className}`} {...props}>{children}</select>;
}

export function Textarea({ className = '', rows = 3, ...props }) {
    return <textarea rows={rows} className={`${inputCls} py-2.5 leading-relaxed ${className}`} {...props} />;
}

/** Tarjeta de un paso de un formulario guiado: número (o ícono), título, ayuda y contenido. */
export function StepCard({ step, icon: Icon, title, subtitle, actions, children, className = '' }) {
    return (
        <section className={`rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil sm:p-6 ${className}`}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]">
                        {step ? <span className="font-marca text-[15px] font-bold">{step}</span> : Icon ? <Icon className="h-5 w-5" /> : null}
                    </span>
                    <div>
                        <h2 className="text-[15px] font-semibold text-gris-900">{title}</h2>
                        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-gris-500">{subtitle}</p>}
                    </div>
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}

const SEGMENT_COLS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 5: 'grid-cols-2 sm:grid-cols-5' };

/** Grupo de botones para elegir una sola opción (método de pago, tipo de producto…). */
export function Segmented({ options, value, onChange, ariaLabel, className = '', cols }) {
    return (
        <div role="radiogroup" aria-label={ariaLabel} className={`grid gap-2 ${cols ?? SEGMENT_COLS[options.length] ?? 'grid-cols-2'} ${className}`}>
            {options.map((o) => {
                const sel = value === o.value;
                const Icon = o.icon;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        onClick={() => onChange(o.value)}
                        className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-semibold transition-all ${
                            sel
                                ? 'border-carbon-900 bg-carbon-900 text-white shadow-[0_8px_18px_-10px_rgba(10,10,11,0.6)]'
                                : 'border-gris-200 bg-white text-gris-600 hover:border-gris-300 hover:text-gris-900'
                        }`}
                    >
                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

/** Tonos de etiqueta. Los nombres viejos (blue, violet, amber…) siguen existiendo para no
 *  romper las pantallas que ya los usan, pero todos caen dentro de la paleta de la marca. */
const TONOS_ETIQUETA = {
    slate:   'bg-gris-100 text-gris-700',
    navy:    'bg-carbon-900/[0.07] text-carbon-900',
    lila:    'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    bronce:  'bg-bronce-100 text-bronce-800',
    blue:    'bg-[color:var(--info-fondo)] text-[color:var(--info-texto)]',
    violet:  'bg-bronce-100 text-bronce-800',
    amber:   'bg-[color:var(--aviso-fondo)] text-[color:var(--aviso-texto)]',
    emerald: 'bg-[color:var(--ok-fondo)] text-[color:var(--ok-texto)]',
    rose:    'bg-[color:var(--peligro-fondo)] text-[color:var(--peligro-texto)]',
};

export function Badge({ tone = 'slate', children, className = '' }) {
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONOS_ETIQUETA[tone] ?? TONOS_ETIQUETA.slate} ${className}`}>
            {children}
        </span>
    );
}

export function EmptyState({ icon: Icon, title, text, action }) {
    return (
        <div className="flex flex-col items-center px-6 py-14 text-center">
            {Icon && (
                <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-gris-100 text-gris-400">
                    <Icon className="h-6 w-6" />
                </span>
            )}
            <p className="mt-3 text-sm font-semibold text-gris-800">{title}</p>
            {text && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-gris-500">{text}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

/** Páginas a mostrar: la primera, la última y las vecinas de la actual, con «…» en los saltos. */
function paginasVisibles(actual, ultima) {
    if (ultima <= 7) return Array.from({ length: ultima }, (_, i) => i + 1);
    const set = new Set([1, ultima, actual - 1, actual, actual + 1]);
    if (actual <= 3) [2, 3, 4].forEach((p) => set.add(p));
    if (actual >= ultima - 2) [ultima - 3, ultima - 2, ultima - 1].forEach((p) => set.add(p));
    const orden = [...set].filter((p) => p >= 1 && p <= ultima).sort((a, b) => a - b);
    return orden.flatMap((p, i) => (i > 0 && p - orden[i - 1] > 1 ? ['…', p] : [p]));
}

/** Paginador para listados que vienen paginados del servidor (LengthAwarePaginator de Laravel). */
export function Paginador({ meta, onPagina, porPagina, onPorPagina, opciones = [25, 50, 100], cargando = false }) {
    const actual = Number(meta?.current_page) || 1;
    const ultima = Number(meta?.last_page) || 1;
    const total = Number(meta?.total) || 0;
    if (!total) return null;

    const boton = 'grid h-9 min-w-[36px] place-items-center rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div className="flex flex-col gap-3 border-t border-gris-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gris-500" aria-live="polite">
                Mostrando{' '}
                <span className="font-semibold text-gris-800">{(Number(meta.from) || 0).toLocaleString('es-BO')}–{(Number(meta.to) || 0).toLocaleString('es-BO')}</span>
                {' '}de <span className="font-semibold text-gris-800">{total.toLocaleString('es-BO')}</span>
            </p>

            {ultima > 1 && (
                <nav className="flex flex-wrap items-center gap-1" aria-label="Paginación">
                    <button type="button" onClick={() => onPagina(actual - 1)} disabled={actual <= 1 || cargando} aria-label="Página anterior"
                        className={`${boton} text-gris-600 hover:bg-gris-100`}>
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    {paginasVisibles(actual, ultima).map((p, i) => (p === '…'
                        ? <span key={`salto-${i}`} className="px-1 text-sm text-gris-400">…</span>
                        : (
                            <button key={p} type="button" onClick={() => p !== actual && onPagina(p)} disabled={cargando}
                                aria-label={`Página ${p}`} aria-current={p === actual ? 'page' : undefined}
                                className={`${boton} ${p === actual ? 'bg-carbon-900 text-white' : 'text-gris-600 hover:bg-gris-100'}`}>
                                {p}
                            </button>
                        )))}
                    <button type="button" onClick={() => onPagina(actual + 1)} disabled={actual >= ultima || cargando} aria-label="Página siguiente"
                        className={`${boton} text-gris-600 hover:bg-gris-100`}>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </nav>
            )}

            {onPorPagina && (
                <label className="flex items-center gap-2 text-xs text-gris-500">
                    Filas por página
                    <select value={porPagina} onChange={(e) => onPorPagina(Number(e.target.value))}
                        className="h-9 rounded-lg border border-gris-200 bg-white py-0 pl-2.5 pr-8 text-sm text-gris-700 focus:border-[color:var(--acento)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--acento-rgb)_/_0.15)]">
                        {opciones.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                </label>
            )}
        </div>
    );
}
