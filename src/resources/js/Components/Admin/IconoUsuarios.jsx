/**
 * El ícono del módulo «Usuarios y roles», dibujado para este panel.
 *
 * No es una silueta más: son dos personas (el equipo) y, delante, la credencial con la banda del rol y el visto de
 * permiso concedido. Se dibuja con el trazo de los íconos de lucide (24 de caja, 1,8 de grosor, puntas redondeadas)
 * para que conviva con el resto del menú, y usa `currentColor`, así toma el color del estado activo.
 */
export default function IconoUsuarios({ className = 'h-5 w-5', title, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
      {...props}
    >
      {title && <title>{title}</title>}

      {/* La persona de atrás: el equipo, insinuado con media cabeza */}
      <path d="M14.4 4.5a2.6 2.6 0 0 1 0 5" opacity="0.5" />

      {/* La persona de adelante */}
      <circle cx="8.6" cy="7" r="3.2" />
      <path d="M2.8 18a5.8 5.8 0 0 1 8.7-5" />

      {/* La credencial del rol: la banda y el visto del permiso */}
      <rect x="13.8" y="14.3" width="7.4" height="5.9" rx="1.4" />
      <path d="M13.8 16.5h7.4" />
      <path d="M16 18.2l1.1 1.1 2.3-2.3" />

    </svg>
  );
}
