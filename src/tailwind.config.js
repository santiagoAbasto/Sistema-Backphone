import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import aspectRatio from '@tailwindcss/aspect-ratio';

/**
 * Blackphone — configuración de Tailwind.
 *
 * Los colores apuntan a las variables de `resources/css/tokens.css`: ahí se cambia
 * la identidad una sola vez y toda la interfaz la sigue. `<alpha-value>` deja que
 * las utilidades con transparencia (bg-acento/10) sigan funcionando.
 */
const conVariable = (nombre) => `rgb(var(${nombre}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans:  ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
                marca: ['"Chakra Petch"', 'Inter', 'system-ui', 'sans-serif'],
                cifra: ['"IBM Plex Mono"', 'ui-monospace', 'SF Mono', 'monospace'],
            },

            colors: {
                // El bronce de la marca
                bronce: {
                    50:  '#FAF6F2',
                    100: '#F3E8DD',
                    200: '#E6D0BC',
                    300: '#D5B396',
                    400: '#C49A7C',
                    500: '#B0846A',
                    600: '#96684F',
                    700: '#79523E',
                    800: '#5A3D2E',
                    900: '#3B2820',
                },
                // El negro del armazón
                carbon: {
                    500: '#4A4A53',
                    600: '#36363D',
                    700: '#26262B',
                    800: '#1D1D21',
                    850: '#171719',
                    900: '#121214',
                    950: '#0A0A0B',
                },
                // Neutros cálidos del contenido
                gris: {
                    25:  '#FCFCFB',
                    50:  '#F7F7F5',
                    100: '#F0F0ED',
                    200: '#E3E3DE',
                    300: '#CDCDC6',
                    400: '#A3A39B',
                    500: '#7B7B73',
                    600: '#5C5C56',
                    700: '#44443F',
                    800: '#2E2E2A',
                    900: '#1B1B19',
                },
                // El acento del panel donde esté montada la pieza
                acento: conVariable('--acento-rgb'),

                ok:      '#17A05A',
                aviso:   '#C8941F',
                peligro: '#D13B3B',
                info:    '#3A72B8',
            },

            borderRadius: {
                DEFAULT: 'var(--radio-md)',
                card:    'var(--radio-lg)',
            },

            boxShadow: {
                sutil:    'var(--sombra-sutil)',
                tarjeta:  'var(--sombra-tarjeta)',
                alzada:   'var(--sombra-alzada)',
                flotante: 'var(--sombra-flotante)',
            },

            transitionTimingFunction: {
                salida: 'cubic-bezier(0.22, 1, 0.36, 1)',
                suave:  'cubic-bezier(0.65, 0, 0.35, 1)',
                cajon:  'cubic-bezier(0.32, 0.72, 0, 1)',
            },

            keyframes: {
                aparecer: {
                    '0%':   { opacity: 0 },
                    '100%': { opacity: 1 },
                },
                subir: {
                    '0%':   { transform: 'translateY(8px)', opacity: 0 },
                    '100%': { transform: 'translateY(0)', opacity: 1 },
                },
            },

            animation: {
                aparecer: 'aparecer var(--dur-ui) cubic-bezier(0.22, 1, 0.36, 1) both',
                subir:    'subir var(--dur-panel) cubic-bezier(0.22, 1, 0.36, 1) both',
            },
        },
    },

    plugins: [forms, typography, aspectRatio],
};
