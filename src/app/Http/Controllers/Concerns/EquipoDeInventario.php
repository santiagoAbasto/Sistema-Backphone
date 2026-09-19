<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ReservaItem;
use App\Models\Venta;
use App\Models\VentaItem;
use App\Support\CondicionInventario;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Lo común de los equipos de inventario (celulares, computadoras…): historial de ventas,
 * permutas y reservas, protección al eliminar y condición en lote.
 *
 * El controlador indica en inventario() el tipo ("celular"), la columna de la venta ("celular_id")
 * y la del equipo recibido en permuta ("entregado_celular_id"). Si ventas no tiene columna propia
 * para el tipo (productos Apple), "venta" va en null y solo se usan los ítems de venta.
 */
trait EquipoDeInventario
{
    /** @return array{tipo: string, venta: ?string, permuta: string} */
    abstract protected function inventario(): array;

    /** Equipos que figuran en ventas, permutas o reservas. */
    protected function idsConHistorial(): array
    {
        ['tipo' => $tipo, 'venta' => $venta, 'permuta' => $permuta] = $this->inventario();

        return VentaItem::where('tipo', $tipo)->pluck('producto_id')
            ->merge(ReservaItem::where('tipo', $tipo)->pluck('producto_id'))
            ->merge($venta ? Venta::whereNotNull($venta)->pluck($venta) : [])
            ->merge(Venta::whereNotNull($permuta)->pluck($permuta))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    /** Por qué no se puede eliminar (null si se puede). */
    protected function motivoBloqueo(Model $equipo): ?string
    {
        ['tipo' => $tipo, 'venta' => $venta, 'permuta' => $permuta] = $this->inventario();
        $id = $equipo->getKey();

        $enVentas = VentaItem::where('tipo', $tipo)->where('producto_id', $id)->exists()
            || Venta::where(fn ($q) => $venta ? $q->where($venta, $id)->orWhere($permuta, $id) : $q->where($permuta, $id))->exists();
        if ($enVentas) {
            return 'Figura en una venta y se conserva para no perder el historial.';
        }

        if (ReservaItem::where('tipo', $tipo)->where('producto_id', $id)->exists()) {
            return 'Figura en una reserva y se conserva para no perder el historial.';
        }

        return null;
    }

    /** Ventas, permutas y reservas en las que figura el equipo (lo más reciente primero). */
    protected function historialDe(Model $equipo): array
    {
        ['tipo' => $tipo, 'venta' => $venta, 'permuta' => $permuta] = $this->inventario();
        $id = $equipo->getKey();
        $movimientos = collect();

        VentaItem::where('tipo', $tipo)->where('producto_id', $id)
            ->with('venta:id,codigo_nota,fecha,nombre_cliente,user_id,created_at', 'venta.vendedor:id,name')
            ->get()
            ->each(function ($item) use ($movimientos) {
                if ($item->venta) {
                    $movimientos->push($this->movimientoVenta($item->venta, 'venta', 'Venta', (float) $item->subtotal));
                }
            });

        ($venta ? Venta::where($venta, $id)->with('vendedor:id,name')->get() : collect())
            ->each(fn ($v) => $movimientos->push($this->movimientoVenta($v, 'venta', 'Venta', (float) $v->subtotal)));

        Venta::where($permuta, $id)->with('vendedor:id,name')->get()
            ->each(fn ($v) => $movimientos->push($this->movimientoVenta($v, 'permuta', 'Ingresó en permuta', (float) $v->valor_permuta)));

        ReservaItem::where('tipo', $tipo)->where('producto_id', $id)
            ->with('reserva:id,codigo_nota,estado,nombre_cliente,created_at')
            ->get()
            ->each(function ($item) use ($movimientos) {
                $r = $item->reserva;
                if (! $r) {
                    return;
                }
                $movimientos->push([
                    'tipo'    => 'reserva',
                    'titulo'  => 'Reserva',
                    'codigo'  => $r->codigo_nota,
                    'fecha'   => optional($r->created_at)->toDateString(),
                    'orden'   => optional($r->created_at)->timestamp ?? 0,
                    'detalle' => collect([$r->nombre_cliente, $r->estado ? 'Reserva ' . mb_strtolower($r->estado) : null])->filter()->implode(' · '),
                    'monto'   => (float) $item->subtotal,
                    'url'     => route('admin.reservas.boleta', $r->id),
                    'externo' => true,
                ]);
            });

        return $movimientos
            ->unique(fn ($m) => $m['tipo'] . ':' . $m['codigo'])
            ->sortByDesc('orden')
            ->map(fn ($m) => collect($m)->except('orden')->all())
            ->values()
            ->all();
    }

    private function movimientoVenta(Venta $venta, string $tipo, string $titulo, float $monto): array
    {
        $fecha = $venta->fecha ? Carbon::parse($venta->fecha) : $venta->created_at;

        return [
            'tipo'    => $tipo,
            'titulo'  => $titulo,
            'codigo'  => $venta->codigo_nota,
            'fecha'   => optional($fecha)->toDateString(),
            'orden'   => optional($fecha)->timestamp ?? 0,
            'detalle' => collect([$venta->nombre_cliente, $venta->vendedor?->name ? 'Vendedor: ' . $venta->vendedor->name : null])->filter()->implode(' · '),
            'monto'   => $monto,
            'url'     => route('admin.ventas.edit', $venta->id),
            'externo' => false,
        ];
    }

    /** Solo vuelve a páginas del propio sistema. */
    protected function destinoSeguro(mixed $url, string $porDefecto): string
    {
        if (! is_string($url) || $url === '' || str_contains($url, '\\')) {
            return $porDefecto;
        }

        if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            return $url;
        }

        return str_starts_with($url, rtrim(url('/'), '/') . '/') ? $url : $porDefecto;
    }

    /**
     * Marca varios equipos como Nuevo o Seminuevo de una vez.
     * Textos: 'un' o 'una', el nombre en singular y en plural ("celular" / "celulares").
     */
    protected function marcarCondicion(Request $request, string $clase, string $articulo, string $singular, string $plural): RedirectResponse
    {
        $datos = $request->validate([
            'ids'       => 'required|array|min:1|max:500',
            'ids.*'     => 'integer|distinct',
            'condicion' => CondicionInventario::regla(),
        ], CondicionInventario::MENSAJES + ['ids.required' => "Elige al menos {$articulo} {$singular}."]);

        $equipos = $clase::whereIn('id', $datos['ids'])->get();
        $equipos->each(fn ($equipo) => $equipo->update(['condicion' => $datos['condicion']]));

        $n = $equipos->count();

        return back()->with('success', "Listo: {$n} " . ($n === 1 ? "{$singular} quedó" : "{$plural} quedaron") . " como {$datos['condicion']}.");
    }
}
