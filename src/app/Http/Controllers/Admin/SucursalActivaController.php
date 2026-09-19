<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\SucursalActiva;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * El selector de sucursal del encabezado.
 *
 * Solo hace efecto en quien puede elegir (super administrador). A quien tiene una sucursal
 * asignada, `SucursalActiva::elegir()` lo ignora: no hay forma de mirar otra escribiendo la
 * petición a mano.
 */
class SucursalActivaController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            // `null` es «Todas las sucursales»
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursales,id'],
        ]);

        SucursalActiva::elegir($datos['sucursal_id'] ?? null);

        return back();
    }
}
