<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\ProductoApple;
use App\Models\ProductoGeneral;
use App\Models\ReservaItem;
use App\Support\SinCostos;
use Illuminate\Http\Request;

/**
 * Stock disponible para las pantallas de venta, reserva y cotización.
 *
 * Al vendedor no le viajan ni el precio de costo ni la procedencia: son datos del administrador.
 * No hacen falta para vender, porque el costo real de cada venta lo vuelve a calcular el servidor
 * desde el producto (VentaController::buildValidatedSaleItems).
 */
class StockController extends Controller
{
    /** La lista tal cual, o sin los datos del administrador si no es él quien pregunta. */
    private function lista($consulta)
    {
        $items = $consulta->get();

        return response()->json(
            SinCostos::aplica(request()->user()) ? SinCostos::deColeccion($items) : $items
        );
    }

    private function idsReservados(string $tipo)
    {
        return ReservaItem::where('tipo', $tipo)
            ->whereHas('reserva', fn ($q) => $q->where('estado', 'activa'))
            ->pluck('producto_id');
    }

    public function celulares()
    {
        return $this->lista(Celular::where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('celular')));
    }

    public function computadoras()
    {
        return $this->lista(Computadora::where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('computadora')));
    }

    public function productosGenerales()
    {
        return $this->lista(ProductoGeneral::where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('producto_general')));
    }

    public function productosApple()
    {
        return $this->lista(ProductoApple::where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('producto_apple')));
    }

    /**
     * Buscar un producto disponible en stock por código / serie / IMEI.
     * Soporta búsqueda en celulares, computadoras, productos Apple y generales.
     */
    public function buscarPorCodigo(Request $request)
    {
        $codigo = trim((string) $request->input('codigo'));

        if ($codigo === '') {
            return response()->json(['error' => 'Código no proporcionado.'], 400);
        }

        // Buscar en productos Apple (IMEI 1, IMEI 2, número de serie o modelo exacto)
        $apple = ProductoApple::where(function ($q) use ($codigo) {
            $q->where('imei_1', $codigo)
                ->orWhere('imei_2', $codigo)
                ->orWhere('numero_serie', $codigo)
                ->orWhere('modelo', $codigo);
        })
            ->where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('producto_apple'))
            ->first();

        if ($apple) {
            return response()->json([
                'tipo' => 'producto_apple',
                'producto' => [
                    'id' => $apple->id,
                    'nombre' => $apple->modelo,
                    'precio_venta' => $apple->precio_venta,
                    'precio_costo' => SinCostos::aplica(request()->user()) ? null : $apple->precio_costo,
                    'stock' => 1,
                    'estado' => $apple->estado,
                    'condicion' => $apple->condicion,
                ],
            ]);
        }

        // Buscar en celulares (IMEI 1 o 2)
        $celular = Celular::where(function ($q) use ($codigo) {
            $q->where('imei_1', $codigo)
                ->orWhere('imei_2', $codigo);
        })
            ->where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('celular'))
            ->first();

        if ($celular) {
            return response()->json([
                'tipo' => 'celular',
                'producto' => [
                    'id' => $celular->id,
                    'nombre' => $celular->modelo,
                    'precio_venta' => $celular->precio_venta,
                    'precio_costo' => SinCostos::aplica(request()->user()) ? null : $celular->precio_costo,
                    'stock' => 1,
                    'estado' => $celular->estado,
                    'condicion' => $celular->condicion,
                ],
            ]);
        }

        // Buscar en computadoras (número de serie o nombre exacto)
        $computadora = Computadora::where(function ($q) use ($codigo) {
            $q->where('numero_serie', $codigo)
                ->orWhere('nombre', $codigo);
        })
            ->where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('computadora'))
            ->first();

        if ($computadora) {
            return response()->json([
                'tipo' => 'computadora',
                'producto' => [
                    'id' => $computadora->id,
                    'nombre' => $computadora->nombre,
                    'precio_venta' => $computadora->precio_venta,
                    'precio_costo' => SinCostos::aplica(request()->user()) ? null : $computadora->precio_costo,
                    'stock' => 1,
                    'estado' => $computadora->estado,
                    'condicion' => $computadora->condicion,
                ],
            ]);
        }

        // Buscar en productos generales (código o nombre exacto)
        $pg = ProductoGeneral::where(function ($q) use ($codigo) {
            $q->where('codigo', $codigo)
                ->orWhere('nombre', $codigo);
        })
            ->where('estado', 'disponible')
            ->whereNotIn('id', $this->idsReservados('producto_general'))
            ->first();

        if ($pg) {
            return response()->json([
                'tipo' => 'producto_general',
                'producto' => [
                    'id' => $pg->id,
                    'nombre' => $pg->nombre,
                    'precio_venta' => $pg->precio_venta,
                    'precio_costo' => SinCostos::aplica(request()->user()) ? null : $pg->precio_costo,
                    'stock' => $pg->stock,
                    'estado' => $pg->estado,
                    'condicion' => $pg->condicion,
                ],
            ]);
        }

        return response()->json(['error' => 'Producto no encontrado.'], 404);
    }
}
