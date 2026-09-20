<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Inventario que viaja de una sucursal a la otra.
 *
 * No lleva el filtro de sucursal: un traspaso pertenece a las dos a la vez, y esconderlo de una
 * de ellas sería esconder la mitad de la historia. Se consulta con `deSucursal()`.
 */
class Traspaso extends Model
{
    protected $table = 'traspasos';

    public const EN_TRANSITO = 'en_transito';
    public const RECIBIDO    = 'recibido';
    public const CANCELADO   = 'cancelado';

    /** El estado en que queda un equipo mientras viaja: fuera de la venta en las dos sucursales. */
    public const ESTADO_EQUIPO_EN_VIAJE = 'en_transito';

    /** Qué se puede mover, y de dónde sale cada cosa. */
    public const TIPOS = [
        'celular'          => ['modelo' => Celular::class,         'label' => 'Celulares'],
        'computadora'      => ['modelo' => Computadora::class,     'label' => 'Computadoras'],
        'producto_apple'   => ['modelo' => ProductoApple::class,   'label' => 'Equipos de marca'],
        'producto_general' => ['modelo' => ProductoGeneral::class, 'label' => 'Accesorios y generales'],
        'pieza'            => ['modelo' => Pieza::class,           'label' => 'Piezas y repuestos'],
    ];

    /** Las piezas se mueven por cantidad; el resto es una unidad por registro. */
    public const POR_CANTIDAD = ['pieza'];

    protected $fillable = [
        'codigo',
        'origen_sucursal_id',
        'destino_sucursal_id',
        'estado',
        'nota',
        'enviado_por',
        'enviado_en',
        'recibido_por',
        'recibido_en',
    ];

    protected $casts = [
        'enviado_en'  => 'datetime',
        'recibido_en' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(TraspasoItem::class);
    }

    public function origen(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'origen_sucursal_id');
    }

    public function destino(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'destino_sucursal_id');
    }

    public function quienEnvio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'enviado_por');
    }

    public function quienRecibio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recibido_por');
    }

    /** Los traspasos que le tocan a una sucursal: los que manda y los que espera. `null` = todos. */
    public function scopeDeSucursal(Builder $consulta, ?int $sucursalId): Builder
    {
        if ($sucursalId === null) {
            return $consulta;
        }

        return $consulta->where(fn ($q) => $q
            ->where('origen_sucursal_id', $sucursalId)
            ->orWhere('destino_sucursal_id', $sucursalId));
    }

    public function scopeEnTransito(Builder $consulta): Builder
    {
        return $consulta->where('estado', self::EN_TRANSITO);
    }

    public function estaEnTransito(): bool
    {
        return $this->estado === self::EN_TRANSITO;
    }
}
