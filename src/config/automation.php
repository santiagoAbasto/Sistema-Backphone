<?php

return [
    /*
    | Token que usa n8n para las tareas normales (test, top-products, reports).
    | Se puede rotar SIN cortar n8n: poné el token nuevo acá y el viejo en
    | AUTOMATION_TOKENS_PREVIOS (separados por coma) hasta que n8n quede actualizado.
    */
    'token'          => env('AUTOMATION_TOKEN'),
    'tokens_previos' => env('AUTOMATION_TOKENS_PREVIOS', ''),

    /*
    | Token APARTE, solo para el export financiero (/api/automation/reportes/exportar),
    | que devuelve costo y ganancia de toda la tienda. n8n NO lo usa.
    | Vacío (por defecto) = ese endpoint queda CERRADO por el canal de automatización.
    | El admin sigue exportando desde el panel (ruta web con sesión), sin este token.
    */
    'export_token'   => env('AUTOMATION_EXPORT_TOKEN', ''),
];
