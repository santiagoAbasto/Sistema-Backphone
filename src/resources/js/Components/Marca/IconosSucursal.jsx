/**
 * Íconos de sucursal, dibujados en la geometría de la marca: trazo de 1.5, esquinas cortadas
 * en diagonal y el bronce solo donde hay que mirar.
 *
 * Van en el código (no como imágenes) para que tomen el color de donde estén montados
 * (`currentColor`) y se vean nítidos en cualquier tamaño.
 */

/** Local comercial: el toldo, la vidriera y la puerta. Es el ícono general de «sucursal». */
export function IconoLocal({ className = 'h-5 w-5', strokeWidth = 1.5 }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
            strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Toldo */}
            <path d="M3.5 7.5 5 3.5h14l1.5 4" />
            <path d="M3.5 7.5v1.2a2.4 2.4 0 0 0 4.25 1.52 2.4 2.4 0 0 0 4.25 0 2.4 2.4 0 0 0 4.25 0 2.4 2.4 0 0 0 4.25-1.52V7.5" />
            {/* Cuerpo del local */}
            <path d="M5 11.6V20.5h14v-8.9" />
            {/* Puerta */}
            <path d="M10 20.5v-5h4v5" />
        </svg>
    );
}

/** Varias sucursales a la vez: dos volúmenes, uno delante del otro. */
export function IconoRed({ className = 'h-5 w-5', strokeWidth = 1.5 }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
            strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 20.5V9.2l5.5-3.7 5.5 3.7V20.5" />
            <path d="M14 11.5l3.5-2.3L21 11.5v9" />
            <path d="M3 20.5h18" />
            <path d="M6.5 20.5v-3.2h4v3.2" />
            <path d="M6.6 12.4h3.8" />
            <path d="M17 14.6h1.5" />
            <path d="M17 17.4h1.5" />
        </svg>
    );
}

/** Chincheta de ubicación, para la ciudad de la sucursal. */
export function IconoUbicacion({ className = 'h-5 w-5', strokeWidth = 1.5 }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
            strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
            <circle cx="12" cy="10.2" r="2.6" />
        </svg>
    );
}

/**
 * Ilustración para el estado vacío de Sucursales: dos locales y el camino entre ellos.
 * Usa las variables de la marca, así que acompaña el tema sin tocar nada.
 */
export function IlustracionSucursales({ className = 'h-40 w-auto' }) {
    return (
        <svg viewBox="0 0 320 160" className={className} fill="none" aria-hidden="true">
            {/* Piso */}
            <path d="M18 138h284" stroke="var(--borde-medio)" strokeWidth="1.5" strokeLinecap="round" />

            {/* Camino entre las dos: lo que las conecta */}
            <path d="M104 118c22 14 90 14 112 0" stroke="var(--bronce-300)" strokeWidth="1.5"
                strokeLinecap="round" strokeDasharray="4 6" />

            {/* Local de la izquierda */}
            <g stroke="var(--gris-400)" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M44 138V74l30-18 30 18v64" fill="var(--superficie)" />
                <path d="M58 138v-22h18v22" fill="var(--superficie-tenue)" />
                <path d="M84 88h12" />
                <path d="M84 100h12" />
            </g>
            <path d="M44 74l30-18 30 18" stroke="var(--bronce-400)" strokeWidth="2" strokeLinejoin="round" fill="none" />

            {/* Local de la derecha */}
            <g stroke="var(--gris-400)" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M216 138V86l26-16 26 16v52" fill="var(--superficie)" />
                <path d="M230 138v-19h15v19" fill="var(--superficie-tenue)" />
                <path d="M250 98h10" />
            </g>
            <path d="M216 86l26-16 26 16" stroke="var(--bronce-400)" strokeWidth="2" strokeLinejoin="round" fill="none" />

            {/* Chincheta arriba: la marca de que son lugares distintos */}
            <g transform="translate(150 22)">
                <path d="M10 40s10-8.2 10-16a10 10 0 1 0-20 0c0 7.8 10 16 10 16Z"
                    fill="var(--bronce-400)" />
                <circle cx="10" cy="23.4" r="3.6" fill="var(--carbon-900)" />
            </g>
        </svg>
    );
}
