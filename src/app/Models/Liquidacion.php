<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Lo que se le pagó a un técnico por una semana.
 *
 * Guarda el cálculo entero y no solo el monto. Si dentro de un mes alguien corrige el costo de
 * un repuesto de esa semana, el número del reporte cambia pero lo que ya se pagó no: la
 * liquidación es la foto de lo que las dos partes acordaron ese día.
 */
class Liquidacion extends Model
{
    protected $table = 'liquidaciones';

    protected $fillable = [
        'tecnico_id',
        'sucursal_id',
        'semana_inicio',
        'semana_fin',
        'servicios',
        'cobrado',
        'repuestos',
        'ganancia',
        'porcentaje',
        'monto',
        'pagada_por',
    ];

    protected $casts = [
        'semana_inicio' => 'date',
        'semana_fin'    => 'date',
        'servicios'     => 'integer',
        'cobrado'       => 'decimal:2',
        'repuestos'     => 'decimal:2',
        'ganancia'      => 'decimal:2',
        'porcentaje'    => 'integer',
        'monto'         => 'decimal:2',
    ];

    public function tecnico(): BelongsTo
    {
        return $this->belongsTo(Tecnico::class);
    }

    public function quienPago(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pagada_por');
    }
}
