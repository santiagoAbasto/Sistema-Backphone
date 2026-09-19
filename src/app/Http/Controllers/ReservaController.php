<?php

namespace App\Http\Controllers;

use App\Models\Celular;
use App\Models\Cliente;
use App\Models\Computadora;
use App\Models\ProductoApple;
use App\Models\ProductoGeneral;
use App\Models\Reserva;
use App\Models\ReservaItem;
use App\Services\GeneradorCodigos;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Illuminate\Support\Str;

class ReservaController extends Controller
{
    private function authorizeReservaAccess(Reserva $reserva): void
    {
        if (auth()->user()->rol === 'vendedor' && (int) $reserva->user_id !== (int) auth()->id()) {
            abort(404);
        }
    }

    private function productModelForType(string $tipo): ?string
    {
        return match ($tipo) {
            'celular' => Celular::class,
            'computadora' => Computadora::class,
            'producto_general' => ProductoGeneral::class,
            'producto_apple' => ProductoApple::class,
            default => null,
        };
    }

    private function productLabel($producto): string
    {
        return $producto->nombre
            ?? $producto->modelo
            ?? $producto->codigo
            ?? $producto->numero_serie
            ?? ('Producto #' . $producto->id);
    }

    private function activeReservationExists(string $tipo, int $productoId): bool
    {
        return ReservaItem::where('tipo', $tipo)
            ->where('producto_id', $productoId)
            ->whereHas('reserva', fn($q) => $q->where('estado', 'activa'))
            ->exists();
    }

    private function availableProductForReservation(string $tipo, int $productoId, int $index)
    {
        $modelo = $this->productModelForType($tipo);

        if (! $modelo) {
            throw ValidationException::withMessages(["items.$index.tipo" => 'Tipo de producto inválido.']);
        }

        $producto = $modelo::whereKey($productoId)
            ->where('estado', 'disponible')
            ->lockForUpdate()
            ->first();

        if (! $producto || $this->activeReservationExists($tipo, $productoId)) {
            throw ValidationException::withMessages([
                "items.$index.producto_id" => 'El producto seleccionado no existe o ya está vendido/reservado.',
            ]);
        }

        if ((float) ($producto->precio_venta ?? 0) <= 0) {
            throw ValidationException::withMessages([
                "items.$index.precio_venta" => 'El producto "' . $this->productLabel($producto) . '" no tiene precio de venta válido.',
            ]);
        }

        return $producto;
    }

    private function snapshotForItem(string $tipo, $producto): array
    {
        return match ($tipo) {
            'celular' => [
                'categoria' => 'celulares',
                'nombre_producto' => $producto->modelo,
                'modelo' => $producto->modelo,
                'capacidad' => $producto->capacidad,
                'color' => $producto->color,
                'bateria' => $producto->bateria,
            ],
            'computadora' => [
                'categoria' => 'computadoras',
                'nombre_producto' => $producto->nombre,
                'modelo' => $producto->nombre,
                'procesador' => $producto->procesador,
                'ram' => $producto->ram,
                'almacenamiento' => $producto->almacenamiento,
                'color' => $producto->color,
                'bateria' => $producto->bateria,
            ],
            'producto_apple' => [
                'categoria' => 'productos_apple',
                'nombre_producto' => $producto->modelo,
                'modelo' => $producto->modelo,
                'capacidad' => $producto->capacidad,
                'color' => $producto->color,
                'bateria' => $producto->bateria,
            ],
            default => [
                'categoria' => $producto->tipo ?? 'producto_general',
                'nombre_producto' => $producto->nombre,
            ],
        };
    }

    private function loadReservaForDocument(Reserva $reserva): Reserva
    {
        return $reserva->load([
            'items',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'vendedor',
            'venta',
        ]);
    }

    public function index()
    {
        $reservas = Reserva::with(['vendedor', 'venta', 'items'])
            ->when(auth()->user()->rol === 'vendedor', fn($q) => $q->where('user_id', auth()->id()))
            ->latest()
            ->get();

        return Inertia::render(auth()->user()->rol === 'admin' ? 'Admin/Reservas/Index' : 'Vendedor/Reservas/Index', [
            'reservas' => $reservas,
        ]);
    }

    public function create()
    {
        return Inertia::render(auth()->user()->rol === 'admin' ? 'Admin/Reservas/Create' : 'Vendedor/Reservas/Create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'nombre_cliente' => 'required|string|max:255',
            'telefono_cliente' => 'nullable|string|max:255',
            'monto_reserva' => 'required|numeric|min:0.01',
            'terminos_condiciones' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.tipo' => 'required|in:celular,computadora,producto_general,producto_apple',
            'items.*.producto_id' => 'required|integer',
            'items.*.cantidad' => 'required|integer|min:1',
            'items.*.descuento' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request) {
            $items = [];
            $subtotal = 0;

            foreach ($request->items as $index => $item) {
                $cantidad = max(1, (int) ($item['cantidad'] ?? 1));
                if ($cantidad > 1) {
                    throw ValidationException::withMessages(["items.$index.cantidad" => 'Solo se puede reservar una unidad por producto seleccionado.']);
                }

                $producto = $this->availableProductForReservation((string) $item['tipo'], (int) $item['producto_id'], $index);
                $descuento = max(0, (float) ($item['descuento'] ?? 0));
                $precioVenta = (float) $producto->precio_venta;

                if ($descuento > $precioVenta) {
                    throw ValidationException::withMessages(["items.$index.descuento" => 'El descuento no puede ser mayor al precio de venta.']);
                }

                $subtotalItem = ($precioVenta - $descuento) * $cantidad;
                $subtotal += $subtotalItem;
                $items[] = [
                    'tipo' => (string) $item['tipo'],
                    'producto_id' => (int) $producto->id,
                    'cantidad' => $cantidad,
                    'precio_venta' => $precioVenta,
                    'descuento' => $descuento,
                    'subtotal' => $subtotalItem,
                    'snapshot' => $this->snapshotForItem((string) $item['tipo'], $producto),
                ];
            }

            if ((float) $request->monto_reserva > $subtotal) {
                throw ValidationException::withMessages([
                    'monto_reserva' => 'El monto de la reserva no puede superar el total reservado.',
                ]);
            }

            $reserva = GeneradorCodigos::crearReservaConCodigo(function (string $codigoReserva) use ($request, $subtotal) {
                return Reserva::create([
                    'codigo_nota' => $codigoReserva,
                    'nombre_cliente' => $request->nombre_cliente,
                    'telefono_cliente' => $request->telefono_cliente,
                    'fecha' => now('America/La_Paz'),
                    'subtotal' => $subtotal,
                    'monto_reserva' => $request->monto_reserva,
                    'terminos_condiciones' => $request->terminos_condiciones,
                    'estado' => 'activa',
                    'user_id' => auth()->id(),
                ]);
            });

            foreach ($items as $item) {
                $reserva->items()->create(array_merge([
                    'tipo' => $item['tipo'],
                    'producto_id' => $item['producto_id'],
                    'cantidad' => $item['cantidad'],
                    'precio_venta' => $item['precio_venta'],
                    'descuento' => $item['descuento'],
                    'subtotal' => $item['subtotal'],
                ], $item['snapshot']));
            }

            if ($reserva->telefono_cliente) {
                Cliente::firstOrCreate(
                    ['telefono' => $reserva->telefono_cliente],
                    [
                        'user_id' => $reserva->user_id,
                        'nombre' => Str::title(trim($reserva->nombre_cliente)),
                        'correo' => null,
                        'documento' => null,
                    ]
                );
            }

            return response()->json([
                'message' => 'Reserva registrada con éxito',
                'reserva_id' => $reserva->id,
            ]);
        });
    }

    public function updateEstado(Request $request, Reserva $reserva)
    {
        $this->authorizeReservaAccess($reserva);

        $request->validate([
            'estado' => 'required|in:activa,cancelada,vencida',
        ]);

        if ($reserva->estado === 'vendida') {
            return back()->withErrors(['estado' => 'Una reserva vendida no puede cambiarse manualmente.']);
        }

        $reserva->update(['estado' => $request->estado]);

        return back()->with('success', 'Estado de reserva actualizado.');
    }

    public function activas()
    {
        $reservas = Reserva::with([
            'items',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
        ])
            ->where('estado', 'activa')
            ->when(auth()->user()->rol === 'vendedor', fn($q) => $q->where('user_id', auth()->id()))
            ->latest()
            ->get();

        // El costo y la procedencia de los equipos reservados no salen del servidor al vendedor.
        return response()->json(\App\Support\SinCostos::paraUsuario($reservas, auth()->user()));
    }

    public function boleta(Reserva $reserva)
    {
        $this->authorizeReservaAccess($reserva);
        $reserva = $this->loadReservaForDocument($reserva);

        return PDF::loadView('pdf.reserva', compact('reserva'))
            ->stream("boleta-reserva-{$reserva->id}.pdf");
    }

    public function boleta80(Reserva $reserva)
    {
        $this->authorizeReservaAccess($reserva);
        $reserva = $this->loadReservaForDocument($reserva);
        $pdf = Pdf::loadView('pdf.reserva_80mm', compact('reserva'));
        $pdf->setPaper([0, 0, 226.77, 650], 'portrait');

        return $pdf->stream("reserva-80mm-{$reserva->id}.pdf");
    }
}
