import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { route } from 'ziggy-js';
import { ChevronDown, LogOut, Menu, UserPlus, X } from 'lucide-react';
import ConfirmLogoutModal from '@/Components/ConfirmLogoutModal';
import Logotipo from '@/Components/Marca/Logotipo';
import SelectorSucursal from '@/Components/Panel/SelectorSucursal';

/**
 * Armazón del panel: barra lateral negra, encabezado claro y el contenido en el medio.
 * Lo comparten el panel de administración y el del vendedor.
 *
 * Los colores salen de `resources/css/tokens.css`. Acá solo se elige cuál acento usa cada panel:
 * viaja como variable CSS (`--acento`) para que las piezas compartidas (ui.jsx, Components/Panel)
 * tomen el del panel donde estén montadas. `--acento-rgb` son los mismos canales sueltos, que es
 * lo que Tailwind necesita para las transparencias.
 */
/**
 * La paleta de la marca, para las piezas que necesitan el color en JavaScript:
 * gráficos, degradados en línea y lienzos. Todo lo demás usa las clases de Tailwind
 * o las variables de `tokens.css`.
 */
export const MARCA = {
    negro:        '#0A0A0B',
    carbon:       '#121214',
    carbonClaro:  '#1D1D21',
    bronce:       '#C49A7C',
    bronceFuerte: '#96684F',
    bronceSuave:  '#E6D0BC',
    tinta:        '#1B1B19',
    pagina:       '#F7F7F5',
};

export const FUENTE_MARCA = "'Chakra Petch', Inter, system-ui, sans-serif";

export const TEMAS = {
    admin: {
        acento: 'var(--bronce-600)',
        acentoRgb: '150 104 79',
        acentoBarra: 'var(--bronce-400)',
        barra: 'var(--carbon-900)',
        gradiente: 'linear-gradient(180deg, #121214 0%, #1A1A1D 60%, #1D1D21 100%)',
        halo: 'rgba(196, 154, 124, 0.14)',
        velo: 'rgba(10, 10, 11, 0.62)',
    },
    vendedor: {
        // El vendedor trabaja con el mismo negro, pero un bronce más cálido: se distingue de un vistazo
        // sin salirse de la marca.
        acento: 'var(--bronce-700)',
        acentoRgb: '121 82 62',
        acentoBarra: 'var(--bronce-300)',
        barra: 'var(--carbon-850)',
        gradiente: 'linear-gradient(180deg, #171719 0%, #221C18 55%, #2A211A 100%)',
        halo: 'rgba(213, 179, 150, 0.16)',
        velo: 'rgba(10, 10, 11, 0.62)',
    },
};

const ANCHO_BARRA = 268;

/** ¿El rol puede abrir esta entrada del menú? La misma regla que aplica el servidor (PermisoMiddleware). */
export function puede(permisos, modulo) {
    if (!modulo) return true;
    const lista = permisos ?? [];
    return lista.includes('*') || lista.includes(modulo);
}

export function isActive(item) {
    try {
        if (route().current(item.r)) return true;
        if (item.exact) return false;
        return route().current(item.r.replace(/\.[^.]+$/, '') + '.*');
    } catch {
        return false;
    }
}

export function safeHref(r) {
    try { return route(r); } catch { return null; }
}

function leerPreferencia(clave, porDefecto) {
    try {
        const v = localStorage.getItem(clave);
        return v === null ? porDefecto : v === '1';
    } catch {
        return porDefecto;
    }
}

// ─── Menú lateral ────────────────────────────────────────────────────────────
function NavGroup({ group, onNavigate }) {
    const reduce = useReducedMotion();
    const hayActivo = group.items.some(isActive);
    const { avisosAdmin } = usePage().props;
    const [abierto, setAbierto] = useState(() => hayActivo || leerPreferencia(`bp-nav-${group.key}`, true));

    const alternar = () => {
        const siguiente = !abierto;
        setAbierto(siguiente);
        try { localStorage.setItem(`bp-nav-${group.key}`, siguiente ? '1' : '0'); } catch { /* sin almacenamiento */ }
    };

    const lista = (
        <ul className="space-y-0.5">
            {group.items.map((item) => {
                const href = safeHref(item.r);
                if (!href) return null;
                const activo = isActive(item);
                const Icono = item.icon;
                return (
                    <li key={item.r}>
                        <Link
                            href={href}
                            prefetch="hover"
                            onClick={onNavigate}
                            aria-current={activo ? 'page' : undefined}
                            className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors ${
                                activo ? 'text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                            }`}
                        >
                            {activo && (
                                <motion.span
                                    layoutId="bp-nav-activo"
                                    className="absolute inset-0 rounded-[10px]"
                                    style={{ background: 'var(--armazon-activo)' }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                >
                                    <span
                                        className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-r-full"
                                        style={{ background: 'var(--bronce-400)' }}
                                    />
                                </motion.span>
                            )}
                            <Icono
                                className="relative h-[17px] w-[17px] shrink-0 transition-transform duration-200 group-hover:scale-110"
                                style={activo ? { color: 'var(--bronce-400)' } : undefined}
                            />
                            <span className="relative truncate">{item.label}</span>
                            {/* Pendientes del módulo, si el panel los informa */}
                            {item.aviso && avisosAdmin?.[item.aviso] > 0 && (
                                <span
                                    className="relative ml-auto rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums"
                                    style={{ background: 'var(--bronce-400)', color: 'var(--carbon-950)' }}
                                    title={`${avisosAdmin[item.aviso]} sin responder`}
                                >
                                    {avisosAdmin[item.aviso]}
                                </span>
                            )}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );

    if (!group.label) return <div className="mb-3">{lista}</div>;

    return (
        <div className="mb-2">
            <button
                type="button"
                onClick={alternar}
                aria-expanded={abierto}
                className="flex w-full items-center justify-between rounded-lg px-3 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white/70"
            >
                {group.label}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${abierto ? '' : '-rotate-90'}`} />
            </button>
            <AnimatePresence initial={false}>
                {abierto && (
                    <motion.div
                        key="lista"
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                    >
                        {lista}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Sidebar({ nav, homeRoute, insignia, filtrarPorPermisos, tema, nombreNegocio, open, isDesktop, onClose, onLogout }) {
    const scrollRef = useRef(null);
    const { auth } = usePage().props;

    // El menú muestra solo lo que el rol puede abrir; el servidor aplica la misma regla
    const grupos = useMemo(() => {
        const base = filtrarPorPermisos
            ? nav.map((g) => ({ ...g, items: g.items.filter((i) => puede(auth?.permisos, i.modulo)) }))
            : nav;
        return base.filter((g) => g.items.length > 0);
    }, [nav, filtrarPorPermisos, auth?.permisos]);

    // El layout se vuelve a montar en cada página: se recuerda hasta dónde bajaste en el menú
    useLayoutEffect(() => {
        try { scrollRef.current.scrollTop = Number(sessionStorage.getItem('bp-nav-scroll') || 0); } catch { /* nada */ }
    }, []);

    // Se guarda una vez por cuadro, no en cada evento de scroll
    const pendiente = useRef(false);
    const alDesplazar = (e) => {
        const el = e.currentTarget;
        if (pendiente.current) return;
        pendiente.current = true;
        requestAnimationFrame(() => {
            pendiente.current = false;
            try { sessionStorage.setItem('bp-nav-scroll', String(el.scrollTop)); } catch { /* nada */ }
        });
    };

    return (
        <aside
            className="bp-reset bp-sidebar fixed inset-y-0 left-0 z-[1040] flex flex-col overflow-hidden"
            style={{
                width: ANCHO_BARRA,
                // Color sólido debajo del degradado: nunca se ve blanco mientras el navegador repinta
                backgroundColor: tema.barra,
                backgroundImage: tema.gradiente,
                // En escritorio no se desplaza: sin transform, el menú fijo no se vuelve a componer al hacer scroll
                transform: isDesktop ? 'none' : (open ? 'translate3d(0,0,0)' : 'translate3d(-100%,0,0)'),
                transition: isDesktop ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            aria-label="Menú del panel"
        >
            {/* Resplandor de marca, muy por debajo del contenido */}
            <span aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-24 h-52 w-52 rounded-full blur-2xl" style={{ background: tema.halo }} />

            {/* Encabezado: la misma altura que la barra de arriba, para que las dos líneas coincidan */}
            <div className="relative h-[60px] shrink-0">
                <Link
                    href={safeHref(homeRoute) ?? '/'}
                    onClick={onClose}
                    className="group flex h-full items-center px-5 text-white transition-opacity hover:opacity-90"
                >
                    <Logotipo nombre={nombreNegocio} insignia={insignia} />
                </Link>
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-4 bottom-0 h-px"
                    style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0) 100%)' }}
                />
                {!isDesktop && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/70 hover:bg-white/10"
                        aria-label="Cerrar menú"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            <nav ref={scrollRef} onScroll={alDesplazar} className="bp-scroll relative flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-2">
                {grupos.map((g) => <NavGroup key={g.key} group={g} onNavigate={isDesktop ? undefined : onClose} />)}
            </nav>

            <div className="relative shrink-0 border-t border-white/[0.08] p-3">
                <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                    <LogOut className="h-[17px] w-[17px]" /> Cerrar sesión
                </button>
            </div>
        </aside>
    );
}

// ─── Barra superior ──────────────────────────────────────────────────────────
function MenuUsuario({ user, onLogout }) {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    const iniciales = (user?.name ?? 'A').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

    useEffect(() => {
        const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', cerrar);
        return () => document.removeEventListener('mousedown', cerrar);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                aria-expanded={abierto}
                className="flex items-center gap-2.5 rounded-[10px] py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-gris-100"
            >
                <span
                    className="grid h-9 w-9 place-items-center rounded-[10px] font-marca text-[13px] font-bold"
                    style={{ background: 'var(--carbon-900)', color: 'var(--bronce-400)' }}
                >
                    {iniciales}
                </span>
                <span className="hidden text-left sm:block">
                    <span className="block text-[13px] font-semibold leading-tight text-gris-900">{user?.name}</span>
                    <span className="block text-[11px] font-medium capitalize leading-tight text-gris-500">{user?.rol ?? 'admin'}</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-gris-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {abierto && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-[14px] border border-gris-200 bg-white p-1.5 shadow-alzada"
                    >
                        <div className="px-3 py-2">
                            <p className="truncate text-sm font-semibold text-gris-900">{user?.name}</p>
                            <p className="truncate text-xs text-gris-500">{user?.email}</p>
                        </div>
                        <div className="my-1 h-px bg-gris-100" />
                        <Link href={route('profile.edit')} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-gris-700 hover:bg-gris-50">
                            <UserPlus className="h-4 w-4 text-gris-400" /> Mi perfil
                        </Link>
                        <button
                            type="button"
                            onClick={() => { setAbierto(false); onLogout(); }}
                            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm font-medium text-peligro hover:bg-peligro/[0.07]"
                        >
                            <LogOut className="h-4 w-4" /> Cerrar sesión
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Topbar({ nav, migaPorDefecto, onMenu, onLogout }) {
    const { auth } = usePage().props;

    // Ruta de migas a partir del menú: «Inventario › Celulares»
    const miga = useMemo(() => {
        for (const g of nav) {
            const item = g.items.find(isActive);
            if (item) return { grupo: g.label, label: item.label };
        }
        return null;
    }, [nav]);

    return (
        <header className="bp-reset sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-gris-200 bg-white/85 px-4 backdrop-blur-md lg:px-8">
            <button
                type="button"
                onClick={onMenu}
                className="grid h-10 w-10 place-items-center rounded-[10px] text-gris-600 hover:bg-gris-100 lg:hidden"
                aria-label="Abrir menú"
            >
                <Menu className="h-5 w-5" />
            </button>

            <nav aria-label="Ubicación" className="min-w-0 flex-1 truncate text-sm">
                {miga?.grupo && <span className="hidden font-medium text-gris-400 sm:inline">{miga.grupo} <span className="mx-1">›</span> </span>}
                <span className="font-semibold text-gris-900">{miga?.label ?? migaPorDefecto}</span>
            </nav>

            <SelectorSucursal />

            <MenuUsuario user={auth?.user} onLogout={onLogout} />
        </header>
    );
}

// ─── Armazón compartido por el panel de administración y el del vendedor ─────
export default function PanelShell({
    children,
    nav,
    homeRoute,
    headTitle,
    migaPorDefecto,
    insignia = null,
    filtrarPorPermisos = false,
    tema = 'admin',
}) {
    const t = TEMAS[tema] ?? TEMAS.admin;
    const { post } = useForm();
    const { url, props } = usePage();
    const reduce = useReducedMotion();
    const [modalSalida, setModalSalida] = useState(false);
    const [barraAbierta, setBarraAbierta] = useState(false);
    const [isDesktop, setIsDesktop] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
    ));

    const nombreNegocio = props?.negocio?.nombre ?? 'Blackphone';

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const alCambiar = (e) => { setIsDesktop(e.matches); if (e.matches) setBarraAbierta(false); };
        mq.addEventListener('change', alCambiar);
        return () => mq.removeEventListener('change', alCambiar);
    }, []);

    useEffect(() => {
        if (!barraAbierta) return;
        const alTeclear = (e) => { if (e.key === 'Escape') setBarraAbierta(false); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [barraAbierta]);

    const salir = () => { setBarraAbierta(false); setModalSalida(true); };

    return (
        <>
            <Head title={headTitle} />

            <style>{`
        :root { --acento: ${t.acento}; --acento-rgb: ${t.acentoRgb}; }
        /* Piezas del panel: sin los márgenes que el navegador pone a p, listas, títulos y etiquetas */
        :where(.bp-reset) :where(p, ul, ol, h1, h2, h3, h4, h5, h6, label, figure) { margin: 0; }
        :where(.bp-reset) :where(ul, ol) { padding: 0; list-style: none; }
        :where(.bp-reset) a:hover { text-decoration: none; }
        /* Fondo del documento con el color del panel: al rebotar el scroll no aparece blanco */
        html:has(.bp-panel), html:has(.bp-panel) body { background: var(--superficie-pagina); overscroll-behavior-y: none; }
        .bp-sidebar { height: 100vh; height: 100dvh; backface-visibility: hidden; contain: layout paint; isolation: isolate; }
        .bp-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.16) transparent; }
        .bp-scroll::-webkit-scrollbar { width: 6px; }
        .bp-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.16); border-radius: 9999px; }
      `}</style>

            <div className="bp-panel min-h-screen bg-gris-50 text-gris-800">
                <AnimatePresence>
                    {!isDesktop && barraAbierta && (
                        <motion.button
                            type="button"
                            aria-label="Cerrar menú"
                            onClick={() => setBarraAbierta(false)}
                            className="fixed inset-0 z-[1035] border-0"
                            style={{ background: t.velo }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                    )}
                </AnimatePresence>

                <Sidebar
                    nav={nav}
                    homeRoute={homeRoute}
                    insignia={insignia}
                    filtrarPorPermisos={filtrarPorPermisos}
                    tema={t}
                    nombreNegocio={nombreNegocio}
                    open={barraAbierta}
                    isDesktop={isDesktop}
                    onClose={() => setBarraAbierta(false)}
                    onLogout={salir}
                />

                <div className="flex min-h-screen flex-col" style={{ marginLeft: isDesktop ? ANCHO_BARRA : 0 }}>
                    <Topbar nav={nav} migaPorDefecto={migaPorDefecto} onMenu={() => setBarraAbierta(true)} onLogout={salir} />

                    <motion.main
                        key={url}
                        className="flex-1 px-4 py-6 lg:px-8 lg:py-8"
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {children}
                    </motion.main>
                </div>
            </div>

            <ConfirmLogoutModal
                open={modalSalida}
                onClose={() => setModalSalida(false)}
                onConfirm={() => post(route('logout'))}
            />
        </>
    );
}
