import { useState } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react';

/** Campo de texto del acceso: etiqueta, ícono, mostrar/ocultar contraseña, ayuda y error. */
export function AuthField({
    id, label, type = 'text', icon: Icon, value, onChange, error, hint, action,
    autoComplete, autoFocus, placeholder, toggle = false, required = true, children,
}) {
    const [show, setShow] = useState(false);
    const inputType = toggle ? (show ? 'text' : 'password') : type;

    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-sm font-semibold text-gris-800">{label}</label>
                {action}
            </div>
            <div className="relative">
                {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gris-400" aria-hidden="true" />}
                <input
                    id={id}
                    name={id}
                    type={inputType}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    placeholder={placeholder}
                    required={required}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
                    className={`h-12 w-full rounded-[12px] border bg-white text-[15px] text-gris-900 outline-none transition placeholder:text-gris-400 focus:ring-4 ${
                        error
                            ? 'border-peligro/60 focus:border-peligro focus:ring-peligro/15'
                            : 'border-gris-200 focus:border-bronce-500 focus:ring-bronce-500/15'
                    }`}
                    style={{ paddingLeft: Icon ? '2.75rem' : '1rem', paddingRight: toggle ? '3rem' : '1rem' }}
                />
                {toggle && (
                    <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-gris-400 transition hover:bg-gris-100 hover:text-gris-700"
                        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                )}
            </div>
            {error ? (
                <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-peligro">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </p>
            ) : hint ? (
                <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-gris-500">{hint}</p>
            ) : null}
            {children}
        </div>
    );
}

/** Botón principal del acceso: el negro de la marca, con el bronce en el anillo de foco. */
export function AuthButton({ children, loading, loadingText, className = '', ...props }) {
    return (
        <button
            type="submit"
            disabled={loading || props.disabled}
            className={`group inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-carbon-900 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(10,10,11,0.7)] transition hover:bg-carbon-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-bronce-400/50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            {...props}
        >
            {loading ? (
                <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {loadingText ?? children}
                </>
            ) : (
                <>
                    {children}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
            )}
        </button>
    );
}

/** Aviso dentro del formulario (correo enviado, contraseña cambiada, error general). */
export function AuthAlert({ tone = 'success', children }) {
    const tones = {
        success: 'border-ok/25 bg-ok/[0.08] text-[color:var(--ok-texto)]',
        error:   'border-peligro/25 bg-peligro/[0.07] text-[color:var(--peligro-texto)]',
        info:    'border-bronce-200 bg-bronce-50 text-bronce-800',
    };
    const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
    return (
        <div role="status" className={`mb-6 flex items-start gap-2.5 rounded-[12px] border px-4 py-3 text-sm font-medium ${tones[tone]}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" /> <span>{children}</span>
        </div>
    );
}

/** Casilla de verificación con el estilo de marca. */
export function AuthCheckbox({ id, checked, onChange, children }) {
    return (
        <label htmlFor={id} className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-gris-600">
            <input id={id} type="checkbox" checked={checked} onChange={onChange}
                className="h-[18px] w-[18px] rounded-md border-gris-300 text-carbon-900 focus:ring-bronce-400/40" />
            {children}
        </label>
    );
}

// Mismas reglas que valida el servidor (RegisteredUserController / NewPasswordController)
const REGLAS = [
    { label: '8 caracteres o más', test: (p) => p.length >= 8 },
    { label: 'Una mayúscula',      test: (p) => /[A-Z]/.test(p) },
    { label: 'Una minúscula',      test: (p) => /[a-z]/.test(p) },
    { label: 'Un número',          test: (p) => /[0-9]/.test(p) },
    { label: 'Un símbolo (#, !, @…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Medidor de seguridad de la contraseña con la lista de requisitos. */
export function PasswordStrength({ password }) {
    if (!password) return null;
    const ok = REGLAS.filter((r) => r.test(password)).length;
    const nivel = ok <= 2 ? { label: 'Débil', color: '#D13B3B' } : ok <= 4 ? { label: 'Casi lista', color: '#C8941F' } : { label: 'Segura', color: '#17A05A' };

    return (
        <div className="mt-3 rounded-[12px] border border-gris-200 bg-white p-3">
            <div className="flex items-center gap-3">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                    {REGLAS.map((_, i) => (
                        <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: i < ok ? nivel.color : '#E3E3DE' }} />
                    ))}
                </div>
                <span className="text-xs font-bold" style={{ color: nivel.color }}>{nivel.label}</span>
            </div>
            <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                {REGLAS.map((r) => {
                    const cumple = r.test(password);
                    return (
                        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${cumple ? 'text-[color:var(--ok-texto)]' : 'text-gris-500'}`}>
                            {cumple ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-3 w-3" />}
                            {r.label}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** Indicador de que ambas contraseñas coinciden. */
export function PasswordMatch({ password, confirmation }) {
    if (!password || !confirmation) return null;
    const igual = password === confirmation;
    return (
        <p className={`mt-1.5 flex items-center gap-1.5 text-[13px] font-medium ${igual ? 'text-[color:var(--ok-texto)]' : 'text-peligro'}`}>
            {igual ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <AlertCircle className="h-3.5 w-3.5" />}
            {igual ? 'Las contraseñas coinciden' : 'Las contraseñas todavía no coinciden'}
        </p>
    );
}

/** Enlace de texto con el color de marca. */
export const linkCls = 'font-semibold text-bronce-600 underline-offset-4 transition-colors hover:text-carbon-900 hover:underline';
