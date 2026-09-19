import { useId } from 'react';

/**
 * Isotipo de Blackphone: la «B» monograma con el corte diagonal de la marca.
 *
 * Va dibujado en el código (no es una imagen) para que se vea nítido en cualquier tamaño y tome
 * el color de donde esté montado: `currentColor` para el trazo pleno. El corte se recorta contra
 * la propia letra, así nunca se desborda por fuera del isotipo.
 *
 * Para usar el archivo oficial de la marca en vez de este trazado, dejarlo en
 * `public/images/marca/isotipo.svg` y cambiar este componente por un <img>.
 */
export default function Isotipo({ className = 'h-9 w-auto', title = 'Blackphone', corte = true }) {
    const uid = useId().replace(/:/g, '');
    const recorte = `recorte-${uid}`;

    // La silueta de la B, con las esquinas cortadas en diagonal.
    const letra = 'M6 0h32l14 14v10l-7 7 9 9v12L40 72H6V0Zm15 14v16h14l6-6v-4l-6-6H21Zm0 28v16h16l6-6v-4l-6-6H21Z';

    return (
        <svg
            viewBox="0 0 64 72"
            className={className}
            role={title ? 'img' : 'presentation'}
            aria-label={title || undefined}
            aria-hidden={title ? undefined : 'true'}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <clipPath id={recorte}>
                <path d={letra} clipRule="evenodd" />
            </clipPath>

            <path d={letra} fillRule="evenodd" clipRule="evenodd" fill="currentColor" />

            {/* El corte diagonal: solo se ve dentro de la letra */}
            {corte && (
                <g clipPath={`url(#${recorte})`}>
                    <path d="M44 -8h12L26 80H14L44 -8Z" fill="var(--bronce-400, #C49A7C)" />
                </g>
            )}
        </svg>
    );
}
