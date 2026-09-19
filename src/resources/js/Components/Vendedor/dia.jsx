import { Link } from '@inertiajs/react';
import {
  AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Flame, PartyPopper, Sparkles, Target, TrendingUp } from 'lucide-react';
import { bsFmt } from '@/Components/Admin/ui';

/* ─── Piezas de «Mi día» ──────────────────────────────────────────────────────
   El morado (#79523E) es el color del panel del vendedor y llega como variable
   CSS (--acento) desde el armazón. Todo lo que se mueve se apaga solo con
   «reducir movimiento» del sistema y en pantallas táctiles.                  */

const LIMA = '#C49A7C';

/** ¿Vale la pena animar? Con «reducir movimiento» o con el dedo, no. */
export function useAnima() {
  const reduce = useReducedMotion();
  const [fino, setFino] = useState(false);
  useEffect(() => {
    try { setFino(window.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch { setFino(false); }
  }, []);
  return { anima: !reduce && fino, reduce: Boolean(reduce) };
}

/**
 * ¿Se hace la entrada?
 *
 * Solo si el visitante no pidió menos movimiento y la pestaña está a la vista. Si la pestaña está en
 * segundo plano el navegador frena las animaciones, y una entrada que arranca en opacidad 0 dejaría
 * la pantalla en blanco hasta que alguien la mire. Cuando no se anima, todo se dibuja ya visible.
 */
export function useEntrada() {
  const reduce = useReducedMotion();
  const [visible] = useState(() => {
    if (typeof document === 'undefined') return false;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch { /* sin matchMedia */ }
    return ! document.hidden;
  });
  return visible && ! reduce;
}

/**
 * Cuenta desde 0 hasta el número final con una curva que frena al llegar.
 * Si el navegador frena los cuadros (pestaña en segundo plano), un temporizador de respaldo deja
 * igual el número real: nunca se queda mostrando un valor a medio camino.
 */
export function useConteo(valor, activo, dura = 1100) {
  const [n, setN] = useState(activo ? 0 : valor);
  const desde = useRef(0);
  useEffect(() => {
    if (!activo) { setN(valor); desde.current = valor; return undefined; }
    const inicio = performance.now();
    const base = desde.current;
    let raf;
    const paso = (t) => {
      const p = Math.min(1, (t - inicio) / dura);
      const suave = 1 - Math.pow(1 - p, 4);
      setN(base + (valor - base) * suave);
      if (p < 1) raf = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    raf = requestAnimationFrame(paso);
    const red = setTimeout(() => { setN(valor); desde.current = valor; }, dura + 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(red); };
  }, [valor, activo, dura]);
  return n;
}

/* ─── Tarjeta de la meta del mes ──────────────────────────────────────────── */

const LARGO_ARCO = Math.PI * 78; // media circunferencia de radio 78

function Chispas({ activo }) {
  if (!activo) return null;
  // Confeti discreto cuando la meta está cumplida
  const piezas = [
    { x: '12%', d: 0, c: LIMA }, { x: '28%', d: 0.35, c: '#FFFFFF' }, { x: '46%', d: 0.7, c: LIMA },
    { x: '64%', d: 0.2, c: '#FFFFFF' }, { x: '82%', d: 0.55, c: LIMA },
  ];
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
      {piezas.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-1.5 w-1.5 rounded-[2px]"
          style={{ left: p.x, background: p.c }}
          initial={{ y: -12, opacity: 0, rotate: 0 }}
          animate={{ y: ['-12px', '190px'], opacity: [0, 1, 1, 0], rotate: 360 }}
          transition={{ duration: 3.2, delay: p.d, repeat: Infinity, repeatDelay: 4, ease: 'easeIn' }}
        />
      ))}
    </span>
  );
}

export function TarjetaMeta({ total, meta, mes, faltaLabel = 'Te falta' }) {
  const { anima, reduce } = useAnima();
  const entra = useEntrada();
  const ref = useRef(null);

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotX = useSpring(useTransform(y, [0, 1], [8, -8]), { stiffness: 190, damping: 20 });
  const rotY = useSpring(useTransform(x, [0, 1], [-11, 11]), { stiffness: 190, damping: 20 });
  const brilloX = useTransform(x, (v) => `${v * 100}%`);
  const brilloY = useTransform(y, (v) => `${v * 100}%`);
  const brillo = useMotionTemplate`radial-gradient(460px circle at ${brilloX} ${brilloY}, rgba(255,255,255,0.26), transparent 60%)`;
  const borde = useMotionTemplate`radial-gradient(260px circle at ${brilloX} ${brilloY}, rgba(255,255,255,0.55), transparent 70%)`;

  const onMove = (e) => {
    if (!anima) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width);
    y.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { x.set(0.5); y.set(0.5); };

  const hayMeta = Number(meta) > 0;
  const pct = hayMeta ? Math.min(100, (Number(total) / Number(meta)) * 100) : 0;
  const cumplida = pct >= 100;
  const mostrado = useConteo(pct, anima && entra);
  const acumulado = useConteo(Number(total) || 0, anima && entra);
  const falta = Math.max(0, Number(meta) - Number(total));

  return (
    <motion.section
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={anima ? { rotateX: rotX, rotateY: rotY, transformPerspective: 1100 } : undefined}
      initial={entra ? { opacity: 0, y: 18, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={anima ? { scale: 1.012 } : undefined}
      className="bp-meta relative overflow-hidden rounded-[16px] p-6 text-white"
      aria-label="Meta del mes"
    >
      {/* Fondo morado con profundidad y una aurora que respira */}
      <span aria-hidden="true" className="bp-meta-fondo absolute inset-0" />
      <span aria-hidden="true" className="bp-meta-aurora absolute -left-1/4 -top-1/2 h-[200%] w-[150%] opacity-80" />
      <span aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/[0.07]" />
      <span aria-hidden="true" className="absolute -bottom-24 -left-10 h-48 w-48 rounded-full" style={{ background: 'rgba(10, 10, 11,0.3)' }} />
      {anima && <motion.span aria-hidden="true" className="absolute inset-0" style={{ background: brillo }} />}
      {anima && (
        <motion.span aria-hidden="true" className="absolute inset-0 rounded-[16px]"
          style={{ background: borde, WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: 1 }} />
      )}
      <span aria-hidden="true" className="absolute inset-0 rounded-[16px] ring-1 ring-inset ring-white/15" />
      <Chispas activo={hayMeta && cumplida && !reduce} />

      <div className="relative" style={anima ? { transform: 'translateZ(48px)' } : undefined}>
        <div className="flex items-center gap-2.5">
          <motion.span
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"
            animate={reduce ? undefined : { rotate: [0, -8, 8, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
          >
            <Target className="h-[18px] w-[18px]" />
          </motion.span>
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-white/75">Meta del mes</p>
            <p className="mt-0.5 text-[12px] text-white/55 first-letter:uppercase">{mes}</p>
          </div>
          {hayMeta && cumplida && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: LIMA, color: '#2B2E12' }}>
              <PartyPopper className="h-3 w-3" /> Cumplida
            </span>
          )}
        </div>

        {hayMeta ? (
          <>
            <div className="mt-5 flex flex-wrap items-end justify-center gap-x-6 gap-y-3 text-center sm:justify-start sm:text-left">
              <div className="relative mx-auto aspect-[188/104] w-full max-w-[188px] shrink-0 sm:mx-0">
                <svg viewBox="0 0 188 104" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="bp-meta-arco" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                      <stop offset="55%" stopColor={LIMA} />
                      <stop offset="100%" stopColor={LIMA} />
                    </linearGradient>
                  </defs>
                  <path d="M16 96a78 78 0 0 1 156 0" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="13" strokeLinecap="round" />
                  {/* Marcas de cada cuarto: dan referencia sin ensuciar */}
                  {[25, 50, 75].map((m) => {
                    const a = Math.PI * (1 - m / 100);
                    return <circle key={m} cx={94 + 78 * Math.cos(a)} cy={96 - 78 * Math.sin(a)} r="2" fill="rgba(255,255,255,0.4)" />;
                  })}
                  <motion.path
                    d="M16 96a78 78 0 0 1 156 0"
                    fill="none" stroke="url(#bp-meta-arco)" strokeWidth="13" strokeLinecap="round"
                    strokeDasharray={LARGO_ARCO}
                    initial={entra ? { strokeDashoffset: LARGO_ARCO } : false}
                    animate={{ strokeDashoffset: LARGO_ARCO - (LARGO_ARCO * pct) / 100 }}
                    transition={entra ? { duration: 1.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
                    style={{ filter: 'drop-shadow(0 0 7px rgba(196, 154, 124,0.5))' }}
                  />
                </svg>
                <div className="absolute inset-x-0 bottom-0 text-center">
                  <span className="block text-[38px] font-bold leading-none tabular-nums">
                    {Math.round(mostrado)}<span className="text-[22px]">%</span>
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-[26px] font-bold leading-none tabular-nums">{bsFmt(acumulado)}</p>
                <p className="mt-1 text-[13px] text-white/65">de {bsFmt(meta)}</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={cumplida ? 'ok' : 'falta'}
                initial={entra ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/[0.14] px-3 py-2 text-[13px] font-semibold backdrop-blur-sm"
              >
                {cumplida
                  ? <><Sparkles className="h-4 w-4 shrink-0" style={{ color: LIMA }} /> ¡Meta cumplida! Lo que vendas de acá en adelante va por encima.</>
                  : <><TrendingUp className="h-4 w-4 shrink-0" style={{ color: LIMA }} /> {faltaLabel} {bsFmt(falta)} para llegar</>}
              </motion.p>
            </AnimatePresence>
          </>
        ) : (
          <div className="mt-5">
            <p className="text-[26px] font-bold leading-none tabular-nums">{bsFmt(acumulado)}</p>
            <p className="mt-1 text-[13px] text-white/65">vendido este mes</p>
            <p className="mt-5 rounded-xl bg-white/[0.14] px-3 py-2 text-[13px] leading-relaxed backdrop-blur-sm">
              Todavía no tienes una meta cargada. La pone el administrador desde Usuarios y roles.
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

/* ─── Entradas escalonadas ───────────────────────────────────────────────── */

/** Cada hijo entra un poquito después del anterior. */
export function Entrada({ i = 0, children, className = '' }) {
  const entra = useEntrada();
  return (
    <motion.div
      className={className}
      initial={entra ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(i * 0.06, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Tarjeta de número con conteo ───────────────────────────────────────── */

export function Numero({ icon: Icon, label, valor, hint, moneda = false, i = 0, tono = 'navy' }) {
  const { anima } = useAnima();
  const entra = useEntrada();
  const n = useConteo(Number(valor) || 0, anima && entra, 900);
  const tonos = {
    navy: 'bg-carbon-900/[0.07] text-carbon-900',
    emerald: 'bg-[color:var(--ok-fondo)] text-[color:var(--ok-texto)]',
    lila: 'bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-gris-100 text-gris-600',
  };

  return (
    <Entrada i={i}>
      <div className="group h-full rounded-[14px] border border-gris-200 bg-white p-5 shadow-sutil transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgb(var(--acento-rgb)_/_0.35)] hover:shadow-tarjeta">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${tonos[tono]}`}>
            <Icon className="h-5 w-5" />
          </span>
          <p className="text-[13px] font-semibold text-gris-500">{label}</p>
        </div>
        <p className="mt-4 text-[24px] font-bold leading-none tracking-tight tabular-nums text-gris-900">
          {moneda ? bsFmt(n) : Math.round(n).toLocaleString('es-BO')}
        </p>
        {hint && <p className="mt-2 truncate text-xs text-gris-400">{hint}</p>}
      </div>
    </Entrada>
  );
}

/* ─── Accesos rápidos ────────────────────────────────────────────────────── */

export function AccesoRapido({ href, icon: Icon, label, hint, i = 0 }) {
  const reduce = useReducedMotion();
  const entra = useEntrada();
  return (
    <motion.div
      initial={entra ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(i * 0.07, 0.35), ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -3 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      className="h-full"
    >
      <Link
        href={href}
        className="group relative flex h-full items-center gap-3 overflow-hidden rounded-[14px] border border-gris-200 bg-white p-4 shadow-sutil transition-all hover:-translate-y-0.5 hover:border-[rgb(var(--acento-rgb)_/_0.4)] hover:shadow-tarjeta"
      >
        {/* Barrido de luz al pasar el mouse */}
        <span aria-hidden="true" className="bp-barrido pointer-events-none absolute inset-0" />
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)] transition-colors duration-300 group-hover:bg-[color:var(--acento)] group-hover:text-white">
          <Icon className="h-5 w-5" />
        </span>
        <span className="relative min-w-0">
          <span className="block text-[15px] font-bold text-gris-900">{label}</span>
          {hint && <span className="block truncate text-xs text-gris-500">{hint}</span>}
        </span>
      </Link>
    </motion.div>
  );
}

/* ─── Listas de lo último ────────────────────────────────────────────────── */

export function ListaReciente({ icon: Icon, titulo, verTodo, items, vacio, render, i = 0 }) {
  const entra = useEntrada();
  return (
    <Entrada i={i} className="h-full">
      <section className="flex h-full flex-col overflow-hidden rounded-[14px] border border-gris-200 bg-white shadow-sutil">
        <header className="flex items-center gap-2.5 border-b border-gris-100 px-5 py-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgb(var(--acento-rgb)_/_0.1)] text-[color:var(--acento)]">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="flex-1 text-[15px] font-bold text-gris-900">{titulo}</h2>
          {verTodo && (
            <Link href={verTodo} className="group inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--acento)]">
              Ver todo
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">›</span>
            </Link>
          )}
        </header>

        {items.length === 0 ? (
          <p className="flex-1 px-5 py-8 text-center text-[13px] text-gris-400">{vacio}</p>
        ) : (
          <ul className="flex-1 divide-y divide-gris-100">
            {items.map((it, n) => (
              <motion.li
                key={it.id}
                initial={entra ? { opacity: 0, x: -8 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: Math.min(0.15 + n * 0.05, 0.5) }}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[rgb(var(--acento-rgb)_/_0.04)]"
              >
                {render(it)}
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </Entrada>
  );
}

/* ─── Racha del día ──────────────────────────────────────────────────────── */

/** Un saludo corto según cómo viene el día. Sin inventar números: solo lee los que ya hay. */
export function animoDelDia({ ventas = 0, servicios = 0, pct = null }) {
  const movimientos = Number(ventas) + Number(servicios);
  if (movimientos === 0) {
    return { icon: Sparkles, texto: 'El día recién empieza. La primera venta mueve todos estos números.' };
  }
  if (pct !== null && pct >= 100) {
    return { icon: PartyPopper, texto: `¡Meta cumplida! Y hoy ya llevás ${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'}.` };
  }
  if (movimientos >= 5) {
    return { icon: Flame, texto: `Día fuerte: ${movimientos} movimientos registrados.` };
  }
  return { icon: TrendingUp, texto: `Llevás ${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'} hoy. Seguí así.` };
}

export const CONSEJOS_VENDEDOR = [
  'Antes de prometer un equipo, míralo en «Productos en stock»: ahí está lo que de verdad queda.',
  'Si el cliente deja una seña, cárgala como reserva. Cuando vuelva, esa seña se descuenta sola de la venta.',
  'Cada venta y cada servicio genera su boleta. Puedes imprimirla normal o en la impresora térmica.',
  'Los clientes que cargues quedan solo en tu lista y se autocompletan la próxima vez.',
];
