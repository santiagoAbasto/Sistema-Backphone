<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un renglón del remito: qué se mandó y cuánto.
 *
 * Guarda el nombre y el detalle del producto tal como estaban al enviarlo. El remito es el papel
 * que las dos sucursales comparan cuando el paquete llega, así que no puede cambiar porque
 * alguien corrigió una ficha en el medio.
 */
class TraspasoItem extends Model
{
    protected $table = 'traspaso_items';

    protected $fillable = [
        'traspaso_id',
        'tipo',
        'producto_id',
        'cantidad',
        'nombre',
        'detalle',
    ];

    protected $casts = [
        'cantidad' => 'integer',
    ];

    public function traspaso(): BelongsTo
    {
        return $this->belongsTo(Traspaso::class);
    }

    /** El producto al que apunta, sin el filtro de sucursal: mientras viaja todavía es del origen. */
    public function producto(): ?Model
    {
        $modelo = Traspaso::TIPOS[$this->tipo]['modelo'] ?? null;

        return $modelo ? $modelo::withoutGlobalScope('sucursal')->find($this->producto_id) : null;
    }
}
