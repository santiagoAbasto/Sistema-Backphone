<?php

// Mensajes en español (Bolivia). Las reglas que no están aquí usan el texto en inglés por defecto.
return [
    'required'         => 'Completa el campo :attribute.',
    'email'            => 'Escribe un correo electrónico válido.',
    'confirmed'        => 'Las contraseñas no coinciden.',
    'current_password' => 'La contraseña no es correcta.',
    'lowercase'        => 'El campo :attribute debe estar en minúsculas.',
    'string'           => 'El campo :attribute no es válido.',
    'unique'           => 'Ese :attribute ya está registrado.',
    'regex'            => 'El formato de :attribute no es válido.',
    'min'              => ['string' => 'El campo :attribute debe tener al menos :min caracteres.', 'numeric' => 'El campo :attribute debe ser al menos :min.'],
    'max'              => ['string' => 'El campo :attribute no puede tener más de :max caracteres.', 'numeric' => 'El campo :attribute no puede ser mayor que :max.'],
    'password' => [
        'letters'       => 'La contraseña debe incluir al menos una letra.',
        'mixed'         => 'La contraseña debe incluir mayúsculas y minúsculas.',
        'numbers'       => 'La contraseña debe incluir al menos un número.',
        'symbols'       => 'La contraseña debe incluir al menos un símbolo.',
        'uncompromised' => 'Esta contraseña apareció en filtraciones públicas. Elige otra.',
    ],
    'attributes' => [
        'name'                  => 'nombre',
        'email'                 => 'correo',
        'password'              => 'contraseña',
        'password_confirmation' => 'confirmación de contraseña',
    ],
];
