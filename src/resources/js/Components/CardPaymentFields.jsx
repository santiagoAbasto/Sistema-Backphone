import { useId, useRef } from 'react';
import {
  motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform,
} from 'framer-motion';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { inputCls } from '@/Components/Admin/ui';
import Isotipo from '@/Components/Marca/Isotipo';

const onlyFourDigits = (value) => value.replace(/\D/g, '').slice(0, 4);
const EASE = [0.22, 1, 0.36, 1];

// Solo el nombre de la red (sin logos de terceros), deducido de los primeros números
function redDeTarjeta(inicio = '') {
  if (/^4/.test(inicio)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(inicio)) return 'Mastercard';
  if (/^3[47]/.test(inicio)) return 'American Express';
  return null;
}

function Chip({ id }) {
  return (
    <svg viewBox="0 0 46 36" className="h-[32px] w-[42px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FCEBB0" />
          <stop offset="0.45" stopColor="#E4B957" />
          <stop offset="1" stopColor="#B5842A" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="45" height="35" rx="7" fill={`url(#${id})`} stroke="#9C7224" strokeOpacity="0.55" />
      <g fill="none" stroke="#86601E" strokeOpacity="0.55" strokeWidth="1">
        <path d="M0.5 12.5h13M0.5 23.5h13M32.5 12.5h13M32.5 23.5h13M13.5 0.5v35M32.5 0.5v35" />
        <rect x="13.5" y="9.5" width="19" height="17" rx="4" />
      </g>
    </svg>
  );
}

function SinContacto() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M7.5 15.5a5 5 0 0 0 0-7" />
      <path d="M11 18a9 9 0 0 0 0-12" />
      <path d="M14.5 20.5a13 13 0 0 0 0-17" />
    </svg>
  );
}

// Líneas finas tipo billete para dar textura a la tarjeta
function Guilloche() {
  const lineas = Array.from({ length: 16 }, (_, i) => {
    const y = 12 + i * 15;
    return `M-30 ${y} C 70 ${y - 46}, 170 ${y + 46}, 270 ${y} S 470 ${y - 46}, 560 ${y}`;
  });
  return (
    <svg viewBox="0 0 400 252" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {lineas.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.045 + (i % 3) * 0.015} strokeWidth="1" />
      ))}
    </svg>
  );
}

// Cuatro dígitos; cada uno entra con una pequeña animación al escribirlo
function Grupo({ valor = '', reduce }) {
  const chars = valor.padEnd(4, '•').slice(0, 4).split('');
  return (
    <span className="inline-flex">
      {chars.map((c, i) => (
        <span key={i} className="inline-block w-[0.68em] text-center">
          <motion.span
            key={`${i}-${c}`}
            className={`inline-block ${c === '•' ? 'text-white/45' : ''}`}
            initial={reduce ? false : { y: 7, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            {c}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

// Campo definido fuera del componente principal para no perder el foco al escribir
function CampoDigitos({ id, label, value, onChange, error, placeholder }) {
  const n = (value || '').length;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gris-600">{label}</label>
      <div className="relative">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(onlyFourDigits(e.target.value))}
          className={`${inputCls} h-12 pr-10 font-mono text-lg tracking-[0.35em] placeholder:font-sans placeholder:text-sm placeholder:tracking-normal ${error ? 'border-red-400' : ''}`}
        />
        {n === 4 && <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" aria-hidden="true" />}
      </div>
      {error
        ? <p className="mt-1 text-xs text-rose-600">{error}</p>
        : n > 0 && n < 4 ? <p className="mt-1 text-xs text-gris-400">Faltan {4 - n} {4 - n === 1 ? 'número' : 'números'}</p> : null}
    </div>
  );
}

export default function CardPaymentFields({
  inicio,
  fin,
  onChangeInicio,
  onChangeFin,
  titular = '',
  errors = {},
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const cardRef = useRef(null);
  const red = redDeTarjeta(inicio || '');

  // Inclinación 3D y brillo que siguen al mouse
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotY = useSpring(useTransform(mx, [0, 1], [-11, 11]), { stiffness: 180, damping: 18 });
  const rotX = useSpring(useTransform(my, [0, 1], [9, -9]), { stiffness: 180, damping: 18 });
  const bx = useTransform(mx, (v) => `${v * 100}%`);
  const by = useTransform(my, (v) => `${v * 100}%`);
  const brillo = useMotionTemplate`radial-gradient(circle at ${bx} ${by}, rgba(255,255,255,0.22), rgba(255,255,255,0) 46%)`;

  const mover = (e) => {
    if (reduce || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const soltar = () => { mx.set(0.5); my.set(0.5); };

  return (
    <div className="md:col-span-2 grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Tarjeta */}
      <motion.div
        className="mx-auto w-full max-w-[360px] [perspective:1100px]"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <motion.div
          ref={cardRef}
          onPointerMove={mover}
          onPointerLeave={soltar}
          role="img"
          aria-label={`Tarjeta${red ? ` ${red}` : ''} terminada en ${fin || '••••'}`}
          className="relative aspect-[1.586/1] w-full select-none overflow-hidden rounded-[18px] text-white shadow-[0_26px_50px_-24px_rgba(10,10,11,0.85)] ring-1 ring-white/10"
          style={{
            background: 'linear-gradient(135deg, #0A0A0B 0%, #1D1D21 42%, #3B2820 76%, #5A3D2E 100%)',
            ...(reduce ? {} : { rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }),
          }}
        >
          {/* Fondo: círculos de marca, textura y brillo */}
          <span aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(123,130,216,0.55) 0%, rgba(150, 104, 79,0.25) 55%, transparent 70%)' }} />
          <span aria-hidden="true" className="absolute -bottom-14 -left-8 h-36 w-36 rounded-full" style={{ background: 'radial-gradient(circle, rgba(196,154,124,0.32) 0%, transparent 68%)' }} />
          <Guilloche />
          <motion.span aria-hidden="true" className="absolute inset-0" style={{ background: brillo }} />
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/25 to-transparent" />

          <div className="relative flex h-full flex-col justify-between p-5">
            {/* Marca */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Isotipo className="h-7 w-auto text-white" title="" />
                <span className="font-marca text-[15px] font-bold uppercase leading-none tracking-[0.16em]">Blackphone</span>
              </div>
              <SinContacto />
            </div>

            {/* Chip */}
            <div className="flex items-center gap-3">
              <Chip id={`${uid}-chip`} />
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">Pago con tarjeta</span>
            </div>

            {/* Número: siempre en una sola línea */}
            <p className="flex items-center gap-[0.6em] whitespace-nowrap font-mono text-[18px] font-semibold tabular-nums tracking-[0.04em] drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] sm:text-[19px]">
              <Grupo valor={inicio || ''} reduce={reduce} />
              <span className="text-white/45">••••</span>
              <span className="text-white/45">••••</span>
              <Grupo valor={fin || ''} reduce={reduce} />
            </p>

            {/* Titular y red */}
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/55">Titular</p>
                <p className="truncate text-[13px] font-semibold uppercase tracking-[0.06em]">{titular?.trim() || 'Nombre del cliente'}</p>
              </div>
              {red ? (
                <motion.p key={red} className="shrink-0 text-[16px] font-extrabold italic tracking-tight"
                  initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  {red}
                </motion.p>
              ) : (
                <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Tarjeta</p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Datos */}
      <div className="rounded-2xl border border-gris-200 bg-white p-5">
        <p className="text-sm font-bold text-gris-900">Datos de la tarjeta</p>
        <p className="mt-0.5 text-[13px] text-gris-500">Anota los 4 primeros y los 4 últimos números; aparecen en la nota.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CampoDigitos id={`${uid}-inicio`} label="Primeros 4 números" value={inicio} onChange={onChangeInicio} error={errors.inicio_tarjeta} placeholder="Ej.: 4557" />
          <CampoDigitos id={`${uid}-fin`} label="Últimos 4 números" value={fin} onChange={onChangeFin} error={errors.fin_tarjeta} placeholder="Ej.: 5678" />
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-gris-50 px-3 py-2.5 text-xs leading-relaxed text-gris-500">
          <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-bronce-600" />
          Por seguridad, nunca anotes el número completo ni el código de atrás de la tarjeta.
        </p>
      </div>
    </div>
  );
}
