<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Una pieza o repuesto del taller: pantallas, baterías, pines de carga, tornillos.
 *
 * A diferencia del resto del inventario, acá no hay un registro por unidad sino un saldo:
 * «pantalla iPhone 11, quedan 6». El saldo nunca se toca a mano desde fuera del modelo;
 * lo mueve `App\Services\StockDePiezas`, que además deja anotado cada movimiento.
 */
class Pieza extends Model
{
    use HasFactory, DeSucursal;

    protected $table = 'piezas';

    protected $fillable = [
        'sucursal_id',
        'nombre',
        'cantidad',
        'precio_costo',
        'precio_venta',
        'codigo',
        'categoria',
        'compatibilidad',
        'origen',
        'minimo',
        'notas',
        'activa',
    ];

    protected $casts = [
        'cantidad'     => 'integer',
        'minimo'       => 'integer',
        'precio_costo' => 'decimal:2',
        'precio_venta' => 'decimal:2',
        'activa'       => 'boolean',
    ];

    protected $attributes = [
        'cantidad' => 0,
        'minimo'   => 0,
        'activa'   => true,
    ];

    /** El código se guarda en mayúsculas, y vacío es no tener código (no una cadena vacía). */
    public function setCodigoAttribute($valor): void
    {
        $limpio = mb_strtoupper(trim((string) $valor));
        $this->attributes['codigo'] = $limpio === '' ? null : $limpio;
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(MovimientoPieza::class)->latest('id');
    }

    /** Las que se pueden ofrecer hoy: activas y con saldo. */
    public function scopeDisponibles(Builder $consulta): Builder
    {
        return $consulta->where('activa', true)->where('cantidad', '>', 0);
    }

    public function scopeActivas(Builder $consulta): Builder
    {
        return $consulta->where('activa', true);
    }

    /** Se acabó. */
    public function getAgotadaAttribute(): bool
    {
        return $this->cantidad <= 0;
    }

    /** Queda poco: el mínimo está puesto y el saldo ya lo alcanzó. */
    public function getPorAgotarseAttribute(): bool
    {
        return $this->minimo > 0 && $this->cantidad > 0 && $this->cantidad <= $this->minimo;
    }

    /** Cómo se nombra la pieza en una nota de venta o en el detalle de un servicio. */
    public function etiqueta(): string
    {
        return trim($this->nombre . ($this->compatibilidad ? ' · ' . $this->compatibilidad : ''));
    }
}
