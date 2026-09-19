<?php

namespace App\Http\Controllers\Vendedor;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Support\ActividadDelCliente;
use App\Support\Busqueda;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Mis clientes: los que registró este vendedor.
 *
 * Es la misma pantalla del administrador (Components/Panel/ClientesIndex) pero con su propia lista:
 * el vendedor no ve ni edita clientes de otra persona, y los movimientos de la ficha son solo los suyos.
 */
class ClienteVendedorController extends Controller
{
    public function index()
    {
        return Inertia::render('Vendedor/Clientes/Index', [
            'clientes' => Cliente::where('user_id', Auth::id())
                ->with('usuario:id,name')
                ->latest()
                ->get(),
        ]);
    }

    /** Sugerencias para autocompletar en ventas, reservas y servicio técnico. */
    public function sugerencias(Request $request)
    {
        $term = trim((string) $request->input('term'));

        if (mb_strlen($term) < 2) {
            return [];
        }

        return Cliente::where('user_id', Auth::id())
            ->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(nombre) LIKE ?', [Busqueda::contiene($term)])
                    ->orWhereRaw('LOWER(telefono) LIKE ?', [Busqueda::contiene($term)]);
            })
            ->select('id', 'nombre', 'telefono', 'correo')
            ->limit(8)
            ->get();
    }

    public function edit($id)
    {
        $cliente = Cliente::where('user_id', Auth::id())->with('usuario:id,name')->findOrFail($id);

        return Inertia::render('Vendedor/Clientes/Edit', [
            'cliente'   => $cliente,
            'actividad' => ActividadDelCliente::de($cliente, 'vendedor', Auth::id()),
        ]);
    }

    public function update(Request $request, $id)
    {
        $cliente = Cliente::where('user_id', Auth::id())->findOrFail($id);

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

        return redirect()->route('vendedor.clientes.index')->with('success', 'Cliente actualizado correctamente.');
    }
}
