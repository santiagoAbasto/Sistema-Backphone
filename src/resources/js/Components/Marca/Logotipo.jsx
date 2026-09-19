import Isotipo from '@/Components/Marca/Isotipo';

/**
 * El logotipo completo: isotipo + palabra, en la tipografía de la marca.
 *
 * `nombre` permite que el sistema se venda con el nombre del negocio que lo compre
 * (Ajustes → Datos del negocio) sin tocar el código.
 */
export default function Logotipo({ nombre = 'Blackphone', insignia = null, className = '', compacto = false }) {
    return (
        <span className={`flex min-w-0 items-center gap-3 ${className}`}>
            <Isotipo className={compacto ? 'h-7 w-auto shrink-0' : 'h-9 w-auto shrink-0'} title={nombre} />
            <span className="min-w-0">
                <span
                    className={`block truncate font-marca font-bold uppercase leading-none tracking-[0.16em] ${compacto ? 'text-[15px]' : 'text-[18px]'}`}
                >
                    {nombre}
                </span>
                {insignia && (
                    <span className="mt-1.5 block text-[10px] font-semibold uppercase leading-none tracking-[0.22em] text-bronce-400">
                        {insignia}
                    </span>
                )}
            </span>
        </span>
    );
}
