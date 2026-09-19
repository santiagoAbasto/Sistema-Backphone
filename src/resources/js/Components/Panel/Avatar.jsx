/**
 * El avatar de una cuenta: su foto, o sus iniciales mientras no haya subido ninguna.
 *
 * Es la misma pieza en el encabezado, en el menú de la cuenta y en Mi perfil, así el avatar
 * se ve igual en todo el panel.
 */
const TAMANOS = {
    sm: { caja: 'h-9 w-9 rounded-[10px]', texto: 'text-[13px]' },
    md: { caja: 'h-12 w-12 rounded-[12px]', texto: 'text-[16px]' },
    lg: { caja: 'h-20 w-20 rounded-[16px]', texto: 'text-[26px]' },
    xl: { caja: 'h-28 w-28 rounded-[20px]', texto: 'text-[34px]' },
};

export default function Avatar({ foto, iniciales = 'U', nombre = '', tamano = 'sm', className = '' }) {
    const t = TAMANOS[tamano] ?? TAMANOS.sm;

    if (foto) {
        return (
            <img
                src={foto}
                alt={nombre ? `Foto de ${nombre}` : ''}
                className={`${t.caja} shrink-0 object-cover ${className}`}
                loading="lazy"
                decoding="async"
            />
        );
    }

    return (
        <span
            aria-hidden={nombre ? undefined : 'true'}
            title={nombre || undefined}
            className={`${t.caja} ${t.texto} grid shrink-0 place-items-center bg-carbon-900 font-marca font-bold text-bronce-400 ${className}`}
        >
            {iniciales}
        </span>
    );
}
