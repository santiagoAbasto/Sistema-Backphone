/**
 * Firma de quien hizo el sistema: el burro y el logotipo oficiales de Burrow Labs (vectores sin tocar,
 * public/assets/burrowlabs) en un solo enlace a su sitio, igual que en Ninth Group, Apple Boss y Summer's Style.
 * Los vectores son claros: va solo sobre fondo oscuro (panel de acceso y barra lateral).
 */
export default function CreditoBurrow({ className = '' }) {
    return (
        <a
            href="https://burrowlabs.com.bo/"
            target="_blank"
            rel="noopener"
            title="burrowlabs.com.bo"
            className={`inline-flex min-h-11 items-center gap-2.5 rounded-full px-3 text-[11px] uppercase tracking-[0.08em] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronce-400 ${className}`}
        >
            <img src="/assets/burrowlabs/mascot.svg" alt="" width={21} height={32} className="h-7 w-auto shrink-0" decoding="async" draggable={false} />
            <span>By</span>
            <img src="/assets/burrowlabs/wordmark.svg" alt="Burrow Labs" width={77} height={14} className="h-[13px] w-auto" decoding="async" draggable={false} />
        </a>
    );
}
