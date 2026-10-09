<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * La caja de una sucursal en un día: se abre con lo que hay en el cajón y se cierra contando.
 *
 * Al cerrar quedan guardados el desglose y lo esperado (ver EfectivoDeCaja): el cierre es lo que
 * se firmó ese día, y no cambia aunque después se corrija una venta.
 */
class Caja extends Model
{
    use DeSucursal;

    protected $fillable = [
        'sucursal_id', 'fecha', 'monto_apertura', 'abierta_por', 'abierta_en',
    ];

    protected $casts = [
        'fecha'              => 'date:Y-m-d',
        'monto_apertura'     => 'decimal:2',
        'efectivo_ventas'    => 'decimal:2',
        'efectivo_servicios' => 'decimal:2',
        'efectivo_reservas'  => 'decimal:2',
        'egresos'            => 'decimal:2',
        'esperado'           => 'decimal:2',
        'monto_contado'      => 'decimal:2',
        'diferencia'         => 'decimal:2',
        'abierta_en'         => 'datetime',
        'cerrada_en'         => 'datetime',
    ];

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    public function quienAbrio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'abierta_por');
    }

    public function quienCerro(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrada_por');
    }

    public function scopeAbiertas(Builder $consulta): Builder
    {
        return $consulta->whereNull('cerrada_en');
    }

    public function estaAbierta(): bool
    {
        return $this->cerrada_en === null;
    }
}
