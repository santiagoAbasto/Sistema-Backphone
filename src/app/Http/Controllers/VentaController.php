<?php

namespace App\Http\Controllers;

use App\Models\Venta;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\MovimientoPieza;
use App\Models\Pieza;
use App\Models\ProductoGeneral;
use App\Services\StockDePiezas;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\VentaItem;
use App\Models\ProductoApple;
use App\Models\Cliente;
use Illuminate\Support\Str;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\ServicioTecnico;
use App\Services\GeneradorCodigos;
use Illuminate\Support\Facades\DB;
use App\Models\SystemNotification;
use App\Models\Reserva;
use App\Models\ReservaItem;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use App\Support\Busqueda;
use App\Support\SinCostos;



class VentaController extends Controller
{
    private function authorizeVentaAccess(Venta $venta): void
    {
        if (auth()->user()->rol === 'vendedor' && (int) $venta->user_id !== (int) auth()->id()) {
            abort(404);
        }
    }

    private function authorizeReservaAccess(Reserva $reserva): void
    {
        if (auth()->user()->rol === 'vendedor' && (int) $reserva->user_id !== (int) auth()->id()) {
            abort(404);
        }
    }

    private function productModelForSaleType(string $tipo): ?string
    {
        return match ($tipo) {
            'celular' => Celular::class,
            'computadora' => Computadora::class,
            'producto_general' => ProductoGeneral::class,
            'producto_apple' => ProductoApple::class,
            'pieza' => Pieza::class,
            default => null,
        };
    }

    /**
     * Los tipos que se venden de a una unidad por registro.
     *
     * Las piezas quedan fuera a propósito: son un saldo («quedan 6 pantallas»), así que una misma
     * línea puede llevar tres. Todo lo demás es un equipo concreto, con su IMEI o su serie.
     */
    private function esPorCantidad(string $tipo): bool
    {
        return $tipo === 'pieza';
    }

    private function productLabelForSale($producto): string
    {
        return $producto->nombre
            ?? $producto->modelo
            ?? $producto->codigo
            ?? $producto->numero_serie
            ?? ('Producto #' . $producto->id);
    }

    private function activeReservationExistsForProduct(string $tipo, int $productoId, ?Reserva $allowedReserva = null): bool
    {
        return ReservaItem::where('tipo', $tipo)
            ->where('producto_id', $productoId)
            ->whereHas('reserva', function ($q) use ($allowedReserva) {
                $q->where('estado', 'activa');
                if ($allowedReserva) {
                    $q->where('id', '!=', $allowedReserva->id);
                }
            })
            ->exists();
    }

    private function reservationItemsPayload(Reserva $reserva): array
    {
        return $reserva->items->map(fn($item) => [
            'tipo' => $item->tipo,
            'producto_id' => $item->producto_id,
            'cantidad' => $item->cantidad,
            'descuento' => $item->descuento,
        ])->all();
    }

    private function mergeSaleItemsWithReservation(array $items, Reserva $reserva): array
    {
        $reservedItems = collect($this->reservationItemsPayload($reserva));
        $reservedKeys = $reservedItems
            ->mapWithKeys(fn($item) => [$item['tipo'] . ':' . $item['producto_id'] => true]);

        $reservedSingleUnitTypes = $reservedItems
            ->pluck('tipo')
            ->filter(fn($tipo) => in_array($tipo, ['celular', 'computadora', 'producto_apple'], true))
            ->unique()
            ->values();

        $additionalItems = collect($items)
            ->filter(function ($item) use ($reservedKeys, $reservedSingleUnitTypes) {
                $tipo = (string) ($item['tipo'] ?? '');
                $productoId = (int) ($item['producto_id'] ?? 0);
                $key = $tipo . ':' . $productoId;

                if ($reservedKeys->has($key)) {
                    return false;
                }

                if ($reservedSingleUnitTypes->contains($tipo)) {
                    return false;
                }

                return $tipo !== '' && $productoId > 0;
            })
            ->values();

        return $reservedItems
            ->concat($additionalItems)
            ->values()
            ->all();
    }

    private function getAvailableProductForSale(string $tipo, int $productoId, int $index, ?Reserva $reserva = null)
    {
        $modelo = $this->productModelForSaleType($tipo);

        if (! $modelo) {
            throw ValidationException::withMessages([
                "items.$index.tipo" => 'Tipo de producto inválido.',
            ]);
        }

        if ($this->esPorCantidad($tipo)) {
            return $this->getAvailablePieceForSale($productoId, $index);
        }

        $producto = $modelo::whereKey($productoId)
            ->where('estado', 'disponible')
            ->lockForUpdate()
            ->first();

        if (! $producto || $this->activeReservationExistsForProduct($tipo, $productoId, $reserva)) {
            throw ValidationException::withMessages([
                "items.$index.producto_id" => 'El producto seleccionado no existe o ya no está disponible.',
            ]);
        }

        if ((float) ($producto->precio_venta ?? 0) <= 0) {
            throw ValidationException::withMessages([
                "items.$index.precio_venta" => 'El producto "' . $this->productLabelForSale($producto) . '" no tiene precio de venta válido.',
            ]);
        }

        if ((float) ($producto->precio_costo ?? 0) < 0) {
            throw ValidationException::withMessages([
                "items.$index.precio_invertido" => 'El producto "' . $this->productLabelForSale($producto) . '" tiene costo inválido.',
            ]);
        }

        return $producto;
    }

    /** La pieza queda bloqueada hasta el final de la transacción: dos ventas a la vez no pueden llevarse la misma última unidad. */
    private function getAvailablePieceForSale(int $piezaId, int $index): Pieza
    {
        $pieza = StockDePiezas::bloquear($piezaId);

        if (! $pieza || ! $pieza->activa) {
            throw ValidationException::withMessages([
                "items.$index.producto_id" => 'La pieza seleccionada ya no está en el inventario.',
            ]);
        }

        if ((float) $pieza->precio_venta <= 0) {
            throw ValidationException::withMessages([
                "items.$index.precio_venta" => 'La pieza «' . $pieza->nombre . '» no tiene precio de venta.',
            ]);
        }

        return $pieza;
    }

    private function productsForSaleEdit(Venta $venta, string $tipo)
    {
        // Las piezas no tienen estado ni reserva: se ofrecen las activas con saldo, más las que ya
        // están en esta venta (si no, al editar desaparecería la línea de una pieza agotada).
        if ($this->esPorCantidad($tipo)) {
            $enLaVenta = $venta->items->where('tipo', $tipo)->pluck('producto_id')->filter()->unique();

            return Pieza::query()
                ->where(fn ($q) => $q->disponibles()->orWhereIn('id', $enLaVenta))
                ->orderBy('nombre')
                ->get();
        }

        $modelo = $this->productModelForSaleType($tipo);
        if (! $modelo) {
            return collect();
        }

        $currentIds = $venta->items
            ->where('tipo', $tipo)
            ->pluck('producto_id')
            ->filter()
            ->unique()
            ->values();

        $reservedIds = ReservaItem::where('tipo', $tipo)
            ->whereHas('reserva', fn($q) => $q->where('estado', 'activa'))
            ->pluck('producto_id');

        $query = $modelo::query()
            ->where(function ($q) use ($currentIds, $reservedIds) {
                $q->where(function ($available) use ($reservedIds) {
                    $available->where('estado', 'disponible')
                        ->whereNotIn('id', $reservedIds);
                });

                if ($currentIds->isNotEmpty()) {
                    $q->orWhereIn('id', $currentIds);
                }
            });

        if ($tipo === 'celular') {
            return $query->ordenInventarioIphone()->get();
        }

        $orderColumn = match ($tipo) {
            'computadora' => 'nombre',
            'producto_general' => 'nombre',
            'producto_apple' => 'modelo',
            default => 'id',
        };

        return $query
            ->orderByRaw("CASE estado WHEN 'disponible' THEN 0 ELSE 1 END")
            ->orderBy($orderColumn)
            ->get();
    }

    private function getProductForSaleItemEdit(string $tipo, int $productoId, int $index, ?VentaItem $currentItem = null)
    {
        $modelo = $this->productModelForSaleType($tipo);

        if (! $modelo) {
            throw ValidationException::withMessages([
                "items.$index.tipo" => 'Tipo de producto inválido.',
            ]);
        }

        $producto = $modelo::whereKey($productoId)->lockForUpdate()->first();
        $sameProduct = $currentItem
            && $currentItem->tipo === $tipo
            && (int) $currentItem->producto_id === $productoId;

        if (! $producto) {
            throw ValidationException::withMessages([
                "items.$index.producto_id" => 'El producto seleccionado no existe.',
            ]);
        }

        if (! $sameProduct && ! $this->esPorCantidad($tipo)) {
            if ($producto->estado !== 'disponible' || $this->activeReservationExistsForProduct($tipo, $productoId)) {
                throw ValidationException::withMessages([
                    "items.$index.producto_id" => 'El producto seleccionado ya no está disponible.',
                ]);
            }
        }

        return [$producto, $sameProduct];
    }

    private function releasePreviousSaleItemProduct(VentaItem $item, ?Venta $venta = null): void
    {
        if (! $item->tipo || ! $item->producto_id) {
            return;
        }

        // Una pieza no se «libera»: las unidades que había sacado vuelven al saldo.
        if ($this->esPorCantidad($item->tipo)) {
            if ($pieza = StockDePiezas::bloquear((int) $item->producto_id)) {
                StockDePiezas::devolver(
                    $pieza,
                    (int) $item->cantidad,
                    MovimientoPieza::DEVOLUCION,
                    $venta,
                    'Se quitó de la venta ' . ($venta?->codigo_nota ?? '') ,
                );
            }

            return;
        }

        $modelo = $this->productModelForSaleType($item->tipo);
        if (! $modelo) {
            return;
        }

        $stillUsed = VentaItem::where('tipo', $item->tipo)
            ->where('producto_id', $item->producto_id)
            ->where('id', '!=', $item->id)
            ->exists();

        if ($stillUsed) {
            return;
        }

        $producto = $modelo::whereKey($item->producto_id)->lockForUpdate()->first();
        if ($producto && $producto->estado === 'vendido') {
            $producto->estado = 'disponible';
            $producto->save();
        }
    }

    /**
     * El saldo de una pieza cuando se edita la línea de una venta.
     *
     * Si cambió la pieza, vuelve entero lo que había salido y sale lo nuevo. Si es la misma, se
     * mueve solo la diferencia: pasar de 2 a 3 saca una unidad, no tres.
     */
    private function ajustarStockDePieza(VentaItem $item, Pieza $pieza, int $cantidad, Venta $venta, bool $mismaPieza): void
    {
        $motivo = 'Venta ' . ($venta->codigo_nota ?? '#' . $venta->id) . ' (editada)';

        if (! $mismaPieza) {
            $this->releasePreviousSaleItemProduct($item, $venta);
            StockDePiezas::descontar($pieza, $cantidad, MovimientoPieza::VENTA, $venta, $motivo);

            return;
        }

        $diferencia = $cantidad - (int) $item->cantidad;

        if ($diferencia > 0) {
            StockDePiezas::descontar($pieza, $diferencia, MovimientoPieza::VENTA, $venta, $motivo);
        } elseif ($diferencia < 0) {
            StockDePiezas::devolver($pieza, -$diferencia, MovimientoPieza::DEVOLUCION, $venta, $motivo);
        }
    }

    private function buildValidatedSaleItems(array $items, ?Reserva $reserva = null): array
    {
        $validated = [];

        foreach ($items as $index => $item) {
            $tipo = (string) ($item['tipo'] ?? '');
            $cantidad = max(1, (int) ($item['cantidad'] ?? 1));
            $descuento = max(0, (float) ($item['descuento'] ?? 0));
            $producto = $this->getAvailableProductForSale($tipo, (int) ($item['producto_id'] ?? 0), $index, $reserva);

            if ($cantidad > 1 && ! $this->esPorCantidad($tipo)) {
                throw ValidationException::withMessages([
                    "items.$index.cantidad" => 'Solo se puede vender una unidad por producto seleccionado.',
                ]);
            }

            if ($this->esPorCantidad($tipo) && $producto->cantidad < $cantidad) {
                throw ValidationException::withMessages([
                    "items.$index.cantidad" => 'De «' . $producto->nombre . '» quedan ' . $producto->cantidad
                        . ' y se están pidiendo ' . $cantidad . '.',
                ]);
            }

            $precioVenta = (float) $producto->precio_venta;
            $precioCosto = (float) ($producto->precio_costo ?? 0);

            if ($descuento > $precioVenta) {
                throw ValidationException::withMessages([
                    "items.$index.descuento" => 'El descuento no puede ser mayor al precio de venta.',
                ]);
            }

            $validated[] = [
                'tipo' => $tipo,
                'producto_id' => (int) $producto->id,
                'cantidad' => $cantidad,
                'precio_venta' => $precioVenta,
                'precio_invertido' => $precioCosto * $cantidad,
                'descuento' => $descuento,
                'subtotal' => ($precioVenta - $descuento) * $cantidad,
                'producto' => $producto,
            ];
        }

        return $validated;
    }

    private function snapshotForSaleItem(string $tipo, $producto): array
    {
        $snapshot = [
            'categoria' => null,
            'nombre_producto' => null,
            'modelo' => null,
            'capacidad' => null,
            'color' => null,
            'bateria' => null,
            'procesador' => null,
            'ram' => null,
            'almacenamiento' => null,
        ];

        switch ($tipo) {
            case 'celular':
                $snapshot['categoria'] = 'celulares';
                $snapshot['nombre_producto'] = $producto->modelo;
                $snapshot['modelo'] = $producto->modelo;
                $snapshot['capacidad'] = $producto->capacidad;
                $snapshot['color'] = $producto->color;
                $snapshot['bateria'] = $producto->bateria;
                break;

            case 'computadora':
                $snapshot['categoria'] = 'computadoras';
                $snapshot['nombre_producto'] = $producto->nombre;
                $snapshot['modelo'] = $producto->nombre;
                $snapshot['procesador'] = $producto->procesador;
                $snapshot['ram'] = $producto->ram;
                $snapshot['almacenamiento'] = $producto->almacenamiento;
                break;

            case 'producto_general':
                $snapshot['categoria'] = $producto->tipo;
                $snapshot['nombre_producto'] = $producto->nombre;
                break;

            case 'pieza':
                // El nombre y la compatibilidad se copian a la venta: si mañana se corrige la ficha
                // de la pieza, la nota ya emitida sigue diciendo lo que se vendió ese día.
                $snapshot['categoria'] = 'piezas';
                $snapshot['nombre_producto'] = $producto->nombre;
                $snapshot['modelo'] = $producto->compatibilidad;
                break;

            case 'producto_apple':
                $snapshot['categoria'] = 'productos_apple';
                $snapshot['nombre_producto'] = $producto->modelo;
                $snapshot['modelo'] = $producto->modelo;
                $snapshot['capacidad'] = $producto->capacidad;
                $snapshot['color'] = $producto->color;
                $snapshot['bateria'] = $producto->bateria;
                break;
        }

        return $snapshot;
    }

    private function createVentaItemFromValidated(Venta $venta, array $item): VentaItem
    {
        return $venta->items()->create(array_merge([
            'tipo' => $item['tipo'],
            'producto_id' => $item['producto_id'],
            'cantidad' => $item['cantidad'],
            'precio_venta' => $item['precio_venta'],
            'precio_invertido' => $item['precio_invertido'],
            'descuento' => $item['descuento'],
            'subtotal' => $item['subtotal'],
        ], $this->snapshotForSaleItem($item['tipo'], $item['producto'])));
    }

    private function ventaEditSnapshot(Venta $venta): array
    {
        $venta->loadMissing(['items', 'servicioTecnico']);

        return [
            'cliente' => $venta->nombre_cliente,
            'telefono' => $venta->telefono_cliente,
            'metodo_pago' => $venta->metodo_pago,
            'tarjeta' => $venta->metodo_pago === 'tarjeta'
                ? trim(($venta->inicio_tarjeta ?? '----') . '...' . ($venta->fin_tarjeta ?? '----'))
                : null,
            'descuento' => (float) ($venta->descuento ?? 0),
            'valor_permuta' => (float) ($venta->valor_permuta ?? 0),
            'subtotal' => (float) ($venta->subtotal ?? 0),
            'capital' => (float) ($venta->precio_invertido ?? 0),
            'ganancia' => (float) ($venta->ganancia_neta ?? 0),
            'notas' => $venta->notas_adicionales,
            'servicio' => $venta->servicioTecnico ? [
                'equipo' => $venta->servicioTecnico->equipo,
                'detalle' => $venta->servicioTecnico->detalle_servicio,
                'tecnico' => $venta->servicioTecnico->tecnico,
                'costo' => (float) ($venta->servicioTecnico->precio_costo ?? 0),
                'venta' => (float) ($venta->servicioTecnico->precio_venta ?? 0),
            ] : null,
            'items' => $venta->items->mapWithKeys(function ($item) {
                return [
                    $item->id => [
                        'producto' => $item->nombre_producto ?: $item->modelo ?: ($item->tipo . ' #' . $item->producto_id),
                        'cantidad' => (int) $item->cantidad,
                        'precio_venta' => (float) ($item->precio_venta ?? 0),
                        'precio_invertido' => (float) ($item->precio_invertido ?? 0),
                        'descuento' => (float) ($item->descuento ?? 0),
                        'subtotal' => (float) ($item->subtotal ?? 0),
                    ],
                ];
            })->all(),
        ];
    }

    private function formatSnapshotValue($value, ?bool $asMoney = null): string
    {
        if ($asMoney ?? is_float($value)) {
            return 'Bs ' . number_format((float) $value, 2);
        }

        if ($value === null || $value === '') {
            return 'vacío';
        }

        return (string) $value;
    }

    private function buildVentaEditChanges(array $before, array $after): array
    {
        $labels = [
            'cliente' => 'Cliente',
            'telefono' => 'Teléfono',
            'metodo_pago' => 'Método de pago',
            'tarjeta' => 'Tarjeta',
            'descuento' => 'Descuento',
            'valor_permuta' => 'Valor permuta',
            'subtotal' => 'Subtotal',
            'capital' => 'Capital',
            'ganancia' => 'Ganancia',
            'notas' => 'Notas',
        ];

        $changes = [];

        foreach ($labels as $key => $label) {
            if (($before[$key] ?? null) != ($after[$key] ?? null)) {
                $changes[] = $label . ': ' .
                    $this->formatSnapshotValue($before[$key] ?? null) .
                    ' → ' .
                    $this->formatSnapshotValue($after[$key] ?? null);
            }
        }

        foreach (($after['servicio'] ?? []) ?: [] as $key => $value) {
            if (($before['servicio'][$key] ?? null) != $value) {
                $changes[] = 'Servicio ' . $key . ': ' .
                    $this->formatSnapshotValue($before['servicio'][$key] ?? null) .
                    ' → ' .
                    $this->formatSnapshotValue($value);
            }
        }

        foreach (($after['items'] ?? []) as $id => $itemAfter) {
            $itemBefore = $before['items'][$id] ?? [];
            if (($itemBefore['producto'] ?? null) != ($itemAfter['producto'] ?? null)) {
                $changes[] = 'Producto de línea #' . $id . ': ' .
                    $this->formatSnapshotValue($itemBefore['producto'] ?? null) .
                    ' → ' .
                    $this->formatSnapshotValue($itemAfter['producto'] ?? null);
            }

            foreach (['cantidad', 'precio_venta', 'precio_invertido', 'descuento', 'subtotal'] as $key) {
                if (($itemBefore[$key] ?? null) != ($itemAfter[$key] ?? null)) {
                    $isMoney = $key !== 'cantidad';
                    $changes[] = ($itemAfter['producto'] ?? 'Item #' . $id) . ' - ' . str_replace('_', ' ', $key) . ': ' .
                        $this->formatSnapshotValue($itemBefore[$key] ?? null, $isMoney) .
                        ' → ' .
                        $this->formatSnapshotValue($itemAfter[$key] ?? null, $isMoney);
                }
            }
        }

        return $changes;
    }

    private function notifyAdminSaleEdited(Venta $venta, array $before, array $after): void
    {
        if (! Schema::hasTable('system_notifications')) {
            return;
        }

        $changes = $this->buildVentaEditChanges($before, $after);
        if (empty($changes)) {
            return;
        }

        $visibleChanges = array_slice($changes, 0, 8);
        $remainingChanges = count($changes) - count($visibleChanges);
        if ($remainingChanges > 0) {
            $visibleChanges[] = '+' . $remainingChanges . ' cambios adicionales.';
        }

        $editorName = auth()->user()->name ?? 'Usuario';
        $codigoVenta = $venta->codigo_nota ?? '#' . $venta->id;

        SystemNotification::create([
            'type' => 'sale_edit',
            'title' => 'Venta editada',
            'message' => $editorName .
                ' editó la venta ' .
                $codigoVenta .
                ".\nCliente: " .
                ($venta->nombre_cliente ?: 'Sin cliente') .
                "\nTotal actual: Bs " .
                number_format((float) ($venta->subtotal ?? $venta->precio_venta ?? 0), 2) .
                "\nCambios registrados:\n- " .
                implode("\n- ", $visibleChanges),
            'sale_id' => $venta->id,
        ]);
    }

    public function index()
    {
        $ventas = Venta::with([
            'vendedor',
            'celular',
            'computadora',
            'productoGeneral',
            'productoApple',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'items',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'items.pieza',
            'servicioTecnico', // ✅ Añade esta relación
            'reserva',
        ])
            ->when(auth()->user()->rol === 'vendedor', function ($q) {
                $q->where('user_id', auth()->id());
            })
            ->orderBy('created_at', 'desc')
            ->get();

        if (auth()->user()->rol === 'admin') {
            return Inertia::render('Admin/Ventas/Index', [
                'ventas' => $ventas,
            ]);
        }

        // El vendedor ve el precio, su descuento y lo que cobró; el costo y la ganancia no salen del
        // servidor. Se purga en profundidad: cada ítem trae su producto (venta.items.celular,
        // venta.items.pieza…) y ahí también viaja el costo si no se lo saca.
        return Inertia::render('Vendedor/Ventas/Index', [
            'ventas' => SinCostos::purgar($ventas),
        ]);
    }

    public function create()
    {
        $celulares = Celular::where('estado', 'disponible')->get();
        $computadoras = Computadora::where('estado', 'disponible')->get();
        $productosGenerales = ProductoGeneral::where('estado', 'disponible')->get();
        $productosApple = ProductoApple::where('estado', 'disponible')->get();

        $data = [
            'celulares' => $celulares,
            'computadoras' => $computadoras,
            'productosGenerales' => $productosGenerales,
            'productosApple' => $productosApple,
            'piezas' => Pieza::disponibles()->orderBy('nombre')->get(),
            'reservasActivas' => Reserva::with([
                'items',
                'items.celular',
                'items.computadora',
                'items.productoGeneral',
                'items.productoApple',
            ])
                ->where('estado', 'activa')
                ->when(auth()->user()->rol === 'vendedor', fn($q) => $q->where('user_id', auth()->id()))
                ->latest()
                ->get(),
        ];

        if (auth()->user()->rol === 'admin') {
            return Inertia::render('Admin/Ventas/Create', $data);
        }

        // El vendedor arma la venta con el precio de venta; el costo, la ganancia y la procedencia
        // no salen del servidor (el servidor recalcula el costo real al guardar).
        return Inertia::render('Vendedor/Ventas/Create', SinCostos::purgar($data));
    }

    public function store(Request $request)
    {
        if ($request->filled('reserva_id')) {
            $reservaParaValidacion = Reserva::with('items')
                ->whereKey($request->reserva_id)
                ->where('estado', 'activa')
                ->first();

            if ($reservaParaValidacion) {
                $this->authorizeReservaAccess($reservaParaValidacion);

                $request->merge([
                    'nombre_cliente' => $request->filled('nombre_cliente')
                        ? $request->nombre_cliente
                        : $reservaParaValidacion->nombre_cliente,
                    'telefono_cliente' => $request->filled('telefono_cliente')
                        ? $request->telefono_cliente
                        : $reservaParaValidacion->telefono_cliente,
                    'items' => $this->mergeSaleItemsWithReservation(
                        $request->input('items', []),
                        $reservaParaValidacion
                    ),
                ]);
            }
        }

        $request->validate([
            'nombre_cliente' => 'required|string',
            'telefono_cliente' => 'nullable|string',
            'tipo_venta' => 'required|in:producto,servicio_tecnico',
            'es_permuta' => 'boolean',
            'tipo_permuta' => 'nullable|in:celular,computadora,producto_general',
            'metodo_pago' => 'required|in:efectivo,qr,tarjeta',
            'inicio_tarjeta' => 'required_if:metodo_pago,tarjeta|nullable|digits:4',
            'fin_tarjeta' => 'required_if:metodo_pago,tarjeta|nullable|digits:4',
            'reserva_id' => 'nullable|integer|exists:reservas,id',
            'items' => 'required|array|min:1',
            'items.*.tipo' => 'required|in:celular,computadora,producto_general,producto_apple,pieza',
            'items.*.producto_id' => 'required|integer',
            'items.*.cantidad' => 'required|integer|min:1',
            'items.*.descuento' => 'nullable|numeric|min:0',
            'equipo' => 'required_if:tipo_venta,servicio_tecnico|string',
            'detalle_servicio' => 'required_if:tipo_venta,servicio_tecnico|string',
            'tecnico' => 'required_if:tipo_venta,servicio_tecnico|string',
        ]);

        return DB::transaction(function () use ($request) {

            $permutaCosto = 0;
            $entregado = null;
            $reserva = null;
            $montoReservaAplicado = 0;

            if ($request->filled('reserva_id')) {
                $reserva = Reserva::with('items')
                    ->whereKey($request->reserva_id)
                    ->where('estado', 'activa')
                    ->lockForUpdate()
                    ->first();

                if (! $reserva) {
                    throw ValidationException::withMessages([
                        'reserva_id' => 'La reserva seleccionada ya no está activa.',
                    ]);
                }

                $this->authorizeReservaAccess($reserva);
                $montoReservaAplicado = (float) $reserva->monto_reserva;
                $request->merge([
                    'items' => $this->mergeSaleItemsWithReservation(
                        $request->input('items', []),
                        $reserva
                    ),
                ]);
            }

            /* ======================================================
         * 1) PERMUTA (MISMAS VALIDACIONES COMPLETAS)
         * ====================================================== */
            if ($request->es_permuta && $request->has('producto_entregado')) {
                $permutaData = $request->producto_entregado;

                switch ($request->tipo_permuta) {
                    case 'celular':
                        $request->validate([
                            'producto_entregado.modelo' => 'required|string',
                            'producto_entregado.capacidad' => 'required|string',
                            'producto_entregado.color' => 'required|string',
                            'producto_entregado.bateria' => 'required|string',
                            'producto_entregado.imei_1' => 'required|string|max:15|unique:celulares,imei_1',
                            'producto_entregado.imei_2' => 'nullable|string|max:15|unique:celulares,imei_2',
                            'producto_entregado.procedencia' => 'required|string',
                            'producto_entregado.estado_imei' => 'required|string',
                            'producto_entregado.precio_costo' => 'required|numeric',
                            'producto_entregado.precio_venta' => 'required|numeric',
                        ]);

                        $entregado = Celular::create(array_merge($permutaData, ['estado' => 'permuta']));
                        $entregado->refresh();
                        $permutaCosto = floatval($entregado->precio_costo);
                        break;

                    case 'computadora':
                        $request->validate([
                            'producto_entregado.nombre' => 'required|string',
                            'producto_entregado.procesador' => 'nullable|string',
                            'producto_entregado.numero_serie' => 'required|string|unique:computadoras,numero_serie',
                            'producto_entregado.bateria' => 'required|string',
                            'producto_entregado.ram' => 'required|string',
                            'producto_entregado.almacenamiento' => 'required|string',
                            'producto_entregado.color' => 'required|string',
                            'producto_entregado.procedencia' => 'required|string',
                            'producto_entregado.precio_costo' => 'required|numeric',
                            'producto_entregado.precio_venta' => 'required|numeric',
                        ]);

                        $entregado = Computadora::create(array_merge($permutaData, ['estado' => 'permuta']));
                        $entregado->refresh();
                        $permutaCosto = floatval($entregado->precio_costo);
                        break;

                    case 'producto_general':
                        $request->validate([
                            'producto_entregado.tipo' => 'required|string',
                            'producto_entregado.nombre' => 'required|string',
                            'producto_entregado.codigo' => 'required|string|unique:producto_generals,codigo',
                            'producto_entregado.procedencia' => 'required|string',
                            'producto_entregado.precio_costo' => 'required|numeric',
                            'producto_entregado.precio_venta' => 'required|numeric',
                        ]);

                        $entregado = ProductoGeneral::create(array_merge($permutaData, ['estado' => 'permuta']));
                        $entregado->refresh();
                        $permutaCosto = floatval($entregado->precio_costo);
                        break;
                }
            }

            /* ======================================================
         * 2) CÁLCULOS (IGUAL QUE TU CÓDIGO)
         * ====================================================== */
            $subtotal = 0;
            $ganancia = 0;
            $aplicaPermuta = false;
            $itemsValidados = $this->buildValidatedSaleItems($request->items, $reserva);
            $precioInvertidoTotal = 0;

            foreach ($itemsValidados as $item) {
                $subtotal += $item['subtotal'];
                $ganancia += ($item['subtotal'] - $item['precio_invertido']);
                $precioInvertidoTotal += $item['precio_invertido'];

                if (in_array($item['tipo'], ['celular', 'computadora'])) {
                    $aplicaPermuta = true;
                }
            }

            if ($reserva) {
                $vendidos = collect($itemsValidados)
                    ->mapWithKeys(fn($item) => [$item['tipo'] . ':' . $item['producto_id'] => true]);

                $faltanteReservado = $reserva->items->contains(function ($item) use ($vendidos) {
                    return ! $vendidos->has($item->tipo . ':' . $item->producto_id);
                });

                if ($faltanteReservado) {
                    throw ValidationException::withMessages([
                        'reserva_id' => 'Para fusionar la reserva, la venta debe incluir los productos reservados.',
                    ]);
                }
            }

            /* ======================================================
         * 3) CÓDIGO CORRELATIVO VENTA (AT-V###)
         * ====================================================== */
            $venta = GeneradorCodigos::crearVentaConCodigo(function (string $codigoVenta) use ($request, $subtotal, $aplicaPermuta, $permutaCosto, $entregado, $precioInvertidoTotal, $reserva, $montoReservaAplicado) {
                return Venta::create([
                    'codigo_nota' => $codigoVenta,
                    'reserva_id' => $reserva?->id,

                    'nombre_cliente' => $request->nombre_cliente,
                    'telefono_cliente' => $request->telefono_cliente,
                    'tipo_venta' => $request->tipo_venta,
                    'es_permuta' => $request->es_permuta,
                    'tipo_permuta' => $request->tipo_permuta,
                    'precio_invertido' => $precioInvertidoTotal,
                    'precio_venta' => $subtotal,
                    'descuento' => $request->descuento ?? 0,
                    'subtotal' => $subtotal,
                    'ganancia_neta' => $subtotal
                        - ($request->descuento ?? 0)
                        - ($aplicaPermuta ? $permutaCosto : 0)
                        - $precioInvertidoTotal,
                    'valor_permuta' => $permutaCosto,
                    'monto_reserva_aplicado' => $montoReservaAplicado,
                    'metodo_pago' => $request->metodo_pago,
                    'inicio_tarjeta' => $request->metodo_pago === 'tarjeta' ? $request->inicio_tarjeta : null,
                    'fin_tarjeta' => $request->metodo_pago === 'tarjeta' ? $request->fin_tarjeta : null,
                    'notas_adicionales' => $request->notas_adicionales,
                    'celular_id' => $request->celular_id,
                    'computadora_id' => $request->computadora_id,
                    'producto_general_id' => $request->producto_general_id,
                    'entregado_celular_id' => $request->tipo_permuta === 'celular' ? $entregado?->id : null,
                    'entregado_computadora_id' => $request->tipo_permuta === 'computadora' ? $entregado?->id : null,
                    'entregado_producto_general_id' => $request->tipo_permuta === 'producto_general' ? $entregado?->id : null,
                    'user_id' => auth()->id(),
                    'fecha' => now('America/La_Paz'),
                ]);
            });
            $codigoVenta = $venta->codigo_nota;
            /* ======================================================
 * 5) CREAR ITEMS (CON SNAPSHOT BI PROFESIONAL)
 * ====================================================== */
            foreach ($itemsValidados as $item) {

                $this->createVentaItemFromValidated($venta, $item);
            }


            /* ======================================================
         * 6) CAMBIAR ESTADO A VENDIDO (INCLUYE APPLE)
         * ====================================================== */
            foreach ($itemsValidados as $item) {
                // La pieza no se marca «vendida»: baja su saldo y queda el renglón en su historial.
                if ($this->esPorCantidad($item['tipo'])) {
                    StockDePiezas::descontar(
                        $item['producto'],
                        $item['cantidad'],
                        MovimientoPieza::VENTA,
                        $venta,
                        'Venta ' . $venta->codigo_nota,
                    );

                    continue;
                }

                $item['producto']->estado = 'vendido';
                $item['producto']->save();
            }

            if ($reserva) {
                $reserva->update([
                    'estado' => 'vendida',
                    'venta_id' => $venta->id,
                ]);
            }

            /* ======================================================
         * 7) SERVICIO TÉCNICO (USANDO GENERADOR AT-ST###)
         * ====================================================== */
            if ($request->tipo_venta === 'servicio_tecnico') {
                // Igual que en Servicio técnico: el vendedor registra lo que cobra y el administrador carga el costo
                $sinCosto = \App\Support\SinCostos::aplica(auth()->user());
                $servicioDeLaVenta = null;

                GeneradorCodigos::crearServicioTecnicoConCodigo(function (string $codigoServicio) use ($request, $venta, $sinCosto, &$servicioDeLaVenta) {
                    $servicioDeLaVenta = ServicioTecnico::create([
                        'venta_id' => $venta->id,
                        'codigo_nota' => $codigoServicio,
                        'cliente' => $request->nombre_cliente,
                        'telefono' => $request->telefono_cliente,
                        'equipo' => $request->equipo,
                        'detalle_servicio' => $sinCosto
                            ? \App\Support\SinCostos::detalleDeServicio($request->detalle_servicio)
                            : $request->detalle_servicio,
                        'precio_costo' => $sinCosto ? 0 : ($request->precio_invertido ?? 0),
                        'precio_venta' => $request->precio_venta ?? 0,
                        'costo_pendiente' => $sinCosto,
                        'costo_cargado_por' => $sinCosto ? null : auth()->id(),
                        'costo_cargado_en' => $sinCosto ? null : now(),
                        'tecnico' => $request->tecnico,
                        'fecha' => now('America/La_Paz'),
                        'user_id' => auth()->id(),
                    ]);
                });

                if ($sinCosto && $servicioDeLaVenta) {
                    $servicioDeLaVenta->load('vendedor')->avisarCostoPendiente();
                }
            }

            /* ======================================================
         * 8) CREAR CLIENTE SI NO EXISTE (MISMA LÓGICA)
         * ====================================================== */
            if ($venta->telefono_cliente) {
                $clienteExistente = Cliente::where('telefono', $venta->telefono_cliente)->first();

                if (!$clienteExistente) {
                    Cliente::create([
                        'user_id' => $venta->user_id,
                        'nombre' => Str::title(trim($venta->nombre_cliente)),
                        'telefono' => $venta->telefono_cliente,
                        'correo' => null,
                        'documento' => null,
                    ]);
                }
            }

            if (Schema::hasTable('system_notifications')) {
                SystemNotification::create([
                    'type' => 'sale',
                    'title' => 'Nueva venta registrada',
                    'message' =>
                    auth()->user()->name .
                        ' vendió por Bs ' .
                        number_format($subtotal, 2) .
                        ' (' . $codigoVenta . ')',
                ]);
            }

            return response()->json([
                'message' => 'Venta registrada con éxito',
                'venta_id' => $venta->id,
            ]);
        });
    }

    public function edit(Venta $venta)
    {
        $this->authorizeVentaAccess($venta);

        $venta->load([
            'vendedor',
            'items',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'items.pieza',
            'servicioTecnico',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'reserva',
        ]);

        $inventarioEdicion = [
            'celulares' => $this->productsForSaleEdit($venta, 'celular'),
            'computadoras' => $this->productsForSaleEdit($venta, 'computadora'),
            'productosGenerales' => $this->productsForSaleEdit($venta, 'producto_general'),
            'productosApple' => $this->productsForSaleEdit($venta, 'producto_apple'),
            'piezas' => $this->productsForSaleEdit($venta, 'pieza'),
        ];

        if (auth()->user()->rol === 'admin') {
            return Inertia::render('Admin/Ventas/Edit', [
                'venta' => $venta,
                'productosGenerales' => $inventarioEdicion['productosGenerales'],
                'inventarioEdicion' => $inventarioEdicion,
            ]);
        }

        // Al vendedor no le viaja el costo ni la ganancia de la venta ni del inventario a editar.
        return Inertia::render('Vendedor/Ventas/Edit', SinCostos::purgar([
            'venta' => $venta,
            'productosGenerales' => $inventarioEdicion['productosGenerales'],
            'inventarioEdicion' => $inventarioEdicion,
        ]));
    }

    public function update(Request $request, Venta $venta)
    {
        $this->authorizeVentaAccess($venta);

        $request->validate([
            'nombre_cliente' => 'required|string|max:255',
            'telefono_cliente' => 'nullable|string|max:255',
            'metodo_pago' => 'required|in:efectivo,qr,tarjeta',
            'inicio_tarjeta' => 'required_if:metodo_pago,tarjeta|nullable|digits:4',
            'fin_tarjeta' => 'required_if:metodo_pago,tarjeta|nullable|digits:4',
            'notas_adicionales' => 'nullable|string',
            'descuento' => 'nullable|numeric|min:0',
            'valor_permuta' => 'nullable|numeric|min:0',
            'items' => 'nullable|array',
            'items.*.id' => 'nullable|integer|exists:ventas_items,id',
            'items.*.tipo' => 'nullable|in:celular,computadora,producto_general,producto_apple,pieza',
            'items.*.producto_id' => 'nullable|integer',
            'items.*.cantidad' => 'required|integer|min:1',
            'items.*.precio_venta' => 'nullable|numeric|min:0',
            'items.*.precio_invertido' => 'nullable|numeric|min:0',
            'items.*.descuento' => 'required|numeric|min:0',
            'servicio_tecnico.equipo' => 'nullable|string|max:255',
            'servicio_tecnico.detalle_servicio' => 'nullable|string',
            'servicio_tecnico.tecnico' => 'nullable|string|max:255',
            'servicio_tecnico.precio_costo' => 'nullable|numeric|min:0',
            'servicio_tecnico.precio_venta' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $venta) {
            $venta->load(['items', 'servicioTecnico']);
            $beforeEdit = $this->ventaEditSnapshot($venta);

            if ($venta->tipo_venta === 'servicio_tecnico' && $venta->servicioTecnico) {
                $servicioData = $request->input('servicio_tecnico', []);
                $precioVenta = (float) ($servicioData['precio_venta'] ?? $venta->servicioTecnico->precio_venta ?? 0);
                $precioCosto = (float) ($servicioData['precio_costo'] ?? $venta->servicioTecnico->precio_costo ?? 0);
                $descuento = (float) ($request->descuento ?? 0);
                $subtotal = max(0, $precioVenta - $descuento);

                $venta->servicioTecnico->update([
                    'cliente' => $request->nombre_cliente,
                    'telefono' => $request->telefono_cliente,
                    'equipo' => $servicioData['equipo'] ?? $venta->servicioTecnico->equipo,
                    'detalle_servicio' => $servicioData['detalle_servicio'] ?? $venta->servicioTecnico->detalle_servicio,
                    'tecnico' => $servicioData['tecnico'] ?? $venta->servicioTecnico->tecnico,
                    'precio_costo' => $precioCosto,
                    'precio_venta' => $precioVenta,
                    'notas_adicionales' => $request->notas_adicionales,
                ]);

                $venta->update([
                    'nombre_cliente' => $request->nombre_cliente,
                    'telefono_cliente' => $request->telefono_cliente,
                    'metodo_pago' => $request->metodo_pago,
                    'inicio_tarjeta' => $request->metodo_pago === 'tarjeta' ? $request->inicio_tarjeta : null,
                    'fin_tarjeta' => $request->metodo_pago === 'tarjeta' ? $request->fin_tarjeta : null,
                    'notas_adicionales' => $request->notas_adicionales,
                    'precio_venta' => $precioVenta,
                    'precio_invertido' => $precioCosto,
                    'descuento' => $descuento,
                    'subtotal' => $subtotal,
                    'ganancia_neta' => $subtotal - $precioCosto,
                    'valor_permuta' => 0,
                ]);

                $venta->refresh()->load(['items', 'servicioTecnico']);
                $this->notifyAdminSaleEdited(
                    $venta,
                    $beforeEdit,
                    $this->ventaEditSnapshot($venta)
                );

                return redirect()
                    ->route(auth()->user()->rol === 'admin' ? 'admin.ventas.index' : 'vendedor.ventas.index')
                    ->with('success', 'Venta actualizada correctamente.');
            }

            $itemsPayload = collect($request->input('items', []));
            if ($itemsPayload->isEmpty()) {
                return back()->withErrors(['items' => 'La venta debe tener al menos un producto.']);
            }

            $itemsPorId = $venta->items->keyBy('id');
            $subtotal = 0;
            $capitalTotal = 0;
            $selectedProducts = [];

            foreach ($itemsPayload as $index => $itemData) {
                $item = ! empty($itemData['id'])
                    ? $itemsPorId->get((int) $itemData['id'])
                    : null;

                if (! empty($itemData['id']) && ! $item) {
                    abort(422, 'Uno de los items no pertenece a esta venta.');
                }

                $requestedTipo = (string) ($itemData['tipo'] ?? $item?->tipo ?? '');
                $requestedProductId = (int) ($itemData['producto_id'] ?? $item?->producto_id ?? 0);

                if ($requestedTipo === '' || $requestedProductId <= 0) {
                    throw ValidationException::withMessages([
                        "items.$index.producto_id" => 'Selecciona un producto válido para esta línea.',
                    ]);
                }

                $selectedKey = $requestedTipo . ':' . $requestedProductId;
                if (isset($selectedProducts[$selectedKey])) {
                    throw ValidationException::withMessages([
                        "items.$index.producto_id" => 'Este producto ya está en otra línea de la misma venta.',
                    ]);
                }
                $selectedProducts[$selectedKey] = true;

                if (! $item) {
                    $validatedItem = $this->buildValidatedSaleItems([$itemData])[0];
                    $this->createVentaItemFromValidated($venta, $validatedItem);

                    if ($this->esPorCantidad($validatedItem['tipo'])) {
                        StockDePiezas::descontar(
                            $validatedItem['producto'],
                            $validatedItem['cantidad'],
                            MovimientoPieza::VENTA,
                            $venta,
                            'Se agregó a la venta ' . $venta->codigo_nota,
                        );
                    } else {
                        $validatedItem['producto']->estado = 'vendido';
                        $validatedItem['producto']->save();
                    }

                    $subtotal += $validatedItem['subtotal'];
                    $capitalTotal += $validatedItem['precio_invertido'];
                    continue;
                }

                $cantidad = (int) $itemData['cantidad'];
                $precioVenta = (float) $itemData['precio_venta'];
                $precioInvertido = (float) $itemData['precio_invertido'];
                $descuentoItem = (float) $itemData['descuento'];

                if ($precioVenta <= 0) {
                    throw ValidationException::withMessages([
                        "items.$index.precio_venta" => 'El precio de venta debe ser mayor a cero.',
                    ]);
                }

                if ($cantidad > 1 && in_array($requestedTipo, ['celular', 'computadora', 'producto_apple'], true)) {
                    throw ValidationException::withMessages([
                        "items.$index.cantidad" => 'Celulares, computadoras y productos Apple se editan de a una unidad por línea.',
                    ]);
                }

                if ($descuentoItem > $precioVenta) {
                    throw ValidationException::withMessages([
                        "items.$index.descuento" => 'El descuento no puede ser mayor al precio de venta.',
                    ]);
                }

                $subtotalItem = max(0, ($precioVenta - $descuentoItem) * $cantidad);
                [$producto, $sameProduct] = $this->getProductForSaleItemEdit(
                    $requestedTipo,
                    $requestedProductId,
                    $index,
                    $item
                );

                if ($this->esPorCantidad($requestedTipo)) {
                    // El costo de una pieza lo pone el inventario, no el navegador: así la utilidad
                    // de la venta editada sigue saliendo de lo que de verdad costó el repuesto.
                    $precioInvertido = round((float) $producto->precio_costo * $cantidad, 2);
                    $this->ajustarStockDePieza($item, $producto, $cantidad, $venta, $sameProduct);
                } elseif (! $sameProduct) {
                    $this->releasePreviousSaleItemProduct($item, $venta);
                    $producto->estado = 'vendido';
                    $producto->save();
                }

                $item->update(array_merge([
                    'tipo' => $requestedTipo,
                    'producto_id' => $requestedProductId,
                    'cantidad' => $cantidad,
                    'precio_venta' => $precioVenta,
                    'precio_invertido' => $precioInvertido,
                    'descuento' => $descuentoItem,
                    'subtotal' => $subtotalItem,
                ], $this->snapshotForSaleItem($requestedTipo, $producto)));

                $subtotal += $subtotalItem;
                $capitalTotal += $precioInvertido;
            }

            $descuentoVenta = (float) ($request->descuento ?? 0);
            $valorPermuta = $venta->es_permuta ? (float) ($request->valor_permuta ?? 0) : 0;

            $venta->update([
                'nombre_cliente' => $request->nombre_cliente,
                'telefono_cliente' => $request->telefono_cliente,
                'metodo_pago' => $request->metodo_pago,
                'inicio_tarjeta' => $request->metodo_pago === 'tarjeta' ? $request->inicio_tarjeta : null,
                'fin_tarjeta' => $request->metodo_pago === 'tarjeta' ? $request->fin_tarjeta : null,
                'notas_adicionales' => $request->notas_adicionales,
                'descuento' => $descuentoVenta,
                'valor_permuta' => $valorPermuta,
                'subtotal' => $subtotal,
                'precio_venta' => $subtotal,
                'precio_invertido' => $capitalTotal,
                'ganancia_neta' => $subtotal - $descuentoVenta - $valorPermuta - $capitalTotal,
            ]);

            if ($venta->telefono_cliente) {
                Cliente::updateOrCreate(
                    ['telefono' => $venta->telefono_cliente],
                    [
                        'user_id' => $venta->user_id,
                        'nombre' => Str::title(trim($venta->nombre_cliente)),
                        'correo' => null,
                        'documento' => null,
                    ]
                );
            }

            $venta->refresh()->load(['items', 'servicioTecnico']);
            $this->notifyAdminSaleEdited(
                $venta,
                $beforeEdit,
                $this->ventaEditSnapshot($venta)
            );

            return redirect()
                ->route(auth()->user()->rol === 'admin' ? 'admin.ventas.index' : 'vendedor.ventas.index')
                ->with('success', 'Venta actualizada correctamente.');
        });
    }

    public function boleta(Venta $venta)
    {
        $this->authorizeVentaAccess($venta);

        $venta->load([
            'items',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'items.pieza',
            'vendedor',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'reserva',
        ]);

        $sumaSubtotalItems = $venta->items->sum('subtotal');
        $valorPermuta = $venta->valor_permuta ?? 0;
        $montoReserva = $venta->monto_reserva_aplicado ?? 0;
        $totalAPagar = $sumaSubtotalItems - $valorPermuta - $montoReserva;

        return PDF::loadView('pdf.boleta', compact('venta', 'sumaSubtotalItems', 'valorPermuta', 'montoReserva', 'totalAPagar'))
            ->stream("boleta-venta-{$venta->id}.pdf");
    }


    public function exportarVentasVendedor(Request $request)
    {
        $fechaInicio = $request->input('fecha_inicio') ?? now()->startOfMonth()->toDateString();
        $fechaFin = $request->input('fecha_fin') ?? now()->endOfMonth()->toDateString();

        $ventas = Venta::with([
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'items.pieza',
            'vendedor'
        ])
            ->where('user_id', auth()->id())
            ->whereBetween('fecha', [$fechaInicio, $fechaFin])
            ->orderBy('fecha', 'desc')
            ->get();

        $pdf = PDF::loadView('pdf.ventas_vendedor', [
            'ventas' => $ventas,
            'vendedor' => auth()->user(),
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin,
            // El pie sale de Configuración y de Ubicaciones, no de la plantilla
            'tienda' => \App\Models\ConfiguracionNegocio::paraPdf(),
        ]);

        return $pdf->stream("ventas-vendedor.pdf");
    }

    public function buscarNota(Request $request)
    {
        try {
            $query = trim($request->input('codigo_nota'));

            if ($query === '') {
                return response()->json([]);
            }

            // Buscar servicios técnicos válidos
            $serviciosRaw = \App\Models\ServicioTecnico::with('vendedor')
                ->whereNotNull('codigo_nota')
                ->when(auth()->user()->rol === 'vendedor', fn($q) => $q->where('user_id', auth()->id()))
                ->where(function ($q) use ($query) {
                    $q->whereRaw('LOWER(codigo_nota) LIKE ?', [Busqueda::contiene($query)])
                        ->orWhereRaw('LOWER(cliente) LIKE ?', [Busqueda::contiene($query)]);
                })
                ->get();

            // Obtener códigos ya usados en servicio técnico
            $codigosST = $serviciosRaw->pluck('codigo_nota')->unique()->toArray();

            // Buscar ventas válidas que no estén repetidas
            $ventasRaw = \App\Models\Venta::with('vendedor')
                ->whereNotNull('codigo_nota')
                ->whereNotIn('codigo_nota', $codigosST)
                ->when(auth()->user()->rol === 'vendedor', fn($q) => $q->where('user_id', auth()->id()))
                ->where(function ($q) use ($query) {
                    $q->whereRaw('LOWER(codigo_nota) LIKE ?', [Busqueda::contiene($query)])
                        ->orWhereRaw('LOWER(nombre_cliente) LIKE ?', [Busqueda::contiene($query)]);
                })
                ->get();

            // Mapear servicios técnicos
            $servicios = $serviciosRaw->map(function ($s) {
                return [
                    'id' => 'st-' . $s->id,
                    'id_real' => $s->id, // 👈 nuevo
                    'codigo_nota' => $s->codigo_nota,
                    'nombre_cliente' => $s->cliente,
                    'tipo' => 'servicio_tecnico',
                    'tipo_venta' => 'servicio_tecnico',
                    'created_at' => $s->created_at,
                    'vendedor' => $s->vendedor?->name ?? null,
                ];
            });

            // Mapear ventas
            $ventas = $ventasRaw->map(function ($v) {
                return [
                    'id' => 'v-' . $v->id,
                    'id_real' => $v->id, // 👈 nuevo
                    'codigo_nota' => $v->codigo_nota,
                    'nombre_cliente' => $v->nombre_cliente,
                    'tipo' => 'venta',
                    'tipo_venta' => 'producto',
                    'created_at' => $v->created_at,
                    'vendedor' => $v->vendedor?->name ?? null,
                ];
            });
            // Unir y retornar correctamente
            return response()->json(
                $servicios->concat($ventas)->sortByDesc('created_at')->values()
            );
        } catch (\Throwable $e) {
            \Log::error('❌ Error en buscarNota: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Error interno al buscar nota.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function buscarSoloVentas(Request $request)
    {
        $query = trim($request->input('codigo_nota'));

        if ($query === '') {
            return response()->json([]);
        }

        $ventas = \App\Models\Venta::select('id', 'codigo_nota', 'nombre_cliente', 'created_at')
            ->whereNotNull('codigo_nota')
            ->when(auth()->user()->rol === 'vendedor', fn($q) => $q->where('user_id', auth()->id()))
            ->where(function ($q) use ($query) {
                $q->whereRaw('LOWER(codigo_nota) LIKE ?', [Busqueda::contiene($query)])
                    ->orWhereRaw('LOWER(nombre_cliente) LIKE ?', [Busqueda::contiene($query)]);
            })
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($v) {
                return [
                    'id' => $v->id,
                    'codigo_nota' => $v->codigo_nota,
                    'nombre_cliente' => $v->nombre_cliente,
                    'tipo' => 'venta',
                    'created_at' => $v->created_at,
                ];
            });

        return response()->json($ventas);
    }

    public function boleta80(Venta $venta)
    {
        $this->authorizeVentaAccess($venta);

        $venta->load([
            'items',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'items.pieza',
            'vendedor',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'reserva',
        ]);

        $sumaSubtotalItems = $venta->items->sum('subtotal');
        $valorPermuta = $venta->valor_permuta ?? 0;
        $montoReserva = $venta->monto_reserva_aplicado ?? 0;
        $totalAPagar = $sumaSubtotalItems - $valorPermuta - $montoReserva;

        $pdf = Pdf::loadView('pdf.boleta_80mm', [
            'venta' => $venta,
            'sumaSubtotalItems' => $sumaSubtotalItems,
            'valorPermuta' => $valorPermuta,
            'montoReserva' => $montoReserva,
            'totalAPagar' => $totalAPagar,
        ]);

        /**
         * 📏 FORMATO TÉRMICO 80mm (PRODUCCIÓN)
         * - 226.77 pt = 80mm
         * - 1200 pt = alto suficiente (NO infinito)
         * DomPDF corta automáticamente donde termina el contenido
         */
        $pdf->setPaper([0, 0, 226.77, 650], 'portrait');

        return $pdf->stream("boleta-80mm-{$venta->id}.pdf");
    }
}
