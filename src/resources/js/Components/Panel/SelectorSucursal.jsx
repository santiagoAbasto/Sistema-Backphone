import { router, usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { route } from 'ziggy-js';
import { IconoLocal } from '@/Components/Marca/IconosSucursal';

/**
 * Con qué sucursal se está trabajando, arriba a la izquierda del encabezado.
 *
 * A quien tiene una sucursal asignada le sale como una etiqueta fija: es un dato, no una decisión.
 * Al super administrador le sale como menú, con «Todas las sucursales» arriba para ver el negocio
 * entero de una vez.
 *
 * Al cambiar se recarga la página: lo que se está mirando pasa a ser de la otra sucursal, y es
 * mejor que se note.
 */
export default function SelectorSucursal() {
    const { sucursalActiva } = usePage().props;
    const [abierto, setAbierto] = useState(false);
    const [cambiando, setCambiando] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
        const escapar = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', cerrar);
        document.addEventListener('keydown', escapar);
        return () => {
            document.removeEventListener('mousedown', cerrar);
            document.removeEventListener('keydown', escapar);
        };
    }, []);

    if (!sucursalActiva?.opciones?.length) return null;

    const { actual, puedeElegir, verTodas, opciones } = sucursalActiva;
    const elegida = opciones.find((s) => s.id === actual);

    // Una sola sucursal y sin poder elegir: no hay nada que decidir, pero sí que saber.
    if (!puedeElegir) {
        return (
            <span
                className="hidden items-center gap-2 rounded-[10px] border border-gris-200 bg-white px-3 py-1.5 sm:inline-flex"
                title={`Estás trabajando en ${elegida?.nombre ?? 'tu sucursal'}`}
            >
                <IconoLocal className="h-4 w-4 text-[color:var(--acento)]" />
                <span className="text-[13px] font-semibold text-gris-800">{elegida?.nombre ?? '—'}</span>
                {elegida?.prefijo && (
                    <span className="cifra rounded bg-gris-100 px-1.5 py-px text-[10px] font-semibold text-gris-500">
                        {elegida.prefijo}
                    </span>
                )}
            </span>
        );
    }

    const cambiar = (id) => {
        setAbierto(false);
        if (id === actual) return;
        setCambiando(true);
        router.post(route('admin.sucursal-activa.update'), { sucursal_id: id }, {
            preserveScroll: true,
            onFinish: () => setCambiando(false),
        });
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                aria-expanded={abierto}
                aria-haspopup="listbox"
                disabled={cambiando}
                className="inline-flex items-center gap-2 rounded-[10px] border border-gris-200 bg-white py-1.5 pl-2.5 pr-2 transition-colors hover:border-gris-300 hover:bg-gris-50 disabled:opacity-60"
            >
                {verTodas
                    ? <Globe className="h-4 w-4 text-[color:var(--acento)]" />
                    : <IconoLocal className="h-4 w-4 text-[color:var(--acento)]" />}
                <span className="max-w-[9rem] truncate text-[13px] font-semibold text-gris-800">
                    {verTodas ? 'Todas las sucursales' : (elegida?.nombre ?? 'Elegí una sucursal')}
                </span>
                {!verTodas && elegida?.prefijo && (
                    <span className="cifra hidden rounded bg-gris-100 px-1.5 py-px text-[10px] font-semibold text-gris-500 sm:inline">
                        {elegida.prefijo}
                    </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gris-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {abierto && (
                    <motion.ul
                        role="listbox"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[14px] border border-gris-200 bg-white p-1.5 shadow-alzada"
                    >
                        <li>
                            <button
                                type="button"
                                role="option"
                                aria-selected={verTodas}
                                onClick={() => cambiar(null)}
                                className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left hover:bg-gris-50"
                            >
                                <Globe className="h-4 w-4 shrink-0 text-gris-400" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-semibold text-gris-900">Todas las sucursales</span>
                                    <span className="block text-[11px] text-gris-500">El negocio completo, sumado</span>
                                </span>
                                {verTodas && <Check className="h-4 w-4 shrink-0 text-[color:var(--acento)]" />}
                            </button>
                        </li>

                        <li className="my-1 h-px bg-gris-100" role="presentation" />

                        {opciones.map((s) => {
                            const seleccionada = s.id === actual;
                            return (
                                <li key={s.id}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={seleccionada}
                                        onClick={() => cambiar(s.id)}
                                        className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left hover:bg-gris-50"
                                    >
                                        <IconoLocal className={`h-4 w-4 shrink-0 ${seleccionada ? 'text-[color:var(--acento)]' : 'text-gris-400'}`} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-semibold text-gris-900">{s.nombre}</span>
                                            {s.ciudad && <span className="block truncate text-[11px] text-gris-500">{s.ciudad}</span>}
                                        </span>
                                        <span className="cifra shrink-0 rounded bg-gris-100 px-1.5 py-px text-[10px] font-semibold text-gris-500">
                                            {s.prefijo}
                                        </span>
                                        {seleccionada && <Check className="h-4 w-4 shrink-0 text-[color:var(--acento)]" />}
                                    </button>
                                </li>
                            );
                        })}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
