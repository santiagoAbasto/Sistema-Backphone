import './polyfills';
import '../css/app-vite.css';
import './bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'react-phone-number-input/style.css';
import 'flag-icons/css/flag-icons.min.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const nombreApp = import.meta.env.VITE_APP_NAME || 'Blackphone';

createInertiaApp({
    // Cada pantalla pone su propio título; la marca se agrega al final si falta.
    title: (title) => (!title ? nombreApp : title.includes(nombreApp) ? title : `${title} · ${nombreApp}`),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        // El bronce de la marca: la barra de carga también es identidad.
        color: '#C49A7C',
        delay: 150,
    },
});
