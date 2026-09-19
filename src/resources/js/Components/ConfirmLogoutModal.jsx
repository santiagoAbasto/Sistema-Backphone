import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { buttonCls } from '@/Components/Admin/ui';

/**
 * Confirmación antes de salir del panel. La usan el panel de administración y el del vendedor.
 * Dice de qué panel sale y con qué cuenta, para que nadie cierre la sesión de otra persona sin darse cuenta.
 */
export default function ConfirmLogoutModal({ open, onClose, onConfirm }) {
    const reduce = useReducedMotion();
    const { auth } = usePage().props;
    const salir = useRef(null);

    // Escape cierra y el foco arranca en «Salir»: se puede confirmar sin tocar el mouse
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        salir.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const ruta = typeof window !== 'undefined' ? window.location.pathname : '';
    const panel = ruta.startsWith('/admin')
        ? 'panel de administración'
        : ruta.startsWith('/vendedor') ? 'panel del vendedor' : 'panel';

    const usuario = auth?.user;
    const iniciales = (usuario?.name ?? 'A').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="ab-reset fixed inset-0 z-[1200] grid place-items-center px-4"
                    style={{ background: 'rgba(10, 10, 11,0.45)', backdropFilter: 'blur(6px)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ab-salir-titulo"
                        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
                        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex items-start gap-3 px-6 pb-4 pt-6">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#96684F]/10 text-[#96684F]">
                                <LogOut className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h2 id="ab-salir-titulo" className="text-lg font-black leading-tight text-gris-900">¿Cerrar sesión?</h2>
                                <p className="mt-1 text-[13px] leading-relaxed text-gris-500">
                                    Vas a salir del {panel}. Para volver a entrar tendrás que escribir tu correo y tu contraseña otra vez.
                                </p>
                            </div>
                        </div>

                        {usuario?.name && (
                            <div className="mx-6 flex items-center gap-3 rounded-xl border border-gris-200 bg-gris-50 px-3 py-2.5">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-extrabold" style={{ background: '#121214', color: '#C49A7C' }}>
                                    {iniciales}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold text-gris-900">{usuario.name}</span>
                                    <span className="block truncate text-[11px] font-medium capitalize text-gris-500">{usuario.rol ?? 'cuenta del equipo'}</span>
                                </span>
                            </div>
                        )}

                        <p className="mx-6 mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-gris-500">
                            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            Nada de lo que guardaste se pierde: todo queda registrado en el sistema.
                        </p>

                        <div className="mt-5 flex justify-end gap-2 border-t border-gris-100 px-6 py-4">
                            <button type="button" onClick={onClose} className={buttonCls('secondary')}>Seguir trabajando</button>
                            <button ref={salir} type="button" onClick={onConfirm} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(220,38,38,0.8)] transition-colors hover:bg-red-700">
                                <LogOut className="h-4 w-4" /> Cerrar sesión
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
