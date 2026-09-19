<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConfiguracionNegocio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ajustes → Datos del negocio.
 *
 * Un solo formulario con la identidad comercial: lo que se guarda acá es lo que sale impreso en boletas,
 * cotizaciones y reportes, y lo que el panel muestra en su encabezado.
 */
class ConfiguracionNegocioController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('Admin/Configuracion/Negocio', [
            'valores' => ConfiguracionNegocio::todas(),
            'grupos'  => ConfiguracionNegocio::GRUPOS,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'negocio_nombre'    => ['required', 'string', 'max:120'],
            'negocio_eslogan'   => ['nullable', 'string', 'max:160'],
            'negocio_nit'       => ['nullable', 'string', 'max:40'],
            'negocio_telefono'  => ['nullable', 'string', 'max:40'],
            'negocio_whatsapp'  => ['nullable', 'string', 'max:40'],
            'negocio_email'     => ['nullable', 'email', 'max:160'],
            'negocio_direccion' => ['nullable', 'string', 'max:200'],
            'negocio_ciudad'    => ['nullable', 'string', 'max:100'],
            'negocio_pais'      => ['nullable', 'string', 'max:100'],
            'negocio_horario'   => ['nullable', 'string', 'max:160'],
            'moneda_simbolo'    => ['required', 'string', 'max:6'],
        ], [
            'negocio_nombre.required' => 'El negocio necesita un nombre: es el que sale en cada comprobante.',
            'moneda_simbolo.required' => 'Indica con qué símbolo se muestran los montos (por ejemplo, Bs).',
            'negocio_email.email'     => 'Ese correo no tiene un formato válido.',
        ]);

        ConfiguracionNegocio::guardar($datos);

        return back()->with('success', 'Datos del negocio guardados.');
    }
}
