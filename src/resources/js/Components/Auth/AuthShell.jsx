import { Head } from '@inertiajs/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import Isotipo from '@/Components/Marca/Isotipo';

/**
 * Marco de todas las pantallas de acceso: el panel negro de la marca a la izquierda y el
 * formulario a la derecha. En celular el panel se reduce a una franja con el logotipo.
 *
 * Los colores salen de `tokens.css`; acá no se define ninguno a mano.
 */
const LATERAL_POR_DEFECTO = {
    eyebrow: 'Sistema de gestión',
    heading: 'Todo el negocio en una sola pantalla',
    text: 'Inventario, ventas, reservas, servicio técnico y reportes, con la misma cuenta.',
    bullets: [
        'Inventario y precios al día',
        'Ventas, reservas y cotizaciones',
        'Reportes y cierres sin planillas',
    ],
};

/** Retícula técnica de fondo: da profundidad sin competir con el formulario. */
function Reticula() {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
                backgroundImage:
                    'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                backgroundSize: '56px 56px',
                maskImage: 'radial-gradient(120% 80% at 30% 30%, #000 40%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(120% 80% at 30% 30%, #000 40%, transparent 100%)',
            }}
        />
    );
}

function Logotipo({ className = '' }) {
    return (
        <span className={`inline-flex items-center gap-3 ${className}`}>
            <Isotipo className="h-9 w-auto text-white" />
            <span className="font-marca text-[19px] font-bold uppercase tracking-[0.18em] text-white">Blackphone</span>
        </span>
    );
}

export default function AuthShell({ title, pageTitle, subtitle, icon: Icon, back, aside = {}, children, footer }) {
    const a = { ...LATERAL_POR_DEFECTO, ...aside };
    const anio = new Date().getFullYear();
    const reduce = useReducedMotion();

    return (
        <div className="min-h-screen bg-gris-50 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <Head title={pageTitle ?? title} />

            {/* ── Panel de marca ── */}
            <aside
                className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14"
                style={{ background: 'linear-gradient(160deg, #0A0A0B 0%, #121214 45%, #1D1D21 100%)' }}
            >
                <Reticula />

                {/* Resplandor bronce: el único color del panel, muy difuso */}
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-32 -top-32 h-[26rem] w-[26rem] rounded-full blur-3xl"
                    style={{ background: 'rgba(196, 154, 124, 0.18)' }}
                />
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-24 left-[22%] h-64 w-64 rounded-full blur-3xl"
                    style={{ background: 'rgba(150, 104, 79, 0.16)' }}
                />

                {/* El isotipo, muy grande y en un solo tono: marca de agua, no un segundo logo */}
                <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-10 -right-10 text-white/[0.05]"
                    initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                >
                    <Isotipo className="h-[22rem] w-auto" title="" corte={false} />
                </motion.span>

                <Logotipo className="relative" />

                <motion.div
                    className="relative max-w-[420px]"
                    initial={reduce ? false : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <span className="mb-5 inline-flex rounded-full border border-bronce-400/25 bg-bronce-400/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-bronce-300">
                        {a.eyebrow}
                    </span>
                    <h2 className="font-marca text-[42px] font-bold leading-[1.06] tracking-tight text-white">{a.heading}</h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-white/60">{a.text}</p>
                    <ul className="mt-9 space-y-3.5">
                        {a.bullets.map((b) => (
                            <li key={b} className="flex items-center gap-3 text-sm text-white/80">
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bronce-400 text-carbon-950">
                                    <Check className="h-3 w-3" strokeWidth={3} />
                                </span>
                                {b}
                            </li>
                        ))}
                    </ul>
                </motion.div>

                <p className="relative text-xs text-white/35">© {anio} Blackphone</p>
            </aside>

            {/* ── Formulario ── */}
            <main className="flex min-h-screen flex-col bg-white">
                {/* Franja de marca en celular */}
                <div className="flex items-center px-5 py-4 lg:hidden" style={{ background: '#0A0A0B' }}>
                    <Logotipo />
                </div>

                <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
                    <motion.div
                        className="w-full max-w-[420px]"
                        initial={reduce ? false : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {back && (
                            <a href={back.href} className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-gris-500 transition-colors hover:text-gris-900">
                                <span aria-hidden="true">←</span> {back.label}
                            </a>
                        )}

                        {Icon && (
                            <span className="mb-5 grid h-12 w-12 place-items-center rounded-[14px] bg-bronce-50 text-bronce-600">
                                <Icon className="h-6 w-6" />
                            </span>
                        )}

                        <h1 className="font-marca text-[32px] font-bold leading-tight tracking-tight text-gris-900">{title}</h1>
                        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-gris-500">{subtitle}</p>}

                        <div className="mt-8">{children}</div>

                        {footer && <div className="mt-8 border-t border-gris-200 pt-6 text-center text-sm text-gris-500">{footer}</div>}
                    </motion.div>
                </div>

                <p className="pb-6 text-center text-xs text-gris-400 lg:hidden">© {anio} Blackphone</p>
            </main>
        </div>
    );
}
