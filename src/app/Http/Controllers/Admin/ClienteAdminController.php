<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Cliente;
use App\Support\ActividadDelCliente;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class ClienteAdminController extends Controller
{
    /**
     * Muestra el listado completo de clientes.
     */
    public function index()
    {
        $clientes = Cliente::with('usuario:id,name')->latest()->get();

        return Inertia::render('Admin/Clientes/Index', [
            'clientes' => $clientes,
        ]);
    }

    /**
     * Devuelve sugerencias de clientes para autocompletar.
     */
    public function sugerencias(Request $request)
    {
        $term = $request->input('term');

        if (!$term || strlen($term) < 2) {
            return [];
        }

        return Cliente::where(function ($q) use ($term) {
            $q->whereRaw('LOWER(nombre) LIKE ?', [\App\Support\Busqueda::contiene($term)])
                ->orWhereRaw('LOWER(telefono) LIKE ?', [\App\Support\Busqueda::contiene($term)]);
        })
            ->select('id', 'nombre', 'telefono', 'correo')
            ->limit(8)
            ->get();
    }

    /**
     * Muestra el formulario de edición de un cliente.
     */
    public function edit(Cliente $cliente)
    {
        $cliente->load('usuario:id,name');

        return Inertia::render('Admin/Clientes/Edit', [
            'cliente' => $cliente,
            'actividad' => ActividadDelCliente::de($cliente),
        ]);
    }

    /**
     * Actualiza la información del cliente.
     */
    public function update(Request $request, Cliente $cliente)
    {
        $validated = $request->validate([
            'nombre'    => 'required|string|max:255',
            'telefono'  => 'required|string|min:7|max:20',
            'correo'    => 'nullable|email|max:255',
            'documento' => 'nullable|string|max:30',
        ], [
            'nombre.required'   => 'Escribe el nombre del cliente.',
            'telefono.required' => 'Escribe el teléfono del cliente.',
            'telefono.min'      => 'El teléfono parece incompleto.',
            'correo.email'      => 'Revisa el correo.',
        ]);

        $cliente->update($validated);

        return redirect()->route('admin.clientes.index')->with('success', 'Cliente actualizado correctamente.');
    }
}
