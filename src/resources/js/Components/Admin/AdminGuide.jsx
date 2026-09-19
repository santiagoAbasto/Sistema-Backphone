import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

/**
 * Guía paso a paso al inicio de cada sección del admin.
 * Pensada para personas sin conocimientos técnicos. Se puede ocultar y se recuerda en este navegador.
 */
export default function AdminGuide({ id, title = '¿Cómo funciona esta sección?', steps = [], tip, children }) {
    const key = `ab-guia-${id}`;
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(key) !== 'cerrada'; } catch { return true; }
    });

    const toggle = () => {
        const next = !open;
        setOpen(next);
        try { localStorage.setItem(key, next ? 'abierta' : 'cerrada'); } catch { /* sin almacenamiento */ }
    };

    if (!open) {
        return (
            <button type="button" onClick={toggle}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--acento-rgb)_/_0.2)] bg-[rgb(var(--acento-rgb)_/_0.06)] px-3 py-1.5 text-xs font-semibold text-bronce-800 hover:bg-[rgb(var(--acento-rgb)_/_0.1)]">
                <HelpCircle className="h-3.5 w-3.5" /> Ver la guía de esta sección
            </button>
        );
    }

    return (
        <section aria-label="Guía de la sección" className="rounded-2xl border border-[rgb(var(--acento-rgb)_/_0.2)] bg-[rgb(var(--acento-rgb)_/_0.06)] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    <HelpCircle className="h-4 w-4 shrink-0 text-[color:var(--acento)]" />
                    <p className="text-sm font-bold text-gris-900">{title}</p>
                    {children && <p className="hidden truncate text-sm text-gris-600 md:block">— {children}</p>}
                </div>
                <button type="button" onClick={toggle} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-bronce-800 hover:bg-white">
                    Ocultar guía
                </button>
            </div>

            {steps.length > 0 && (
                <ol className={`grid gap-2 ${steps.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`} style={{ listStyle: 'none', padding: 0, margin: '0.625rem 0 0' }}>
                    {steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 rounded-xl bg-white px-3 py-2 text-[13px] leading-snug text-gris-700 shadow-sm">
                            <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-carbon-900 text-[11px] font-bold text-white">{i + 1}</span>
                            <span>{s}</span>
                        </li>
                    ))}
                </ol>
            )}

            {tip && <p className="mt-2 text-xs leading-relaxed text-gris-600"><strong className="text-gris-800">Consejo:</strong> {tip}</p>}
        </section>
    );
}
