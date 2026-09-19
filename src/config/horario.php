<?php

return [
    /*
    | Horario laboral del vendedor. Fuera de estas ventanas, un vendedor NO puede iniciar sesión.
    | El admin no tiene restricción. La hora se evalúa en la zona horaria de la tienda.
    */
    'timezone' => env('APP_TIMEZONE', 'America/La_Paz'),

    // Ventanas [inicio, fin) en formato HH:MM. Por defecto: mañana y tarde con corte de mediodía.
    'ventanas' => [
        ['09:00', '13:00'],
        ['14:00', '19:00'],
    ],

    // Días permitidos (ISO: 1=lunes … 7=domingo). Por defecto todos; ajustá si no se trabaja fin de semana.
    'dias' => [1, 2, 3, 4, 5, 6, 7],
];
