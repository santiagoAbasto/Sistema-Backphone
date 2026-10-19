<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un renglón del historial de un producto general. Mismos tipos y etiquetas que el de las piezas:
 * los dos saldos se mueven con `App\Services\StockPorCantidad`.
 */
class MovimientoProductoGeneral extends MovimientoPieza
{
    protected $table = 'movimientos_producto_general';

    protected $fillable = [
        'producto_general_id',
        'sucursal_id',
        'tipo',
        'cantidad',
        'saldo',
        'motivo',
        'referencia_tipo',
        'referencia_id',
        'user_id',
    ];

    public function productoGeneral(): BelongsTo
    {
        return $this->belongsTo(ProductoGeneral::class);
    }
}
